# The settings store

One object holds every setting. It is read safely, saved on every change, and applied through
one function, so the menu, the game and the save always agree. The examples are TypeScript;
write them in the game's own language and style.

## Contents
- The settings object and defaults
- Reading safely
- Saving
- Applying changes
- Reset
- Per device or per player

## The settings object and defaults

```ts
type Quality = "low" | "medium" | "high" | "custom";

interface Settings {
  graphics: {
    quality: Quality;
    renderScale: number;        // 0.5 to 1
    fpsCap: 0 | 30 | 60;         // 0 = the display's rate
    shadows: boolean;
    effects: boolean;
    particles: number;          // 0.33 to 1
    showFps: boolean;
  };
  audio: {
    master: number;             // 0 to 1, as the slider shows it
    music: number;
    effects: number;
    voice: number;
    ui: number;
    muteInBackground: boolean;
  };
  controls: {
    bindings: Record<string, string[]>;   // action -> key codes and pad buttons
    sensitivity: number;        // 0.25 to 4, 1 = default
    invertY: boolean;
    deadZone: number;           // 0 to 0.4
    vibration: boolean;
    touchScale: number;         // 0.75 to 1.5
    touchOpacity: number;       // 0.2 to 1
    leftHanded: boolean;
  };
  accessibility: {
    textScale: number;          // 1 to 1.5
    colorMode: "default" | "protan" | "deutan" | "tritan" | "highContrast";
    reducedMotion: boolean;
    screenShake: number;        // 0 to 1
    reduceFlashing: boolean;
    subtitles: boolean;
    holdToToggle: boolean;
  };
  general: {
    language: string;           // "" = pick from the browser
  };
}

const DEFAULT_BINDINGS: Record<string, string[]> = {
  moveUp: ["KeyW", "ArrowUp", "pad:12"],
  moveDown: ["KeyS", "ArrowDown", "pad:13"],
  moveLeft: ["KeyA", "ArrowLeft", "pad:14"],
  moveRight: ["KeyD", "ArrowRight", "pad:15"],
  jump: ["Space", "pad:0"],
  pause: ["Escape", "KeyP", "pad:9"],     // Escape stays fixed; players can rebind only the others
};

function defaultSettings(): Settings {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    graphics: { quality: "medium", renderScale: 1, fpsCap: 0, shadows: true, effects: true, particles: 1, showFps: false },
    audio: { master: 0.8, music: 0.6, effects: 0.8, voice: 0.9, ui: 0.6, muteInBackground: true },
    controls: { bindings: structuredClone(DEFAULT_BINDINGS), sensitivity: 1, invertY: false, deadZone: 0.15, vibration: true, touchScale: 1, touchOpacity: 0.6, leftHanded: false },
    accessibility: { textScale: 1, colorMode: "default", reducedMotion: reduce, screenShake: reduce ? 0 : 1, reduceFlashing: false, subtitles: true, holdToToggle: false },
    general: { language: "" },
  };
}
```

Pick the starting quality from the device on the first run (see `options.md`), not a fixed
"high".

## Reading safely

Settings are read like a save: never trusted, never allowed to crash the game.

```ts
const SETTINGS_KEY = "star-hopper.settings";   // your game's own id
const SETTINGS_VERSION = 1;
const COLOR_MODES = ["default", "protan", "deutan", "tritan", "highContrast"] as const;
const LANGUAGES = ["en", "de", "ja"] as const;   // the game's own language files

// KeyboardEvent.code values are letters and digits ("KeyW", "ArrowUp", "Numpad5");
// controller buttons are "pad:0" to "pad:16".
const BINDING_CODE = /^(?:[A-Za-z][A-Za-z0-9]{0,23}|pad:(?:1[0-6]|[0-9]))$/;

function num(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function loadSettings(): Settings {
  const s = defaultSettings();
  let raw: any = null;
  try {
    raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
  } catch {
    return s;                                // blocked storage or broken JSON: defaults
  }
  if (!raw || typeof raw !== "object" || !Number.isInteger(raw.version) || raw.version < 0) {
    return s;
  }
  const d = migrateSettings(raw.version, raw.data) ?? {};
  const g = d.graphics ?? {};
  s.graphics.quality = oneOf(g.quality, ["low", "medium", "high", "custom"], s.graphics.quality);
  s.graphics.renderScale = num(g.renderScale, 0.5, 1, s.graphics.renderScale);
  s.graphics.fpsCap = [0, 30, 60].includes(g.fpsCap) ? g.fpsCap : s.graphics.fpsCap;
  s.graphics.shadows = bool(g.shadows, s.graphics.shadows);
  // ...each field the same way: numbers clamped, booleans checked, choices from an allowed list.
  const a = d.accessibility ?? {};
  s.accessibility.textScale = num(a.textScale, 1, 1.5, s.accessibility.textScale);
  s.accessibility.colorMode = oneOf(a.colorMode, COLOR_MODES, s.accessibility.colorMode);
  s.general.language = oneOf(d.general?.language, ["", ...LANGUAGES], "");
  s.controls.bindings = readBindings(d.controls?.bindings);
  return s;
}

function readBindings(raw: unknown): Record<string, string[]> {
  const out = structuredClone(DEFAULT_BINDINGS);
  if (!raw || typeof raw !== "object") {
    return out;
  }
  const saved = raw as Record<string, unknown>;
  for (const action of Object.keys(DEFAULT_BINDINGS)) {   // the game's actions, never the file's keys
    const list = Object.hasOwn(saved, action) ? saved[action] : undefined;
    if (!Array.isArray(list)) {
      continue;
    }
    const codes = list.filter((code): code is string => typeof code === "string" && BINDING_CODE.test(code));
    if (codes.length > 0) {
      out[action] = [...new Set(codes)].slice(0, 4);
    }
  }
  return out;                    // then apply the reserved-key rules (options.md), as rebinding does
}
```

- Every number clamped to its range, every choice from an allowed list, everything else the
  default.
- Bindings: keep only known actions and valid codes; an action left with no binding gets its
  default back, so the player can't lock themselves out.
- Read only the fields the game knows into a fresh `defaultSettings()`. Never `Object.assign`,
  spread or deep-merge the parsed object over the defaults, and never loop over its keys to
  index an object, so a `__proto__` or `constructor` key in the file does nothing.
- `migrateSettings` reshapes old versions, as for saves: steps in an array indexed by a version
  checked to be a whole number from 0 up (`Number.isInteger`), never a handler looked up by a
  string from the file on a plain object. A version newer than the build is read as far as it
  parses but never written over until the player changes something.
- Values reach CSS, the page's `lang` and `dir`, and file paths only after this check: the text
  scale as a clamped number, the color mode and language from their lists. A language code
  from storage never goes into a fetch address or a file path unchecked, so `../` can't get in.

## Saving

```ts
function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: SETTINGS_VERSION, data: s }));
  } catch {
    // Storage blocked or full: keep the settings in memory for this session.
  }
}
```

Save on every change. Slider drags save when the drag ends, not on every step.

## Applying changes

One `setSetting` function changes a value, saves, and tells whoever cares:

```ts
type Listener = (s: Settings) => void;
const listeners: Listener[] = [];
let settings = loadSettings();

export function onSettingsChanged(listener: Listener): () => void {
  listeners.push(listener);
  listener(settings);                          // apply the current values at once
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);         // safe to call twice
    }
  };
}

export function setSetting(change: (s: Settings) => void): void {
  change(settings);
  saveSettings(settings);
  for (const listener of listeners) {
    listener(settings);
  }
}

// The audio system:
onSettingsChanged((s) => audio.setVolumes(s.audio));
// The menu:
setSetting((s) => { s.audio.music = 0.4; });
```

- Each system (renderer, audio, input, UI) applies its own part from the listener. The menu
  never reaches into them directly.
- Apply at load too, before the title screen shows, so the game starts with the saved settings.
- A change to one quality setting switches the preset to "custom"; choosing a preset sets all of
  its settings.

## Reset

- "Reset this tab" puts that group back to `defaultSettings()`; "Reset all settings" does all of
  them. Both ask first.
- Reset doesn't touch the player's saves or progress.

## Per device or per player

Settings belong to the device by default: the screen, speakers and controller are the device's.
If the game keeps saves per player (for example per Harmony account, with the Harmony SDK),
keep settings device-wide
unless a setting is personal (key bindings, subtitles, sensitivity); those can live in
the player's save instead. Don't split them without a reason.
