# Protocol: messages, handshake, lobby

## Contents
- Two message styles
- Connection states
- Handshake
- Heartbeat and timeouts
- Lobby look and live previews
- Ready-up
- Loading gate
- Leaving
- Rejoining after a drop
- Results, leaderboards and history
- Ordering rules

## Two message styles

**Control messages: small JSON objects** on the reliable channel. Easy to extend, easy to
validate with a typed parser, and infrequent enough that size doesn't matter.

```json
{"type":"hello","version":"0.1.33","look":{"name":"RustySprocket42","paint":"teal","level":7}}
```

**State and world lines: compact tagged text** for anything sent many times a second. One
leading tag character, `|`-separated fields, invariant-culture numbers, a fixed field count
per tag. Smaller than JSON, cheap to parse without allocations, and trivially routed by the
first character before any JSON parsing.

```
S|map|time|px|py|pz|rx|ry|rz|rw|turret|shots|hull|maxHull|boost
M|time|id,x,y,z,yaw,health,...;id,x,y,z,yaw,health,...
```

Binary (`ArrayBuffer` with a `DataView`) is smaller again; switch when profiling says
bandwidth matters. For 2 to 4 players at 15 Hz, text lines are fine.

Route on receive: size check, then "first char is a known tag and second is `|`" goes to the
line handler, else parse as JSON. Ignore unknown tags and types so old clients don't crash on
new messages (the version check still blocks real mismatches).

Example tag set for a co-op wave shooter (host H, guest G):

| Tag | From | Channel | Meaning |
|---|---|---|---|
| `S` | both | fast | my avatar state |
| `N` | H | main | enemy spawned (id, kind, affix, pos, yaw, health, boss) |
| `M` | H | fast | enemy snapshot batch |
| `X` | H | main | enemy died (id, who killed it, guest's damage share) |
| `R` | H | main | enemy removed without dying |
| `W` | H | main | wave state (number, phase, enemies left, timer, event) |
| `H` | H | main | your avatar was hit (damage, point, direction) |
| `D` | G | main | I hit enemy id (damage, point, direction) |
| `T` | G | main | I stunned enemy id (seconds, push) |
| `A` | H | main | enemy attack started (id, kind, params) for telegraphs |
| `P` | both | main | ability visual (pulse, mine placed / exploded / fizzled) |
| `E` | H | main | extraction state |
| `C` | G | main | guest asks to call extraction |
| `Z` | H | main | both extract now |
| `Q` | both | main | I left the run |

## Connection states

```
Idle -> Opening -> Hosting -> (guest asks) -> Hosting + pending -> Connected
Idle -> Joining -> WaitingApproval -> Connected
any  -> Idle (on leave, deny, timeout, error)
```

Expose the state and a status string to the UI; every transition sets both. Players need to
see "Waiting for the host to let you in..." rather than a spinner.

## Handshake

```
guest                         host
  | -- open channel ---------> |
  | -- hello{version,look} --> |  version mismatch -> deny{version}, drop
  |                            |  full / pending  -> deny{full}, drop
  |                            |  show Accept / Deny prompt
  | <-- welcome{look} -------- |  accept: state = Connected FIRST, then send
  | -- look{look} -----------> |
  | <-- plan{...} ------------ |  current lobby choice, if any
```

On deny: show the reason, close, return to Idle.

**What goes in `version`.** The build version alone isn't enough. Content tables (levels, items,
cards) grow without anyone bumping it, and two builds with different tables pass the check, then the guest waits
forever on a plan it can't load. Add a hash of the shared tables:
`version = "1.5.0+" + fingerprint(JSON.stringify(LEVELS))`.

## Heartbeat and timeouts

- Send `ping` every 1 s on the main channel. Any received message resets the quiet timer.
- Drop the friend after ~10 s quiet. Show "Lost connection to <name>."
- Join attempts time out at ~15 s.
- While in a room, keep the app ticking when its tab is hidden: run the network tick on
  `setInterval`, not `requestAnimationFrame`. Hidden-tab
  timers are throttled to about once a second, which a 10 s timeout tolerates.

## Lobby look and live previews

Send a `look` (name, level, cosmetics) on connect and whenever it changes. Show the friend's
avatar in the lobby with their name tag as `NAME [LV n]`.

While a player browses cosmetics, send `preview` messages (cosmetic id plus a color value) so
the friend sees them try things on. Throttle to changes, not frames.

## Ready-up

The host picks what to play; the guest confirms.

1. Host chooses a plan (map, difficulty, modifiers) and sends `plan`. Validate it on the
   guest: known map, known difficulty, capped modifier list.
2. Guest's main button becomes READY, enabled once a plan exists. A changed plan clears the
   guest's ready, so they never launch into something they didn't agree to.
3. When the host is ready and the guest is ready, the host runs a short countdown (3 s) and
   broadcasts it, so both screens count together. Either side unreadying cancels it.
4. The host sends `go`. **Only `go` launches the guest.** Never let the guest start on its own
   countdown reaching zero; clocks and frame timings differ.
5. A host left alone gets a "Play solo" option. A guest who leaves the room gets their
   normal solo buttons back. If a button is disabled because they're in a room, say so on it.

**Solo-only modes** (daily challenge, ranked solo, anything with a solo leaderboard): one
`solo: true` flag on the mode's table entry drives both sides. The host's picker hides those
modes while in a room, and the guest's plan check allows only modes without the flag, so a
modified host can't push a guest into one.

## Loading gate

After `go` (or when a guest joins a match in progress), the guest loads what the plan needs
before the host sends it anything live:

1. Host sends the plan with a fresh token.
2. Guest loads, then always answers `loaded{token, ok: true}` or
   `loaded{token, ok: false, reason}` (unknown content, failed asset). Never stay silent: a
   host waiting on a reply that won't come leaves both players stuck.
3. Host sends a full snapshot (chunked with `chunkText()` if it's over the 2 KB cap) and adds
   the guest to a `synced` set. Live events go only to synced peers.
4. Async loading work checks the token when it finishes and drops its result if the plan
   changed meanwhile.

Don't gate loading on `requestAnimationFrame`: it never runs in a hidden tab, so a guest
who tabbed away never sends `loaded`. Race it against a 100 ms timer.

## Leaving

- Send `bye` before closing so the other side can say "<name> left" instead of waiting for
  the timeout.
- In a run, send `Q` (left the run) separately from leaving the room: a friend can quit the
  match and stay in the lobby.

## Rejoining after a drop (optional)

A dropped guest normally has to ask again and wait for approval. To let them back in fast:

- On `welcome`, the host sends a random rejoin token (16+ bytes from the CSPRNG) and keeps
  it with the guest's slot for a short window (60 to 120 s after they drop).
- The guest keeps the token in memory (not storage) and sends it in its next `hello`.
- A matching token inside the window skips the approval prompt (still version-checked) and
  restores the slot: avatar, downed state, rewards so far. Anything else goes through
  normal approval. Tokens are single use; a kick revokes the token.
- The rejoining guest has a new peer ID. The host maps the token back to the old seat
  (`rejoinOf = oldId`) and moves the seat's state to the new ID; key game state by seat,
  not by peer ID, and this is one line.
- If `rejoin()` calls `join()` and `join()` resets session state, the token is wiped before
  the hello goes out. Save the token first and restore it after.
- Retry the rejoin at 1.5 s, then every 2 s, 3 tries in all, then fall back to the normal
  join screen.

## Results, leaderboards and history

- **Co-op results stay out of solo leaderboards.** Mark the saved run as co-op and keep it in
  its own save slot. Keep the co-op flag on the run itself, not on the room: the room can be
  gone (the host left) by the time a guest who kept playing posts a result.
- **Save the roster with the result.** The room can close (and clear the teammate list)
  before the result screen. Copy the names into the result when the match starts and as
  players join, and decide up front whether a teammate who left before the end is credited,
  and whether solo time before the room opened counts.
- In-game invites (a HUD button that opens a room mid-run) freeze the solo run's save first,
  reuse the assets already loaded, and need the room panel to reopen from the HUD.

## Ordering rules

- Set state to Connected before the first send that depends on it.
- Accept lobby messages once Connected, even if the friend's look hasn't arrived yet.
- On the unordered channel, drop snapshots older than the newest one applied.
- Make one-shot events idempotent by ID (spawn N for an id that exists: update it; death X for
  an id that doesn't: ignore).
- A scene load can eat messages. Queue world messages that arrive before the receiving scene
  is ready, or have the host resend a full snapshot when the guest reports it's loaded.
- Number the host's reliable events (`n`, one up per event). A guest that sees a gap asks for
  a snapshot instead of carrying on out of sync. The room module raises `dropped` when a peer
  goes over the reliable rate budget, which is one way events get lost. See
  `shared_objects.md`.
