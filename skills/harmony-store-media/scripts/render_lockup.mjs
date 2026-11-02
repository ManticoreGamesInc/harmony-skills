#!/usr/bin/env node
// Renders a title lockup (lockup.html filled in from a JSON config) to a transparent PNG with
// the Chrome or Edge already installed on the machine, run headless. No npm packages needed.
//
//   node render_lockup.mjs --config lockup.json --out title_raw.png [--browser <path to chrome or edge>]
//
// Paths in the config (font files, emblem) are relative to the config file. The PNG is
// 2400x1300 for "layout": "wide" and 2048x2048 for "square", with the art centered on a
// transparent background; compose_thumbnail.py and store_media.py logo trim it.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
function arg(name, fallback) {
	const i = argv.indexOf("--" + name);
	return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

function fail(message) {
	console.error("error: " + message);
	process.exit(1);
}

const configPath = arg("config", "");
const outPath = arg("out", "");
if (!configPath || !outPath) {
	fail("usage: node render_lockup.mjs --config lockup.json --out title_raw.png [--browser <path>]");
}

function findBrowser() {
	const given = arg("browser", process.env.CHROME_PATH || "");
	if (given) {
		if (!existsSync(given)) {
			fail("no browser at " + given);
		}
		return given;
	}
	const candidates = [];
	if (process.platform === "win32") {
		for (const root of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]) {
			if (root) {
				candidates.push(join(root, "Google", "Chrome", "Application", "chrome.exe"));
				candidates.push(join(root, "Microsoft", "Edge", "Application", "msedge.exe"));
				candidates.push(join(root, "Chromium", "Application", "chrome.exe"));
			}
		}
	} else if (process.platform === "darwin") {
		candidates.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
		candidates.push("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge");
		candidates.push("/Applications/Chromium.app/Contents/MacOS/Chromium");
	} else {
		for (const dir of (process.env.PATH || "").split(":")) {
			for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]) {
				candidates.push(join(dir, name));
			}
		}
	}
	const found = candidates.find((p) => existsSync(p));
	if (!found) {
		fail("couldn't find Chrome, Edge or Chromium; pass --browser <path> or set CHROME_PATH");
	}
	return found;
}

// Font files and the emblem become file:// URLs the page can load.
function toUrl(value, base) {
	if (!value || /^(https?|file|data):/i.test(value)) {
		return value;
	}
	const path = isAbsolute(value) ? value : resolve(base, value);
	if (!existsSync(path)) {
		fail("file not found: " + path);
	}
	return pathToFileURL(path).href;
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const base = dirname(resolve(configPath));
for (const key of ["font", "taglineFont"]) {
	if (config[key] && config[key].file) {
		config[key].file = toUrl(config[key].file, base);
	}
}
if (config.emblem) {
	config.emblem = toUrl(config.emblem, base);
}

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(here, "lockup.html"), "utf8");
const json = JSON.stringify(config).replace(/</g, "\\u003c");
const html = template.replace("/*CONFIG*/null", json);

// One work folder per user (with the browser profile) is reused across runs, so nothing piles
// up. It must be ours and private: on a shared /tmp another user could have made it first.
function workFolder() {
	const fixed = join(tmpdir(), "harmony-store-media-lockup-" + userInfo().username);
	try {
		mkdirSync(fixed, { recursive: true, mode: 0o700 });
		const info = statSync(fixed);
		const ours = typeof process.getuid !== "function" || (info.uid === process.getuid() && (info.mode & 0o077) === 0);
		if (ours) {
			return fixed;
		}
	} catch {
		// Fall through to a fresh private folder.
	}
	return mkdtempSync(join(tmpdir(), "harmony-store-media-lockup-"));
}
const work = workFolder();
const page = join(work, "lockup-" + process.pid + ".html");
writeFileSync(page, html);
const url = pathToFileURL(page).href;
const square = config.layout === "square";
const size = square ? "2048,2048" : "2400,1300";
const browser = findBrowser();
const common = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files", "--user-data-dir=" + join(work, "profile"), "--virtual-time-budget=5000", "--window-size=" + size];

let failure = null;
try {
	// First pass reads the page's status, so a missing font or bad config fails loudly.
	const dom = execFileSync(browser, common.concat(["--dump-dom", url]), { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
	const status = (dom.match(/data-status="([^"]*)"/) || [])[1];
	if (status !== "ok") {
		throw new Error(status ? status.replace(/^error: /, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&") : "the lockup page didn't finish rendering");
	}
	const out = resolve(outPath);
	mkdirSync(dirname(out), { recursive: true });
	execFileSync(browser, common.concat(["--default-background-color=00000000", "--screenshot=" + out, url]), { stdio: "ignore" });
	if (!existsSync(out)) {
		throw new Error("the browser didn't write " + out);
	}
	const png = readFileSync(out);
	console.log(out + "  (" + png.readUInt32BE(16) + "x" + png.readUInt32BE(20) + ", transparent, rendered with " + browser + ")");
} catch (error) {
	failure = error.message;
} finally {
	if (existsSync(page) && !argv.includes("--keep-html")) {
		unlinkSync(page);
	}
}
if (failure) {
	fail(failure);
}
