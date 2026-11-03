# The options

What each setting does, its default, and how to apply it. The examples are TypeScript; write
them in the game's own language and style.

## Contents
- Graphics
- Audio
- Controls
- Accessibility
- General

## Graphics

**Quality presets.** Each preset is a bundle of the other graphics settings:

| Setting | Low | Medium | High |
| --- | --- | --- | --- |
| Render scale | 0.75 | 1 | 1 |
| Pixel ratio cap | 1 | 1.5 | 2 |
| Shadows | off | on, small | on, soft |
| Effects (bloom, post) | off | cheap ones | all |
| Particles | a third | two thirds | all |

- First run: start phones and small touch screens (`matchMedia("(pointer: coarse)")`) on Low,
  others on Medium. Optionally measure the first seconds of play and step once.
- Changing any single graphics setting switches the preset to Custom.
- Apply while the menu is open, with the game visible behind it, so players see the difference.

**Render scale.** Renders the scene at a fraction of the canvas size and scales it up; the UI
stays sharp. The biggest single speed-up on weak GPUs.

**Frame-rate cap.** "Display" (no cap), 60 or 30. Saves battery and heat on phones and 120 Hz
screens. Skip frames in the `requestAnimationFrame` callback:

```ts
let lastDrawn = 0;

function frame(now: number): void {
  requestAnimationFrame(frame);
  const cap = settings.graphics.fpsCap;
  if (cap > 0 && now - lastDrawn < 1000 / cap - 1) {
    return;                                 // too soon: skip this display refresh
  }
  lastDrawn = now;
  update();
  render();
}
```

**Fullscreen.** A toggle that calls `document.documentElement.requestFullscreen()` from the
click or key handler, and `document.exitFullscreen()` to leave. Keep the toggle in step with
`fullscreenchange`, since players also leave with Esc. On Harmony this works from a click or
key handler, and Harmony makes the whole page fullscreen with its overlay above. Fullscreen
isn't a saved setting: browsers only allow it on a player action.

**Show frame rate.** A small counter in a corner, off by default.

## Audio

Route every sound through a gain bus per category, all into one master:

```ts
const audioContext = new AudioContext();
const master = audioContext.createGain();
master.connect(audioContext.destination);

const buses = {
  music: audioContext.createGain(),
  effects: audioContext.createGain(),
  voice: audioContext.createGain(),
  ui: audioContext.createGain(),
};
for (const bus of Object.values(buses)) {
  bus.connect(master);
}

// Sliders are 0 to 1; ears hear loudness on a curve, so square the value.
function toGain(slider: number): number {
  return slider * slider;
}

function setGain(node: GainNode, slider: number): void {
  node.gain.setTargetAtTime(toGain(slider), audioContext.currentTime, 0.02);   // no clicks
}

onSettingsChanged((s) => {
  setGain(master, s.audio.master);
  setGain(buses.music, s.audio.music);
  setGain(buses.effects, s.audio.effects);
  setGain(buses.voice, s.audio.voice);
  setGain(buses.ui, s.audio.ui);
});
```

- Sliders show 0 to 100, in steps of 5. 0 is silent.
- Play a sample on release of the effects, voice and interface sliders; music keeps playing
  behind the menu so its slider is heard live.
- **Unlocking:** browsers start audio suspended until the player acts. Call
  `audioContext.resume()` in the first `pointerdown` or `keydown` handler.
- **Mute in the background:** on `visibilitychange`, ramp the master to 0 when
  `document.hidden` and back when visible (when the setting is on). Suspending the context also
  works and saves battery.
- A mute key (M) is handy; show it in the settings and the pause menu.

## Controls

**Bindings.** Actions map to inputs; the game reads actions, never raw keys.

- Keys by `KeyboardEvent.code` (the physical key: `KeyW` is in the same place on every layout),
  shown to the player by what's printed on it: `navigator.keyboard.getLayoutMap()` where it
  exists (Chromium), else a readable name from the code (`KeyW` -> "W", `ArrowUp` -> "↑").
  Browsers can refuse the layout map in a frame on another site, as a hosted game is, so wrap
  the call in `try`/`catch` (it returns a promise that can reject) and fall back to the code's name.
  Show key names and binding labels with `textContent` or the engine's plain text object; a code
  read from storage is checked like any other setting (`store.md`) before it's used.
- Controller buttons by the standard mapping's index (`pad:0` is the bottom face button).
  Show the right labels for the controller in use: A, B, X, Y for Xbox-style pads; Cross,
  Circle, Square, Triangle for PlayStation-style; guess from `gamepad.id` and offer a choice.
- **Rebinding:** select the action, show "Press a key for Jump (Esc to cancel)", take the next
  key or button. If it's already used, offer to swap. Keep at least one binding per action.
- **Reserved:** Esc (pause and back: it always does that, can't be rebound, and can't be bound to
  another action), the browser's own shortcuts (they can't be captured reliably), and
  Shift+Tab, which opens the Harmony overlay by default. Refuse those with a short message.
- Two bindings per action on keyboard (WASD and arrows), one on controller.

**Sensitivity:** a multiplier for mouse look and stick look, 0.25 to 4, shown as 1 to 100
on a curve. **Invert vertical axis:** for look controls. **Dead zone:** radial, applied to the
stick's length, not each axis; 0.1 to 0.2 by default. **Vibration:** through
`gamepad.vibrationActuator?.playEffect("dual-rumble", { duration, strongMagnitude, weakMagnitude })`
where the browser supports it; hide the setting where it doesn't.

**Touch:** control size (75% to 150%), opacity, and a left-handed layout that mirrors the
controls. Preview them over the game while adjusting.

## Accessibility

- **Text size:** scales all interface text (a CSS variable on the root, and a multiplier for
  canvas text), 100% to 150%. Layouts must grow with it. Set the variable from the clamped
  number only: `root.style.setProperty("--text-scale", String(s.accessibility.textScale))`.
- Color-blind palettes are the game's own token sets, chosen by the saved mode's name from the
  allowed list (`root.dataset.colorMode = s.accessibility.colorMode`); colors are never read
  from storage.
- **Color-blind mode:** never let color alone carry meaning; add a shape, icon, pattern or
  label to every color that matters (teams, matches, good and bad pickups). Then offer palettes
  tuned so those colors stay apart for each kind of color blindness (protanopia, deuteranopia,
  tritanopia) and a high-contrast option. A full-screen color filter isn't a fix.
- **Reduced motion:** on by default when the system's `prefers-reduced-motion` is set. Removes
  or shortens camera shake, zooms, parallax, big screen transitions and bouncing UI.
- **Screen shake:** a slider from 0 to 100%, separate from reduced motion.
- **Reduce flashing:** no more than three flashes a second anywhere, and with the option on,
  no full-screen flashes at all (dim them or replace them with an outline).
- **Subtitles and captions:** for speech, and for sounds that matter to play ("[footsteps
  behind you]"). Readable size, a background box, and the speaker's name.
- **Hold or toggle:** for any action held down (aim, sprint, crouch), let a press toggle it.
- **Assists,** where the design allows: game speed, aim assist, extra time, skip a puzzle.
  Say plainly what each does; never hide content behind not using them.

## General

- **Language:** each language in its own name ("Deutsch", "日本語"), plus "Automatic" (from
  the browser). Applies at once. The saved code, and any code from the browser, is matched
  against the game's own list of languages before it sets the page's `lang` and `dir` or picks
  a language file; anything else means the default, so a value like `../x` never reaches a path.
- **Save backup:** Export and Import save buttons if the game keeps progress, with a line saying
  saves stay in this browser otherwise. Without the Harmony SDK they use a download and a file
  picked with `<input type="file">`, which both work in a game hosted on Harmony; Harmony's Save
  and Open dialogs (`harmony.files`) are only for a game that already uses the SDK. The
  `harmony-progression` skill's `saves.md` has both.
- **Reset all settings,** with a confirmation. It doesn't touch saves or progress.
- **Credits and version:** the build's version in small text at the bottom helps bug reports.
