# Security and privacy

## Contents
- Threat model
- IP exposure and consent copy
- Room codes
- Host approval, room size, kicks
- Validating peer input
- Trust between host and guest
- Checklist

## Threat model

Be honest with the developer about what P2P protects and what it doesn't.

| Who | Can | Mitigation |
|---|---|---|
| Someone with the code | connect, learn the host's IP, ask to join | approval prompt, new code after a kick, consent text |
| Someone without the code | guess codes | ~60-bit CSPRNG codes; guessing is hopeless |
| A joiner the host refuses | still learned the host's IP during setup | say so in consent text; TURN relay-only mode hides it |
| A malicious peer | send malformed, huge or extreme messages; crash or grief the other game | size caps, strict parsing, clamps, allow-lists, ignore non-friends |
| The host | cheat freely (they run the world) | accept it for co-op; don't build ranked or tradeable economies on P2P |
| A guest | lie about their own hits, position, inventory | clamp; accept for co-op among friends |
| Signaling / TURN provider | see IPs and room IDs | privacy policy; self-host if that matters |

## IP exposure and consent copy

Every peer learns every other peer's public IP address, and the host learns it for anyone who
*tries* the code, before approval. With an IP address someone can find a rough location and
the ISP, and can flood the connection. Between friends that's fine. Make sure players know.

Show a one-time notice the first time a player hosts and the first time they join, with
Continue / Cancel. A line of text on the panel isn't enough on its own: make the player
acknowledge it once, and store that per action in the game's settings. Wording that tested
well:

- **Host:** "Hosting shares your IP address with anyone who tries to join with your code,
  even if you turn them away. Only give your code to people you trust."
- **Join:** "Joining shares your IP address with the host. Only join rooms from people you
  trust."
- **Room panel footnote (always visible), host:** "Anyone who connects can see your IP
  address. Only share codes with people you trust."
- **Room panel footnote, guest:** "The host can see your IP address." (In a star topology
  guests never connect to each other, so don't tell guests other guests see it.)
- **Join request prompt:** "<Name> wants to join. Only let in people you trust." with
  Accept / Deny, centered and impossible to miss.

Don't soften these into "may share some network information". Players can't decide on vague
text.

**Why refused joiners still see the host's IP.** PeerJS answers every incoming connection
automatically, so ICE candidates flow both ways before the game reads the joiner's `hello`.
The joiner's own offer also carries its candidates, so the host always sees the joiner's
IP. If you write your own signaling, you can hold the host's answer until the host approves
(send the join request and look over the signaling server first); that protects the host
from refused joiners. Relay-only TURN (`iceTransportPolicy: "relay"`) protects both sides.
Make the consent text match whichever flow you ship.

## Room codes

```js
// 12 chars from 32 symbols (0 O 1 I left out) = 60 bits.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function newCode(length = 12) {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	let code = "";
	for (let i = 0; i < length; i++) {
		code += ALPHABET[bytes[i] & 31]; // 256 is a multiple of 32, so no modulo bias
	}
	return code;
}

// What the player typed or pasted: cut very long text first, then strip spaces and dashes,
// upper-case, and keep A-Z 0-9.
function cleanCode(typed) {
	return String(typed || "").slice(0, 64).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}
```

- `Math.random` is predictable (xorshift128+ state can be recovered from a few outputs) and
  short codes (4 to 6 chars) can be brute-forced against a public signaling server. Use the
  browser's CSPRNG, `crypto.getRandomValues`.
- Peer ID = `NAMESPACE_PREFIX + code`. The prefix stops collisions with other games.
- Show the code as `XXXX-XXXX-XXXX`, hidden behind a SHOW toggle (streamers leak codes). Give
  a Copy button (`navigator.clipboard.writeText`) and a field that takes Ctrl+V. Reading the
  clipboard needs a click or key press from the player and may prompt, and it doesn't work at all in a game hosted
  on Harmony, so don't rely on a Paste button there.
  Truncate pasted text before cleaning it.
- Codes live as long as the host's peer. Closing the room ends the code. No separate expiry is
  needed, but a host who wants to cut off a leaked code can "new code" at any time.

## Host approval, room size, kicks

- On a new connection, wait for the guest's `hello` (with version and look). Show the host an
  Accept / Deny prompt. Send nothing about the game until accepted.
- One pending request at a time. While one is pending or the room is full, answer any other
  joiner with `deny: full` and drop them.
- Deny with a reason (`full`, `version`, `kicked`, `denied`) so the joiner's UI explains it.
- **Kick:** send `deny: kicked`, drop the connection, and after a short delay (~0.5 s, so the
  deny gets out) close the peer and reopen with a **new code**. Tell the host: "New code
  ready. The old one no longer works." Without this the kicked player just rejoins.
- Ignore any message whose sender ID isn't the approved friend (or the pending one, for
  `hello`). Stray connections can't inject state.

## Validating peer input

Write one cleaning function per message type and run everything through it. This applies in
both directions: guests validate what the host sends just as strictly as the host validates
guests. Rules:

1. **Size first.** Drop any message over a cap (2 KB is plenty for lobby JSON and compact
   state lines) before parsing. Cap field counts on delimited lines.
2. **Strict parse.** Catch parse errors and drop. Never `eval`, never `new Function`, never
   deserialize into arbitrary classes or revive objects from the data.
3. **Numbers:** parse with `Number()` (never locale-aware parsing), reject `NaN` and `Infinity`, clamp to sane
   ranges (coordinates within the map, health within max, damage per hit, stun seconds,
   knockback). A single `NaN` position can poison physics for every object it touches.
4. **Enums:** check membership in a `Set` of allowed values, never trust an index.
5. **IDs and strings:** allow-list characters and length (`[A-Za-z0-9_]{1,32}` for cosmetic
   IDs) and look them up in your own tables; unknown IDs fall back to a default.
6. **Names:** letters and digits in any script, combining marks, space, dot, dash, underscore; max
   ~16 characters counted by code point (20 for Harmony names); trim; fall back to a default. Strip bidirectional
   and zero-width controls (`U+202E` flips the rest of a label). Don't go ASCII-only: Chinese,
   Japanese and Korean players all become "Friend". `cleanName()` in the room module does
   this. Turn rich text / markup off on every label that shows a peer string (`textContent`, not
   `innerHTML`, in the DOM; PixiJS `Text`, not `HTMLText`; Phaser `Text`, not a BBCode or
   rich-text plugin; Unity labels with rich text off, which is on by default in TextMeshPro, uGUI
   and UI Toolkit; Godot's plain `Label`, not `RichTextLabel` with BBCode on). Two players with the
   same or look-alike names: show a short tag after the name (`Mina #4F2`) wherever players
   pick one (kick, invite lists).
7. **Arrays:** cap length before iterating.
8. **Counts that spawn things** (mines, projectiles, effects): cap per message and in total.
9. **Rate:** cap messages per peer per second, with a separate budget for each channel (the
   room module drops anything past `maxRate` / `maxFastRate`, 120 each) so a flood can't
   stall the main thread and snapshots can't crowd out events. Cap pending join requests too
   (the module allows one at a time).
10. **Derive limits from the wire.** Any limit that sizes an event (board size, group size,
    hand size) must keep the largest event under the message cap, or those events are
    dropped silently.
11. **Known fields only, into fresh objects.** Read the fields each message type has and
    ignore any others. Never merge a parsed message into game state or a look with
    `Object.assign`, spread or a deep merge: copy each checked field across. Keep anything
    keyed by a value from a peer (peer ids, object ids, rejoin tokens, cosmetic ids) in a `Map`,
    or check the key against your own table first, so `__proto__` or `constructor` can't
    reach an object's built-ins.
12. **Data never picks code.** Route each message type with a `switch` or a `Map` of
    allowed types, never `handlers[message.type]` on a plain object, which a type of
    `constructor` or `toString` reaches. Never `eval`, `new Function`, a string passed to
    `setTimeout`, or `import()` with anything a peer sent.
13. **Not a URL, a style or a file path.** A peer sends ids that you look up in your own
    tables, never a URL, a file path or a CSS value. A color is an index into your palette, or
    a string that matches `/^#[0-9a-f]{6}$/i`, set through the style property, never into
    `cssText` or `<style>` text.
14. **Free text and chat.** Leave chat out of the game where you can: players already talk
    somewhere else, and on Harmony the overlay has chat. If the game needs free text (a team
    name, a short note), cap its length, strip control, bidirectional and zero-width
    characters, and show it as text only, like a name.

## Trust between host and guest

- The host is authoritative for the shared world. A guest's claim ("I hit bot 17 for 40") is
  a request: the host checks the bot exists, clamps the damage and applies it.
- The host can read everything it is sent, in DevTools if nowhere else. A secret that belongs
  to a guest (a hangman word, a hand of cards, a Battleship board) stays on the guest's machine,
  and the guest commits to it with a hash and reveals it at the end. See "Hidden information"
  in `turn_based.md`.
- Each player's progression and save live on their own machine, so rewards are computed
  locally from events. Nobody can stop a determined cheater from editing their own save, and
  in co-op that only affects them.
- Never accept a peer's request to change anything outside the session (settings, saves,
  purchases, file paths, URLs). Never open a URL a peer sent.
- Guests check the host's plan against their own allow-list too: a mode flagged solo-only
  (daily challenge, solo leaderboard) is refused even if a modified host sends it.
- A "hide my IP" option must fail closed: no TURN server, no connection (`no-relay`).
- Dev-only switches that change where the game connects (`?signal=` for another signaling
  server) stay out of release builds. See `self_hosting.md`.

## Checklist

- [ ] CSPRNG codes, ~60 bits, namespaced peer ID, retry on collision
- [ ] Code hidden by default, copy/paste helpers
- [ ] First-host and first-join consent notices with the IP wording
- [ ] Persistent footnote on the room panel
- [ ] Approval prompt; nothing game-related sent before accept
- [ ] Room cap, one pending join, deny reasons
- [ ] Kick rolls a new code
- [ ] Version handshake, with a fingerprint of shared content tables
- [ ] Names keep non-Latin scripts, strip bidi and zero-width controls
- [ ] Hide my IP fails closed without TURN
- [ ] Size cap, strict parse, finite + clamp, enum and ID allow-lists, sanitized names
- [ ] Known fields copied into fresh objects; peer-keyed lookups in a `Map`; message types routed by `switch` or `Map`
- [ ] Every peer string shown as text, never HTML, a URL, CSS or code
- [ ] Messages from non-friends ignored
- [ ] No PII on the wire: a typed name, a random handle or a Harmony name and tag, never an account ID
- [ ] A secret a guest owns (word, hand, board) never reaches the host in plain form
- [ ] Host-side clamps on every guest request
