---
name: harmony-p2p-multiplayer
description: Add online multiplayer for 2 to 4 players to a web game with no game server - one player hosts a room with a secure code, friends join it, and the game talks browser to browser over WebRTC (PeerJS). Covers IP-exposure consent, validating peer input, host-authoritative sync, lobbies, turn-based and hidden-information games, disconnects and two-window testing. Use when a game needs co-op or online play, "play with a friend", room codes, host and join, or netcode without a server.
license: MIT-0
compatibility: Web games in any browser engine (Three.js, Babylon, PlayCanvas, Phaser, PixiJS, WebGPU, plain canvas). The room module needs PeerJS 1.5 from npm; its tests need Node 20 or newer.
---

# P2P multiplayer for web games

A recipe for small-group (2 to 4 player) online play where one player's game hosts the
session and the others connect straight to it over WebRTC. No game server to run or pay for.
A free signaling server introduces the peers, then the game traffic flows browser to browser.

The recipe covers real-time co-op, turn-based and shared-object games, and nothing in it
depends on one engine. The engine only has to give you a per-frame update and a way to spawn and
move objects. `references/engines.md` shows the glue for the common web engines. Unity and Godot games use the same room module through a
JavaScript bridge (the harmony-engines skill shows how); the protocol, security and sync rules
here apply unchanged, and those games are tested in their web build with two browser windows.

**On Harmony.** Harmony hosts the game and adds its overlay to every upload with no code, but
runs no game servers and has no invite API, so these rooms work the same there. The game needs
neither the Harmony SDK nor a Game ID: players type a name, and inviting is copying the room
code. A few things change: the game doesn't pause for the overlay during a session, and it runs
in a frame inside Harmony's page, where it can't read the clipboard. A game that already uses
the SDK can also start players with their Harmony name and open the overlay, where they can
paste the code in chat. Read `references/harmony.md` when the game is, or will be, on Harmony.

**Real-time or turn-based?** Real-time games (shooters, racers, co-op action) need the whole
recipe: lossy snapshots, interpolation, puppets. Turn-based games (board, card, puzzle,
tactics) skip most of `sync.md`: the host validates move requests and streams match events,
and the guest replays them into a mirrored copy of the match. Read `references/turn_based.md`
for that path. **Shared-object games** (jigsaws, sandboxes, card tables, where everyone
handles the same pieces at once with no turns) need a third shape: host-owned locks,
optimistic grabs with exact rollback, and results only the host decides. Read
`references/shared_objects.md`. Rooms, consent, codes and validation apply to all three.

## When P2P fits, and when it doesn't

Fits: co-op with friends, small sessions, browser games, jams, prototypes, anything where
"you and a friend share a code" is the whole matchmaking story.

Push back (and say why) when the developer wants:
- **Competitive play with stakes** (ranked, real-money, tradeable items). The host runs the
  world and can cheat; guests can lie about their own hits. A server is the fix, not more checks.
- **Many players** (more than about 4 to 6). The host's upload carries everyone's traffic.
- **Strangers matched automatically.** Every peer learns every other peer's IP address (see
  security below). Fine between friends; a doxxing and DDoS risk between strangers.
- **Guaranteed connectivity.** Without a TURN relay, some networks (symmetric NAT, strict
  corporate or mobile carrier networks) can't connect at all. Budget for TURN if that matters.

## Ask the developer first

Look at the game first: its shape (real-time, turn-based or shared objects), its engine and UI,
whether it uses the Harmony SDK, and whether it already has a room module or online code. Then
ask in one round, with a recommendation for each. Don't ask what the code already shows, and
raise any push-back from the list above in the same round.

- **How many players per room?** 2, or up to 4. Recommended: 2, unless the design needs more.
  Rooms of 3 or 4 add relaying through the host ("Rooms of 3 or more" in `references/sync.md`).
- **Which signaling server?** The free public PeerJS server, or one they run. Recommended: the
  public server for testing and small releases; their own for a real launch
  (`references/self_hosting.md`).
- **A TURN relay and "hide my IP"?** Recommended: not at first, unless they already have TURN or
  will pay for it. Without TURN, some networks can't connect, and there is no "hide my IP"
  option.
- **What happens when a player leaves mid-match?** Recommended for real-time games: the
  "Drop-out rules" in `references/sync.md`. For turn-based games: the match is abandoned, not
  forfeited, which is kinder for casual play.
- **Can players join a match in progress?** Recommended: only from the lobby, which is simpler;
  allow it for drop-in games such as a shared jigsaw, through the loading gate in
  `references/protocol.md`.
- **The game's shape,** only when the code doesn't settle it: real-time, turn-based or shared
  objects.

If the developer says "you decide", use the recommendations and list them in the report as
choices they can change.

## The architecture in one picture

```
 Host browser                         Guest browser
 ┌───────────────────────┐            ┌───────────────────────┐
 │ game (authoritative)  │            │ game (puppets)        │
 │  waves, enemies, loot │  reliable  │  own player, input    │
 │  damage, objectives   │◄──────────►│  forwarded hits       │
 │ room: code, approval  │  ordered   │ room: join, consent   │
 │ net bridge (PeerJS)   │◄ ─ ─ ─ ─ ─►│ net bridge (PeerJS)   │
 └──────────┬────────────┘   lossy    └──────────┬────────────┘
            │              unordered             │
            └──── signaling server (setup only) ─┘
```

- **Host authority.** The host simulates everything shared (enemies, waves, timers, pickups,
  objectives). Guests simulate only their own player and render the host's world as puppets.
- **Each player owns their own avatar.** Movement is never host-authoritative for the other
  player. Both send their own state; both draw the other as an interpolated ghost.
- **Star topology.** Guests connect only to the host. In rooms of 3 or 4 the host relays each
  guest's state to the others, so only the host learns everyone's IP.
- **Two channels.** Reliable ordered for control and events. Lossy unordered
  (`ordered: false, maxRetransmits: 0`) for the frequent state snapshots, so one lost packet
  never stalls the ones behind it.
- **PeerJS trap:** its `reliable` option only toggles ordering and defaults to `false`.
  `reliable: false` still retransmits, and a plain `peer.connect(id)` is unordered. Pass
  `reliable: true` for control, and add the lossy channel as a pre-negotiated data channel
  on `connection.peerConnection` (see `references/transport.md`).

## Fit the existing project

When the game already exists, the multiplayer code and screens should look like they were
always there. Before writing anything:

- **UI:** find the UI technology, stylesheet or theme, and the closest existing screens
  (confirm dialog, popup, banner, HUD row). Build the room panel, consent notice, join
  request, ready-up and partner HUD with those same pieces, classes, fonts and colors, and
  follow the game's conventions for key hints, click sounds, gamepad navigation, Esc/back and
  localization. Don't introduce a second UI framework. `references/ui.md` lists every screen
  and what it needs.
- **Code:** write the game's own network code (session, messages, screens) in the project's
  naming, file layout and event pattern, following any rules file (`AGENTS.md`, `CLAUDE.md`,
  style guide, lint config). Copy `scripts/p2p_room.js` in unchanged as a vendored file (for
  example `src/net/p2p_room.js`, with a header comment saying where it came from), so its
  tests keep running against it. In a TypeScript project, copy `scripts/p2p_room.d.ts` next to
  it. Porting the module to the project's style is optional; if you port it, port its tests too,
  because they call the original API.
- **Systems:** reuse the game's settings storage, save system, audio routing, scene loading
  and object pooling instead of adding parallel ones.

## When the output is for other people

Design docs, PR descriptions and READMEs go to people who don't have this skill. Present the
recommendations as your own and inline any code they need. Don't cite this skill or its file
names (`p2p_room.js`, `references/...`). Adapt names, numbers and screens to their game rather
than copying the examples here.

## Build order

Work in this order. Each step is playable and testable before the next one starts, and the
early steps catch the bugs that are miserable to find later. Open each step's reference when
you reach that step, not all of them up front (see "Reading the references" below).

1. **Transport bridge.** Host, join, send, receive, close, with events back to the game.
   Bundle the library locally. Start from `scripts/p2p_room.js`: codes, approval, kicks with
   a new code, version check, heartbeat on a timer, reliable + lossy channels, size cap, rate
   limit, backpressure, relay for 3+ players, a bad-network simulator and validation helpers.
   Copy it in unchanged, plus `scripts/p2p_room.d.ts` in a TypeScript project, and bring the
   tests with it: copy `scripts/test_p2p_room.mjs` and `scripts/mock_peerjs.mjs` into the
   project's test folder and run them against the copy. Only if you port the module, port its
   checks to the project's test runner too (see `references/testing.md`). Read `references/transport.md`.
2. **Room and security layer.** Codes, consent, approval, version check, kicks, validation of
   every incoming field. Read `references/security.md` before writing any of it. This is the
   part people skip and regret. Build its screens in the project's UI style (`references/ui.md`).
3. **Lobby.** Hello / welcome / deny, player look (name, cosmetics, level), ready-up with a
   host-chosen plan and a host-sent "go". Read `references/protocol.md`.
4. **Avatars in the world** (real-time). Each side sends its own state at a fixed rate; each
   side draws the other with snapshot interpolation. Read `references/sync.md`.
   **Turn-based instead:** move requests to the host, match events back, a mirror mode on the
   guest. Read `references/turn_based.md` and skip to step 6.
   **Shared objects instead:** locks, grabs and numbered host events behind a loading gate.
   Read `references/shared_objects.md` and skip to step 6.
5. **Shared world** (real-time). Host-authoritative enemies and events; guest puppets; guest
   hits forwarded to the host. Then rewards, downs and revives, joint objectives, drop-out rules.
6. **Test in two real windows** on a local server, plus a fake-peer harness for fast
   iteration. Read `references/testing.md`.
7. **Report** to the developer: what was built, the choices made for them, which tests ran (the
   room module's tests, two windows, a simulated bad network) and which didn't (two devices on
   different networks, a TURN relay, the uploaded build on Harmony), and what a launch still
   needs (their own signaling server, TURN).

## Non-negotiables

These come from real bugs and real risks. Explain them to the developer rather than silently
applying them, so they can decide knowing the risks.

**Privacy and consent**
- WebRTC hands each peer the other's public IP address. Tell players before their first host
  or join, in plain words, and let them back out. Keep a short reminder visible on the room
  panel. Exact wording that tested well is in `references/security.md`.
- The host learns a joiner's IP even if the host turns them away, and with PeerJS the joiner
  also learns the host's, because PeerJS answers automatically and the connection forms
  before the game sees the "hello". Say so in the host's consent text. (Custom signaling can
  hold the answer until approval; see `references/security.md`.)
- Never put emails, account IDs, real names or tokens on the wire. Use the name the player
  typed, a random handle (`RustySprocket42`), or, in a game that uses the Harmony SDK, the
  Harmony name and tag.
  A name from a peer proves nothing: any client can claim any name.
- A "hide my IP" option (TURN relay only) fails closed: if the TURN credentials don't load,
  refuse to connect and say why. Never fall back to a direct connection.

**Codes**
- Generate room codes from a cryptographic source (`crypto.getRandomValues`, or the platform
  CSPRNG), never `Math.random`. About 60 bits: 12 characters from a 32-symbol alphabet that
  drops look-alikes (`0 O 1 I`). Display grouped (`XXXX-XXXX-XXXX`), hidden until revealed.
- The code is the only secret. Prefix it with a game namespace for the peer ID so it can't
  collide with other games on a shared signaling server.
- Roll a new code whenever the host removes someone, so the removed player can't walk back in.

**Untrusted input**
- Treat every byte from a peer as hostile: size cap before parsing, strict parse, finite and
  range checks on every number, allow-lists on enums and IDs, sanitized names with rich text
  off. Ignore messages from any peer that isn't the approved friend, and cap messages per
  second per peer, with a separate budget per channel.
- Sanitize names without going ASCII-only: keep letters and digits in every script, strip
  bidirectional and zero-width controls.
- Show every peer string (names, a revealed secret, any free text) as text: `textContent` or
  the engine's plain text object, never HTML, a URL, CSS or code.
- Copy known fields into fresh objects; never merge a message into game state. Key anything
  by peer data in a `Map`, and route message types with a `switch` or a `Map` of allowed
  types, so `__proto__` or `constructor` can't reach built-ins.
- Clamp anything a guest can request of the host (damage, stun time, knockback, spawn counts).

**Staying connected**
- Version handshake first; deny with a reason ("version", "full", "kicked", "denied") so the
  UI can say something useful. Put a fingerprint of the shared content tables in the version
  (`fingerprint()` in the room module), since tables grow without the version number moving.
- Every request gets an answer. A guest that can't load the plan replies
  `loaded{ok: false, reason}`; silence leaves the other side waiting forever.
- Heartbeat about once a second; drop a peer that's been quiet for ~10 s; time out a join
  attempt at ~15 s.
- Keep networking alive in background tabs. Browsers stop `requestAnimationFrame` in hidden
  tabs, so a game loop that drives the network goes silent and the peer times out. Drive
  heartbeats and sends from a timer outside the render loop.
- Keep the host's simulation alive too. Heartbeats alone keep the connection up, but if the
  host's authoritative clocks (wave timers, turn timers, bot turns) live in the render loop,
  they freeze when the host switches tabs and the guest is stuck waiting. While a session is
  running, tick the simulation from a timer when the tab is hidden, or base clocks on wall time.
- No shared pause. A menu that freezes time on one machine desyncs the other. In multiplayer,
  menus overlay a running world, and that includes the Harmony overlay.

## Message ordering traps

The bugs that cost the most time were ordering bugs. Check for these in any design:

- **State set after the first send.** Mark the connection "connected" *before* sending the
  first look/welcome, or handlers that gate on "connected" will drop the reply.
- **Message B arriving before message A.** The lobby plan can land before the player look.
  Gate handlers on connection state, not on "have I received X yet", or buffer until ready.
- **Unordered channel reordering.** Stamp every snapshot with sender time and drop anything
  older than the newest one already applied.
- **Counters, not flags, for one-shot events on the unreliable channel.** Send "shots fired so
  far" and let the receiver play `new - last` (capped). A boolean "firing" flag either repeats
  forever or gets lost. Return early when the difference is zero.

## Pitfalls from cloning the local player as the remote ghost

Cloning the local avatar is the fastest way to get an identical remote player, and it bites:
- Copy it without running its setup code (input bindings, camera follow, audio, network
  sends), then remove input, physics, camera, audio and controller parts, dependents first.
- Remember which renderers, colliders and effects were *enabled* when you hide/show the ghost
  (death, revive), and restore only those. Re-enabling everything turns on hidden effect
  meshes and draws mystery shapes.
- Turn off player-to-player collision. Ghosts lag by the interpolation delay, so collisions
  with them feel like hitting a wall that isn't there, and they block revives.

## Reading the references

The references total about 80 KB (roughly 20k tokens). Anything you read stays in context for
the rest of the session and is paid for again on every later call, so read them on demand:

- **One at a time, at its step.** Open a reference when the build order reaches it. Don't
  read several at once while still planning; this file is enough to design the netcode.
- **Only the ones the game needs.** Real-time games need `security.md`, `protocol.md` and
  `sync.md`. Turn-based games swap `sync.md` for `turn_based.md`, shared-object games for
  `shared_objects.md`. Open `engines.md` only when wiring into an engine for the first time,
  `ui.md` when building the screens, `testing.md` when testing, `self_hosting.md` only
  when moving off the public PeerJS server or adding TURN, and `harmony.md` when the game is
  on Harmony.
- **Prefer working code.** If the project, or a sibling project by the same team, already
  has the room module (vendored or ported) and an online session, read those files instead of
  `transport.md`, `engines.md` and the scripts. They show the project's style as well.
- **Search for one detail.** When you need a single item (the consent wording, a deny reason,
  the PeerJS `reliable` trap), search the file for its heading rather than reading the whole
  file.

## Reference files

| File | Read when |
|---|---|
| `references/transport.md` | Setting up WebRTC/PeerJS, signaling, STUN/TURN, channels, hosting headers |
| `references/security.md` | Codes, consent copy, approval, kicks, validation, threat model |
| `references/protocol.md` | Message formats, handshake, lobby, ready-up, heartbeat |
| `references/sync.md` | Real-time games: interpolation, host authority, puppets, hits, rewards, revives, drop-out |
| `references/turn_based.md` | Turn-based games: move requests, event stream, mirrored match, turn timers, rematch |
| `references/shared_objects.md` | Jigsaws, sandboxes, card tables: locks, optimistic grabs and rollback, host-decided results, event counter and resync, loading gate, chunked snapshots |
| `references/self_hosting.md` | Running your own signaling server and coturn: where to host, `wss`, proxies, the ICE endpoint, fail-closed relay, coturn hardening |
| `references/engines.md` | Wiring the room into a web engine's loop, and keeping it alive in a hidden tab |
| `references/harmony.md` | Games hosted on Harmony, with or without the SDK: typed names, sharing the code, optional SDK extras (Harmony names, an Invite button that opens the overlay), the overlay and pausing, the game's frame, testing on Harmony |
| `references/ui.md` | Building the multiplayer screens in the project's own UI style, plus tested wording |
| `references/testing.md` | Local server, two-window tests, fake-peer harness, debugging recipes |
| `scripts/p2p_room.js` | ES module to copy unchanged into a web game: rooms, codes, approval, kicks, channels, limits, relay, simulator, validation helpers, `loadIce`, `chunkText` / `ChunkJoiner`, `fingerprint` |
| `scripts/p2p_room.d.ts` | TypeScript declarations for every export of `p2p_room.js`, with typed events; copy it next to the module in a TypeScript project |
| `scripts/test_p2p_room.mjs` | Node tests for the module (`node test_p2p_room.mjs path/to/p2p_room.js`, with `mock_peerjs.mjs` beside the test file); run after copying, porting or changing it |
| `scripts/mock_peerjs.mjs` | In-process PeerJS stand-in used by the tests; import it from vitest or jest to test a ported module |
