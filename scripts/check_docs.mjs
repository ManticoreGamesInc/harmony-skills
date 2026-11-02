#!/usr/bin/env node
// check_docs.mjs: checks that every skill names only what the Harmony SDK docs (sdk.md) document.
//
//   node scripts/check_docs.mjs [sdk.md path or URL]
//   npm run check:docs -- [sdk.md path or URL]
//
// Without an argument it reads HARMONY_SDK_MD, then https://playharmony.ai/developers/sdk.md.
// Node 18 or newer, no packages. Exit code 0 when every skill passes, 1 on any failure, 2 when
// sdk.md can't be read or parsed.
//
// From sdk.md it takes:
// - the documented calls, from headings such as ### `harmony.auth.getSession(): ...`
// - the documented exports and types, from those headings' signatures
// - the attach options, from the "- `name` (" list under ### `attach(
// - which handle calls take no arguments, from signatures such as harmony.open(): void
// - the package name, from its `npm install` line
//
// In every file under skills/ it fails on:
// - a call on the Harmony handle that sdk.md doesn't document (harmony.auth.notDocumented(), ...)
// - a name imported from the SDK package that sdk.md doesn't document
// - an attach option, in code or in an options table, that sdk.md doesn't document
// - an argument passed to a handle call sdk.md documents with none (harmony.open("friends"))
// - a retired SDK name that sdk.md no longer documents (attachGameServices, pictureUrl, ...)
// - an `npm install` of a different Harmony package name

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));   // handles spaces and drive letters
const SKILLS = join(ROOT, "skills");
const DEFAULT_SOURCE = "https://playharmony.ai/developers/sdk.md";
// JavaScript in any form, including Unity .jslib and .jspre plugins, plus C# and GDScript, whose
// bridges hold JavaScript in strings.
const SCANNED = /\.(md|mjs|js|ts|tsx|jsx|json|jslib|jspre|cs|gd)$/i;

// Receivers the skills use for the handle attach resolves to.
const HANDLE = "(?:harmony|handle|services|gameServices)";
const SERVICES = "(?:auth|friends|files|chat)";
// Any scoped npm package with "harmony" in its scope or name, so a skill that names a package
// other than the one sdk.md installs is caught.
const HARMONY_PACKAGE = "@(?:[\\w-]*harmony[\\w-]*\\/[\\w-]+|[\\w-]+\\/[\\w-]*harmony[\\w-]*)";
// Names earlier SDK versions had. Each fails when sdk.md doesn't mention it, so a skill can't keep
// using one after the docs drop it.
const RETIRED = ["attachGameServices", "ManticoreHarmony", "pictureUrl", "joinUrl", "loadFakeGameServices"];
// An attach call: attach({ ... }) from the package, or PlayHarmony.attach({ ... }) from a script tag.
const ATTACH_CALL = /(?:\bPlayHarmony\??\.|(?<![\w.]))attach\s*\(\s*\{/g;

async function readSource(source) {
	if (/^https?:\/\//.test(source)) {
		const response = await fetch(source);
		if (!response.ok) {
			throw new Error(source + " answered " + response.status);
		}
		return await response.text();
	}
	return readFileSync(source, "utf8");
}

function parseDocs(text) {
	const calls = new Set();
	const noArgs = new Set();
	const exports = new Set();
	for (const match of text.matchAll(/^#{2,4}\s+`([^`]+)`/gm)) {
		const signature = match[1];
		const call = signature.match(/^harmony\.([\w.]+)\s*\((\s*\))?/);
		if (call) {
			calls.add(call[1]);
			if (call[2]) {
				noArgs.add(call[1]);
			}
		} else {
			const fn = signature.match(/^(\w+)\s*\(/);
			if (fn) {
				exports.add(fn[1]);
			}
		}
		for (const type of signature.matchAll(/\b([A-Z]\w+)\b/g)) {
			if (!["Promise", "HTMLElement", "Record", "Array", "Blob", "ArrayBuffer"].includes(type[1])) {
				exports.add(type[1]);
			}
		}
	}
	if (!calls.size) {
		throw new Error("no ### `harmony.<call>(` headings");
	}
	// Names sdk.md's own examples import from the package, such as loadFakeGameServices from its
	// testing entry, count as documented too.
	for (const m of text.matchAll(new RegExp("import\\s*\\{([^}]*)\\}\\s*from\\s*[\"']" + HARMONY_PACKAGE + "[^\"']*[\"']", "g"))) {
		for (const raw of m[1].split(",")) {
			const id = raw.replace(/\btype\s+/, "").split(/\s+as\s+/)[0].trim();
			if (id) {
				exports.add(id);
			}
		}
	}
	const options = new Set();
	const attach = text.indexOf("### `attach(");
	if (attach < 0) {
		throw new Error("no ### `attach( heading");
	}
	{
		const next = text.indexOf("\n## ", attach + 1);
		const section = next < 0 ? text.slice(attach) : text.slice(attach, next);
		for (const option of section.matchAll(/^- `(\w+)` \(/gm)) {
			options.add(option[1]);
		}
	}
	const pkg = (text.match(/npm install (@[\w-]+\/[\w-]+)/) || [])[1];
	const retired = new Set(RETIRED.filter((name) => !text.includes(name)));
	return { calls, noArgs, exports, options, pkg, retired };
}

function listFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name !== "node_modules") {
				out.push(...listFiles(full));
			}
		} else if (SCANNED.test(entry.name)) {
			out.push(full);
		}
	}
	return out;
}

// The top-level keys of the object literal starting at text[open] === "{".
function objectKeys(text, open) {
	let depth = 0;
	let close = -1;
	for (let i = open; i < text.length; i++) {
		if (text[i] === "{") {
			depth++;
		} else if (text[i] === "}" && --depth === 0) {
			close = i;
			break;
		}
	}
	if (close < 0) {
		return [];
	}
	// Blank out strings, then collapse nested brackets, leaving "key: 0, key2, ..." at the top.
	let body = text.slice(open + 1, close).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, "0");
	let before = "";
	while (before !== body) {
		before = body;
		body = body.replace(/\{[^{}]*\}|\[[^[\]]*\]|\([^()]*\)/g, "0");
	}
	const keys = [];
	for (const part of body.replace(/\/\/[^\n]*/g, "").split(",")) {
		const key = part.trim().match(/^(\w+)\s*(?::|$)/);
		if (key && !/^\d+$/.test(key[1])) {
			keys.push(key[1]);
		}
	}
	return keys;
}

function lineAt(text, index) {
	return text.slice(0, index).split("\n").length;
}

function checkFile(file, text, docs, findings) {
	const name = relative(ROOT, file).split(sep).join("/");
	let mentions = false;
	const fail = (index, message) => findings.push(name + ":" + lineAt(text, index) + "  " + message);

	// "?." counts too: harmony?.friends?.list() is the same call.
	const serviceCall = new RegExp("\\b" + HANDLE + "\\??\\.(" + SERVICES + "\\??\\.\\w+)", "g");
	for (const m of text.matchAll(serviceCall)) {
		mentions = true;
		const call = m[1].replace("?", "");
		if (!docs.calls.has(call)) {
			fail(m.index, "harmony." + call + " isn't documented in sdk.md");
		}
	}
	const handleCall = new RegExp("\\b" + HANDLE + "\\??\\.(\\w+)\\s*\\((\\s*\\))?", "g");
	for (const m of text.matchAll(handleCall)) {
		mentions = true;
		if (!docs.calls.has(m[1])) {
			fail(m.index, "harmony." + m[1] + "() isn't documented in sdk.md");
		} else if (docs.noArgs.has(m[1]) && !m[2]) {
			fail(m.index, "harmony." + m[1] + "() takes no arguments in sdk.md");
		}
	}
	for (const name of docs.retired) {
		for (const m of text.matchAll(new RegExp("\\b" + name + "\\b", "g"))) {
			mentions = true;
			fail(m.index, name + " is from an earlier SDK; sdk.md doesn't document it");
		}
	}
	const prose = new RegExp("`" + HANDLE + "\\.(\\w+)`", "g");
	for (const m of text.matchAll(prose)) {
		// A service name passes when sdk.md documents a call on it; file names such as `harmony.md` pass.
		const documentedService = [...docs.calls].some((call) => call.startsWith(m[1] + "."));
		if (!docs.calls.has(m[1]) && !documentedService && !["md", "js", "mjs", "ts", "json", "html"].includes(m[1])) {
			fail(m.index, "harmony." + m[1] + " isn't documented in sdk.md");
		}
	}
	if (new RegExp(HARMONY_PACKAGE + "|PlayHarmony").test(text)) {
		mentions = true;
	}

	for (const m of text.matchAll(new RegExp("import\\s*\\{([^}]*)\\}\\s*from\\s*[\"'](" + HARMONY_PACKAGE + ")[^\"']*[\"']", "g"))) {
		for (const raw of m[1].split(",")) {
			const id = raw.replace(/\btype\s+/, "").split(/\s+as\s+/)[0].trim();
			if (id && !docs.exports.has(id)) {
				fail(m.index, id + " is imported from the SDK but isn't documented in sdk.md");
			}
		}
	}

	if (docs.options.size) {
		const usesSdk = new RegExp(HARMONY_PACKAGE + "|PlayHarmony").test(text);
		for (const m of usesSdk ? text.matchAll(ATTACH_CALL) : []) {
			for (const key of objectKeys(text, m.index + m[0].length - 1)) {
				if (!docs.options.has(key)) {
					fail(m.index, "attach option `" + key + "` isn't documented in sdk.md");
				}
			}
		}
		// Option tables: rows whose first cell is a backticked name, in a section about attachGameServices.
		const lines = text.split("\n");
		let inAttach = false;
		let offset = 0;
		for (const line of lines) {
			if (/^#{1,4}\s/.test(line)) {
				inAttach = /`attach`|\battach\(|PlayHarmony\.attach/.test(line);
			}
			const row = line.match(/^\|\s*`(\w+)`[^|]*\|/);
			if (inAttach && row && !docs.options.has(row[1])) {
				fail(offset, "attach option `" + row[1] + "` isn't documented in sdk.md");
			}
			offset += line.length + 1;
		}
	}

	if (docs.pkg) {
		for (const m of text.matchAll(new RegExp("npm (?:install|i|add)\\s+(?:-\\S+\\s+)*(" + HARMONY_PACKAGE + ")", "g"))) {
			if (m[1] !== docs.pkg) {
				fail(m.index, "installs " + m[1] + ", but sdk.md installs " + docs.pkg);
			}
		}
	}
	return mentions;
}

async function main() {
	const source = process.argv[2] || process.env.HARMONY_SDK_MD || DEFAULT_SOURCE;
	let docs;
	try {
		docs = parseDocs(await readSource(source));
	} catch (error) {
		console.error("Can't read the SDK docs from " + source + ": " + error.message);
		console.error("Pass a path or URL: node scripts/check_docs.mjs <sdk.md>");
		process.exit(2);
	}
	console.log("sdk.md: " + docs.calls.size + " calls, " + docs.options.size + " attach options" + (docs.pkg ? ", package " + docs.pkg : "") + " (" + source + ")");

	const findings = [];
	const skills = readdirSync(SKILLS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
	for (const skill of skills) {
		const dir = join(SKILLS, skill);
		let mentions = false;
		for (const file of listFiles(dir)) {
			const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
			if (checkFile(file, text, docs, findings)) {
				mentions = true;
			}
		}
		console.log((mentions ? "uses SDK  " : "no SDK    ") + skill);
	}

	console.log("");
	for (const finding of findings) {
		console.log("FAIL  " + finding);
	}
	console.log(findings.length ? findings.length + (findings.length === 1 ? " problem." : " problems.") : "All skills match sdk.md.");
	process.exit(findings.length ? 1 : 0);
}

main();
