# The audio engine

One `AudioContext`, buses into a limited master, sounds loaded ahead of use, and voices kept
under control. The examples are TypeScript; write them in the game's own style, or map them
onto the engine's own audio system.

## Contents
- The context and the graph
- Unlocking
- Loading and formats
- Playing sounds
- Pausing and resuming
- Phones

## The context and the graph

```ts
export const audio = new AudioContext();

// A limiter: a fast, hard compressor just under 0 dB, so a pile of sounds never clips.
const limiter = audio.createDynamicsCompressor();
limiter.threshold.value = -3;
limiter.knee.value = 0;
limiter.ratio.value = 20;
limiter.attack.value = 0.003;
limiter.release.value = 0.1;
limiter.connect(audio.destination);

const master = audio.createGain();
master.connect(limiter);

export const buses = {
  music: audio.createGain(),
  effects: audio.createGain(),
  voice: audio.createGain(),
  ui: audio.createGain(),
};
for (const bus of Object.values(buses)) {
  bus.connect(master);
}

// Volume sliders (0 to 1) map to gain on a curve, ramped to avoid clicks.
export function setVolume(node: GainNode, slider: number): void {
  node.gain.setTargetAtTime(slider * slider, audio.currentTime, 0.02);
}
```

- One context for the whole game. Creating more wastes resources and some browsers cap them.
- The settings menu drives `master` and each bus with `setVolume`.
- Keep the limiter's threshold a little below 0 dB. If it's working hard all the time (sounds
  pump or flatten), the mix is too hot: lower the buses instead.

## Unlocking

Browsers keep a new context `suspended` until the player acts on the page. Resume it on the
first input, and every time it's found suspended while the game wants sound:

```ts
function unlockAudio(): void {
  if (audio.state !== "running") {
    audio.resume();
  }
}
for (const type of ["pointerup", "touchend", "keydown"]) {   // the end of a tap counts as the player's action
  window.addEventListener(type, unlockAudio, { capture: true });
}
```

- Leave the listeners in place: phones can suspend the context again later (see Phones).
- Don't play the title music on a timer before the first input; start it from that first input
  so it isn't silently dropped.

## Loading and formats

```ts
const buffers = new Map<string, AudioBuffer>();

export async function loadSound(name: string, url: string): Promise<void> {
  const response = await fetch(url);
  const data = await response.arrayBuffer();
  buffers.set(name, await audio.decodeAudioData(data));
}
```

- Decode at load; decoding works while the context is still suspended. Load the title screen's
  and first level's sounds first, the rest in the background.
- Load files by relative addresses (`./audio/jump.ogg`) so they're found wherever the build is
  served.
- **Formats:** Opus (in `.ogg` or `.webm`) for everything: effects mono at 48 to 64 kbit/s,
  music stereo at about 96 kbit/s. Older Safari may not decode Opus; if older iPhones matter,
  ship AAC (`.m4a`) copies too and pick with `new Audio().canPlayType(...)`. Never WAV.
- Trim silence from the start of every effect (it adds delay) and the end (it wastes bytes).
- **Long music:** a decoded buffer takes about 10 MB of memory per stereo minute. Stream long
  tracks with an `<audio>` element routed into the music bus:

  ```ts
  const element = new Audio("./audio/theme.ogg");
  element.loop = true;
  audio.createMediaElementSource(element).connect(buses.music);
  ```

  `<audio>` loops can have a small gap; for short loops that must have no gap, decode them and
  loop the buffer (see `music.md`).

## Playing sounds

A cue describes how a sound plays; `play` enforces it:

```ts
interface Cue {
  sounds: string[];          // one is picked at random
  bus: GainNode;
  volume: number;            // 0 to 1
  pitch: [number, number];   // playback rate range, e.g. [0.95, 1.05]
  maxVoices: number;         // copies at once
  cooldown: number;          // seconds before it can start again
}

const voices = new Map<Cue, AudioBufferSourceNode[]>();
const lastStart = new Map<Cue, number>();

export function play(cue: Cue, pan = 0, gainScale = 1): void {
  if (audio.state !== "running") {
    return;
  }
  const now = audio.currentTime;
  if (now - (lastStart.get(cue) ?? -Infinity) < cue.cooldown) {
    return;
  }
  const buffer = buffers.get(cue.sounds[Math.floor(Math.random() * cue.sounds.length)]);
  if (!buffer) {
    return;
  }
  const playing = voices.get(cue) ?? [];
  if (playing.length >= cue.maxVoices) {
    playing.shift()?.stop();                     // steal the oldest voice
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = cue.pitch[0] + Math.random() * (cue.pitch[1] - cue.pitch[0]);
  const gain = audio.createGain();
  gain.gain.value = cue.volume * gainScale;
  const panner = audio.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  source.connect(gain).connect(panner).connect(cue.bus);
  source.onended = () => {
    const list = voices.get(cue) ?? [];
    const index = list.indexOf(source);
    if (index >= 0) {
      list.splice(index, 1);                     // a stolen voice was already removed
    }
  };
  playing.push(source);
  voices.set(cue, playing);
  lastStart.set(cue, now);
  source.start();
}
```

- Typical limits: footsteps 2 voices, gunfire 4 to 6, coins 3 with a 0.05 s cooldown, explosions
  3, interface 1 or 2.
- A whole-game cap (around 32 voices) protects phones; drop the quietest or oldest past it.
- Play from game events, not from the render loop, so a dropped frame never doubles a sound.

## Pausing and resuming

- **Hidden tab:** when the player's "mute in background" setting is on, call `audio.suspend()`
  on `visibilitychange` when `document.hidden`, and `audio.resume()` when visible again.
- **Pause menu and the Harmony overlay** (single player): the game pauses, so suspend the
  context or ramp the master down. In a game that uses the Harmony SDK, do it from
  `harmony.on("open")` too, and resume from `harmony.on("close")`. Without the SDK the game
  isn't told, but the window gets `blur` when the overlay opens: the game pauses on `blur`, and
  the audio follows the pause menu.
- **Online play:** the game keeps running, so don't suspend. Duck the music and effects buses
  instead, and keep important cues (a teammate down) audible.
- Suspending pauses everything at once, including music, and resumes it in place.

## Phones

- **iPhone silent switch:** with the ringer switch on silent, iPhones mute Web Audio. This is the
  most common "no sound on iPhone" report. Safari's `navigator.audioSession.type = "playback"`
  (where supported) lets the game's sound play anyway; whether to set it is the developer's
  call, since players may expect silence.
- **Interruptions:** a phone call, an alarm or another app can stop the context (Safari reports
  the state `interrupted`). Listen for `statechange`, and resume on the next input.
- **Bluetooth headphones** add delay. Keep timing-critical feedback visual as well as audible.
- Decode fewer sounds up front on phones, and stream music, to stay well within memory.
