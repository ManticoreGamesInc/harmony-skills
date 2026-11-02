#!/usr/bin/env node
// Receives frames and takes from the running game for harmony-store-media. Serves the in-page
// script at /<token>/capture.js and writes each posted PNG to <out>/<name>.png and each
// recording to <out>/<name>.webm. Needs no change to the game.
//
// Every route sits under a random token printed at start, so other pages open in the browser
// can't post files to it. Listens on 127.0.0.1 only. Stop it with GET /<token>/quit (or it
// exits after 30 idle minutes).
//
//   node capture_server.mjs --out <folder> [--port 0] [--allow-origin https://example.com]
//
// Pages on localhost may call it; add --allow-origin for a game served from another address.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
function arg(name, fallback) {
	const i = argv.indexOf("--" + name);
	return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

if (!arg("out", "")) {
	console.error("usage: node capture_server.mjs --out <folder> [--port 0] [--allow-origin <origin>]");
	process.exit(1);
}
const outDir = resolve(arg("out", ""));
mkdirSync(outDir, { recursive: true });

const MAX_BYTES = 64 * 1024 * 1024;
const IDLE_MS = 30 * 60 * 1000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBM_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const TOKEN = randomBytes(12).toString("hex");
// Read on every request, so edits to the in-page script apply without restarting the server.
const clientPath = join(dirname(fileURLToPath(import.meta.url)), "capture_client.js");

let idleTimer = null;
function touch() {
	clearTimeout(idleTimer);
	idleTimer = setTimeout(() => {
		console.log("idle for 30 minutes, exiting");
		process.exit(0);
	}, IDLE_MS);
}

// Only the game's page may call the server: local pages by default, plus any origins given with
// --allow-origin (comma separated), for a game served from somewhere else.
const ALLOWED = new Set(arg("allow-origin", "").split(",").map((o) => o.trim()).filter(Boolean));
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function originAllowed(value) {
	return typeof value === "string" && (LOCAL_ORIGIN.test(value) || ALLOWED.has(value));
}

function cors(req, res) {
	if (!originAllowed(req.headers.origin)) {
		return;                                 // no CORS headers: the browser blocks other sites
	}
	res.setHeader("access-control-allow-origin", req.headers.origin);
	res.setHeader("vary", "origin");
	res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
	res.setHeader("access-control-allow-headers", "content-type");
	res.setHeader("access-control-allow-private-network", "true");
}

function sendJson(res, code, data) {
	res.statusCode = code;
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify(data));
}

function origin() {
	return "http://127.0.0.1:" + server.address().port + "/" + TOKEN;
}

const server = createServer((req, res) => {
	cors(req, res);
	// Requests from a page on another site carry its Origin; refuse them outright, so even a
	// request the browser sends without asking first (a simple POST) never writes a file.
	if (req.headers.origin && !originAllowed(req.headers.origin)) {
		sendJson(res, 403, { ok: false, error: "origin not allowed; start the server with --allow-origin " + req.headers.origin });
		return;
	}
	const url = new URL(req.url, "http://127.0.0.1");
	if (req.method === "OPTIONS") {
		res.statusCode = 204;
		res.end();
		return;
	}
	const prefix = "/" + TOKEN + "/";
	if (!url.pathname.startsWith(prefix)) {
		sendJson(res, 404, { ok: false, error: "unknown route" });
		return;
	}
	touch();
	const route = url.pathname.slice(prefix.length);
	if (req.method === "GET" && route === "capture.js") {
		res.setHeader("content-type", "text/javascript; charset=utf-8");
		res.setHeader("cache-control", "no-store");
		res.end(readFileSync(clientPath, "utf8").replace("__ORIGIN__", origin()));
		return;
	}
	if (req.method === "GET" && route === "quit") {
		sendJson(res, 200, { ok: true });
		console.log("quit requested");
		setTimeout(() => process.exit(0), 50);
		return;
	}
	if (req.method === "POST" && route === "save") {
		const name = url.searchParams.get("name") || "";
		if (!/^[a-z0-9_-]{1,48}$/i.test(name)) {
			sendJson(res, 400, { ok: false, error: "name must be 1-48 letters, digits, _ or -" });
			return;
		}
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > MAX_BYTES) {
				sendJson(res, 413, { ok: false, error: "upload larger than 64 MB" });
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			if (size > MAX_BYTES) {
				return;
			}
			const body = Buffer.concat(chunks);
			const isPng = body.length >= 24 && body.subarray(0, 8).equals(PNG_SIGNATURE);
			// Recordings: WebM (EBML header) or MP4 ("ftyp" box).
			const isWebm = body.length >= 4 && body.subarray(0, 4).equals(WEBM_SIGNATURE);
			const isMp4 = body.length >= 8 && body.subarray(4, 8).toString("latin1") === "ftyp";
			if (!isPng && !isWebm && !isMp4) {
				sendJson(res, 400, { ok: false, error: "body is not a PNG, WebM or MP4" });
				return;
			}
			const path = join(outDir, name + (isPng ? ".png" : isWebm ? ".webm" : ".mp4"));
			writeFileSync(path, body);
			if (!isPng) {
				console.log("saved " + path + " (" + Math.round(body.length / 1024) + " KB)");
				sendJson(res, 200, { ok: true, path: path, bytes: body.length });
				return;
			}
			const width = body.readUInt32BE(16);
			const height = body.readUInt32BE(20);
			console.log("saved " + path + " (" + width + "x" + height + ", " + Math.round(body.length / 1024) + " KB)");
			sendJson(res, 200, { ok: true, path: path, width: width, height: height, bytes: body.length });
		});
		return;
	}
	sendJson(res, 404, { ok: false, error: "unknown route" });
});

server.listen(Number(arg("port", "0")), "127.0.0.1", () => {
	console.log("capture server: " + origin() + "  (saving to " + outDir + ")");
	console.log("in the game page: const t = await import(\"" + origin() + "/capture.js\");");
	console.log("stop: GET " + origin() + "/quit");
	touch();
});
