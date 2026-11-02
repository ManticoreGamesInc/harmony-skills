#!/usr/bin/env node
// Fallback for agents that can't run JavaScript in a browser page themselves: opens the game in
// a visible Chrome or Edge window (the real GPU, so WebGL and WebGPU render as players see
// them) and takes commands over a small local HTTP API. Uses Playwright with the browser
// already installed on the machine; install it in the game folder first:
//   npm install --no-save playwright-core
//
//   node drive_chrome.mjs --url http://localhost:5173 --out <folder> [--size 1920x1080] [--scale 1] [--record] [--headless] [--browser chrome|msedge] [--port 0]
//
//   --size      viewport in CSS pixels (default 1920x1080)
//   --scale     device pixel ratio (default 1). Page screenshots come out at size times scale,
//               so --size 1280x720 --scale 1.5 gives 1920x1080 pictures. For games with no canvas.
//   --record    records the page with Playwright's video recorder at the viewport size, for games
//               with no canvas (capture.js records canvas games). End a take with save-video.
//   --headless  no window. Fine for games drawn in HTML and SVG; WebGL and WebGPU games need the
//               real GPU of a visible window.
//
// Every route sits under a random token printed at start. Send requests with any HTTP client:
//   POST <base>/eval            body: JavaScript run in the page as an async function body; `return` a JSON-able value
//   POST <base>/screenshot?name=judge_1    page screenshot (viewport size times --scale) to <out>/judge_1.png
//   POST <base>/viewport?w=1920&h=1080
//   POST <base>/key?key=Space&action=press      action: press (default), down, up
//   POST <base>/mouse?x=640&y=360&action=click  action: click (default), down, up, move
//   POST <base>/goto?url=http://localhost:5173
//   POST <base>/save-video?name=take_1   with --record: ends the take, writes <out>/take_1.webm and
//                               opens the page's address again for the next take
//   GET  <base>/quit            closes the browser and exits (an unsaved take is dropped)
// The window stays muted. Keep it on screen: a minimized window stops drawing.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
function arg(name, fallback) {
	const i = argv.indexOf("--" + name);
	return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

const startUrl = arg("url", "");
if (!startUrl || !arg("out", "")) {
	console.error("usage: node drive_chrome.mjs --url <game url> --out <folder> [--size 1920x1080] [--scale 1] [--record] [--headless] [--browser chrome|msedge] [--port 0]");
	process.exit(1);
}
const outDir = resolve(arg("out", ""));
mkdirSync(outDir, { recursive: true });
const [width, height] = arg("size", "1920x1080").split("x").map(Number);
const scale = Number(arg("scale", "1"));
if (!(width > 0 && height > 0 && scale > 0)) {
	console.error("--size must look like 1920x1080 and --scale must be a number above 0");
	process.exit(1);
}
const recording = argv.includes("--record");
const headless = argv.includes("--headless");
const TOKEN = randomBytes(12).toString("hex");

// Playwright is resolved from the folder the driver runs in (the game folder), not from here.
async function loadPlaywright() {
	const require = createRequire(join(process.cwd(), "noop.js"));
	for (const name of ["playwright-core", "playwright"]) {
		try {
			return await import(require.resolve(name).replace(/\\/g, "/").replace(/^([a-z]):/i, "file:///$1:"));
		} catch {
			// Try the next package name.
		}
	}
	console.error("Playwright isn't installed here. Run this in the game folder first: npm install --no-save playwright-core");
	process.exit(1);
}

const playwright = await loadPlaywright();
const chromium = playwright.chromium || (playwright.default && playwright.default.chromium);
const browser = await chromium.launch({
	channel: arg("browser", "chrome"),
	headless: headless,
	args: ["--mute-audio", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
});
// bypassCSP lets capture.js load into games whose Content Security Policy blocks 127.0.0.1.
// With --record, every page in the context is recorded; a take ends when its page closes. The
// video size is set to the viewport, since Playwright otherwise scales it down to fit 800x800.
const contextOptions = { viewport: { width: width, height: height }, deviceScaleFactor: scale, bypassCSP: true };
if (recording) {
	contextOptions.recordVideo = { dir: mkdtempSync(join(tmpdir(), "drive-chrome-video-")), size: { width: width, height: height } };
}
const context = await browser.newContext(contextOptions);
let page = null;

async function openPage(url) {
	page = await context.newPage();
	page.on("pageerror", (e) => console.log("page error: " + e.message));
	await page.goto(url);
}

await openPage(startUrl);

function sendJson(res, code, data) {
	res.statusCode = code;
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify(data));
}

function readBody(req) {
	return new Promise((done) => {
		const chunks = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => done(Buffer.concat(chunks).toString("utf8")));
	});
}

async function handle(route, params, body) {
	if (route === "eval") {
		// Runs through the DevTools protocol, so it works on pages whose CSP blocks eval.
		const value = await page.evaluate("(async () => {\n" + body + "\n})()");
		return { ok: true, value: value === undefined ? null : value };
	}
	if (route === "screenshot") {
		const name = params.get("name") || "";
		if (!/^[a-z0-9_-]{1,48}$/i.test(name)) {
			return { ok: false, error: "name must be 1-48 letters, digits, _ or -" };
		}
		const path = join(outDir, name + ".png");
		await page.screenshot({ path: path });
		return { ok: true, path: path };
	}
	if (route === "viewport") {
		await page.setViewportSize({ width: Number(params.get("w")), height: Number(params.get("h")) });
		return { ok: true, viewport: await page.evaluate("innerWidth + 'x' + innerHeight") };
	}
	if (route === "key") {
		const key = params.get("key");
		const action = params.get("action") || "press";
		await page.keyboard[action](key);
		return { ok: true };
	}
	if (route === "mouse") {
		const x = Number(params.get("x"));
		const y = Number(params.get("y"));
		const action = params.get("action") || "click";
		if (action === "click") {
			await page.mouse.click(x, y);
		} else {
			await page.mouse.move(x, y);
			if (action !== "move") {
				await page.mouse[action]();
			}
		}
		return { ok: true };
	}
	if (route === "goto") {
		await page.goto(params.get("url"));
		return { ok: true, url: page.url() };
	}
	if (route === "save-video") {
		if (!recording) {
			return { ok: false, error: "start the driver with --record to record takes" };
		}
		const name = params.get("name") || "";
		if (!/^[a-z0-9_-]{1,48}$/i.test(name)) {
			return { ok: false, error: "name must be 1-48 letters, digits, _ or -" };
		}
		const url = page.url();
		const video = page.video();
		await page.close();
		const path = join(outDir, name + ".webm");
		await video.saveAs(path);
		await video.delete();
		await openPage(url);
		return { ok: true, path: path, reopened: url };
	}
	return null;
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url, "http://127.0.0.1");
	const prefix = "/" + TOKEN + "/";
	if (!url.pathname.startsWith(prefix)) {
		sendJson(res, 404, { ok: false, error: "unknown route" });
		return;
	}
	const route = url.pathname.slice(prefix.length);
	if (route === "quit") {
		sendJson(res, 200, { ok: true });
		if (recording && page) {
			// Drop the unsaved take instead of leaving it in the temp folder.
			const video = page.video();
			await page.close();
			await video.delete();
		}
		await browser.close();
		process.exit(0);
	}
	try {
		const body = req.method === "POST" ? await readBody(req) : "";
		const out = await handle(route, url.searchParams, body);
		sendJson(res, out ? 200 : 404, out || { ok: false, error: "unknown route" });
	} catch (e) {
		sendJson(res, 500, { ok: false, error: String(e && e.message || e) });
	}
});

browser.on("disconnected", () => {
	console.log("browser closed, exiting");
	process.exit(0);
});

server.listen(Number(arg("port", "0")), "127.0.0.1", () => {
	const base = "http://127.0.0.1:" + server.address().port + "/" + TOKEN;
	console.log("driver: " + base + "  (" + width + "x" + height + " at scale " + scale + (recording ? ", recording" : "") + (headless ? ", headless" : "") + ", files to " + outDir + ")");
	console.log("run JavaScript in the game: POST " + base + "/eval with the code as the body");
	console.log("stop: GET " + base + "/quit");
});
