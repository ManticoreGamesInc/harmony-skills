# Testing and debugging

## Contents
- Local server
- Two-window test
- Fake-peer harness
- Simulating a bad network
- Probe logging
- Reaching the end fast
- What to test every build
- Bugs seen in practice

## Local server

Serve the build over HTTP on localhost (WebRTC and `crypto.getRandomValues` work on
`localhost` without HTTPS; `navigator.clipboard` needs a secure context, which localhost is).
The server below sends cross-origin isolation headers, which threaded WASM builds need when
you host the game yourself. For a game going on Harmony, remove those three header lines: a
hosted game can't count on isolation, and testing with it can hide a build that breaks there.
A minimal Python server:

```python
import http.server, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
class Handler(http.server.SimpleHTTPRequestHandler):
	def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
	def end_headers(self):
		self.send_header("Cross-Origin-Opener-Policy", "same-origin")
		self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
		self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
		self.send_header("Cache-Control", "no-store")
		super().end_headers()
http.server.ThreadingHTTPServer(("127.0.0.1", 8080), Handler).serve_forever()
```

## Two-window test

This is also how Unity and Godot games that bridge the room are tested: in their web build,
since the engine's editor can't run the room.

- Open two windows side by side, not two tabs (a hidden tab throttles and hides bugs that a
  player with two monitors won't see, or shows timeouts that aren't real).
- Use two browser profiles or one normal + one private window, so local saves, names and
  "consent already shown" flags don't collide (same-origin windows share `localStorage`).
  Where that isn't possible (two tabs or two Playwright pages on one origin), a dev-only
  `?name=` override keeps both players from showing the same default name. Clean it with
  `cleanName()` like any name, and leave it out of release builds.
- Host in one, copy the code, join in the other. Watch both consoles.
- Test across machines and networks before release (phone hotspot is a good NAT test).
- Agents: don't use two tabs of a browser panel built into the agent's app for this. A background tab there pauses `requestAnimationFrame` yet still reports
  `document.hidden = false`, and clicks and typing never reach it, so one side freezes and
  the visibility code never runs. Drive two real windows with Playwright instead (two browser
  contexts, both visible), which also gives each side its own storage.

## Fake-peer harness

Two windows per change is slow. In a headless test page (or the engine's own test setup), fake the
other player by feeding messages straight into the receive handler:

```js
// Pretend a friend is connected and driving in a circle beside us. The lines go through the
// room's real receive path (size cap, friend check), then out as normal "data" events.
room._debugSetFriend("test-peer", { name: "Tester", level: 3 });
let t = 0;
setInterval(() => {
	t += 1 / 15;
	const x = Math.cos(t) * 4, z = Math.sin(t) * 4;
	room._debugReceive("test-peer", `S|arena|${performance.now() / 1000}|${x}|0|${z}|0|0|0|1|0|0|250|300|0`);
}, 1000 / 15);
```

`scripts/test_p2p_room.mjs` tests the room module itself (handshake, deny reasons, kick and
new code, timeouts) against an in-process PeerJS stand-in. When the module is vendored
unchanged, copy the test and `scripts/mock_peerjs.mjs` into the same folder of the project
(for example `tests/net/`) and run them against the copy, from the project's test script:

```
node tests/net/test_p2p_room.mjs src/net/p2p_room.js
```

It prints PASS or FAIL per check and exits with 1 on any failure. Run it after updating the
copy. If the project's runner picks up every `.mjs` file under `tests/`, exclude these two.

Only when the module is ported into the project's style (renamed API, rewritten in
TypeScript) do the tests need porting too, since they call the original API. Test the port
with the project's own runner. `scripts/mock_peerjs.mjs` exports the stand-in on its own:

```js
import { afterEach, expect, it } from "vitest";
import { MockPeer, resetMockPeers } from "./mock_peerjs.mjs";
import { P2PRoom } from "../src/net/p2p_room";

afterEach(resetMockPeers);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

it("guest joins and both sides see each other", async () => {
	const opts = { Peer: MockPeer, namespace: "test-", version: "1", heartbeat: 0.05, timeout: 0.4 };
	const host = new P2PRoom({ ...opts, look: { name: "Host" } });
	host.on("request", () => host.accept());
	host.host();
	await wait(150);
	const guest = new P2PRoom({ ...opts, look: { name: "Guest" } });
	guest.join(host.code);
	await wait(250);
	expect(host.together && guest.together).toBe(true);
	host.leave();
	guest.leave();
});
```

Port the rest of `test_p2p_room.mjs` the same way: one `it` per section, with generous
timeouts, since the checks wait on real timers.

### A hostile peer

The same harness tests the game's own screens against a peer that ignores the rules. The room
module's tests cover its helpers; this covers what the game does with the result. Feed a hostile
look and hostile messages, then play through the lobby, the match and the results:

```js
// Each of these must show as plain, capped text, change nothing, and crash nothing.
const HOSTILE_NAMES = [
	"<img src=x onerror=\"window.__pwned = true\">",
	"x".repeat(500),
	"\u202eevil",                       // right-to-left override
	"zero\u200bwidth\nnew line",
	"__proto__",
];
for (const name of HOSTILE_NAMES) {
	room._debugSetFriend("test-peer", { name, tag: "<b>", level: "9e999", color: "red;background:url(x)" });
	room._debugReceive("test-peer", JSON.stringify({ type: "__proto__", constructor: { prototype: { polluted: true } } }));
	room._debugReceive("test-peer", JSON.stringify({ type: "constructor", x: "NaN" }));
	room._debugReceive("test-peer", "{not json");
}
```

Then check: no element the peer named exists (`document.querySelector("img[src=x]")` is null),
`window.__pwned` and `({}).polluted` are undefined, names show cleaned and capped with no flipped
text, the level and color fall back to defaults, and the game still plays. Do the same in an
engine through its bridge, with labels showing markup as plain characters.

Watch for test-only artifacts: a harness that pauses between steps leaves interpolation
buffers stale and the ghost hides itself, and a quiet timer that isn't reset drops the fake
friend after the heartbeat timeout.

## Simulating a bad network

Browser DevTools network throttling doesn't affect WebRTC data channels, so a smooth test on
localhost tells you nothing about a friend on hotel Wi-Fi. Options:

- `new P2PRoom({ simulate: { loss: 0.1, latency: 0.12, jitter: 0.05 } })` drops and delays
  incoming fast-channel messages (seconds). Turn it on from a debug menu in both windows.
  It doesn't touch the reliable channel. Games where reliable round trips matter (grabs and
  locks, move requests) need a delay hook of their own around the reliable receive path; 300
  ms makes every race show up.
- OS level: clumsy (Windows), `tc netem` (Linux), Network Link Conditioner (macOS).
- Test at 10% loss and 150 ms plus jitter before calling interpolation done.

## Probe logging

When something shows on one screen but not the other, add a temporary probe that logs to the
browser console with a tag (`[PROBE]`) and only the facts needed: which object, which
component, enabled state, position, material/shader. Log on change, not every frame. Gate it
so it runs in solo too if the bug might not be multiplayer-only. Remove it once fixed.

## Reaching the end fast

- A dev console hook that applies host commands directly (`win`, `place all but one`,
  `skip to the last wave`) gets both sides to the result screen in seconds, so completion,
  rewards and history get tested every build rather than once.
- Mirror check: replay a scripted host session into the guest's apply code and compare the
  final state with the host's. It catches events the guest applies differently.
- Test the layers above the room module too (lobby, table or world sync), not just the room
  and protocol. That's where the loading-gate and result bugs live.

## What to test every build

- [ ] Host, join, approve, deny, kick (does the old code stop working?)
- [ ] Version mismatch shows the right message
- [ ] Third player gets "full"
- [ ] Ready-up: plan change clears guest ready; countdown cancels on unready; guest starts only on `go`
- [ ] Both avatars move smoothly on both screens; firing shows only when firing
- [ ] Enemies move smoothly on the guest; attacks telegraph on the guest
- [ ] Guest hits and stuns affect host enemies; host enemies damage the guest
- [ ] Abilities and cosmetics visible to both
- [ ] Down, revive, both down
- [ ] Joint objective needs both; waiting text fits
- [ ] Guest leaves mid-run, host leaves mid-run, network pulled mid-run
- [ ] Hidden tab for 30 s on each side, including while the guest is loading
- [ ] Joining with the code from before a kick or New Code fails fast with a clear message
- [ ] A Chinese, Japanese or Korean name shows as typed on the other side
- [ ] The hostile-peer harness: markup, 500-character, right-to-left and `__proto__` names and
      messages show as plain capped text, pollute nothing and crash nothing
- [ ] Builds with different content tables refuse each other at the handshake
- [ ] Before release: two devices on two different networks, and with Hide my IP on, check
      `chrome://webrtc-internals` shows a relay candidate pair

## Bugs seen in practice

| Symptom | Cause | Fix |
|---|---|---|
| Joiner sees only themselves | host sent its look before marking Connected; joiner's handler dropped it | set Connected, then send |
| Guest READY stuck disabled | plan arrived before the host's look; handler required both | accept lobby messages once Connected |
| Remote weapon recoils constantly | effect played on every state packet even with zero new shots | early return when the shot delta is 0 |
| Mystery colored squares after revive | re-enabled every renderer on the ghost, including hidden effect meshes | restore only what was enabled |
| Enemy frozen in place | retarget restarted behavior while the pathing agent was still stopped | reset the agent's stopped state on retarget |
| Wave timer flickers 13/12/13 | one side paused time for a menu | no shared pause; tolerance on mirrored timers |
| Players spawn inside each other | both used the same spawn point | queue spawns |
| Players shove each other / block revives | avatar collision with a lagging ghost | ignore player-player collision |
| Boost marks / dust missing on the remote | effects read the local controller, which the ghost lacks | interface both the controller and a ghost driver implement |
| Cosmetic colors missing on the remote | look message lacked the new fields | add to the look, validate, apply on change |
| Connection drops when tab is hidden | game loop (and heartbeats) stopped with rAF | run in background / timer-driven network tick |
| Guest's turn timer freezes while the host's tab is hidden | host's match clock ticks in the render loop | tick the authoritative simulation from a timer while hidden |
| Lobby still shows a kicked player for a moment | state stayed "connected" until the new code opened | set the hosting state as soon as the last friend is removed |
| CJK names all show as "Friend" | name filter allowed only `A-Za-z0-9` | keep `\p{L}\p{N}`, strip controls (`cleanName`) |
| Join on an old code hangs 15 s, then blames the network | old peer `disconnect()`ed, not destroyed; its ID stops answering | destroy it when nobody's left on it; timeout text covers an out-of-date code |
| Guest waits forever after picking content | builds had different content tables under the same version; guest rejected the plan silently | fingerprint the tables into the version; always answer `loaded{ok:false}` |
| Events go missing during busy moments | rate limit shared by both channels dropped reliable events | a budget per channel, batch events, number them and resync on a gap |
| Guest stuck on loading in a background tab | loading waited on `requestAnimationFrame` | race rAF against a 100 ms timer |
| Board limit bigger than the wire allows | a group move on the largest board was over 2 KB and dropped | derive validation limits from the message cap |
| Shared result posted to a solo leaderboard | co-op flag lived on the room, gone after the host left | store the co-op flag on the saved run, in its own slot |
| Both test windows show the same name | same origin, shared storage | dev-only name override |
