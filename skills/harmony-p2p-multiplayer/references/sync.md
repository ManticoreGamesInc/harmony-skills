# Sync: avatars, shared world, gameplay rules

## Contents
- Who owns what
- Avatar state and send rate
- Snapshot interpolation
- Clock offset
- The remote avatar (ghost / proxy)
- Rooms of 3 or more
- Shared world: enemies as puppets
- Hits, stuns and abilities across the wire
- Enemy targeting with two players
- Rewards
- Downs and revives
- Shared objectives (extraction, exits, bosses)
- Drop-out rules
- Things that must not pause

## Who owns what

| Thing | Owner | Others see |
|---|---|---|
| Each player's avatar, input, camera | that player | interpolated ghost |
| Enemies, AI, spawns, waves, timers | host | puppets driven by snapshots |
| Damage to enemies | host applies | guest sends hit requests |
| Damage to the guest | host detects (enemy hits the guest's proxy) | guest applies on its own avatar |
| Pickups, loot rolls, objectives | host | events |
| Progression, currency, saves | each player locally | nothing, or a level number |

Rule of thumb: whoever can't be wrong about it owns it.

The alternative, the host simulating every player from their inputs with client-side
prediction and reconciliation, costs far more code and only pays off when players must not
be able to cheat movement (competitive play). For co-op among friends, players own their
own avatars. A player must never feel input lag on
their own movement, so they own it. Two machines must never disagree about whether an enemy
is dead, so the host owns it.

## Avatar state and send rate

Send your own state 15 times a second on the fast channel: sender time, position, rotation,
aim, a running shot counter, health and max, and flags (boosting, down). Keep it to one line.

Counters beat flags for events: send "shots fired so far". The receiver plays
`min(new - last, 4)` shots and does nothing when the difference is zero. A "firing" flag on
an unreliable channel either repeats forever or drops shots.

## Snapshot interpolation

Draw remote things slightly in the past, between two real snapshots, instead of guessing the
future. Keep a small ring buffer per entity.

```js
const DELAY = 0.15;           // avatars; 0.2 to 0.25 for enemies at 10 Hz
const MAX_EXTRAPOLATE = 0.2;

function sample(buffer, nowRemote) {
	const at = nowRemote - DELAY;
	// buffer sorted by time, oldest first. Before the oldest snapshot (just joined, or the
	// buffer was cleared): hold the oldest. Returning the newest here jumps the entity ahead,
	// then snaps it back once the delay window catches up.
	if (at <= buffer[0].time) {
		return { pos: buffer[0].pos, rot: buffer[0].rot };
	}
	for (let i = buffer.length - 1; i > 0; i--) {
		const a = buffer[i - 1], b = buffer[i];
		if (a.time <= at && at <= b.time) {
			const t = (at - a.time) / Math.max(b.time - a.time, 1e-4);
			return { pos: lerp(a.pos, b.pos, t), rot: slerp(a.rot, b.rot, t) };
		}
	}
	const newest = buffer[buffer.length - 1];
	if (at > newest.time && buffer.length >= 2) {
		// short, capped extrapolation from the last velocity, then hold
		const prev = buffer[buffer.length - 2];
		const ahead = Math.min(at - newest.time, MAX_EXTRAPOLATE);
		const vel = scale(sub(newest.pos, prev.pos), 1 / Math.max(newest.time - prev.time, 1e-4));
		return { pos: add(newest.pos, scale(vel, ahead)), rot: newest.rot };
	}
	return { pos: newest.pos, rot: newest.rot };
}
```

- Insert by sender time; drop anything older than the newest stored.
- Send at a fixed rate from a timer, never once per rendered frame. Frame rates differ
  between machines and a 144 Hz host floods a 60 Hz guest.
- Skip a snapshot when the channel is backed up (`dataChannel.bufferedAmount` above ~64 KB)
  instead of queueing it; the next one replaces it. `sendFast` in `scripts/p2p_room.js`
  does this.
- Snap (don't interpolate) on teleports: respawn, revive, scene change.
- Hide or freeze a ghost whose newest snapshot is more than ~2 s old.
- 6 entries per enemy, 16 per avatar is plenty.

## Clock offset

`nowRemote` is your clock translated into theirs. Estimate the offset from every snapshot:

```js
// offset = their time - our time. The quickest packet gives the largest value
// (least delay). Take the max, and let it creep down slowly so a clock drift or
// route change can recover without a late packet ever yanking it.
function noteClock(senderTime) {
	const offset = senderTime - nowLocal();
	clockOffset = clockSet ? Math.max(offset, clockOffset - 0.002) : offset;
	clockSet = true;
}
const nowRemote = () => nowLocal() + clockOffset;
```

Use an unscaled, monotonic clock (`performance.now() / 1000`), never
game time that pauses or slows.

Never let the render clock run backward. If the sender goes quiet (hidden tab, stall), hold
or extrapolate (capped) and wait; don't snap the clock back toward the newest snapshot, or
remote entities rewind in a sawtooth. The max-tracking offset above only creeps, so it can't
jump backward.

## The remote avatar (ghost / proxy)

Fastest route to a faithful remote player: clone the local avatar and strip it.

- Copy it without running its setup code (input, camera follow, audio, network sends).
- Remove input, controller, physics body, camera, audio listener, UI, and anything that sends
  network messages. Remove dependents before what they depend on.
- Keep visuals that read state: cosmetics, damage smoke, hit flash, footstep or trail
  effects. Feed them through a small interface (`isBoosting`, `isGrounded`, `boostStarted`)
  that both the real controller and a ghost driver implement.
- Apply the friend's cosmetics from their lobby look (colors, trail, effects), once cleaned:
  ids looked up in your own tables, colors from your palette.
- **On the host only**, give the guest's proxy a solid collider, moved by code rather than by physics, so enemy
  attacks and projectiles can hit it. Route damage on the proxy to an `H` message for the
  guest instead of applying it locally.
- Ignore collisions between the two players (and re-apply the ignore after anything that
  toggles colliders, since some engines reset it).
- When hiding the ghost (down, dead), record which renderers / colliders / effects were
  enabled and restore exactly those.

## Rooms of 3 or more

Keep the star: guests connect only to the host, never to each other. That way only the host
learns everyone's IP, and only the host's upload grows with the room.

- The host forwards each guest's avatar line to the other guests (`sendOthers(text, from,
  true)` in the room module), adding the sender's player number if the line doesn't carry
  one. Guests trust a player number only if the host's roster (sent on the reliable channel
  when someone joins or leaves) lists it.
- The host's own state goes to everyone as usual.
- Budget the host's upload: (players - 1) x (own state + relayed states + world snapshots).
  At 15 Hz with ~150-byte lines that stays small up to 4 players.
- Rewards, revives and joint objectives generalize from "both" to "everyone still in the
  run". Decide what happens when one of three leaves (usually: carry on).

## Shared world: enemies as puppets

On the guest, enemies are the same enemy objects with their brains off: no AI, no pathfinding,
no damage dealing, no loot. The host streams them.

- `N` spawn: id, kind, variant, position, yaw, health, boss flag. Guest spawns the enemy in
  puppet mode.
- `M` batch at 10 Hz on the fast channel: for each live enemy, position, yaw, health, shield,
  and a few behavior fields (current state, charge value, aim point) so the puppet can play
  the right animation and telegraph.
- `A` attack started: id, kind, parameters. The puppet plays the wind-up, the ground decal,
  the muzzle flash. Without this the guest gets hit by attacks they never saw coming.
- `X` died / `R` removed. The puppet plays its death or vanishes.

Give every behavior two hooks: `writeShow()` on the host (pack what the puppet needs) and
`applyShow()` on the guest (play it). Keeps puppet code next to the real behavior.

## Hits, stuns and abilities across the wire

- Guest hits an enemy puppet: send `D|id|damage|point|dir`; play hit effects locally at once
  so it feels instant. The host clamps and applies, and the health comes back in `M`.
- Guest stuns: `T|id|seconds|pushX|pushZ`, clamped on the host (e.g. 5 s, 20 m/s).
- Host's enemies hit the guest's proxy: `H|damage|point|dir` to the guest, who applies it.
- Abilities with visuals (shock pulse, mines, shields) send a `P` event. The other side plays
  a **visual-only dummy**: a mine that shows and explodes but deals no damage, since the
  owner's game applies the real effect. Cap dummies.
- No friendly fire: projectiles ignore the other player, and AoE only hits enemies.

## Enemy targeting with two players

Enemies on the host choose between the host's avatar and the guest's proxy.

- Pick the nearest living player on spawn.
- Every ~1 s, re-check: switch only when the other player is much closer (distance ratio
  around 1.5) so enemies don't jitter between targets.
- When retargeting, reset any "stopped" state the AI was in (a pathing agent left stopped
  from a wind-up attack stays frozen forever).
- Skip downed players.

## Rewards

Each player earns from their own play, computed on their own machine.

- Track damage per player on every enemy (host knows both).
- On death the host sends `X|id|killer|guestShare`. Currency splits by damage share (the
  other player's share shows as "Assists"); XP, kill count and drops go to the killer.
- Rewards that don't come from kills (wave bonuses, extraction) go to both.

## Downs and revives

Instant death in co-op feels bad; a downed state gives the partner something to do.

- When a player's health hits zero while the partner is alive and in the run, they go down
  instead of dying. Show it on the partner's HUD row and minimap (red ring, dimmed arrow).
- The partner revives by staying within ~3.5 m for ~3 s. Show a ground ring for the range
  and a fill meter. Only fill while the downed player is actually waiting (not during the
  death explosion).
- Decide the revive in one place (the downed player's own game is simplest, since it owns
  that avatar's health) and send the result. Snap the revived avatar's ghost to its new
  position (no interpolation across it).
- Both down, or the partner left, means the normal death path.

## Shared objectives (extraction, exits, bosses)

- Joint objectives need everyone present: the extraction zone only fills while both players
  are inside, and a downed player counts as present if they're inside.
- The host decides and sends the result (`Z|1`); both extract on that message, not on their
  own timers.
- HUD says who you're waiting for: "WAITING FOR <name>". Fit long names (truncate or shrink).
- A partner who has left falls back to the solo rule.

## Drop-out rules

Decide these up front and write them into the UI.

| Event | Rule used |
|---|---|
| Guest leaves mid-run | host carries on solo; guest's proxy removed; enemies retarget |
| Host leaves mid-run | guest's puppets cleared; if extraction is ready the guest can still extract, else the run ends like a death (with the death reward) |
| Connection lost | same as leaving, after the heartbeat timeout |
| Host's tab hidden | world keeps running if the tab stays alive; throttled timers slow it |

Host migration (guest takes over the world) is possible but rarely worth the complexity
for small co-op.

## Things that must not pause

- Pause menus, settings, upgrade/augment picks: overlay them on a running world in
  multiplayer. Shared time can't stop for one player.
- Timers that both sides display (wave countdowns): display the host's value with a small
  tolerance (~0.35 s) before correcting, so the number doesn't flicker 13, 12, 13.
- Spawn queues: when two players spawn from the same place (a spawn point, a door), queue them.
  The first one moves further out, the second waits until the first is clear (or a timeout).
