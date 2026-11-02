# Transport: WebRTC, signaling, channels

## Contents
- How a connection forms
- Library choice
- Signaling server
- STUN and TURN
- Channels
- Hosting headers
- Errors worth handling

## How a connection forms

1. Both peers open a WebSocket to a **signaling server** and register an ID.
2. The guest asks the signaling server to forward an offer to the host's ID.
3. Both sides gather **ICE candidates** (local addresses, public address from STUN, relay
   addresses from TURN) and swap them through the signaling server.
4. ICE picks a working pair and opens a direct (or relayed) connection.
5. Data channels open on it. From here the signaling server isn't involved, but keep the
   socket alive so new guests can still reach the host.

Step 3 is why each peer learns the other's IP, and it happens before your game code sees a
single message. See `security.md`.

## Library choice

| Option | Use when |
|---|---|
| **PeerJS** (MIT, ~100 KB min) | Browser games. Handles signaling, offers, ICE and channels behind `peer.connect(id)`. Free public signaling server. The notes here assume 1.5.x. |
| Raw `RTCPeerConnection` | You want full control of channels or already have a WebSocket server to signal through. |
| `simple-peer`, `trystero` | Alternatives. Trystero signals over public BitTorrent/Nostr/MQTT relays, so no server at all, but you depend on third-party relays you don't control. |

**Bundle the library with the game.** Don't load it from a CDN at runtime: a CDN outage
breaks multiplayer, and pages with `Cross-Origin-Embedder-Policy: require-corp` can refuse
cross-origin scripts.

## Signaling server

PeerJS defaults to the free public server (`0.peerjs.com`). Fine for testing and small
releases; no uptime promise, shared ID namespace, rate limits you can't see.

- Namespace the peer ID: `<studio>-<game>-<ROOMCODE>`. A bare code can collide with another
  game using the same server.
- Handle `unavailable-id` (someone holds that ID) by generating a new code and retrying a
  few times.
- For a real launch, self-host `peerjs-server` (Node, one small instance handles thousands of
  idle sockets) and keep `allow_discovery` **off**, or anyone can list every open room.
  `self_hosting.md` covers where to run it, `wss`, proxies and coturn.
- The signaling server sees every peer's IP and room ID. Say so in a privacy policy.
- **Retiring an ID: `destroy()`, not `disconnect()`.** A destroyed peer's ID answers joins with
  `peer-unavailable` in about 0.2 s. A `disconnect()`ed one goes quiet: joins on it get no
  reply and hang until the joiner's own timeout (15 s). `destroy()` also closes every live
  connection on that peer, so the room module destroys the old peer after a kick when nobody
  is left on it, and only falls back to `disconnect()` when friends are still connected.

## STUN and TURN

- **STUN** tells a peer its public address. Free public servers exist
  (`stun:stun.l.google.com:19302`, `stun:stun1.l.google.com:19302`). Enough for most home
  networks.
- **TURN** relays traffic when a direct path is impossible (symmetric NAT, strict firewalls,
  many mobile carriers, some university and corporate networks). Without it, expect a
  noticeable minority of pairs to fail with no clear error. Options: self-host `coturn`, or a
  paid service (Cloudflare Calls TURN, Twilio, Metered, Xirsys). Hand out short-lived
  credentials from your backend; never ship long-lived TURN secrets in the client.
- **IP privacy through TURN.** With `iceTransportPolicy: "relay"` on both peers, only relay
  addresses are exchanged, so peers no longer learn each other's IP (the TURN provider does).
  Offer it as a "hide my IP" option if you add TURN. It costs relay bandwidth.
- **Fetch credentials, fall back, fail closed.** `loadIce("/ice")` in the room module fetches
  short-lived credentials (4 s timeout), cleans the response, caches it for 10 minutes, and
  falls back to public STUN on any failure. That fallback has no relay, so with "hide my IP" on
  the room refuses to open (`no-relay`) rather than connecting directly:

  ```js
  room.ice = { iceServers: await loadIce("/ice"), iceTransportPolicy: hideIp ? "relay" : "all" };
  room.host();
  ```

Config passed to PeerJS:

```js
const options = {
	config: {
		iceServers: [
			{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
			// { urls: "turn:turn.example.com:3478", username, credential },
		],
		// iceTransportPolicy: "relay",
	},
	debug: 0,
};
```

## Channels

Open two data channels per peer pair:

| Channel | Settings | Carries |
|---|---|---|
| main | reliable, ordered | handshake, lobby, ready-up, spawns, deaths, damage events, rewards, objectives, anything that must arrive once and in order |
| fast | lossy, unordered (`ordered: false, maxRetransmits: 0`) | avatar state and enemy snapshots at 10 to 20 Hz |

Why bother: on a reliable ordered channel one dropped packet holds every later packet until
the retransmit lands. Positions arrive in bursts and avatars stutter. On a lossy unordered
channel a lost snapshot is just gone, and the next one (50 to 100 ms later) replaces it.

### PeerJS's `reliable` option is not what it sounds like

In PeerJS 1.5.x, `reliable` only sets `ordered: !!reliable` on the data channel. It never sets
`maxRetransmits` or `maxPacketLifeTime`. So:

- `reliable: false` gives an **unordered channel that still retransmits** lost packets. Better
  than ordered (no head-of-line blocking), but late resends still arrive, so the receiver
  must drop stale snapshots by sender time.
- **`reliable` defaults to `false`.** A plain `peer.connect(id)` is unordered, so control
  messages (hello, plan, go, deaths) can arrive out of order. Always pass `reliable: true`
  for the control channel.
- PeerJS has no option for a truly lossy channel, and each `peer.connect` builds a separate
  RTCPeerConnection with its own ICE setup.
- Use `serialization: "raw"` and send strings. With the default binary or `"json"`, PeerJS
  decodes every message before your code sees it, so a peer can make you parse a huge
  payload before your size cap runs.

Check what you actually got in the console: `connection.dataChannel.ordered`,
`.maxRetransmits`, `.maxPacketLifeTime`.

### Getting a real lossy channel with PeerJS

Open one PeerJS connection with `reliable: true`. When it opens, **both** sides add a
pre-negotiated channel to the same `RTCPeerConnection` (PeerJS exposes it as
`connection.peerConnection`). With `negotiated: true` and the same `id` on both sides, the
channel opens without another offer/answer.

```js
connection.on("open", () => {
	const fast = connection.peerConnection.createDataChannel("fast", {
		negotiated: true, id: 100, ordered: false, maxRetransmits: 0,
	});
	fast.onmessage = (event) => onData(connection.peer, event.data);
	// send with fast.send(text) while fast.readyState === "open", else the main connection
});
```

Verified in Chromium: the channel opens on an already-connected peer connection with zero
renegotiations, and reports `ordered: false, maxRetransmits: 0`. Pick an id PeerJS won't use:
PeerJS opens one channel per connection, which gets id 0 or 1 depending on the side, so 100
is safe. This channel carries raw strings or ArrayBuffers, not PeerJS-serialized
objects. `scripts/p2p_room.js` does all of this.

Without PeerJS (raw `RTCPeerConnection`), create the channel with
`{ ordered: false, maxRetransmits: 0 }` directly.

Send state through the fast channel when it's open and fall back to the main one when it
isn't, so nothing is lost during setup. Either way, stamp snapshots with sender time and drop
anything older than the newest applied.

Keep messages small. SCTP fragments anything over ~16 KB and some browsers fail on large
messages. Cap your own messages around 2 KB and design formats that fit. For the rare big
one (a full snapshot for a late joiner), split it with `chunkText()` into
`K|key|part|of|chunk` lines of 1,500 characters (64 at most, about 96 KB) and put it back
together with a `ChunkJoiner`, which accepts parts in any order.

The module's rate limit has a budget per channel (`maxRate` reliable, `maxFastRate` fast,
120 a second each), so a burst of snapshots can't push events over the limit. Past the
reliable budget it drops messages and raises `dropped { id }` once per second, because a lost
event means the receiver is now out of sync.

## Hosting headers

WebRTC doesn't need any special headers. Engines that use threads in WebAssembly (Emscripten
pthreads, some physics WASM builds) need
`SharedArrayBuffer`, which needs cross-origin isolation:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: cross-origin
```

Test locally with a server that sends them (see `testing.md`). itch.io has a
"SharedArrayBuffer support" toggle; other hosts need a `_headers` file or server config.
On Harmony you can't set response headers, and a hosted game can't count on cross-origin
isolation, so ship a single-threaded build there. WebRTC itself works either way.

## Errors worth handling

PeerJS `peer.on("error")` gives `error.type`. Map these to messages players understand:

| Type | Meaning | What to show |
|---|---|---|
| `peer-unavailable` | no room with that ID | "No room with that code. Check it with your friend." |
| `unavailable-id` | host ID taken | retry with a new code silently |
| `network`, `server-error`, `socket-error` | signaling unreachable | "Can't reach the matchmaking server. Check your connection." |
| `browser-incompatible` | no WebRTC | "This browser can't do online play." |
| `disconnected` event | lost the signaling socket, peers may still be connected | call `peer.reconnect()` for a host still taking joins |
| `no-relay` (room module) | hide my IP is on but no TURN server loaded | "Can't reach the relay server, so your IP can't be hidden right now. Try again, or turn off Hide my IP." |

A join that never opens and never errors means ICE failed (NAT) or the code belongs to a peer
that disconnected without being destroyed (a code retired while others stayed in the room).
Time out at ~15 s and cover both: "Couldn't connect. The code may be out of date, or this
network blocks direct connections."
