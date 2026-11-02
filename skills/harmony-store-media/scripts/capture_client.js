// In-page half of harmony-store-media, served by capture_server.mjs. Load it into the running
// game from the browser (the server prints the exact line):
//   const t = await import("http://127.0.0.1:<port>/<token>/capture.js");
//   t.hideUi(); await t.freeze(); /* look at the page */ await t.save("shot_1"); t.resume();
//
// A WebGL or WebGPU canvas only holds its frame until the frame is presented, so the copy is
// taken right after the game's own requestAnimationFrame callbacks, inside the same frame.
// freeze() then holds the game loop so the screen shows exactly the copied frame while it is
// judged. Works with any engine whose loop runs on window.requestAnimationFrame (plain canvas,
// Three.js, Babylon, PlayCanvas, Phaser, PixiJS, Unity and Godot web builds).
const ORIGIN = "__ORIGIN__";

const state = window.__harmonyStoreMedia || (window.__harmonyStoreMedia = {
	realRaf: window.requestAnimationFrame.bind(window),
	installed: false,
	mode: "run",
	held: [],
	grab: null,
	hidden: [],
	copy: null,
	rec: null
});

function pickCanvas() {
	let best = null;
	let bestArea = 0;
	for (const c of document.querySelectorAll("canvas")) {
		if (c === state.copy) {
			continue;
		}
		const r = c.getBoundingClientRect();
		const area = r.width * r.height;
		if (area > bestArea && getComputedStyle(c).visibility !== "hidden") {
			best = c;
			bestArea = area;
		}
	}
	return best;
}

function copyFrame() {
	const canvas = pickCanvas();
	if (!canvas) {
		return;
	}
	const copy = state.copy || (state.copy = document.createElement("canvas"));
	copy.width = canvas.width;
	copy.height = canvas.height;
	copy.getContext("2d").drawImage(canvas, 0, 0);
	// The last callback of the frame wins: finish after the frame, once all callbacks ran.
	if (!state.grab.scheduled) {
		state.grab.scheduled = true;
		setTimeout(finishGrab, 0);
	}
}

function isBlank(c) {
	const g = c.getContext("2d");
	const stepX = Math.max(1, Math.floor(c.width / 16));
	const stepY = Math.max(1, Math.floor(c.height / 9));
	for (let y = 0; y < c.height; y += stepY) {
		for (let x = 0; x < c.width; x += stepX) {
			const p = g.getImageData(x, y, 1, 1).data;
			if (p[0] + p[1] + p[2] > 12) {
				return false;
			}
		}
	}
	return true;
}

function finishGrab() {
	const grab = state.grab;
	state.grab = null;
	if (grab.freeze) {
		state.mode = "frozen";
	}
	clearTimeout(grab.timer);
	grab.resolve({ width: state.copy.width, height: state.copy.height, blank: isBlank(state.copy), frozen: state.mode === "frozen" });
}

if (!state.installed) {
	state.installed = true;
	window.requestAnimationFrame = function (cb) {
		if (state.mode === "frozen") {
			state.held.push(cb);
			return 0;
		}
		return state.realRaf(function (t) {
			if (state.mode === "frozen") {
				state.held.push(cb);
				return;
			}
			cb(t);
			if (state.grab) {
				copyFrame();
			}
		});
	};
}

// Hides every DOM element that isn't the game canvas or one of its ancestors (HUD, menus,
// toasts, loading screen, debug panels). UI drawn inside the canvas itself is not touched.
export function hideUi() {
	showUi();
	const canvas = pickCanvas();
	if (!canvas) {
		throw new Error("no canvas on the page");
	}
	const keep = new Set();
	for (let n = canvas; n; n = n.parentElement) {
		keep.add(n);
	}
	for (const el of document.querySelectorAll("body *")) {
		if (keep.has(el) || !keep.has(el.parentElement)) {
			continue;
		}
		state.hidden.push([el, el.style.getPropertyValue("visibility"), el.style.getPropertyPriority("visibility"), el.style.getPropertyValue("opacity"), el.style.getPropertyPriority("opacity")]);
		el.style.setProperty("visibility", "hidden", "important");
		el.style.setProperty("opacity", "0", "important");
	}
	return { hidden: state.hidden.length, canvas: canvas.width + "x" + canvas.height };
}

export function showUi() {
	for (const [el, vis, visPrio, op, opPrio] of state.hidden) {
		el.style.setProperty("visibility", vis, visPrio);
		el.style.setProperty("opacity", op, opPrio);
	}
	const count = state.hidden.length;
	state.hidden = [];
	return { shown: count };
}

function grab(freeze) {
	if (state.mode === "frozen") {
		return Promise.resolve({ width: state.copy.width, height: state.copy.height, blank: isBlank(state.copy), frozen: true });
	}
	// A second capture before the first finished replaces it; the first one's timer must not
	// later cancel the new one.
	if (state.grab) {
		clearTimeout(state.grab.timer);
		state.grab.reject(new Error("replaced by a newer capture before a frame was rendered"));
		state.grab = null;
	}
	return new Promise((resolve, reject) => {
		const pending = { freeze: freeze, scheduled: false, resolve: resolve, reject: reject, timer: 0 };
		state.grab = pending;
		pending.timer = setTimeout(() => {
			if (state.grab !== pending) {
				return;
			}
			state.grab = null;
			const why = document.hidden ? "the tab is hidden or in the background" : "the browser isn't drawing this page (a window that is minimized or not on screen can pause it), or the game loop doesn't use window.requestAnimationFrame";
			reject(new Error("no frame was rendered in 3 s: " + why + ". Bring the game's window to the front, then retry this shot"));
		}, 3000);
	});
}

// Copies the next rendered frame and holds the game loop on it.
export function freeze() {
	return grab(true);
}

// Copies the next rendered frame without stopping the game.
export function snap() {
	return grab(false);
}

export function resume() {
	const held = state.held;
	state.held = [];
	state.mode = "run";
	for (const cb of held) {
		window.requestAnimationFrame(cb);
	}
	return { resumed: held.length };
}

// Posts the last copied frame (or element image) to the capture server as <name>.png.
export async function save(name) {
	if (!state.copy) {
		throw new Error("nothing copied yet: call freeze(), snap() or captureElement() first");
	}
	const blob = await new Promise((resolve) => state.copy.toBlob(resolve, "image/png"));
	const res = await fetch(ORIGIN + "/save?name=" + encodeURIComponent(name), { method: "POST", headers: { "content-type": "image/png" }, body: blob });
	return res.json();
}

// Store screenshots with the game's HTML UI, at full canvas resolution. The DOM is cloned with
// every computed style inlined, its fonts and images embedded, rendered through an SVG
// foreignObject and drawn over the last copied frame. backdrop-filter blur isn't rendered
// (panels keep their tint).

const SKIP_PROPS = new Set(["transition", "transition-property", "transition-duration", "transition-delay", "animation", "animation-name", "animation-duration", "animation-delay", "will-change", "cursor", "pointer-events"]);

// Inline and inline-flex boxes size to their text: a pixel width copied from the page can come
// out a hair too narrow in the SVG render and wrap or clip the text, so they keep auto widths.
const SIZE_PROPS = new Set(["width", "inline-size", "min-width", "min-inline-size"]);

// An SVG drawn as an image can't load anything, so every <img> and CSS url() image the UI uses
// is fetched first and swapped for a data URL (card art, ornaments, icons, backgrounds).
const dataUrls = new Map();
const URL_RE = /url\(["']?([^"')]+)["']?\)/g;

function absUrl(u) {
	try {
		return new URL(u, location.href).href;
	} catch {
		return u;
	}
}

async function toDataUrl(url) {
	if (dataUrls.has(url) || url.startsWith("data:")) {
		return;
	}
	try {
		const blob = await (await fetch(url)).blob();
		const d = await new Promise((resolve) => {
			const fr = new FileReader();
			fr.onload = () => resolve(fr.result);
			fr.readAsDataURL(blob);
		});
		dataUrls.set(url, d);
	} catch {
		// An image that can't be fetched is left as it was (it renders empty).
	}
}

async function inlineImages(root, skip) {
	const urls = new Set();
	for (const el of [root, ...root.querySelectorAll("*")]) {
		if (el === skip) {
			continue;
		}
		if (el.tagName === "IMG" && (el.currentSrc || el.src)) {
			urls.add(absUrl(el.currentSrc || el.src));
		}
		for (const which of [null, "::before", "::after"]) {
			const cs = getComputedStyle(el, which);
			for (const prop of ["background-image", "mask-image", "-webkit-mask-image", "border-image-source", "list-style-image"]) {
				const v = cs.getPropertyValue(prop);
				if (v && v.includes("url(")) {
					for (const m of v.matchAll(URL_RE)) {
						urls.add(absUrl(m[1]));
					}
				}
			}
		}
	}
	await Promise.all(Array.from(urls).map(toDataUrl));
}

function swapUrls(value) {
	if (!value.includes("url(")) {
		return value;
	}
	return value.replace(URL_RE, (all, u) => {
		const d = dataUrls.get(absUrl(u));
		return d ? "url(\"" + d + "\")" : all;
	});
}

function inlineStyles(src, dst) {
	const cs = getComputedStyle(src);
	const inline = cs.getPropertyValue("display").startsWith("inline");
	let css = "";
	for (let i = 0; i < cs.length; i++) {
		const p = cs[i];
		if (!SKIP_PROPS.has(p) && !(inline && SIZE_PROPS.has(p))) {
			css += p + ":" + swapUrls(cs.getPropertyValue(p)) + ";";
		}
	}
	dst.setAttribute("style", css);
}

function pseudo(src, which) {
	const cs = getComputedStyle(src, which);
	const content = cs.getPropertyValue("content");
	if (!content || content === "none" || content === "normal") {
		return null;
	}
	const span = document.createElement("span");
	let css = "";
	for (let i = 0; i < cs.length; i++) {
		if (!SKIP_PROPS.has(cs[i])) {
			css += cs[i] + ":" + swapUrls(cs.getPropertyValue(cs[i])) + ";";
		}
	}
	span.setAttribute("style", css);
	const text = content.replace(/^["']|["']$/g, "");
	span.textContent = text === content ? "" : text;
	return span;
}

function cloneUi(src, skip) {
	if (src.nodeType === Node.TEXT_NODE) {
		return document.createTextNode(src.textContent);
	}
	if (src.nodeType !== Node.ELEMENT_NODE || src === skip || src.tagName === "SCRIPT" || src.tagName === "STYLE" || src.tagName === "LINK") {
		return null;
	}
	if (src.tagName === "CANVAS") {
		// Other canvases (not the game's) are kept as images of themselves.
		const img = document.createElement("img");
		try {
			img.src = src.toDataURL();
		} catch {
			return null;
		}
		inlineStyles(src, img);
		return img;
	}
	const dst = src.cloneNode(false);
	inlineStyles(src, dst);
	// Text renders a hair wider in the SVG than on the page. Text that sits on one line on the
	// page stays on one line, and "..." truncation is dropped where the page didn't truncate.
	const onlyText = src.childNodes.length > 0 && Array.from(src.childNodes).every((n) => n.nodeType === Node.TEXT_NODE);
	if (onlyText) {
		const range = document.createRange();
		range.selectNodeContents(src);
		if (range.getClientRects().length <= 1) {
			dst.style.setProperty("white-space", "nowrap");
		}
		if (src.scrollWidth <= src.clientWidth + 1) {
			dst.style.setProperty("text-overflow", "clip");
			dst.style.setProperty("overflow", "visible");
		}
	}
	if (src.tagName === "INPUT" || src.tagName === "TEXTAREA") {
		dst.setAttribute("value", src.value);
	}
	if (src.tagName === "IMG") {
		const d = dataUrls.get(absUrl(src.currentSrc || src.src));
		if (d) {
			dst.setAttribute("src", d);
			dst.removeAttribute("srcset");
		}
	}
	const before = pseudo(src, "::before");
	if (before) {
		dst.appendChild(before);
	}
	for (const child of src.childNodes) {
		const c = cloneUi(child, skip);
		if (c) {
			dst.appendChild(c);
		}
	}
	const after = pseudo(src, "::after");
	if (after) {
		dst.appendChild(after);
	}
	return dst;
}

async function fontCss() {
	let css = "";
	for (const sheet of document.styleSheets) {
		let rules;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}
		for (const rule of rules) {
			if (!(rule instanceof CSSFontFaceRule)) {
				continue;
			}
			let text = rule.cssText;
			for (const m of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
				try {
					const res = await fetch(new URL(m[1], sheet.href || location.href));
					const buf = new Uint8Array(await res.arrayBuffer());
					let bin = "";
					for (let i = 0; i < buf.length; i += 0x8000) {
						bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
					}
					text = text.replace(m[0], "url(data:" + (res.headers.get("content-type") || "font/woff2") + ";base64," + btoa(bin) + ")");
				} catch {
					// A font that can't be fetched falls back to the next family in the stack.
				}
			}
			css += text + "\n";
		}
	}
	return css;
}

// Slider tracks and thumbs, scrollbars and similar vendor pseudo-elements have no computed
// style to inline, so the page's own rules for them are copied in (a themed range input would
// otherwise render as the browser's default dot with no track).
function vendorPseudoCss() {
	let css = "";
	for (const sheet of Array.from(document.styleSheets)) {
		let rules;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}
		for (const r of Array.from(rules)) {
			if (r.selectorText && /::-(webkit|moz)-/.test(r.selectorText)) {
				css += r.cssText + "\n";
			}
		}
	}
	return css;
}

// Renders cloned nodes (w x h CSS pixels, inside a box styled like boxStyle) to an image of outW x outH.
async function renderClone(nodes, boxStyle, w, h, outW, outH) {
	const wrap = document.createElement("div");
	wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
	wrap.setAttribute("style", "width:" + w + "px;height:" + h + "px;position:relative;overflow:hidden;");
	const style = document.createElement("style");
	style.textContent = (await fontCss()) + vendorPseudoCss();
	wrap.appendChild(style);
	const inner = document.createElement("div");
	inner.setAttribute("style", boxStyle);
	for (const n of nodes) {
		inner.appendChild(n);
	}
	wrap.appendChild(inner);
	const xhtml = new XMLSerializer().serializeToString(wrap);
	const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + outW + "\" height=\"" + outH + "\"><foreignObject x=\"0\" y=\"0\" width=\"" + w + "\" height=\"" + h + "\" transform=\"scale(" + (outW / w) + ")\">" + xhtml + "</foreignObject></svg>";
	const img = new Image();
	await new Promise((resolve, reject) => {
		img.onload = resolve;
		img.onerror = () => reject(new Error("the UI didn't render as an image"));
		img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
	});
	return img;
}

// The page's HTML UI alone (transparent elsewhere), rendered at outW x outH.
async function uiImage(outW, outH) {
	const canvas = pickCanvas();
	const w = window.innerWidth;
	const h = window.innerHeight;
	await inlineImages(document.body, canvas);
	const body = cloneUi(document.body, canvas);
	body.style.setProperty("background", "transparent", "important");
	body.style.setProperty("margin", "0");
	body.style.setProperty("width", w + "px");
	body.style.setProperty("height", h + "px");
	return renderClone(Array.from(body.childNodes), body.getAttribute("style"), w, h, outW, outH);
}

/** Draws the page's HTML UI over the last copied frame, at the frame's size. */
export async function withUi() {
	if (!state.copy) {
		throw new Error("nothing copied yet: call freeze() or snap() first");
	}
	const img = await uiImage(state.copy.width, state.copy.height);
	const out = document.createElement("canvas");
	out.width = state.copy.width;
	out.height = state.copy.height;
	const g = out.getContext("2d");
	g.drawImage(state.copy, 0, 0);
	g.drawImage(img, 0, 0, out.width, out.height);
	state.copy = out;
	return { width: out.width, height: out.height };
}

/**
 * Renders one HTML element (the game's own title on its menu, say) on a transparent
 * background at `scale` times its CSS size, and makes it the copy that save() writes.
 * Only HTML and CSS are rendered: a title drawn inside the game canvas can't be lifted out.
 */
export async function captureElement(selector, scale) {
	const el = typeof selector === "string" ? document.querySelector(selector) : selector;
	if (!el) {
		throw new Error("no element matches " + selector);
	}
	const rect = el.getBoundingClientRect();
	// Display lettering often paints past its own box (italics, big shadows, overflowing
	// lines), so the picture covers every child box and text line, plus a margin.
	let left = rect.left;
	let top = rect.top;
	let right = rect.right;
	let bottom = rect.bottom;
	const range = document.createRange();
	range.selectNodeContents(el);
	for (const r of [...Array.from(el.querySelectorAll("*")).map((n) => n.getBoundingClientRect()), ...Array.from(range.getClientRects())]) {
		if (r.width > 0 && r.height > 0) {
			left = Math.min(left, r.left);
			top = Math.min(top, r.top);
			right = Math.max(right, r.right);
			bottom = Math.max(bottom, r.bottom);
		}
	}
	const pad = Math.ceil(parseFloat(getComputedStyle(el).fontSize) * 0.25);
	const s = scale || 4;
	const w = Math.ceil(right - left) + pad * 2;
	const h = Math.ceil(bottom - top) + pad * 2;
	await inlineImages(el, null);
	const clone = cloneUi(el, null);
	// The clone keeps its own transform (a skew or tilt is part of the look), so it is placed by
	// its layout box: a transform about the box's center keeps that center where it was.
	const boxW = el.offsetWidth || rect.width;
	const boxH = el.offsetHeight || rect.height;
	clone.style.setProperty("position", "absolute");
	clone.style.setProperty("left", (rect.left + rect.width / 2 - boxW / 2 - left + pad) + "px");
	clone.style.setProperty("top", (rect.top + rect.height / 2 - boxH / 2 - top + pad) + "px");
	clone.style.setProperty("width", boxW + "px");
	clone.style.setProperty("height", boxH + "px");
	clone.style.setProperty("margin", "0");
	clone.style.setProperty("overflow", "visible");
	const img = await renderClone([clone], "position:relative;width:" + w + "px;height:" + h + "px;", w, h, w * s, h * s);
	const out = document.createElement("canvas");
	out.width = w * s;
	out.height = h * s;
	out.getContext("2d").drawImage(img, 0, 0);
	state.copy = out;
	return { width: out.width, height: out.height };
}

// Preview movie takes: the game canvas only (no HTML UI, no sound), recorded in the page with
// MediaRecorder at a high bitrate and posted to the server as <name>.webm. store_media.py
// preview cuts and squeezes the take into the store's small muted clip.
const RECORD_TYPES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

// opts.ui: true records the HTML UI too (word lists, card hands), for games whose UI carries
// the game. The UI layer is re-rendered after DOM changes (a few times a second at most), so UI
// changes show up a fraction of a second late; canvas motion stays at full rate.
export function startRecording(fps, opts) {
	if (state.rec) {
		throw new Error("already recording: call stopRecording(name) first");
	}
	if (state.mode === "frozen") {
		throw new Error("the game is frozen: call resume() before recording");
	}
	const canvas = pickCanvas();
	if (!canvas) {
		throw new Error("no canvas on the page");
	}
	const type = RECORD_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
	let source = canvas;
	let ui = null;
	if (opts && opts.ui) {
		source = document.createElement("canvas");
		source.width = canvas.width;
		source.height = canvas.height;
		ui = { img: null, layers: 0 };
		const g = source.getContext("2d");
		const draw = () => {
			if (!ui.done) {
				g.drawImage(canvas, 0, 0, source.width, source.height);
				if (ui.img) {
					g.drawImage(ui.img, 0, 0, source.width, source.height);
				}
				state.realRaf(draw);
			}
		};
		// Re-renders the UI layer only after the DOM changes (rendering it blocks the page for
		// tens of ms, so a nonstop loop drops the canvas to about 13 fps).
		ui.dirty = true;
		ui.observer = new MutationObserver(() => {
			ui.dirty = true;
		});
		ui.observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
		const refresh = async () => {
			while (!ui.done) {
				if (ui.dirty) {
					ui.dirty = false;
					try {
						ui.img = await uiImage(source.width, source.height);
						ui.layers++;
					} catch (e) {
						ui.dirty = true;
					}
				}
				await new Promise((r) => setTimeout(r, 100));
			}
		};
		state.realRaf(draw);
		refresh();
	}
	const stream = source.captureStream(fps || 60);
	const rec = { recorder: new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 24000000 }), stream: stream, chunks: [], type: type, frames: 0, started: performance.now(), size: canvas.width + "x" + canvas.height, ui: ui };
	rec.recorder.ondataavailable = (e) => {
		if (e.data.size > 0) {
			rec.chunks.push(e.data);
		}
	};
	// Counts rendered frames, so a paused page (nothing drawn) shows up in the result.
	const count = () => {
		if (state.rec === rec) {
			rec.frames++;
			state.realRaf(count);
		}
	};
	state.rec = rec;
	state.realRaf(count);
	rec.recorder.start(1000);
	return { recording: true, size: rec.size, type: type };
}

export async function stopRecording(name) {
	const rec = state.rec;
	if (!rec) {
		throw new Error("not recording: call startRecording() first");
	}
	const stopped = new Promise((resolve) => {
		rec.recorder.onstop = resolve;
	});
	rec.recorder.stop();
	await stopped;
	state.rec = null;
	if (rec.ui) {
		rec.ui.done = true;
		rec.ui.observer.disconnect();
	}
	for (const track of rec.stream.getTracks()) {
		track.stop();
	}
	const seconds = (performance.now() - rec.started) / 1000;
	const blob = new Blob(rec.chunks, { type: rec.type });
	if (rec.frames === 0 || blob.size === 0) {
		throw new Error("nothing was recorded: the browser isn't drawing this page. Bring the game's window to the front, then record again");
	}
	const res = await fetch(ORIGIN + "/save?name=" + encodeURIComponent(name), { method: "POST", headers: { "content-type": "video/webm" }, body: blob });
	const out = await res.json();
	out.seconds = Math.round(seconds * 10) / 10;
	out.fps = Math.round(rec.frames / seconds);
	out.size = rec.size;
	if (rec.ui) {
		out.uiLayersPerSecond = Math.round(rec.ui.layers / seconds * 10) / 10;
	}
	return out;
}

// Records for a fixed time in one call. Keep it short enough for the agent's tool-call timeout.
export async function record(name, seconds, fps, opts) {
	startRecording(fps, opts);
	await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
	return stopRecording(name);
}

export function status() {
	return { mode: state.mode, held: state.held.length, hidden: state.hidden.length, copy: state.copy ? state.copy.width + "x" + state.copy.height : null, recording: !!state.rec };
}
