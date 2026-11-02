// p2p_room.js: small-group P2P game rooms over PeerJS (WebRTC data channels).
//
// Engine agnostic: works in any browser game (Three.js, Babylon, PlayCanvas, Phaser, PixiJS,
// WebGPU, plain canvas).
//
// What it does for you:
// - crypto-random room codes (60 bits), namespaced peer IDs, retry when an ID is taken
// - host approval: the host sees a "request" and calls accept() or deny()
// - version check, room cap, deny reasons (full, version, kicked, denied)
// - kick() drops the guest and reopens under a new code (other guests stay connected)
// - two channels per guest on one WebRTC connection: reliable ordered (send) and lossy
//   unordered (sendFast). PeerJS's own `reliable: false` only turns ordering off and still
//   retransmits, so the lossy channel is a pre-negotiated RTCDataChannel added to the PeerJS
//   connection's peerConnection.
// - heartbeat on a timer (survives hidden tabs), quiet timeout, join timeout
// - message size cap, strings only, per-peer rate limits (one budget per channel, so a burst of
//   snapshots never eats the events), ignores anyone who isn't a friend
// - sendFast drops a snapshot instead of queueing when the channel is backed up
// - sendOthers() for a host relaying one guest's state to the rest (rooms of 3+)
// - simulate: { loss, latency, jitter } on incoming fast-channel messages, for testing bad
//   networks (browser DevTools throttling doesn't touch WebRTC)
// - loadIce() fetches TURN credentials from your own endpoint with a STUN fallback, and a
//   relay-only ("hide my IP") room refuses to open without a TURN server instead of going direct
// - chunkText() / ChunkJoiner for snapshots bigger than one message, fingerprint() for
//   content tables in the version string
//
// What it leaves to the game: validating every field it receives (helpers below), the
// consent notices, and all game messages. Star topology: guests only talk to the host.
//
// Events (room.on(name, fn), fn gets one object):
//   state     { state, status }        every state change, with a sentence for the UI
//   hosting   { code }                 room open; show this code (grouped, hidden by default)
//   request   { id, look }             host: someone wants in (look is UNTRUSTED, clean it)
//   joined    { id, look }             approved (host side) / let in (guest side); look is
//                                      UNTRUSTED on both sides, the host's too: clean it
//   data      { id, text }             a game message from a friend (UNTRUSTED, validate it)
//   left      { id, reason }           friend gone: "left", "closed", "timeout", "kicked"
//   denied    { reason }               guest: the host turned us away
//   rekeyed   { code }                 host: new code after a kick
//   dropped   { id }                   a friend went over maxRate on the reliable channel and
//                                      at least one event was lost: resync (send or ask for a snapshot)
//   error     { type, message }        something failed; message is player-facing
//
// Usage:
//   import { Peer } from "peerjs";               // bundle it; don't load from a CDN at runtime
//   const version = "1.0.3+" + fingerprint(JSON.stringify(LEVELS));
//   const room = new P2PRoom({ Peer, namespace: "mystudio-mygame-", version, look });
//   room.ice = { iceServers: await loadIce("/ice"), iceTransportPolicy: hideIp ? "relay" : "all" };
//   room.host();  /  room.join(typedCode);

export const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const State = Object.freeze({
	IDLE: "idle",
	OPENING: "opening",
	HOSTING: "hosting",
	JOINING: "joining",
	WAITING: "waitingApproval",
	CONNECTED: "connected",
});

const DENY_REASONS = ["full", "version", "kicked", "denied"];

// Both sides create the lossy channel with this stream id (negotiated: true), so it opens
// without another offer/answer. PeerJS's own channel takes a low id.
const FAST_CHANNEL_ID = 100;

const DENY_TEXT = {
	full: "That room is full.",
	version: "You and the host are on different versions. Both of you need to update.",
	kicked: "The host removed you from the room.",
	denied: "The host didn't let you in.",
};

const ERROR_TEXT = {
	"peer-unavailable": "No room with that code. Check it with your friend.",
	"bad-code": "That doesn't look like a room code.",
	"network": "Can't reach the matchmaking server. Check your connection.",
	"server-error": "Can't reach the matchmaking server. Check your connection.",
	"socket-error": "Can't reach the matchmaking server. Check your connection.",
	"browser-incompatible": "This browser can't do online play.",
	"no-library": "Online play failed to load.",
	"connect-timeout": "Couldn't connect. The code may be out of date, or this network blocks direct connections.",
	"approval-timeout": "The host didn't answer your request.",
	"no-relay": "Can't reach the relay server, so your IP can't be hidden right now. Try again, or turn off Hide my IP.",
};

const STUN_FALLBACK = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];

let iceCache = null;

// Validation helpers. Run every field from a peer through one of these.

/** A room code from the cryptographic random source: 32 symbols, no look-alikes (0 O 1 I). */
export function newCode(length = 12) {
	const bytes = new Uint8Array(length);
	let code = "";

	crypto.getRandomValues(bytes);

	for (let i = 0; i < length; i++) {
		code += ALPHABET[bytes[i] & 31];
	}

	return code;
}

/** What the player typed or pasted, as a bare code: upper case, A-Z and 0-9 only. */
export function cleanCode(typed) {
	return String(typed ?? "").slice(0, 64).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** XXXX-XXXX-XXXX for display. */
export function groupCode(code, size = 4) {
	return (String(code).match(new RegExp(".{1," + size + "}", "g")) ?? []).join("-");
}

/**
 * Letters and digits in any script (so 王小明 and José survive), combining marks, space, dot,
 * dash and underscore, at most max characters. Strips everything else, including bidirectional
 * and zero-width controls and emoji. Display with textContent.
 */
export function cleanName(name, max = 16, fallback = "Friend") {
	const kept = String(name ?? "").slice(0, 256).normalize("NFC").replace(/[^\p{L}\p{M}\p{N} ._-]/gu, "").replace(/ +/g, " ");
	// By code point, so a character outside the BMP is never cut in half.
	const safe = Array.from(kept.trim()).slice(0, max).join("").trim();

	return safe.length > 0 ? safe : fallback;
}

/** An ID for a lookup table (cosmetic, map, item): [A-Za-z0-9_], 1 to max long, else "". */
export function cleanId(value, max = 32) {
	const text = String(value ?? "");

	return text.length <= max && /^[A-Za-z0-9_]+$/.test(text) ? text : "";
}

/** A finite number clamped to [min, max]; anything else (NaN, Infinity, "", "12abc") is fallback. */
export function clampNumber(value, min, max, fallback = min) {
	if (value === "" || value === null || value === undefined) {
		return fallback;
	}

	const number = typeof value === "number" ? value : Number(value);

	return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

/** One of the allowed values, else fallback. */
export function cleanEnum(value, allowed, fallback) {
	return allowed.includes(value) ? value : fallback;
}

/** Split a tagged line like "S|a|b|c" when it has exactly `fields` fields, else null. */
export function splitLine(text, tag, fields) {
	if (typeof text !== "string" || text[0] !== tag || text[1] !== "|") {
		return null;
	}

	const parts = text.split("|");

	return parts.length === fields ? parts : null;
}

/**
 * A short hash (FNV-1a, 8 hex digits) of shared content: level lists, card tables, painting
 * lists. Add it to the version so builds whose tables differ refuse each other at the
 * handshake, even when nobody bumped the version number. Not for security.
 */
export function fingerprint(text) {
	const value = String(text);
	let hash = 0x811c9dc5;

	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}

	return (hash >>> 0).toString(16).padStart(8, "0");
}

/** ICE servers from an untrusted source, kept to at most 8 servers of 8 stun:/turn:/turns: URLs. */
export function cleanIce(data) {
	const list = Array.isArray(data) ? data : data?.iceServers;
	const servers = [];

	if (!Array.isArray(list)) {
		return servers;
	}

	for (const entry of list.slice(0, 8)) {
		const raw = Array.isArray(entry?.urls) ? entry.urls : [entry?.urls];
		const urls = raw.filter((url) => typeof url === "string" && url.length < 256 && /^(stun|turns?):/.test(url)).slice(0, 8);

		if (urls.length === 0) {
			continue;
		}

		const server = { urls };

		if (typeof entry.username === "string" && entry.username.length < 256) {
			server.username = entry.username;
		}

		if (typeof entry.credential === "string" && entry.credential.length < 256) {
			server.credential = entry.credential;
		}

		servers.push(server);
	}

	return servers;
}

/** True when an ICE config has at least one TURN server (a relay). */
export function hasRelay(ice) {
	return (ice?.iceServers ?? []).some((server) => [].concat(server.urls).some((url) => /^turns?:/.test(url)));
}

/**
 * iceServers from your own endpoint (which hands out short-lived TURN credentials), cleaned and
 * cached for cacheSeconds (keep it under the credentials' lifetime). Any failure (timeout,
 * 429, bad JSON, empty list) gives public STUN, which has no relay: a relay-only room then
 * refuses to open rather than connecting directly.
 */
export async function loadIce(url, timeout = 4, cacheSeconds = 600) {
	const now = Date.now();

	if (iceCache && iceCache.url === url && now - iceCache.at < cacheSeconds * 1000) {
		return iceCache.servers;
	}

	let servers = [];

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout * 1000);

		try {
			const response = await fetch(url, { signal: controller.signal, credentials: "omit" });

			if (response.ok) {
				servers = cleanIce(await response.json());
			}
		} finally {
			clearTimeout(timer);
		}
	} catch (error) {
	}

	if (servers.length === 0) {
		return [{ urls: [...STUN_FALLBACK] }];
	}

	iceCache = { url, at: now, servers };
	return servers;
}

/**
 * Split text too long for one message into "K|key|part|of|chunk" lines, parts numbered from 0.
 * Use a fresh key per snapshot ("s" + counter) so parts of two snapshots never mix. Returns
 * null when the key isn't [A-Za-z0-9_]{1,16} or the text needs more than maxParts lines.
 */
export function chunkText(key, text, size = 1500, maxParts = 64) {
	const value = String(text);
	const parts = Math.max(1, Math.ceil(value.length / size));

	if (cleanId(key, 16) === "" || parts > maxParts) {
		return null;
	}

	const lines = [];

	for (let i = 0; i < parts; i++) {
		lines.push("K|" + key + "|" + i + "|" + parts + "|" + value.slice(i * size, (i + 1) * size));
	}

	return lines;
}

/**
 * Puts chunkText lines back together, in any order. Keep one per peer. add() returns
 * { key, text } once every part of a key is in, else null. A line for a new key drops an
 * unfinished one. The joined text is as untrusted as any message: validate all of it.
 */
export class ChunkJoiner {

	constructor(size = 1500, maxParts = 64) {
		this.size = size;
		this.maxParts = maxParts;
		this._reset();
	}

	add(line) {
		if (typeof line !== "string" || !line.startsWith("K|")) {
			return null;
		}

		// The first four fields never contain "|"; the chunk is everything after them.
		const fields = line.split("|", 5);

		if (fields.length < 5) {
			return null;
		}

		const key = cleanId(fields[1], 16);
		const part = /^\d{1,3}$/.test(fields[2]) ? Number(fields[2]) : -1;
		const of = /^\d{1,3}$/.test(fields[3]) ? Number(fields[3]) : -1;
		const chunk = line.slice(fields[0].length + fields[1].length + fields[2].length + fields[3].length + 4);

		if (key === "" || of < 1 || of > this.maxParts || part < 0 || part >= of || chunk.length > this.size) {
			return null;
		}

		if (key !== this.key || of !== this.parts.length) {
			this.key = key;
			this.parts = new Array(of).fill(null);
			this.left = of;
		}

		if (this.parts[part] !== null) {
			return null;
		}

		this.parts[part] = chunk;
		this.left--;

		if (this.left > 0) {
			return null;
		}

		const text = this.parts.join("");

		this._reset();
		return { key, text };
	}

	_reset() {
		this.key = "";
		this.parts = [];
		this.left = 0;
	}

}

export class P2PRoom {

	constructor(options = {}) {
		this.PeerClass = options.Peer ?? globalThis.Peer ?? globalThis.peerjs?.Peer ?? null;
		this.namespace = options.namespace ?? "mygame-";
		this.version = String(options.version ?? "1");
		this.look = options.look ?? {};
		this.maxGuests = options.maxGuests ?? 1;
		this.codeLength = options.codeLength ?? 12;
		this.ice = options.ice ?? { iceServers: [{ urls: [...STUN_FALLBACK] }] };
		this.peerOptions = options.peerOptions ?? {};
		this.heartbeat = options.heartbeat ?? 1;
		this.timeout = options.timeout ?? 10;
		this.connectTimeout = options.connectTimeout ?? 15;
		this.approvalTimeout = options.approvalTimeout ?? 60;
		this.maxStrangers = options.maxStrangers ?? 4;
		this.maxMessage = options.maxMessage ?? 2048;
		this.maxRate = options.maxRate ?? 120;
		this.maxFastRate = options.maxFastRate ?? 120;
		this.maxBuffered = options.maxBuffered ?? 64 * 1024;
		this.simulate = options.simulate ?? null;
		this.openTries = options.openTries ?? 4;
		this.listeners = new Map();
		this.timer = null;
		this._clear();
	}

	static supported(PeerClass) {
		const hasLibrary = !!(PeerClass ?? globalThis.Peer ?? globalThis.peerjs?.Peer);

		return hasLibrary && typeof RTCPeerConnection !== "undefined";
	}

	on(type, fn) {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, []);
		}

		this.listeners.get(type).push(fn);
		return this;
	}

	get friendIds() {
		return [...this.friends.keys()];
	}

	get together() {
		return this.state === State.CONNECTED && this.friends.size > 0;
	}

	/** Open a room under a fresh code. Show the consent notice before the first call. */
	host() {
		this.leave(true);
		this.isHost = true;
		this.tries = 0;
		this._openHost();
		this._startTimer();
	}

	/** Join the room behind a typed or pasted code. Show the consent notice before the first call. */
	join(typed) {
		const code = cleanCode(typed);

		if (code.length < 8) {
			this._error("bad-code");
			return;
		}

		this.leave(true);
		this.isHost = false;
		this.code = code;
		this.joinLeft = this.connectTimeout;
		this._setState(State.JOINING, "Connecting...");

		const peer = this._makePeer(null);

		if (!peer) {
			return;
		}

		const hostId = this.namespace + code;

		peer.on("open", () => {
			if (this.peer !== peer) {
				return;
			}

			// reliable: true matters: PeerJS defaults to false, which makes the channel unordered.
			// serialization "raw": strings arrive untouched, so the size cap runs before any
			// parsing (with "json" PeerJS would parse a huge message first).
			this._watch(peer.connect(hostId, { reliable: true, serialization: "raw" }));
		});

		this._startTimer();
	}

	/** Host: let the pending guest in. */
	accept() {
		if (!this.pending) {
			return;
		}

		const { id, look } = this.pending;

		this.pending = null;
		this.friends.set(id, { look, heard: this._now() });

		// Connected before the first send: the reply handlers gate on it.
		this._setState(State.CONNECTED, "Connected.");
		this._sendJson(id, { type: "welcome", version: this.version, look: this.look });
		this._emit("joined", { id, look });
	}

	/** Host: turn the pending guest away. */
	deny() {
		if (!this.pending) {
			return;
		}

		const id = this.pending.id;

		this.pending = null;
		this._refuse(id, "denied");
	}

	/** Host: remove a guest and reopen under a new code, so they can't walk back in. */
	kick(id = this.friendIds[0]) {
		if (!this.isHost || !this.friends.has(id)) {
			return;
		}

		this._sendJson(id, { type: "deny", reason: "kicked" });
		this.friends.delete(id);
		this.kicked.add(id);          // ignore anything it sends until the connection is dropped
		this._emit("left", { id, reason: "kicked" });

		// Nobody left: say so now. Without this the state stays "connected" with no friend
		// until the new code opens, and a UI watching state shows a stale lobby.
		if (this.friends.size === 0) {
			this._setState(State.HOSTING, "Making a new code...");
		}

		setTimeout(() => {
			this._drop(id);
			this.kicked.delete(id);

			if (this.isHost && this.peer) {
				this._rekey();
			}
		}, 500);
	}

	/** Host: retire the current code now (e.g. it leaked). Connected guests stay. */
	newCode() {
		if (this.isHost && this.peer) {
			this._rekey();
		}
	}

	/** Leave the room. Friends get a "bye" so they don't wait for the timeout. */
	leave(quiet = false) {
		const peers = [this.peer, ...this.retired].filter(Boolean);
		const connections = [...this.main.values(), ...this.fast.values()];

		for (const id of this.friends.keys()) {
			this._sendJson(id, { type: "bye" });
		}

		this._clear();
		this._stopTimer();

		// A moment for the bye to get out before the channels close.
		setTimeout(() => {
			for (const connection of connections) {
				try {
					connection.close();
				} catch (error) {
				}
			}

			for (const peer of peers) {
				try {
					peer.destroy();
				} catch (error) {
				}
			}
		}, 150);

		if (!quiet) {
			this._setState(State.IDLE, "");
		}
	}

	/** A game message on the reliable, ordered channel. id omitted: every friend. */
	send(text, id = null) {
		this._send(text, id, false);
	}

	/** A game message on the lossy, unordered channel (falls back to reliable until it opens). */
	sendFast(text, id = null) {
		this._send(text, id, true);
	}

	/** Host: forward a message to every friend except one (relay a guest's state in rooms of 3+). */
	sendOthers(text, exceptId, fast = false) {
		for (const key of this.friends.keys()) {
			if (key !== exceptId) {
				this._send(text, key, fast);
			}
		}
	}

	sendJson(message, id = null) {
		this.send(JSON.stringify(message), id);
	}

	// Test helpers: fake a friend and feed messages in without a network.

	_debugSetFriend(id, look = {}) {
		this.friends.set(id, { look, heard: this._now() });
		this._setState(State.CONNECTED, "Connected (test).");
	}

	_debugReceive(id, text) {
		this._onData(id, text);
	}

	// Internals

	_clear() {
		this.peer = null;
		this.retired = [];
		this.code = "";
		this.isHost = false;
		this.state = State.IDLE;
		this.main = new Map();
		this.fast = new Map();
		this.friends = new Map();
		this.strangers = new Map();
		this.kicked = new Set();      // kicked peers whose connection hasn't closed yet
		this.rates = new Map();
		this.fastRates = new Map();
		this.pending = null;
		this.tries = 0;
		this.joinLeft = 0;
		this.lastTick = this._now();
	}

	_openHost(rekeying = false) {
		this.code = newCode(this.codeLength);
		this.tries++;

		// While a new code is being made the room is still open for the players in it, so
		// don't show "Opening a room..." (and its Cancel) after a kick.
		if (this.friends.size === 0) {
			this._setState(rekeying ? State.HOSTING : State.OPENING, rekeying ? "Making a new code..." : "Opening a room...");
		}

		const peer = this._makePeer(this.namespace + this.code);

		if (!peer) {
			return;
		}

		peer.on("open", () => {
			if (this.peer !== peer) {
				return;
			}

			this.tries = 0;

			if (this.friends.size === 0) {
				this._setState(State.HOSTING, "Waiting for your friend to join...");
			}

			this._emit("hosting", { code: this.code });
		});
		peer.on("connection", (connection) => {
			if (this.peer === peer) {
				this._watch(connection);
			} else {
				connection.close();
			}
		});
	}

	// A new peer takes joins under the new code. The old one has to stop answering:
	// - nobody left on it (the usual kick): destroy() frees the ID, so a join on the old code
	//   fails with peer-unavailable in a fraction of a second.
	// - friends still connected (rooms of 3+, newCode() mid-session): destroy() would close
	//   them too, so disconnect() keeps their connections up. The old ID then goes quiet on the
	//   signaling server and a join on it only fails at connectTimeout ("out of date, or ...").
	_rekey() {
		const old = this.peer;

		if (old && this.friends.size === 0) {
			try {
				old.destroy();
			} catch (error) {
			}
		} else if (old) {
			try {
				old.disconnect();
			} catch (error) {
			}

			this.retired.push(old);
		}

		this.peer = null;
		this.tries = 0;
		this._openHost(true);

		const peer = this.peer;

		if (peer) {
			peer.on("open", () => {
				if (this.peer === peer) {
					this._emit("rekeyed", { code: this.code });
				}
			});
		}
	}

	_makePeer(id) {
		if (!this.PeerClass) {
			this._error("no-library");
			this.leave();
			return null;
		}

		// Fail closed: a player who asked to hide their IP must never connect directly because
		// the TURN credentials didn't load.
		if (this.ice?.iceTransportPolicy === "relay" && !hasRelay(this.ice)) {
			this._error("no-relay");
			this.leave();
			return null;
		}

		const options = { ...this.peerOptions, config: this.ice, debug: 0 };
		const peer = id ? new this.PeerClass(id, options) : new this.PeerClass(options);

		this.peer = peer;

		peer.on("error", (error) => {
			if (this.peer === peer) {
				this._onPeerError(error?.type ?? "unknown");
			}
		});
		peer.on("disconnected", () => {
			// Lost the signaling socket. Live connections may be fine; a host still taking
			// joins needs the socket back.
			if (this.peer === peer && this.isHost && !peer.destroyed) {
				try {
					peer.reconnect();
				} catch (error) {
				}
			}
		});
		return peer;
	}

	_onPeerError(type) {
		if (type === "unavailable-id" && this.isHost && this.tries < this.openTries) {
			const old = this.peer;

			this.peer = null;

			try {
				old.destroy();
			} catch (error) {
			}

			this._openHost();
			return;
		}

		// A guest that vanished mid-handshake shows up on the host as peer-unavailable.
		if (type === "peer-unavailable" && this.isHost) {
			return;
		}

		const opening = this.state === State.OPENING || this.state === State.JOINING || this.state === State.WAITING;

		this._error(type);

		if (opening) {
			this.leave();
		}
	}

	_watch(connection) {
		const id = connection.peer;
		const old = this.main.get(id);

		if (old && old !== connection) {
			try {
				old.close();
			} catch (error) {
			}
		}

		this.main.set(id, connection);

		connection.on("open", () => {
			if (this.main.get(id) !== connection) {
				return;
			}

			this._openFast(id, connection);

			if (this.isHost) {
				// Must say hello within the join timeout or get dropped, and only a few may wait.
				if (this.strangers.size >= this.maxStrangers) {
					this._drop(id);
					return;
				}

				this.strangers.set(id, this._now());
			} else {
				this._sendJson(id, { type: "hello", version: this.version, look: this.look });
				// Connected: now the host is deciding, which can take longer than connecting.
				this.joinLeft = this.approvalTimeout;
				this._setState(State.WAITING, "Waiting for the host to let you in...");
			}
		});
		connection.on("data", (data) => this._onData(id, data));

		const gone = () => this._lost(id, connection);

		connection.on("close", gone);
		connection.on("error", gone);
	}

	// The lossy channel: no retransmits, no ordering. Late or lost snapshots are simply gone,
	// which is what positions want. Both sides call this on the same connection.
	_openFast(id, connection) {
		const peerConnection = connection.peerConnection;

		if (!peerConnection || typeof peerConnection.createDataChannel !== "function") {
			return;
		}

		let channel;

		try {
			channel = peerConnection.createDataChannel("fast", { negotiated: true, id: FAST_CHANNEL_ID, ordered: false, maxRetransmits: 0 });
		} catch (error) {
			return;
		}

		const gone = () => {
			if (this.fast.get(id) === channel) {
				this.fast.delete(id);
			}
		};

		channel.onopen = () => {
			if (this.main.get(id) === connection) {
				this.fast.set(id, channel);
			}
		};
		channel.onmessage = (event) => this._onFastData(id, event.data);
		channel.onclose = gone;
		channel.onerror = gone;

		if (channel.readyState === "open") {
			channel.onopen();
		}
	}

	// Test only: drop and delay fast-channel messages like a bad network would.
	_onFastData(id, data) {
		const sim = this.simulate;

		if (!sim) {
			this._onData(id, data, true);
			return;
		}

		if (Math.random() < (sim.loss ?? 0)) {
			return;
		}

		const delay = (sim.latency ?? 0) + Math.random() * (sim.jitter ?? 0);

		setTimeout(() => this._onData(id, data, true), delay * 1000);
	}

	_lost(id, connection) {
		if (this.main.get(id) !== connection) {
			return;
		}

		this.main.delete(id);
		this.strangers.delete(id);
		this.rates.delete(id);
		this.fastRates.delete(id);
		this._closeFast(id);

		if (this.pending && this.pending.id === id) {
			this.pending = null;
			this._emit("left", { id, reason: "closed" });
		}

		if (this.friends.has(id)) {
			this._removeFriend(id, "closed");
		} else if (!this.isHost && this.state !== State.IDLE) {
			this._error("connect-timeout");
			this.leave();
		}
	}

	_onData(id, data, fast = false) {
		// Strings only, capped before any parsing.
		if (typeof data !== "string" || data.length === 0 || data.length > this.maxMessage) {
			return;
		}

		if (!this._withinRate(id, fast)) {
			return;
		}

		const friend = this.friends.get(id);

		if (friend) {
			friend.heard = this._now();
		}

		if (data[0] !== "{") {
			if (friend) {
				this._emit("data", { id, text: data });
			}

			return;
		}

		let message;

		try {
			message = JSON.parse(data);
		} catch (error) {
			return;
		}

		if (!message || typeof message !== "object" || typeof message.type !== "string") {
			return;
		}

		switch (message.type) {
			case "hello":
				this._onHello(id, message);
				return;

			case "welcome":
				if (!this.isHost && this.state === State.WAITING && this.main.has(id)) {
					const look = message.look ?? {};

					this.friends.set(id, { look, heard: this._now() });
					this.joinLeft = 0;
					this._setState(State.CONNECTED, "Connected.");
					this._emit("joined", { id, look });
				}

				return;

			case "deny":
				if (!this.isHost && this.main.has(id)) {
					const reason = cleanEnum(message.reason, DENY_REASONS, "denied");

					this.leave();
					this._emit("denied", { reason, message: DENY_TEXT[reason] });
				}

				return;

			case "ping":
				return;

			case "bye":
				if (friend) {
					this._removeFriend(id, "left");
				}

				return;
		}

		if (friend) {
			this._emit("data", { id, text: data });
		}
	}

	_onHello(id, message) {
		if (!this.isHost || !this.main.has(id) || this.friends.has(id) || this.kicked.has(id)) {
			return;
		}

		if (String(message.version) !== this.version) {
			this._refuse(id, "version");
			return;
		}

		// A repeated hello from the joiner already waiting: ignore it, or each one would reopen
		// the host's prompt.
		if (this.pending && this.pending.id === id) {
			return;
		}

		if (this.friends.size >= this.maxGuests || this.pending) {
			this._refuse(id, "full");
			return;
		}

		this.strangers.delete(id);
		this.pending = { id, look: message.look ?? {} };
		this._emit("request", { id, look: this.pending.look });
	}

	// At most maxRate reliable and maxFastRate fast messages a second per peer; a flood is
	// dropped, not parsed. Separate budgets, so a burst of snapshots never costs an event.
	_withinRate(id, fast) {
		const rates = fast ? this.fastRates : this.rates;
		const limit = fast ? this.maxFastRate : this.maxRate;
		const now = this._now();
		let rate = rates.get(id);

		if (!rate || now - rate.start >= 1) {
			rate = { start: now, count: 0 };
			rates.set(id, rate);
		}

		rate.count++;

		// A lost snapshot is replaced by the next one; a lost event isn't. Say so once per window.
		if (!fast && rate.count === limit + 1 && this.friends.has(id)) {
			this._emit("dropped", { id });
		}

		return rate.count <= limit;
	}

	_refuse(id, reason) {
		this.strangers.delete(id);
		this._sendJson(id, { type: "deny", reason });
		setTimeout(() => this._drop(id), 250);
	}

	_removeFriend(id, reason) {
		this.friends.delete(id);
		this._drop(id);
		this._emit("left", { id, reason });

		if (!this.isHost) {
			this.leave();
		} else if (this.friends.size === 0 && this.peer) {
			this._setState(State.HOSTING, "Waiting for your friend to join...");
		}
	}

	_drop(id) {
		const connection = this.main.get(id);

		// A dropped peer can't stay the one waiting for approval, or nobody else could ask to join.
		if (this.pending && this.pending.id === id) {
			this.pending = null;
			this._emit("left", { id, reason: "closed" });
		}

		this.main.delete(id);
		this.strangers.delete(id);
		this._closeFast(id);

		if (connection) {
			try {
				connection.close();
			} catch (error) {
			}
		}
	}

	_closeFast(id) {
		const connection = this.fast.get(id);

		this.fast.delete(id);

		if (connection) {
			try {
				connection.close();
			} catch (error) {
			}
		}
	}

	_send(text, id, fast) {
		if (typeof text !== "string") {
			return;
		}

		for (const key of this.friends.keys()) {
			if (id !== null && key !== id) {
				continue;
			}

			const quick = fast ? this.fast.get(key) : null;

			if (quick && quick.readyState === "open") {
				// Backed up (slow link, hidden tab): drop this snapshot, the next one replaces it.
				if (quick.bufferedAmount <= this.maxBuffered) {
					quick.send(text);
				}

				continue;
			}

			const connection = this.main.get(key);

			if (connection && connection.open) {
				connection.send(text);
			}
		}
	}

	_sendJson(id, message) {
		const connection = this.main.get(id);

		if (connection && connection.open) {
			connection.send(JSON.stringify(message));
		}
	}

	// A timer, not requestAnimationFrame: rAF stops in hidden tabs and the friend would time out.
	_startTimer() {
		this._stopTimer();
		this.lastTick = this._now();
		this.timer = setInterval(() => this._tick(), this.heartbeat * 1000);
	}

	_stopTimer() {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	_tick() {
		const now = this._now();
		const gap = now - this.lastTick;

		this.lastTick = now;

		// We were frozen (tab suspended, debugger): their messages are still queued behind
		// this tick, so give everyone a fresh window rather than blaming them.
		if (gap > this.timeout / 2) {
			for (const friend of this.friends.values()) {
				friend.heard = now;
			}

			for (const id of this.strangers.keys()) {
				this.strangers.set(id, now);
			}
		}

		for (const id of this.friends.keys()) {
			this._sendJson(id, { type: "ping" });
		}

		for (const [id, friend] of [...this.friends]) {
			if (now - friend.heard > this.timeout) {
				this._removeFriend(id, "timeout");
			}
		}

		for (const [id, since] of [...this.strangers]) {
			if (now - since > this.connectTimeout) {
				this._drop(id);
			}
		}

		if (!this.isHost && this.joinLeft > 0 && this.state !== State.CONNECTED) {
			this.joinLeft -= gap;

			if (this.joinLeft <= 0) {
				this._error(this.state === State.WAITING ? "approval-timeout" : "connect-timeout");
				this.leave();
			}
		}
	}

	_setState(state, status) {
		this.state = state;
		this._emit("state", { state, status });
	}

	_error(type) {
		this._emit("error", { type, message: ERROR_TEXT[type] ?? "Online play hit a problem. Try again." });
	}

	_emit(type, detail) {
		for (const fn of this.listeners.get(type) ?? []) {
			try {
				fn(detail);
			} catch (error) {
				console.error(error);
			}
		}
	}

	_now() {
		return performance.now() / 1000;
	}

}
