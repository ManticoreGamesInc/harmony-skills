#!/usr/bin/env node
// run_evals.mjs: runs the cases in evals/ with `claude -p`, for when `claude plugin eval` isn't
// available. Each case runs in a fresh temporary folder with this repo loaded as a plugin, and is
// scored with its graders.
//
//   node scripts/run_evals.mjs [--tag trigger|behavior] [name filter] [--runs N] [--jobs N] [--allow-shell]
//   npm run eval:triggers
//   npm run eval:behavior
//
// Needs the `claude` CLI, signed in. Every case is a real agent session, so it costs usage.
//
// Cases, prompts and skills can come from someone else's pull request, so the runner decides what
// an agent may do, not the case:
// - Agents run with --restricted and --strict-mcp-config: no shell, no web, no MCP servers, no
//   settings files, and file tools confined to the run's own temporary folder.
// - The plugin is a fresh copy of skills/ only, so a pull request can't add hooks, MCP servers,
//   agents or commands to it. A skill that declares allowed-tools or runs a command on load
//   (!`...`) stops the run.
// - A case may ask only for Read, Glob, Grep, Skill, Write and Edit. A case that asks for Bash is
//   skipped unless you pass --allow-shell, after reading that case and the skills it uses.
// - Nothing from a case runs as a script: the runner copies examples/orb-dash itself.
// The runner itself (scripts/, package.json) is code you run: review changes to it like any code.
//
// Supported case files (the `claude plugin eval` format):
// - prompt.md: frontmatter (tags, allowed_tools, max_turns, timeout_seconds) and the prompt
// - case.yaml: only context.scaffold_script, a Bash script run in the empty folder first
// - graders/*.md: tool_used, regex (target last_message, trace, or { source: file, path }),
//   file_exists, and llm (judged once by a small model)
//
// Skills installed in your own Claude setup don't load, so they don't compete with these.

import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { EXAMPLE, FILES, fixtureScript } from "./build_eval_fixtures.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));   // handles spaces and drive letters
const EVALS = join(ROOT, "evals");

const args = process.argv.slice(2);
const valueOf = (name, fallback) => {
	const at = args.indexOf(name);
	return at >= 0 ? args[at + 1] : fallback;
};
const runs = Number(valueOf("--runs", 1));
const jobs = Number(valueOf("--jobs", 3));
const tag = valueOf("--tag", "");
const allowShell = args.includes("--allow-shell");

// The tools a case may ask for. Anything else stops the run; Bash needs --allow-shell.
const SAFE_TOOLS = ["Read", "Glob", "Grep", "Skill", "Write", "Edit"];
const SHELL_TOOLS = ["Bash"];

// Flags every agent run gets: no shell or web tools unless named, no settings files, no MCP
// servers, file tools confined to the working folders.
const LOCKDOWN = ["--restricted", "--strict-mcp-config", "--no-session-persistence"];
const filter = args.find((a, i) => !a.startsWith("--") && !["--runs", "--jobs", "--tag"].includes(args[i - 1])) ?? "";

function frontmatter(text) {
	const m = text.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!m) {
		return { meta: {}, body: text.trim(), raw: "" };
	}
	const meta = {};
	let parent = null;
	for (const line of m[1].split("\n")) {
		const nested = line.match(/^\s+([\w-]+):\s*(.*)$/);
		const kv = line.match(/^([\w-]+):\s*(.*)$/);
		if (nested && parent) {
			meta[parent][nested[1]] = parseValue(nested[2]);
			continue;
		}
		if (!kv) {
			continue;
		}
		if (kv[2].trim() === "") {
			parent = kv[1];
			meta[parent] = {};
			continue;
		}
		parent = null;
		meta[kv[1]] = parseValue(kv[2]);
	}
	return { meta, body: m[2].trim(), raw: m[1] };
}

function parseValue(raw) {
	const value = raw.trim();
	if (/^\[.*\]$/.test(value)) {
		return value.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
	}
	if (/^'.*'$/.test(value) || /^".*"$/.test(value)) {
		return value.slice(1, -1);
	}
	if (/^-?\d+(\.\d+)?$/.test(value)) {
		return Number(value);
	}
	if (value === "true" || value === "false") {
		return value === "true";
	}
	return value;
}

function loadCases() {
	return readdirSync(EVALS, { withFileTypes: true })
		.filter((e) => e.isDirectory() && e.name !== "results" && e.name.includes(filter))
		.filter((e) => existsSync(join(EVALS, e.name, "prompt.md")))
		.map((e) => {
			const dir = join(EVALS, e.name);
			const prompt = frontmatter(readFileSync(join(dir, "prompt.md"), "utf8"));
			const caseFile = join(dir, "case.yaml");
			const scaffold = existsSync(caseFile) ? (readFileSync(caseFile, "utf8").match(/scaffold_script:\s*(\S+)/) || [])[1] : null;
			const gradersDir = join(dir, "graders");
			const graders = existsSync(gradersDir)
				? readdirSync(gradersDir).map((f) => {
					const parsed = frontmatter(readFileSync(join(gradersDir, f), "utf8"));
					return { file: f, ...parsed.meta, criteria: parsed.meta.criteria ?? parsed.body };
				})
				: [];
			return { name: e.name, dir, prompt, scaffold, graders };
		})
		.filter((c) => !tag || (c.prompt.meta.tags ?? []).includes(tag));
}

function listFiles(dir) {
	const out = [];
	const walk = (d) => {
		for (const entry of readdirSync(d, { withFileTypes: true })) {
			if (entry.name === "node_modules" || entry.name === ".git") {
				continue;
			}
			const full = join(d, entry.name);
			entry.isDirectory() ? walk(full) : out.push(relative(dir, full).split(sep).join("/"));
		}
	};
	walk(dir);
	return out;
}

function globToRegExp(glob) {
	// Turn each glob token into regex in one pass, so one expansion can't be rewritten by another.
	const pattern = glob.replace(/\*\*\/|\*\*|\*|\?|[.+^${}()|[\]\\]/g, (token) => {
		if (token === "**/") {
			return "(?:.*/)?";
		}
		if (token === "**") {
			return ".*";
		}
		if (token === "*") {
			return "[^/]*";
		}
		if (token === "?") {
			return "[^/]";
		}
		return "\\" + token;
	});
	return new RegExp("^" + pattern + "$");
}

// Copies skills/ into a fresh plugin folder, refusing anything a skill could use to get more
// than the run allows.
function preparePlugin() {
	const dir = mkdtempSync(join(tmpdir(), "harmony-eval-plugin-"));
	const source = join(ROOT, "skills");
	const problems = [];
	const walk = (d) => {
		for (const entry of readdirSync(d, { withFileTypes: true })) {
			const full = join(d, entry.name);
			if (lstatSync(full).isSymbolicLink()) {
				problems.push(relative(ROOT, full) + " is a link");
			} else if (entry.isDirectory()) {
				walk(full);
			} else if (entry.name === "SKILL.md") {
				const text = readFileSync(full, "utf8");
				if (/^allowed-tools\s*:/m.test(frontmatter(text).raw)) {
					problems.push(relative(ROOT, full) + " declares allowed-tools");
				}
				if (/!`[^`]+`/.test(text)) {
					problems.push(relative(ROOT, full) + " runs a command when it loads (!`...`)");
				}
			}
		}
	};
	walk(source);
	if (problems.length) {
		console.error("Not running: " + problems.join("; "));
		process.exit(2);
	}
	cpSync(source, join(dir, "skills"), { recursive: true });
	mkdirSync(join(dir, ".claude-plugin"));
	writeFileSync(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "harmony", description: "harmony-skills under test" }));
	return dir;
}

// The tools a case gets, or why it can't run.
function toolsFor(c) {
	const asked = c.prompt.meta.allowed_tools ?? ["Read", "Glob", "Grep", "Skill"];
	const unknown = asked.filter((t) => !SAFE_TOOLS.includes(t) && !SHELL_TOOLS.includes(t));
	if (unknown.length) {
		return { error: "asks for tools the runner doesn't allow: " + unknown.join(", ") };
	}
	if (asked.some((t) => SHELL_TOOLS.includes(t)) && !allowShell) {
		return { skip: "needs a shell; read the case, then run with --allow-shell" };
	}
	return { tools: asked };
}

// Sets up the case's folder. The only fixture is the generated Orb Dash one, copied with fs.
function setUp(c, cwd) {
	if (!c.scaffold) {
		return "";
	}
	const script = join(c.dir, c.scaffold);
	if (!existsSync(script) || readFileSync(script, "utf8").replace(/\r\n/g, "\n") !== fixtureScript()) {
		return c.scaffold + " isn't the generated Orb Dash fixture; run npm run eval:fixtures, or review it";
	}
	for (const file of FILES) {
		mkdirSync(join(cwd, file, ".."), { recursive: true });
		cpSync(join(EXAMPLE, file), join(cwd, file));
	}
	return "";
}

function runClaude(c, plugin, tools) {
	return new Promise((resolve) => {
		const cwd = mkdtempSync(join(tmpdir(), "harmony-eval-"));
		const setupError = setUp(c, cwd);
		if (setupError) {
			resolve({ error: setupError });
			return;
		}
		const before = new Set(listFiles(cwd).map((f) => f + ":" + statSync(join(cwd, f)).mtimeMs));
		const meta = c.prompt.meta;
		const child = spawn("claude", [
			"-p", c.prompt.body,
			"--plugin-dir", plugin,
			"--add-dir", plugin,
			"--output-format", "stream-json",
			"--verbose",
			"--max-turns", String(meta.max_turns ?? 10),
			"--tools", tools.join(","),
			"--allowedTools", tools.join(","),
			"--setting-sources", "project",
			...LOCKDOWN,
		], { cwd });
		let out = "";
		child.on("error", (error) => {
			resolve({ error: "couldn't start claude (" + error.message + "); is the claude CLI on your PATH?" });
		});
		const timer = setTimeout(() => child.kill(), (meta.timeout_seconds ?? 300) * 1000);
		child.stdout.on("data", (d) => { out += d; });
		child.stderr.on("data", () => {});
		child.stdin.end();
		child.on("close", () => {
			clearTimeout(timer);
			const tools = [];
			const trace = [];
			let lastMessage = "";
			let error = "";
			for (const line of out.split("\n")) {
				let event;
				try {
					event = JSON.parse(line);
				} catch {
					continue;
				}
				// Only what the agent itself said and did: tool results (files it read, skill text)
				// would let a grader match text the agent never wrote.
				if (event.type === "assistant") {
					trace.push(JSON.stringify(event.message));
				}
				if (event.type === "result") {
					lastMessage = String(event.result ?? "");
					// Running out of turns is fine; sign-in failures stop the run.
					if (/authenticate|log ?in|oauth|api key/i.test(lastMessage) && lastMessage.length < 200) {
						error = lastMessage;
					}
				}
				if (event.type === "assistant" && Array.isArray(event.message?.content)) {
					for (const part of event.message.content) {
						if (part.type === "tool_use") {
							tools.push({ name: part.name, input: part.input ?? {} });
						}
					}
				}
			}
			const created = listFiles(cwd).filter((f) => !before.has(f + ":" + statSync(join(cwd, f)).mtimeMs));
			resolve({ cwd, tools, trace: trace.join("\n"), lastMessage, created, error });
		});
	});
}

// The contents the agent wrote with Write and Edit, for the judge to read.
function codeWritten(run) {
	return run.tools
		.filter((t) => t.name === "Write" || t.name === "Edit")
		.map((t) => "--- " + (t.input.file_path ?? "") + "\n" + (t.input.content ?? t.input.new_string ?? ""))
		.join("\n");
}

function judge(criteria, run) {
	const prompt = "You are grading an AI agent's work. Criteria:\n" + criteria +
		"\n\nThe agent's final reply:\n" + run.lastMessage.slice(0, 6000) +
		"\n\nFiles it created or changed: " + run.created.join(", ") +
		"\n\nCode it wrote (excerpts):\n" + codeWritten(run).slice(0, 12000) +
		"\n\nAnswer with exactly PASS or FAIL on the first line, then one sentence why.";
	// The judge reads text the agent wrote, so it gets no tools at all and its own empty folder.
	const cwd = mkdtempSync(join(tmpdir(), "harmony-eval-judge-"));
	const result = spawnSync("claude", ["-p", prompt, "--model", "haiku", "--max-turns", "1", "--tools", "", "--setting-sources", "project", ...LOCKDOWN], { cwd, encoding: "utf8", input: "" });
	const verdict = (result.stdout ?? "").trim();
	run.verdicts.push(verdict);
	return /^\s*PASS/i.test(verdict);
}

function grade(g, run) {
	if (g.type === "tool_used") {
		const re = new RegExp(g.input_match ?? ".");
		const count = run.tools.filter((t) => t.name === g.tool && re.test(JSON.stringify(t.input))).length;
		return count >= (g.min ?? 1) && count <= (g.max ?? Infinity);
	}
	if (g.type === "regex") {
		let text = run.lastMessage;
		if (g.target === "trace") {
			text = run.trace;
		} else if (g.target === "files") {
			text = run.created.join("\n");
		} else if (g.target && typeof g.target === "object" && g.target.source === "file") {
			const path = join(run.cwd, g.target.path);
			text = existsSync(path) ? readFileSync(path, "utf8") : "";
		}
		const re = new RegExp(g.pattern, g.flags ?? "");
		const found = re.test(text);
		return g.match === "not_contains" ? !found : found;
	}
	if (g.type === "file_exists") {
		const re = globToRegExp(g.path);
		const any = run.created.some((f) => re.test(f));
		return g.exists === false ? !any : any;
	}
	if (g.type === "llm") {
		return judge(g.criteria, run);
	}
	return true;
}

async function main() {
	const cases = loadCases();
	if (!cases.length) {
		console.error("No cases match.");
		process.exit(2);
	}
	const plugin = preparePlugin();
	const allowed = new Map();
	for (const c of cases) {
		const t = toolsFor(c);
		if (t.error) {
			console.error("Not running: " + c.name + " " + t.error);
			process.exit(2);
		}
		allowed.set(c.name, t);
	}
	const skipped = cases.filter((c) => allowed.get(c.name).skip);
	const queue = cases.filter((c) => !allowed.get(c.name).skip).flatMap((c) => Array.from({ length: runs }, () => c));
	const results = new Map(cases.map((c) => [c.name, []]));
	async function worker() {
		while (queue.length) {
			const c = queue.shift();
			const run = await runClaude(c, plugin, allowed.get(c.name).tools);
			if (run.error) {
				console.error("\n" + c.name + ": " + run.error);
				if (/authenticate|log ?in|oauth|api key/i.test(run.error)) {
					console.error("Sign the claude CLI in, then run again.");
					process.exit(2);
				}
				results.get(c.name).push({ pass: false, failed: ["(" + run.error + ")"], loaded: "" });
				continue;
			}
			run.verdicts = [];
			const failed = c.graders.filter((g) => !grade(g, run)).map((g) => g.file.replace(/\.md$/, ""));
			// Keep what happened next to the run's files, for reading a failure later.
			writeFileSync(join(run.cwd, "_eval_run.json"), JSON.stringify({ case: c.name, failed, lastMessage: run.lastMessage, judge: run.verdicts, created: run.created }, null, 2));
			const loaded = run.tools.filter((t) => t.name === "Skill").map((t) => t.input.skill).join(", ") || "(none)";
			results.get(c.name).push({ pass: failed.length === 0, failed, loaded, dir: join(run.cwd, "_eval_run.json") });
			process.stdout.write(".");
		}
	}
	await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, worker));
	console.log("\n");
	let passed = 0;
	for (const c of skipped) {
		console.log("SKIP  " + c.name.padEnd(30) + allowed.get(c.name).skip);
	}
	const ran = cases.filter((c) => !allowed.get(c.name).skip);
	for (const c of ran) {
		const r = results.get(c.name);
		const ok = r.filter((x) => x.pass).length;
		passed += ok === r.length ? 1 : 0;
		const failed = [...new Set(r.flatMap((x) => x.failed))];
		console.log((ok === r.length ? "PASS  " : "FAIL  ") + c.name.padEnd(30) + ok + "/" + r.length +
			"   loaded: " + [...new Set(r.map((x) => x.loaded))].join(" | ") +
			(failed.length ? "   failed: " + failed.join(", ") + "   (details: " + r.filter((x) => !x.pass).map((x) => x.dir).join(", ") + ")" : ""));
	}
	console.log("\n" + passed + " of " + ran.length + " cases passed" + (skipped.length ? ", " + skipped.length + " skipped." : "."));
	process.exit(passed === ran.length ? 0 : 1);
}

main();
