#!/usr/bin/env node
// check_skills.mjs: checks every skill against the Agent Skills format and this repo's rules.
//
//   node scripts/check_skills.mjs
//   npm run check:skills
//
// Node 18 or newer, no packages. Exit code 0 when every skill passes, 1 on any failure.
//
// Per skill folder under skills/:
// - SKILL.md exists, with YAML frontmatter between --- lines
// - only the spec's frontmatter fields: name, description, license, compatibility, metadata
// - no allowed-tools, and no !`...` command that runs when the skill loads
// - name: 1 to 64 characters, lowercase letters, digits and single hyphens, the same as the folder,
//   and starting with "harmony-"
// - description: 1 to 1,024 characters (agents and claude.ai refuse longer ones); a warning past 950
// - compatibility: at most 500 characters
// - license present
// - SKILL.md under 500 lines
// - every relative link in SKILL.md and references/*.md points at a file that exists
// For the repo:
// - .claude-plugin/marketplace.json lists every skill folder, and nothing else
// - README.md's skills table has a row for every skill folder

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));   // handles spaces and drive letters
const SKILLS = join(ROOT, "skills");
const FIELDS = ["name", "description", "license", "compatibility", "metadata", "allowed-tools"];
const DESCRIPTION_MAX = 1024;
const DESCRIPTION_WARN = 950;

const failures = [];
const warnings = [];

// A top-level field's value, joining folded (>) and literal (|) blocks onto one line.
function field(front, key) {
	const lines = front.split("\n");
	const at = lines.findIndex((line) => line.startsWith(key + ":"));
	if (at < 0) {
		return null;
	}
	let value = lines[at].slice(key.length + 1).trim();
	if (/^[>|][-+]?$/.test(value)) {
		const block = [];
		for (let i = at + 1; i < lines.length && /^\s+\S/.test(lines[i]); i++) {
			block.push(lines[i].trim());
		}
		value = block.join(" ");
	}
	return value.replace(/^(["'])(.*)\1$/, "$2");
}

function checkLinks(skill, file) {
	// Links only, not code that happens to look like one (MIGRATIONS[v](out)).
	const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
	for (const m of text.matchAll(/\]\(([^)\s#]+)(#[^)]*)?\)/g)) {
		const target = m[1];
		if (/^[a-z]+:/i.test(target)) {
			continue;                                  // http:, https:, mailto:
		}
		if (!existsSync(resolve(dirname(file), target))) {
			failures.push(skill + ": " + file.slice(ROOT.length).replace(/\\/g, "/") + " links to " + target + ", which doesn't exist");
		}
	}
}

const folders = readdirSync(SKILLS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

for (const skill of folders) {
	const file = join(SKILLS, skill, "SKILL.md");
	if (!existsSync(file)) {
		failures.push(skill + ": no SKILL.md");
		continue;
	}
	const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
	const front = (text.match(/^---\n([\s\S]*?)\n---\n/) || [])[1];
	if (front === undefined) {
		failures.push(skill + ": SKILL.md has no frontmatter between --- lines");
		continue;
	}
	for (const key of front.split("\n").map((line) => (line.match(/^([\w-]+):/) || [])[1]).filter(Boolean)) {
		if (!FIELDS.includes(key)) {
			failures.push(skill + ": frontmatter field \"" + key + "\" isn't in the Agent Skills spec");
		}
	}
	// Unquoted values are YAML plain scalars: ": " or " #" inside one breaks the frontmatter, and
	// agents then read no description at all.
	for (const line of front.split("\n")) {
		const m = line.match(/^([\w-]+):\s+(.+)$/);
		if (m && !/^["'>|]/.test(m[2]) && (/: |\s#/.test(m[2]) || /^[[{&*!%@`]/.test(m[2]))) {
			failures.push(skill + ": the " + m[1] + " value has \": \" or \" #\" in it, which breaks YAML; reword it or quote the value");
		}
	}
	// Skills here never grant themselves tools or run commands when they load: a developer installs
	// them into their own agent, and the eval runner relies on it.
	if (/^allowed-tools:/m.test(front)) {
		failures.push(skill + ": declares allowed-tools; skills here leave tool permissions to the developer");
	}
	if (/!`[^`\n]+`/.test(text)) {
		failures.push(skill + ": SKILL.md has !`...`, which runs a command when the skill loads");
	}
	const name = field(front, "name") ?? "";
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) {
		failures.push(skill + ": name \"" + name + "\" must be 1 to 64 lowercase letters, digits and single hyphens");
	}
	if (name !== skill) {
		failures.push(skill + ": name \"" + name + "\" differs from its folder");
	}
	if (!name.startsWith("harmony-")) {
		failures.push(skill + ": name should start with \"harmony-\" (see CONTRIBUTING.md)");
	}
	const description = field(front, "description") ?? "";
	if (!description) {
		failures.push(skill + ": no description");
	} else if (description.length > DESCRIPTION_MAX) {
		failures.push(skill + ": description is " + description.length + " characters; the limit is " + DESCRIPTION_MAX);
	} else if (description.length > DESCRIPTION_WARN) {
		warnings.push(skill + ": description is " + description.length + " characters, close to the " + DESCRIPTION_MAX + " limit");
	}
	const compatibility = field(front, "compatibility");
	if (compatibility !== null && compatibility.length > 500) {
		failures.push(skill + ": compatibility is " + compatibility.length + " characters; the limit is 500");
	}
	if (!field(front, "license")) {
		failures.push(skill + ": no license field");
	}
	const lines = text.split("\n").length;
	if (lines > 500) {
		failures.push(skill + ": SKILL.md is " + lines + " lines; keep it under 500 and move detail into references/");
	}
	checkLinks(skill, file);
	const refs = join(SKILLS, skill, "references");
	if (existsSync(refs)) {
		for (const ref of readdirSync(refs).filter((f) => f.endsWith(".md"))) {
			checkLinks(skill, join(refs, ref));
		}
	}
	console.log(String(description.length).padStart(5) + "  " + skill);
}

const marketplace = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "marketplace.json"), "utf8"));
const listed = marketplace.plugins.flatMap((p) => p.skills ?? []).map((s) => s.replace(/^\.\/skills\//, ""));
for (const skill of folders) {
	if (!listed.includes(skill)) {
		failures.push("marketplace.json doesn't list skills/" + skill);
	}
}
for (const skill of listed) {
	if (!folders.includes(skill)) {
		failures.push("marketplace.json lists skills/" + skill + ", which doesn't exist");
	}
}
const readme = readFileSync(join(ROOT, "README.md"), "utf8");
for (const skill of folders) {
	if (!readme.includes("](skills/" + skill + "/SKILL.md)")) {
		failures.push("README.md's skills table has no row for " + skill);
	}
}

console.log("");
for (const warning of warnings) {
	console.log("WARN  " + warning);
}
for (const failure of failures) {
	console.log("FAIL  " + failure);
}
console.log(failures.length ? failures.length + (failures.length === 1 ? " problem." : " problems.") : folders.length + " skills pass.");
process.exit(failures.length ? 1 : 0);
