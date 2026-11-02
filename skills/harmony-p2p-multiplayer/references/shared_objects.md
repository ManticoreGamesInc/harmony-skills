# Shared objects (jigsaws, sandboxes, card tables)

Some games are neither a real-time world nor a turn sequence. Everyone handles the same pile
of objects at once: jigsaw pieces, blocks in a sandbox, cards and tokens on a table. Nobody
waits for a turn, and there are no avatars to interpolate, so neither `sync.md` nor
`turn_based.md` fits on its own. The examples use a 2 to 4 player co-op jigsaw.

## Contents
- The shape of it
- Locks and grabs
- Optimistic moves and rollback
- Results the host decides
- Event counter and resync
- Joining mid-game: plan, load, snapshot
- Layout
- Testing

## The shape of it

- The host owns every object's state and the lock on it.
- Players ask to grab, move, drop and place. The host checks each request, applies it, and
  broadcasts the result as a numbered event on the reliable channel.
- A player's own grab and drag show at once (optimistic); the host's answer confirms it or
  rolls it back.
- Drag positions while held go on the fast channel at 10 to 15 Hz so others see the piece
  move. The drop goes on the reliable channel.

## Locks and grabs

- `grab{id}` from a player: the host gives the lock if the object is free and not already
  placed, and broadcasts `held{id, who}`. Otherwise it answers `refused{id}`.
- One lock per object, a small cap per player (one or two held at once).
- Locks die with their holder: when a player leaves or times out, the host releases
  everything they held and broadcasts it, or pieces stay stuck in a ghost's hand.
- A lock that's been held with no movement for a long time (30 s or so) is released by the
  host, for the player who walked away from the keyboard.

## Optimistic moves and rollback

Waiting a round trip before a piece lifts feels broken, so the grab shows at once:

1. On press, remember the object's exact state (position, rotation, z-order, group) and
   start dragging.
2. Send `grab{id}`. Keep dragging.
3. `held{id, you}`: carry on. `refused{id}` or `held{id, someone else}`: restore the saved
   state exactly and drop the drag. Restore it, don't recompute it, or rounding drifts the
   piece a little on every refusal.
4. Two players grabbing the same piece in the same instant: the host's order decides, and the
   loser rolls back. Test it on purpose (see Testing).

## Results the host decides

Whether a piece snapped into place, whether two groups joined, whether the board is complete:
the host decides and broadcasts it. Never let each side work it out from positions. Two
machines doing the same floating-point math on slightly different positions can disagree
(snapped on one screen, loose on the other), and nothing ever brings them back together.

- The guest sends where it dropped the piece; the host runs the snap test and sends
  `placed{id, x, y}` with exact numbers, or `moved{id, x, y}` if it didn't snap.
- Completion, scores and the finish time come from the host. Guests show them.
- Record outcomes (placed, completed, score) when the event arrives, not when its animation
  finishes. A render-loop animation stops in a hidden tab, so an outcome recorded at the end
  of it may never be recorded at all.

## Event counter and resync

Number every host event: `n` goes up by one for each event, in every event. The guest keeps
the last `n` it applied.

- `n` is last + 1: apply it.
- `n` jumped: something was lost (a rate-limit drop, a bug, a reconnect). Stop applying and
  send `resync`. The host answers with a full snapshot carrying the current `n`.
- `n` already seen: ignore it.

The room module's `dropped` event fires when a friend goes over the reliable rate budget; use
it on the host to send a snapshot unasked. Keep event bursts under the budget in the first
place: batch what happens in one frame ("these 12 pieces moved with their group") into one
message rather than twelve.

## Joining mid-game: plan, load, snapshot

A guest who joins, or a match that starts, goes through a gate before it gets live events:

```
host: plan{token, content}  ->  guest loads assets (art, puzzle cut)
guest: loaded{token, ok}    ->  host sends the snapshot (chunked if big), adds guest to `synced`
host: events with n         ->  only to synced peers
```

- Live events go only to peers in the `synced` set. An event sent while the guest was still
  loading would land on a board that isn't there yet.
- Every plan carries a fresh token. Async work (image loads, piece cutting) checks the token
  when it finishes and throws its result away if the plan has changed since.
- The guest always answers, `loaded{ok: false, reason}` included (unknown content, an image
  that failed to load, a stand-in used). A host that hears nothing waits forever, and so does
  the player.
- Don't wait on `requestAnimationFrame` while loading. A hidden tab never runs it, so the
  guest never says `loaded`. Race it against a 100 ms timer.
- Big snapshots: the room module caps messages at 2 KB. Split with `chunkText()` and put back
  together with one `ChunkJoiner` per peer (1,500-character parts, at most 64, about 96 KB).
  Validate the whole snapshot after joining it, not just each part.
- Derive validation limits from the wire limit. A board limit that allows events bigger than
  one message (a 30 x 30 grid moved as one group) means those events are dropped without a
  word. Either cap the board so its largest event fits, or chunk that event too.

## Layout

- The host decides the table: its size, where pieces start, where the tray is. Guests scale
  their view to fit; they never lay out the table themselves, or pieces sit in different
  places on different screens.
- After loading, the guest checks its assets match the plan (image dimensions, piece count).
  If it had to use a stand-in, it leaves with a clear message rather than playing a different
  puzzle from everyone else.

## Testing

- Add an artificial delay (300 ms) to every incoming message in a dev build and play with two
  windows. Every grab now races; refusals and rollbacks happen constantly and show up at once.
  The room module's `simulate` option only delays the fast channel, so this needs its own hook
  around the reliable path.
- A dev console hook that applies host commands directly (`place all but one`, `complete`)
  reaches the finish in seconds and tests completion on every side.
- Mirror check: replay a scripted host session into the guest's apply code and compare the
  final state with the host's, object by object.
