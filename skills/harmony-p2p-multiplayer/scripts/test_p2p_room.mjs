// Tests p2p_room.js against an in-process PeerJS stand-in (no network). Run after any change:
//   node test_p2p_room.mjs path/to/p2p_room.js
// (path is relative to the current directory; mock_peerjs.mjs must sit next to this file)
import { pathToFileURL } from "node:url";
const mod = await import(pathToFileURL(process.argv[2]).href);
const { P2PRoom, State, newCode, cleanCode, groupCode, cleanName, cleanId, clampNumber, splitLine, fingerprint, cleanIce, hasRelay, loadIce, chunkText, ChunkJoiner } = mod;

// The PeerJS stand-in lives in mock_peerjs.mjs so other test runners can reuse it.
const { MockPeer } = await import(new URL("./mock_peerjs.mjs", import.meta.url).href);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, what) => { console.log((ok ? "PASS " : "FAIL ") + what); if (!ok) failures++; };
const log = (room, name) => { const ev = []; for (const t of ["state", "hosting", "request", "joined", "data", "left", "denied", "rekeyed", "dropped", "error"]) room.on(t, (d) => ev.push([t, d])); return ev; };
const has = (ev, t, pred = () => true) => ev.some(([x, d]) => x === t && pred(d));

// Helpers
const c = newCode();
check(c.length === 12 && /^[23456789A-HJ-NP-Z]+$/.test(c), "newCode alphabet/length " + c);
check(cleanCode(" abcd-efgh ijkl ") === "ABCDEFGHIJKL", "cleanCode");
check(groupCode("ABCDEFGHIJKL") === "ABCD-EFGH-IJKL", "groupCode");
check(cleanName("<b>Bob</b>!!") === "bBobb" && cleanName("   ") === "Friend", "cleanName");
check(cleanId("teal_01") === "teal_01" && cleanId("../x") === "", "cleanId");
check(clampNumber("NaN", 0, 10, 5) === 5 && clampNumber("12abc", 0, 10, 5) === 5 && clampNumber(99, 0, 10) === 10 && clampNumber("", 0, 1, 0.5) === 0.5, "clampNumber");
check(splitLine("S|a|b", "S", 3)?.length === 3 && splitLine("S|a", "S", 3) === null, "splitLine");

// Names in any script survive; controls, emoji and markup characters don't.
check(cleanName("王小明") === "王小明" && cleanName("José") === "José" && cleanName("김민준") === "김민준", "cleanName keeps CJK and accented names");
check(cleanName("‮evil​") === "evil" && cleanName("a  🎉  b") === "a b", "cleanName strips bidi, zero-width and emoji");
check(Array.from(cleanName("𠮷".repeat(20))).length === 16 && !cleanName("𠮷".repeat(20)).includes("�"), "cleanName caps by code point");

check(fingerprint("abc") === fingerprint("abc") && fingerprint("abc") !== fingerprint("abd") && /^[0-9a-f]{8}$/.test(fingerprint("")), "fingerprint");

// ICE: cleaned, relay detected, failures fall back to STUN (no relay), success cached.
const dirty = { iceServers: [{ urls: ["turn:t.example:3478", "http://x", "stun:" + "a".repeat(300)], username: "u", credential: "c", evil: 1 }, { urls: 5 }, ...Array(20).fill({ urls: "stun:s:1" })] };
const cleaned = cleanIce(dirty);
check(cleaned.length === 7 && cleaned[0].urls.length === 1 && cleaned[0].username === "u" && !("evil" in cleaned[0]), "cleanIce reads 8 entries, keeps valid urls and known fields");
check(hasRelay({ iceServers: cleaned }) && !hasRelay({ iceServers: [{ urls: "stun:s:1" }] }), "hasRelay");
const realFetch = globalThis.fetch;
let fetches = 0;
globalThis.fetch = async (url, init) => {
	fetches++;
	if (url === "/slow") return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("abort"))));
	if (url === "/busy") return { ok: false, status: 429 };
	return { ok: true, json: async () => ({ iceServers: [{ urls: "turn:t.example:3478", username: "u", credential: "c" }] }) };
};
check(!hasRelay({ iceServers: await loadIce("/busy") }), "loadIce falls back to STUN on 429");
check(!hasRelay({ iceServers: await loadIce("/slow", 0.05) }), "loadIce falls back to STUN on timeout");
fetches = 0;
const loaded = await loadIce("/ice");
await loadIce("/ice");
check(hasRelay({ iceServers: loaded }) && fetches === 1, "loadIce gets TURN and caches it");
globalThis.fetch = realFetch;

// Chunks: round trip in any order, duplicates ignored, too big and malformed refused.
const bigText = "x|y".repeat(2000);
const lines = chunkText("s1", bigText);
const joiner = new ChunkJoiner();
let joined = null;
for (const line of [...lines].reverse()) joined = joiner.add(line) ?? joined;
check(lines.length === 4 && lines.every((l) => l.length < 2048) && joined?.key === "s1" && joined.text === bigText, "chunkText / ChunkJoiner round trip");
check(chunkText("s1", "a".repeat(1500 * 64 + 1)) === null && chunkText("../", "a") === null, "chunkText refuses too big and bad keys");
check(joiner.add("K|s2|5|3|a") === null && joiner.add("K|s2|0|99|a") === null && joiner.add("K|s2|0|1|" + "a".repeat(1501)) === null, "ChunkJoiner rejects bad parts");
const one = new ChunkJoiner();
one.add("K|s3|0|2|a");
check(one.add("K|s3|0|2|b") === null && one.add("K|s3|1|2|c")?.text === "ac", "ChunkJoiner ignores a repeated part");

// Hide my IP without a relay refuses to open instead of going direct.
const hidden = new P2PRoom({ Peer: MockPeer, namespace: "test-", ice: { iceServers: [{ urls: "stun:s:1" }], iceTransportPolicy: "relay" } });
const hidev = log(hidden);
hidden.host();
check(has(hidev, "error", (d) => d.type === "no-relay") && hidden.state === State.IDLE && hidden.peer === null, "relay-only without TURN fails closed");
hidden.leave();

const opts = { Peer: MockPeer, namespace: "test-", version: "1", heartbeat: 0.05, timeout: 0.4, connectTimeout: 1.2 };
const host = new P2PRoom({ ...opts, look: { name: "Host" } });
const hev = log(host);
host.on("request", () => host.accept());
host.host();
await wait(150);
check(host.state === State.HOSTING && has(hev, "hosting"), "host opens");
const code = host.code;

const guest = new P2PRoom({ ...opts, look: { name: "Guest" } });
const gev = log(guest);
guest.join(groupCode(code).toLowerCase());
await wait(250);
check(guest.state === State.CONNECTED && has(gev, "joined", (d) => d.look.name === "Host"), "guest joined, sees host look");
check(host.together && has(hev, "joined", (d) => d.look.name === "Guest"), "host has friend");
const fast = host.fast.get(host.friendIds[0]);
check(fast && guest.fast.size === 1 && fast.ordered === false && fast.maxRetransmits === 0, "lossy unordered fast channel open on both sides");
check(host.main.size === 1, "one PeerJS connection per guest");

guest.send("S|x|1"); host.sendFast("M|2|3"); host.sendJson({ type: "plan", map: "a" });
await wait(150);
check(has(hev, "data", (d) => d.text === "S|x|1"), "guest -> host data");
check(has(gev, "data", (d) => d.text === "M|2|3") && has(gev, "data", (d) => d.text.includes("plan")), "host -> guest fast + json");

// Oversized and non-string messages are dropped.
guest._debugReceive(guest.friendIds[0], "x".repeat(5000));
guest._debugReceive(guest.friendIds[0], { evil: 1 });
check(gev.filter(([t]) => t === "data").length === 2, "oversize / non-string dropped");

// Backpressure: a backed-up fast channel drops snapshots instead of queueing them.
fast.bufferedAmount = 1e6;
host.sendFast("M|dropped");
fast.bufferedAmount = 0;
host.sendFast("M|kept");
await wait(150);
check(!has(gev, "data", (d) => d.text === "M|dropped") && has(gev, "data", (d) => d.text === "M|kept"), "backed-up fast channel drops, then recovers");

// Simulated bad network on the fast channel: about half the messages are lost.
guest.simulate = { loss: 0.5, latency: 0.02, jitter: 0.02 };
for (let i = 0; i < 100; i++) host.sendFast("M|sim|" + i);
await wait(300);
const arrived = gev.filter(([t, d]) => t === "data" && d.text.startsWith("M|sim|")).length;
check(arrived > 20 && arrived < 80, "simulate loss drops about half (" + arrived + " of 100)");
guest.simulate = null;

// Rate limit: a flood past maxRate in one second is dropped unparsed.
const before = hev.filter(([t]) => t === "data").length;
for (let i = 0; i < 300; i++) host._debugReceive(host.friendIds[0], "S|flood|" + i);
const flooded = hev.filter(([t]) => t === "data").length - before;
check(flooded > 0 && flooded <= 120, "rate limit caps a flood (" + flooded + " of 300 let through)");
check(hev.filter(([t]) => t === "dropped").length === 1, "a reliable flood raises one dropped event");
host.rates.clear();

// A burst of snapshots on the fast channel doesn't use up the reliable budget.
const fid = host.friendIds[0];
for (let i = 0; i < 300; i++) host._onData(fid, "S|burst|" + i, true);
const beforeEvent = hev.filter(([t]) => t === "data").length;
host._debugReceive(fid, "E|event");
check(hev.filter(([t]) => t === "data").length === beforeEvent + 1, "fast flood leaves the reliable budget alone");
host.rates.clear();
host.fastRates.clear();

// Version mismatch and full.
const old = new P2PRoom({ ...opts, version: "0" });
const oev = log(old);
old.join(code);
await wait(250);
check(has(oev, "denied", (d) => d.reason === "version"), "version mismatch denied");
const third = new P2PRoom(opts);
const tev = log(third);
third.join(code);
await wait(250);
check(has(tev, "denied", (d) => d.reason === "full") && third.state === State.IDLE, "third player denied full");

// Heartbeat keeps a quiet-but-alive friend.
await wait(700);
check(host.together && guest.together, "heartbeat keeps connection past timeout");

// Kick rolls a new code, and the room stops claiming to be connected straight away.
const kickedId = host.friendIds[0];
const beforeKick = hev.length;
host.kick();
check(host.state === State.HOSTING && !host.together, "kick leaves the connected state immediately");
// A modified client that says hello again before its connection is dropped must not become the
// pending joiner, or it would block everyone else ("full") until the host answered a dead prompt.
host._onData(kickedId, JSON.stringify({ type: "hello", version: host.version, look: {} }));
check(host.pending === null && !hev.slice(beforeKick).some(([t, d]) => t === "request" && d.id === kickedId), "kicked peer can't ask to join again before it's dropped");
await wait(700);
check(has(gev, "denied", (d) => d.reason === "kicked") && guest.state === State.IDLE, "guest kicked");
check(has(hev, "rekeyed") && host.code !== code && host.state === State.HOSTING, "host rekeyed " + host.code);
const afterKick = hev.slice(hev.findIndex(([t, d]) => t === "left" && d.reason === "kicked"));
check(!afterKick.some(([t, d]) => t === "state" && d.state === State.OPENING), "kick never shows Opening a room (no Cancel flash)");
const back = new P2PRoom(opts);
const bev = log(back);
back.join(code);
await wait(250);
check(has(bev, "error", (d) => d.type === "peer-unavailable"), "old code dead");

// A slow host: waiting for approval outlasts the connect timeout, then gives up at the approval timeout.
host.listeners.set("request", [() => {}]);
const patient = new P2PRoom({ ...opts, approvalTimeout: 2.5 });
const patev = log(patient);
patient.join(host.code);
await wait(1800);
check(patient.state === State.WAITING, "waiting for approval survives the connect timeout");
await wait(1500);
check(has(patev, "error", (d) => d.type === "approval-timeout") && patient.state === State.IDLE, "gives up at the approval timeout");
host.pending = null;
await wait(400);

// A waiting joiner who repeats hello doesn't reopen the host's prompt.
let prompts = 0;
host.listeners.set("request", [() => prompts++]);
const pushy = new P2PRoom(opts);
pushy.join(host.code);
await wait(250);
for (let i = 0; i < 5; i++) pushy._sendJson(pushy.friendIds[0] ?? [...pushy.main.keys()][0], { type: "hello", version: "1", look: {} });
await wait(150);
check(prompts === 1, "repeated hello raises one prompt (" + prompts + ")");
pushy.leave();
await wait(400);

// Deny path, then bye.
host.listeners.set("request", [() => host.deny()]);
const rude = new P2PRoom(opts);
const rev = log(rude);
rude.join(host.code);
await wait(400);
check(has(rev, "denied", (d) => d.reason === "denied"), "host deny");
host.listeners.set("request", [() => host.accept()]);
const pal = new P2PRoom(opts);
const pev = log(pal);
pal.join(host.code);
await wait(250);
check(pal.together, "rejoin with new code");
pal.leave();
await wait(150);
check(has(hev, "left", (d) => d.reason === "left"), "bye -> left");

// Stranger who never says hello is dropped.
const peer = new MockPeer();
await wait(100);
const conn = peer.connect("test-" + host.code, { reliable: true });
await wait(150);
check(host.main.size === 1, "stranger connected");
await wait(1600);
check(host.main.size === 0, "silent stranger dropped");

// Only maxStrangers silent connections may wait at once.
const lurkers = [];
for (let i = 0; i < 6; i++) { const p = new MockPeer(); lurkers.push(p); }
await wait(100);
for (const p of lurkers) p.connect("test-" + host.code, { reliable: true });
await wait(200);
check(host.strangers.size === 4 && host.main.size === 4, "silent connections capped at 4 (" + host.main.size + ")");
await wait(1600);

// Timeout when the friend's game goes silent (stop its timer and channel).
const quiet = new P2PRoom(opts);
quiet.join(host.code);
await wait(250);
quiet._stopTimer();
quiet._sendJson = () => {};
await wait(700);
check(has(hev, "left", (d) => d.reason === "timeout"), "silent friend times out");

host.leave();
await wait(200);

// Rooms of 3: two guests, host relays one guest's state to the other.
const big = new P2PRoom({ ...opts, maxGuests: 2 });
const bigev = log(big);
big.on("request", () => big.accept());
big.on("data", ({ id, text }) => big.sendOthers(text, id, true));
big.host();
await wait(250);
const g1 = new P2PRoom(opts), g2 = new P2PRoom(opts);
const g1ev = log(g1), g2ev = log(g2);
g1.join(big.code);
await wait(250);
g2.join(big.code);
await wait(250);
check(big.friends.size === 2 && g1.together && g2.together, "two guests in a 3-player room");
g1.sendFast("S|g1|0");
await wait(150);
check(has(g2ev, "data", (d) => d.text === "S|g1|0") && !has(g1ev, "data", (d) => d.text === "S|g1|0"), "host relays guest 1 to guest 2 only");

// A new code while guests are in keeps them; the old code goes quiet and the joiner times out
// with a message that covers an out-of-date code.
const bigCode = big.code;
big.newCode();
await wait(150);
check(big.code !== bigCode && g1.together && g2.together && big.friends.size === 2, "new code mid-session keeps both guests");
const late = new P2PRoom(opts);
const lev = log(late);
late.join(bigCode);
await wait(1600);
check(has(lev, "error", (d) => d.type === "connect-timeout" && d.message.includes("out of date")) && late.state === State.IDLE, "join on a retired code with guests still in times out");
big.leave();
await wait(200);
check(has(g1ev, "left") && has(g2ev, "left"), "host leaving reaches every guest");
console.log(failures === 0 ? "ALL PASS" : failures + " FAILED");
process.exit(failures ? 1 : 0);
