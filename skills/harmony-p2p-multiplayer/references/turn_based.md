# Turn-based games (board, card, puzzle, tactics)

Most of `sync.md` is about real-time play: interpolation, ghosts, puppets, lossy snapshots.
Turn-based games need almost none of it. What they need is a clean split between the game
that decides and the game that shows, plus care with clocks. Rooms, codes, consent,
approval, kicks and validation (`security.md`) apply unchanged.

## Contents
- The shape of it
- Commands in, events out
- The mirror on the guest
- Hidden information
- Turn timers and other clocks
- Hidden tabs
- Lobby, rematch and leaving
- Validation checklist
- Testing

## The shape of it

```
 guest                                   host
   | -- move{cell, turn} -------------->  |  validate, apply to the real match
   |                                      |  match emits events
   | <-- ev{placed, ...} / ev{turn, ...}  |  every event forwarded, in order
   |  mirror applies the event            |
   |  same event -> same animation/sound  |
```

- **The host runs the only real game state.** It decides legal moves, scoring, round and
  match ends, and timeouts. The one exception is a secret a guest owns (see "Hidden
  information" below).
- **The guest never applies its own move.** It sends a request and waits for the host's
  event. On a LAN or decent internet the round trip is well under 100 ms, which is invisible
  next to a piece drop animation. Play a small "sent" cue (hover sound, cursor change) if you
  want instant feedback, but don't draw the piece until the event arrives.
- **Use the reliable ordered channel for everything.** Events must arrive once and in order.
  The lossy channel is optional, useful only for cosmetic extras like showing which cell the
  other player is hovering. If you send those, drop stale ones by sender time.

## Commands in, events out

Structure the game logic so it only changes through commands and reports through events.
This is good design offline too, and it makes networking a thin layer:

- **Commands** are plain data (`{type: "place", cell, turn}`). The local player, a bot and
  the remote guest all produce the same commands. The game validates each one: right phase,
  right player, current turn number, legal target.
- **Events** are plain data (`roundStarted`, `turnStarted`, `placed`, `roundWon`,
  `matchOver`). Presentation (board, HUD, sound, stats) listens to events only.
- Include a **turn number** in every move request and reject stale ones. A double click or a
  late packet otherwise plays a move into the wrong turn.
- Put **authoritative totals** (scores, remaining pieces) in end-of-round events instead of
  having the guest recompute them, so a missed event can't leave the scoreboards disagreeing.

## The mirror on the guest

Give the game state a mirror mode: one method per event that applies an already-validated
host event and emits the same event the authoritative game would. Then the guest's board,
HUD, sounds and stats run exactly the code they run offline.

- Mirror mode never acts on its own: no timeouts, no phase changes, no AI. It only replays.
- Validate every event field before applying it (cells in range, marks from the enum, a win
  line that exists in your table, scores within the round count). See the checklist below.
- Ignore events while not in a match, and ignore anything if the mirror isn't active, so a
  late event from a finished match can't reopen it.
- If you want resync after a hiccup, give the host a `snapshot()` and send it on `go` or on
  request. With a reliable ordered channel and no reconnects it's rarely needed.

## Hidden information

Some games have a secret that one player owns: the word in hangman, a hand of cards, a
Battleship board. The host can read anything it holds, in DevTools if nowhere else, so a
guest's secret can't live in the host's match state.

- **The owner keeps the secret and answers questions about it.** The secret stays on the
  owner's machine. Moves that touch it ("is there an E?", "fire at C4") go to the owner, and
  the owner's game sends the answer ("E at 2 and 5", "miss"). Never send a guest's secret to
  the host in plain form, not even to validate it.
- **Authority over the secret moves to its owner; the host runs the rest.** The host keeps turn
  order, timers, scores and round ends, and validates moves as before. For a move that touches
  a guest's secret, it forwards the request to that guest, checks the answer's shape (enum,
  range, turn number) and applies it as a normal event. It can't tell whether the answer is
  true until the reveal. Make answers carry what the host needs to end the round (letters
  found, ships sunk). When the host owns the secret, its own game answers, and the same commit
  and reveal keeps it honest.
- **Commit up front.** Before the first question, the owner sends a SHA-256 hash of a random
  salt plus the secret, and keeps both. The salt stops the other side from hashing every word
  in a dictionary to find a short secret.
- **Reveal at the end.** When the round ends, the owner sends the salt and the secret. The
  other side hashes them, compares the result with the commit, and checks every earlier answer
  against the secret. No other secret matches the hash, so the owner can't switch secrets
  mid-round either. On a mismatch, void the round and say so ("<name>'s answers didn't match
  their word").
- **A missing reveal counts against the owner.** If the owner leaves or never reveals, the
  round stays unchecked: don't count it as the owner's win.
- When both players own secrets (Battleship), both commit, both reveal, and each checks the
  other. In rooms of 3 or more, the host forwards each commit, answer and reveal to everyone.
- Commit and reveal doesn't cover a secret dealt from a shared deck, because whoever deals
  sees every hand. Between friends, let the host deal and accept that it could look.

```js
// SHA-256 as hex, from Web Crypto. crypto.subtle exists only on secure pages (https, localhost),
// so test on localhost or 127.0.0.1, not a LAN address over http.
async function sha256(text) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Owner, before the first question: keep salt and secret, send only the hash.
const salt = newCode(16);   // 80 random bits from the room module's crypto source
room.sendJson({ type: "commit", round, hash: await sha256(salt + "|" + secret) });

// Owner, when the round ends: room.sendJson({ type: "reveal", round, salt, secret }).

// The other side, on the reveal. answers holds every { question, answer } the owner sent this
// round; answerFor is the same function the owner's game uses to answer.
async function checkReveal(message, hash, answers) {
	const salt = cleanId(message.salt, 16);
	const secret = cleanSecret(message.secret);
	if (salt === "" || secret === null || await sha256(salt + "|" + secret) !== hash) {
		return false;
	}
	return answers.every(({ question, answer }) => answerFor(secret, question) === answer);
}

// The revealed secret comes from a peer: allow-list its characters and cap its length before
// hashing, comparing or showing it. For hangman, a word of 2 to 24 letters A to Z; for a hand,
// a short list of card ids looked up in your own table. null when invalid.
function cleanSecret(value) {
	return typeof value === "string" && /^[A-Z]{2,24}$/.test(value) ? value : null;
}
```

Show a revealed secret (the word was "...") only after it passes, and as text, like a name.

## Turn timers and other clocks

- **The host decides timeouts.** When the turn clock runs out, the host plays the timeout
  move (random legal move, pass, forfeit) and sends it as an ordinary event, marked `forced`.
  The guest never ends a turn because its own clock hit zero.
- **The guest only displays the clock.** Send the time left with `turnStarted` and let the
  guest count down locally for display. Small drift doesn't matter, because the host's event
  ends the turn.
- **Use a seeded random source on the host** for timeout moves, so the result is reproducible
  in tests and logs.

## Hidden tabs

Heartbeats on a timer keep the connection alive in a hidden tab (see `protocol.md`), but
that isn't enough here: if the host's match clock lives in the render loop, it stops when the
host switches tabs, and the guest's turn timer freezes with it. While a match is running,
tick the authoritative game from a timer as well (`setInterval` at ~4 Hz, only when
`document.hidden`), or move the clock to wall time. The same applies to any host-side bot or
AI that takes turns.

## Lobby, rematch and leaving

- Use the lobby from `protocol.md`: host picks the rules (rounds, timer, variant), guest
  readies up, host counts down and sends `go`. A rule change clears the guest's ready.
- **Rematch** goes back to the lobby with both players still connected, so the same ready-up
  runs again. Don't auto-start a new match from the result screen.
- **Leaving mid-match:** decide whether it's a forfeit or an abandoned match and show it.
  Abandoned is kinder for casual games (and keeps stats honest when a connection drops).
- **No shared pause.** The pause menu overlays a running match; the turn clock keeps going.

## Validation checklist

- [ ] Move requests: integer cell/target in range, integer turn equal to the current turn,
      sender is the player whose turn it is (the host knows which seat the guest has).
- [ ] Rule choices from the lobby: values from an allow-list, not free numbers.
- [ ] Events on the guest: enums checked, indices in range, win lines looked up in your own
      table, scores and round numbers within the match's limits, time values finite and clamped.
- [ ] Hidden information: a commit is 64 lowercase hex characters, one per owner per round,
      in before the first question; answers checked for shape and turn; the reveal's salt and
      secret cleaned (allow-listed characters, capped length), then the hash and every answer
      checked, and the secret shown only as text.
- [ ] Names: sanitized, length-capped, shown with `textContent`.
- [ ] Everything ignored unless the room is connected and the match phase allows it.

## Testing

- Unit-test the rules, the bot and the match state without any networking (commands in,
  events out), including stale turns, occupied cells and timeouts.
- Drive both sides in two windows: host, join, approve, change rules, ready, start, play to a
  win and a draw, let a turn time out, leave mid-match from each side.
- Check the guest's mirror ends in the same state as the host (board, scores, phase) after
  every round.
- With hidden information, open DevTools on the side that doesn't own the secret and check the
  secret isn't in memory or in any message before the reveal. Then make the owner's game lie
  once and switch secrets once (a dev-only switch): both must void the round.
