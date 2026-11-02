# Music

Loops without gaps, smooth changes between tracks, music that reacts to play, and ducking. The
examples are TypeScript and use `audio`, `buses` and `buffers` from `engine.md`.

## Contents
- Gapless loops
- Crossfades
- Layered music
- Changing on the beat, and stingers
- Ducking
- Which music when

## Gapless loops

An `<audio>` element with `loop` can leave a small gap. For a loop that must have no gap,
decode it and loop the buffer:

```ts
function startLoop(name: string, bus: GainNode, loopStart = 0, loopEnd = 0): { source: AudioBufferSourceNode; gain: GainNode } {
  const source = audio.createBufferSource();
  source.buffer = buffers.get(name)!;
  source.loop = true;
  if (loopEnd > loopStart) {
    source.loopStart = loopStart;               // seconds: skip an intro, or encoder padding
    source.loopEnd = loopEnd;
  }
  const gain = audio.createGain();
  source.connect(gain).connect(bus);
  source.start();
  return { source, gain };
}
```

- Compressed formats add a little padding at the start. If a loop clicks or skips at the seam,
  set `loopStart` and `loopEnd` to the exact loop points in seconds.
- A track with an intro: start at 0, loop between the end of the intro and the end.
- Author loops with the tail of the last bar mixed into the start, so the seam is musical.
- Long tracks (several minutes) stream through `<audio>` instead, where a tiny gap matters less
  than the memory a decoded buffer takes.

## Crossfades

Fade the old track out while the new one fades in, over one to three seconds. Equal-power
curves keep the loudness steady through the middle:

```ts
function equalPowerFade(gain: GainNode, fadeIn: boolean, seconds: number): void {
  const steps = 64;
  const curve = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    curve[i] = fadeIn ? Math.sin(t * Math.PI / 2) : Math.cos(t * Math.PI / 2);
  }
  gain.gain.cancelScheduledValues(audio.currentTime);
  gain.gain.setValueCurveAtTime(curve, audio.currentTime, seconds);
}

// Old track out, new track in; stop the old source when its fade ends.
equalPowerFade(current.gain, false, 2);
current.source.stop(audio.currentTime + 2);
const next = startLoop("forest", buses.music);
equalPowerFade(next.gain, true, 2);
```

- Don't restart a track that's already playing when the player returns to the same screen.
- Short fades (0.5 s) for menus, longer (2 to 4 s) between areas.

## Layered music

Music that builds with the action: several stems of one piece (drums, bass, melody, a tense
layer) started together and faded in and out.

```ts
const startAt = audio.currentTime + 0.1;         // all layers on the same clock
const layers = ["calm", "drums", "tension"].map((name) => {
  const source = audio.createBufferSource();
  source.buffer = buffers.get(name)!;
  source.loop = true;
  const gain = audio.createGain();
  gain.gain.value = name === "calm" ? 1 : 0;
  source.connect(gain).connect(buses.music);
  source.start(startAt);
  return { name, gain };
});

function setLayer(name: string, on: boolean): void {
  const layer = layers.find((l) => l.name === name)!;
  layer.gain.gain.setTargetAtTime(on ? 1 : 0, audio.currentTime, 0.5);
}
```

- Every stem must be exactly the same length, so they stay in sync loop after loop.
- Drive layers from game state (enemies near, time running out), with a little delay before
  fading down so the music doesn't flicker.

## Changing on the beat, and stingers

Musical changes sound right when they land on a beat or a bar:

```ts
const bpm = 120;
const beatsPerBar = 4;
const barSeconds = 60 / bpm * beatsPerBar;

function nextBar(trackStartTime: number): number {
  const elapsed = audio.currentTime - trackStartTime;
  return trackStartTime + Math.ceil(elapsed / barSeconds) * barSeconds;
}
```

- Schedule layer changes, track changes and stingers (short musical hits for a level up, a boss
  appearing, a win) at `nextBar(...)` or the next beat, using `source.start(when)` and gain
  automation at `when`.
- Keep stingers in the key of the music, or duck the music under them.
- Gameplay feedback that must be instant (a hit, a pickup) is a sound effect, never quantized.

## Ducking

Lower the music under speech and big moments, then bring it back:

```ts
// Music tracks connect to musicDuck instead of straight to the music bus.
const musicDuck = audio.createGain();
musicDuck.connect(buses.music);

function duck(bus: GainNode, level: number, seconds: number): void {
  const now = audio.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setTargetAtTime(level, now, 0.08);          // down quickly
  bus.gain.setTargetAtTime(1, now + seconds, 0.4);     // back up slowly
}

// Dialogue line of 3 s: music to 40% while it plays.
duck(musicDuck, 0.4, 3);
```

- Duck through a separate gain node between the music and its bus (`musicDuck` above), so it
  doesn't fight the volume setting on the bus itself.
- Duck for voice lines, stingers, the Harmony overlay in online play (with the Harmony SDK,
  which tells the game when it opens), and huge one-off sounds.
- Duck by 6 to 10 dB (to about 30% to 50%), down in under 0.1 s, back over half a second or
  more.

## Which music when

- Title and menus: one calm loop that doesn't tire over minutes of browsing settings.
- Play: a loop per area or mode, or layered music that follows the action.
- Results: a short win or lose cue, then the menu loop.
- Silence is fine: short puzzle games often feel better with ambience and no music.
- Every track has a volume that fits under the effects; set it once by ear across all tracks.
