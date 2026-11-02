# Sound design and the mix

Which sounds a game needs, how to keep them from repeating badly, where they sit in space, how
loud each one is, where to get them, and how to test them. Code uses `play`, `audio` and
`buses` from `engine.md`.

## Contents
- A cue for each event
- Variation
- Interface sounds
- Panning and positional sound
- Mix levels
- Sourcing and licenses
- Testing

## A cue for each event

List the game's events and give each one a cue, most important first:

1. **The player's own actions:** jump, shoot, hit, take damage, collect, land. These make the
   game feel responsive; they play instantly, every time.
2. **Danger and state:** low health, an enemy appearing, a timer running out, a teammate down.
3. **Rewards:** score, combo, level up, unlock, win.
4. **The world:** ambience, enemies, machines, weather.
5. **Interface:** see below.

- The sound starts on the same frame as the event; even 50 ms of delay feels sluggish. Trim the
  silence at the start of every file.
- Bigger events are louder and lower; frequent events are short and quiet.
- Don't add a sound to everything. A cue the player hears a thousand times per session needs to
  be subtle, or left out.

## Variation

Repeated identical sounds become irritating fast.

- Two to four variants for anything frequent (footsteps, hits, gunfire), picked at random
  without playing the same one twice in a row.
- A small random pitch range (about ±3% to ±6% playback rate) and volume range (about ±10%).
- Rising pitch for streaks: each coin in a combo plays a little higher, resetting after a pause.

## Interface sounds

- A small, consistent family: move (focus or hover), confirm, back, toggle, slider tick, error,
  and open and close for panels. Quieter than gameplay; on the interface bus.
- Hover and focus sounds are very short and soft, and limited to one voice with a short cooldown,
  so sweeping across a menu doesn't machine-gun.
- Back sounds lower or softer than confirm; errors are short and not harsh.
- No sound on every keystroke in text fields.

## Panning and positional sound

**2D games:** pan by screen position, gently. `play(cue, pan)` with
`pan = (x / screenWidth) * 2 - 1`, scaled to about ±0.6, so nothing is hard left or right.

**3D games:** a `PannerNode` per moving source, and the listener on the camera:

```ts
const panner = new PannerNode(audio, {
  panningModel: "HRTF",          // "equalpower" is cheaper for many sources
  distanceModel: "inverse",
  refDistance: 2,
  maxDistance: 60,
  rolloffFactor: 1,
});

// Each frame (or when they move):
panner.positionX.value = enemy.x;
panner.positionY.value = enemy.y;
panner.positionZ.value = enemy.z;
const listener = audio.listener;
listener.positionX.value = camera.x;
listener.positionY.value = camera.y;
listener.positionZ.value = camera.z;
// Plus listener.forwardX/Y/Z and upX/Y/Z from the camera's orientation.
```

- Engines wrap this: Three.js `PositionalAudio` with an `AudioListener` on the camera, Babylon.js
  spatial sounds.
- HRTF on many sources at once is expensive on phones; use it for the few that matter and
  `equalpower` for the rest.
- Don't play sounds that are too far away to hear at all; skip them before creating nodes.
- Important cues (danger behind the player) need a visual cue too.

## Mix levels

Set levels by ear with the master at the default, in this order:

1. The player's core actions (jump, hit, shoot): the reference level.
2. Danger and important events: as loud or slightly louder.
3. Music: clearly under the core actions; the player should hear their own hits over it.
4. Ambience: quieter than music.
5. Interface: quiet, but audible over music in menus.

- Normalize every effect file to the same peak (about −1 dBFS) before setting levels in code,
  so cue volumes mean the same thing across files.
- Bring music tracks to a similar loudness (about −16 to −18 LUFS integrated) so switching tracks
  doesn't jump.
- If the limiter is working all the time, everything is too loud: lower the buses, don't push
  the limiter harder.
- Check the mix with many things happening at once, not one sound at a time.

## Sourcing and licenses

- Use sounds the developer made, bought, or that come with a clear license: CC0 (no
  attribution), CC BY (attribution required), or a library license that allows games.
- Avoid licenses that forbid commercial use (CC BY-NC) unless the game is free and will stay
  free, and anything with no license stated.
- Keep `audio/CREDITS.md`: every file, its source, its author, its license, and any changes made.
  Show required attributions in the game's credits screen.
- Generated sounds and music: record the tool and its terms in the same file.

## Testing

- Listen on a laptop or phone speaker and on headphones; both often reveal different problems
  (missing bass on speakers, harsh highs on headphones).
- Play for ten minutes and note anything that becomes irritating.
- Test with the sound off: can the game still be played? Every important cue needs a visual
  partner.
- Test the first input after loading (the context unlocks and the title music starts), a hidden
  tab and back, the pause menu, and on an iPhone with the silent switch on and off.
- Watch the voice count in heavy moments; if it keeps hitting the cap, lower some cues' limits.
