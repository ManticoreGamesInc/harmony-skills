# Engine glue

The networking lives in one JavaScript module (`scripts/p2p_room.js`). The engine side needs a
call into it, a callback out of it, and a per-frame tick. Keep the game-facing API the same
whatever the engine:

```
host() / join(code) / leave() / kick(id)
accept() / deny()
send(text) / sendFast(text)
events: hosting { code }, request { id, look }, joined { id, look }, data { id, text },
        left { id, reason }, denied { reason, message }, error { type, message }
```

## Contents
- Any web engine: Three.js, Babylon, PlayCanvas, Phaser, PixiJS, WebGPU, plain canvas
- Unity, Godot and other engines
- Keeping the session alive in a hidden tab
- Engine notes

## Any web engine

Import the module directly; the renderer doesn't matter to the network code. Copy
`scripts/p2p_room.js` into the project unchanged, and in a TypeScript project copy
`scripts/p2p_room.d.ts` next to it, so the import is typed. Install PeerJS from npm and import
it, so it ships inside the game's build instead of loading from a CDN.

```js
import { Peer } from "peerjs";
import { P2PRoom, cleanName } from "./p2p_room.js";

const room = new P2PRoom({ Peer, namespace: "mystudio-mygame-", version: GAME_VERSION, look: myLook });

room.on("request", ({ id, look }) => {
	// look is untrusted: clean every field before showing it.
	showJoinPrompt(cleanName(look.name), () => room.accept(), () => room.deny());
});
room.on("data", ({ text }) => netInbox.push(text));   // handle inside the game tick

renderer.setAnimationLoop(() => {
	for (const text of netInbox.splice(0)) handle(text);
	updateWorld();
	renderer.render(scene, camera);
});
```

- Queue incoming messages and handle them in the game tick, so handlers never run halfway
  through a frame.
- Use `textContent`, or the engine's text call, for any string a peer sent. Never `innerHTML`.

## Unity, Godot and other engines

Engines whose games aren't written in JavaScript use `p2p_room.js` through a bridge: a small
JavaScript wrapper exposes `host`, `join`, `send` and the room's events on `window`, and the
engine calls it (a Unity `.jslib` with C#, Godot's `JavaScriptBridge`). The harmony-engines
skill has the wrapper and both engines' sides.

- Everything else in this skill applies unchanged: consent, codes, approval, validation, the
  protocol and sync.
- Peer messages reach the engine as strings: parse and validate every field there, and show any
  text with rich text or BBCode off.
- The engine's editor can't run the room. Test in the web build with two browser windows, as in
  `testing.md`.

## Keeping the session alive in a hidden tab

The room's heartbeat runs on `setInterval`, so it survives a hidden tab when
`setAnimationLoop` / `requestAnimationFrame` stops. Send state from a timer too if you want
the host's world to keep reaching the guest while the host's tab is hidden, and tick the
host's authoritative simulation (timers, AI, turn clocks) from a timer while
`document.hidden`, or the guest waits on a frozen host:

```js
let last = performance.now();
setInterval(() => {
	const now = performance.now();
	const dt = Math.min((now - last) / 1000, 1);
	last = now;
	if (document.hidden && inSession) {
		updateSimulation(dt);   // the same update the render loop calls, minus rendering
	}
}, 250);
// In the render loop, also set last = performance.now() each frame so the two never double-tick.
```

Browsers slow timers in hidden tabs to about once a second, which is still enough for the
heartbeat and a slow simulation tick.

## Engine notes

- **Three.js, Babylon, PlayCanvas, WebGPU:** drive the tick from the engine's render loop
  (`setAnimationLoop`, `runRenderLoop`, the `update` event) as above.
- **Phaser:** handle the inbox in a scene's `update(time, delta)`. Phaser pauses its loop in a
  hidden tab, so the timer above matters.
- **PixiJS:** handle the inbox in a `app.ticker.add(...)` callback.
- **Plain canvas:** handle the inbox at the top of the `requestAnimationFrame` callback.
- **Engines with their own UI layer** (Phaser text, Pixi `Text`, canvas `fillText`) draw peer
  strings as text already; keep it that way rather than switching to an HTML overlay with
  `innerHTML`.
- **Threaded WebAssembly** builds need cross-origin isolation headers; on Harmony, ship a
  single-threaded build (see "Hosting headers" in `transport.md`). WebRTC itself needs none.
