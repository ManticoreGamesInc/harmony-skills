#!/usr/bin/env node
// check_build.mjs: checks a web game build before it is uploaded to Harmony.
//
//   node check_build.mjs <build folder | game.html | game.zip> [--json]
//
// Node 18 or newer, no packages. Reads the files only; it changes nothing and uploads nothing.
// Exit code 0 when there are no errors (warnings allowed), 1 when there are errors, 2 on bad
// usage. Each finding names the file and line.
//
// Errors (the game will break when hosted):
// - no index.html at the top of the folder or zip (or the zip holds one folder around it)
// - a service worker is registered
// - the browser's own file pickers (showSaveFilePicker, showOpenFilePicker, showDirectoryPicker)
// - dev cheats (the "__DEV_CHEATS__" marker) left in the build
// - a zip entry whose path leaves the top folder ("..", a leading "/" or a drive letter)
// Warnings (check by hand):
// - a file is loaded by an address starting with "/" instead of a relative one
// - the clipboard is read (navigator.clipboard.readText / read)
// - a web app manifest (PWA leftovers)
// - addresses pointing at localhost
// It also prints the file count and total size, to compare with the limits shown in My Creations.
//
// It never runs, imports or extracts anything from the build: files are read as text and matched
// against patterns, zip entries are inflated in memory with a size cap, and folder links
// (symlinks, junctions) are skipped. File names from the build are printed with control and
// bidirectional characters replaced, so a crafted name can't drive the terminal.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import { inflateRawSync } from "node:zlib";

const SCAN_TYPES = new Set([".html", ".htm", ".js", ".mjs", ".cjs", ".css"]);
const MAX_SCAN_BYTES = 20 * 1024 * 1024;

const RULES = [
	{
		// A warning, not an error: some engines' scripts (Godot 4's, for one) contain guarded
		// registration code that only runs when their PWA option is on.
		level: "warning",
		id: "service-worker",
		pattern: /navigator\s*\.\s*serviceWorker\s*\.\s*register\s*\(/,
		message: "Can register a service worker, which hosted games can't use. Make sure it never runs: Unity's Default or Minimal WebGL template, not PWA; Godot's Progressive Web App off; your own code, remove it.",
	},
	{
		level: "error",
		id: "file-picker",
		pattern: /\b(showSaveFilePicker|showOpenFilePicker|showDirectoryPicker)\s*\(/,
		message: "Uses the browser's own file picker, which doesn't work in a hosted game. Use a download and <input type=\"file\">, or harmony.files.save and harmony.files.open in a game with the Harmony SDK.",
	},
	{
		level: "error",
		id: "dev-cheats",
		pattern: /__DEV_CHEATS__/,
		message: "Dev cheats are in the build. Load them only behind the dev switch, so production builds drop them.",
	},
	{
		level: "warning",
		id: "clipboard-read",
		pattern: /navigator\s*\.\s*clipboard\s*\.\s*(readText|read)\s*\(/,
		message: "Reads the clipboard, which doesn't work in a hosted game. Let players paste with Ctrl+V instead.",
	},
	{
		level: "warning",
		id: "localhost",
		pattern: /\bhttps?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//,
		message: "Points at localhost, which won't exist for players.",
	},
];

// Root-absolute addresses in HTML attributes, CSS url() and common JS loads. "//host" is a
// different site and is skipped.
const ABSOLUTE_PATTERNS = [
	/\b(?:src|href|data|poster|srcset|action)\s*=\s*["']\/(?!\/)/i,
	/\burl\(\s*["']?\/(?!\/)/i,
	/\b(?:fetch|import|new\s+URL|new\s+Worker|loadImage|load\.\w+)\s*\(\s*["'`]\/(?!\/)/,
	/\bfrom\s+["']\/(?!\/)/,
];

// Control characters (terminal escapes) and bidirectional overrides in a file name could rewrite
// what the terminal shows; they print as "?".
function printable(text) {
	return String(text).replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "?");
}

function usage() {
	console.error("usage: node check_build.mjs <build folder | game.html | game.zip> [--json]");
	process.exit(2);
}

// Files as { name, size, read() } with "/" separators, relative to the top.
function listFolder(folder) {
	const out = [];
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
			} else if (entry.isFile()) {
				out.push({ name: relative(folder, full).split(sep).join("/"), size: statSync(full).size, read: () => readFileSync(full) });
			}
		}
	};
	walk(folder);
	return out;
}

// Zip entry names written with "\" separators, and names that leave the top folder, reported as
// errors after reading.
const backslashNames = [];
const escapingNames = [];

// Reads a zip's central directory; entries are stored or deflated.
function listZip(path) {
	const buf = readFileSync(path);
	let end = -1;
	for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
		if (buf.readUInt32LE(i) === 0x06054b50) {
			end = i;
			break;
		}
	}
	if (end < 0) {
		throw new Error("not a zip file (no end of central directory)");
	}
	const count = buf.readUInt16LE(end + 10);
	let at = buf.readUInt32LE(end + 16);
	const out = [];
	for (let n = 0; n < count; n++) {
		if (buf.readUInt32LE(at) !== 0x02014b50) {
			throw new Error("broken zip central directory");
		}
		const method = buf.readUInt16LE(at + 10);
		const packed = buf.readUInt32LE(at + 20);
		const size = buf.readUInt32LE(at + 24);
		const nameLength = buf.readUInt16LE(at + 28);
		const extraLength = buf.readUInt16LE(at + 30);
		const commentLength = buf.readUInt16LE(at + 32);
		const local = buf.readUInt32LE(at + 42);
		const rawName = buf.toString("utf8", at + 46, at + 46 + nameLength);
		if (rawName.includes("\\")) {
			backslashNames.push(rawName);        // some zip tools write Windows separators
		}
		const name = rawName.replace(/\\/g, "/");
		if (/^\/|^[a-z]:/i.test(name) || name.split("/").includes("..")) {
			escapingNames.push(name);
		}
		at += 46 + nameLength + extraLength + commentLength;
		if (name.endsWith("/")) {
			continue;
		}
		out.push({
			name,
			size,
			read: () => {
				const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
				const data = buf.subarray(start, start + packed);
				if (method === 0) {
					return data;
				}
				if (method === 8) {
					// Cap the output, so a zip that lies about its sizes can't exhaust memory.
					return inflateRawSync(data, { maxOutputLength: MAX_SCAN_BYTES + 1 });
				}
				throw new Error("compression method " + method + " not supported");
			},
		});
	}
	return out;
}

function scanText(file, text, findings) {
	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		for (const rule of RULES) {
			if (rule.pattern.test(line)) {
				findings.push({ level: rule.level, id: rule.id, file, line: i + 1, message: rule.message });
			}
		}
		for (const pattern of ABSOLUTE_PATTERNS) {
			if (pattern.test(line)) {
				findings.push({ level: "warning", id: "absolute-path", file, line: i + 1, message: "Loads a file by an address starting with \"/\". Hosted builds are served under a folder of their own, so use a relative address (with Vite, base: './')." });
				break;
			}
		}
	}
}

function main() {
	const args = process.argv.slice(2);
	const json = args.includes("--json");
	const target = args.find((a) => !a.startsWith("--"));
	if (!target) {
		usage();
	}
	let stat;
	try {
		stat = statSync(target);
	} catch {
		console.error("Not found: " + target);
		process.exit(2);
	}
	const ext = extname(target).toLowerCase();
	let files;
	const findings = [];
	if (stat.isDirectory()) {
		files = listFolder(target);
	} else if (ext === ".zip") {
		try {
			files = listZip(target);
		} catch (error) {
			console.error("Can't read " + target + ": " + error.message);
			process.exit(2);
		}
	} else if (ext === ".html" || ext === ".htm") {
		files = [{ name: basename(target), size: stat.size, read: () => readFileSync(target) }];
	} else {
		usage();
	}

	const single = ext === ".html" || ext === ".htm";
	if (!single && !files.some((f) => f.name.toLowerCase() === "index.html")) {
		const nested = files.find((f) => /^[^/]+\/index\.html$/i.test(f.name));
		findings.push({
			level: "error",
			id: "index-html",
			file: nested ? nested.name : "(top)",
			line: 0,
			message: nested
				? "index.html is inside the folder \"" + nested.name.split("/")[0] + "\". Zip the files inside the build folder, not the folder itself, so index.html is at the top."
				: "No index.html at the top. Harmony opens index.html from the top of the folder or zip.",
		});
	}
	if (files.some((f) => /\.webmanifest$|(^|\/)manifest\.json$/i.test(f.name))) {
		const manifest = files.find((f) => /\.webmanifest$|(^|\/)manifest\.json$/i.test(f.name));
		findings.push({ level: "warning", id: "manifest", file: manifest.name, line: 0, message: "A web app manifest: PWA leftovers. Hosted games can't install as apps or use service workers." });
	}
	if (backslashNames.length) {
		findings.push({ level: "error", id: "zip-backslash", file: backslashNames[0], line: 0, message: "The zip stores paths with \\ instead of / (" + backslashNames.length + " entries), which breaks on other systems. Zip it again with tar or Python (see packaging.md)." });
	}

	if (escapingNames.length) {
		findings.push({ level: "error", id: "zip-path", file: escapingNames[0], line: 0, message: "The zip has paths that leave its top folder (" + escapingNames.length + " entries with \"..\", a leading \"/\" or a drive letter). Zip again from inside the build folder (see packaging.md)." });
	}

	for (const file of files) {
		const type = extname(file.name).toLowerCase();
		if (!SCAN_TYPES.has(type)) {
			continue;
		}
		if (file.size > MAX_SCAN_BYTES) {
			findings.push({ level: "warning", id: "not-scanned", file: file.name, line: 0, message: "Too big to scan (over 20 MB); check it by hand." });
			continue;
		}
		let text;
		try {
			text = file.read().toString("utf8");
		} catch (error) {
			findings.push({ level: "warning", id: "unreadable", file: file.name, line: 0, message: "Couldn't read it: " + error.message });
			continue;
		}
		scanText(file.name, text, findings);
	}

	const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
	const errors = findings.filter((f) => f.level === "error");
	const warnings = findings.filter((f) => f.level === "warning");

	if (json) {
		console.log(JSON.stringify({ target, files: files.length, bytes: totalBytes, errors, warnings }, null, 2));
	} else {
		for (const f of [...errors, ...warnings]) {
			const where = f.line ? f.file + ":" + f.line : f.file;
			console.log((f.level === "error" ? "ERROR  " : "WARN   ") + printable(where) + "  " + printable(f.message));
		}
		const mb = (totalBytes / (1024 * 1024)).toFixed(2);
		console.log("");
		console.log(files.length + (files.length === 1 ? " file, " : " files, ") + mb + " MB (unpacked). Compare with the upload limits shown in My Creations.");
		console.log(errors.length + (errors.length === 1 ? " error, " : " errors, ") + warnings.length + (warnings.length === 1 ? " warning." : " warnings."));
	}
	process.exit(errors.length ? 1 : 0);
}

main();
