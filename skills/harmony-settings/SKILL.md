---
name: harmony-settings
description: Add a settings menu to a web game - graphics quality, volumes, key and controller remapping, sensitivity and touch controls, accessibility (text size, color-blind modes, reduced motion, subtitles) and language, stored on the device, applied at once, and usable with keyboard, controller and touch. Use when a game needs a settings or options menu, volume sliders, graphics options, rebinding or accessibility options, or its settings don't save or apply.
license: MIT-0
compatibility: Web games in any browser engine. Guidance only; no scripts.
---

# Settings for web games

Every game needs a settings menu players can find, understand and trust. This skill covers what
goes in it, how settings are stored and applied, and how the screen behaves. It is guidance:
write the code into the game, in its own UI technology and style.

## Steps

1. **Read the game** for what decides the tabs: the inputs it reads, its sound categories, its
   costly graphics effects, its languages, whether it keeps saves, and its design brief
   (`docs/design.md`) if it has one.
2. **Ask the developer** in one round, only what the code didn't answer, with a recommendation
   for each:
   - **Assists:** which ones the design allows (game speed, aim assist, extra time, skipping a
     puzzle). Recommended: none when the developer has no preference; the rest of
     Accessibility still ships.
   - **Settings per device or per player?** Recommended: per device (`store.md` explains when a
     setting belongs to the player).

   If the developer says "you decide", take the recommendations and say so.
3. **The store** ([references/store.md](references/store.md)): the settings object, defaults,
   safe loading and saving, one function that applies changes.
4. **The options** ([references/options.md](references/options.md)): each setting the game has,
   applied by its own system.
5. **The screen** ([references/screen.md](references/screen.md)), reachable from the title
   screen and the pause menu.
6. **Check and hand over** (below).

## What goes in it

Group settings into a few tabs. Include what the game has; leave out what it doesn't (no
Controls tab for a game played with one button).

| Tab | Settings |
| --- | --- |
| Graphics | quality preset (Low, Medium, High, plus Custom once changed), resolution scale, frame-rate cap, shadows, effects, particles, fullscreen, show frame rate |
| Audio | master, music, sound effects, voice and interface volumes; mute when the game is in the background |
| Controls | key and controller remapping, mouse and stick sensitivity, invert vertical axis, stick dead zone, vibration, touch control size and opacity, left-handed touch layout |
| Accessibility | text size, color-blind mode, reduced motion, screen shake, flashing effects, subtitles and captions, hold or toggle for held actions, game speed or assists where the design allows |
| General | language, save Export and Import, reset all settings |

Details, defaults and how to apply each: [references/options.md](references/options.md).

## Rules

- **Apply at once.** Every change takes effect while the menu is open (volume plays a sample,
  quality redraws the scene behind the menu), and is saved at once. No separate Apply button,
  except for a change that needs confirming (a resolution that might not work: revert after 10
  seconds unless confirmed).
- **Start from good defaults.** Volumes about 80% master, music a little below effects; quality picked
  from the device; reduced motion on when the system asks for it
  (`prefers-reduced-motion`); subtitles on.
- **Saved safely.** Settings live in `localStorage`, versioned and checked on load like a save:
  a broken or old settings file never breaks the game; unknown values fall back to defaults.
  See [references/store.md](references/store.md).
- **Checked before use, shown as text.** Read only the fields the game knows into fresh
  defaults; never `Object.assign`, spread or merge stored or imported settings, so a `__proto__`
  key does nothing. A stored value reaches CSS, the page's `lang` and `dir`, or a file path only
  as a clamped number or a value from the game's own list (a language code is one of the
  game's languages, never `../` or a URL). Key names, labels and anything read from storage go
  on screen with `textContent` or the engine's plain text object, never HTML.
- **Reset to defaults**, per tab and for everything, with a confirmation.
- **Reachable from the title screen and the pause menu.** In online play, opening settings
  doesn't pause the shared game.
- **Works with every input the game supports**: mouse, keyboard, controller and touch. Esc and
  the controller's back button close it, and focus returns where it was. See
  [references/screen.md](references/screen.md).
- **Explain what's not obvious.** One line under the focused setting saying what it does
  ("Lower values run faster on older devices").
- **Labels from the language files** when the game is translated; never hard-coded.
- **Don't take the Harmony overlay's key.** Shift+Tab opens the Harmony overlay in every game
  Harmony hosts. Don't let players bind it to a game action. Only a game that uses the Harmony
  SDK can change the overlay's key, with the `hotkey` option of `attach` (see
  Harmony's SDK docs, https://playharmony.ai/developers/sdk.md, or the `harmony-sdk` skill);
  without the SDK, the game leaves Shift+Tab free.

## Check and hand over

- Change each setting and see it apply with the menu open; reload the page and see it kept.
- Put broken JSON, then wrong-typed values, a `__proto__` key and a language of `../x`, in the
  settings key in `localStorage` and reload: the game starts, with defaults for anything invalid.
- Rebind a key, then try to bind Esc and Shift+Tab: both are refused.
- Use the screen with every input the game supports; Esc closes it and focus returns.
- Tell the developer which tabs and settings were built, which were left out and why, and the
  defaults.

## Reference files

| File | Read when |
| --- | --- |
| [references/store.md](references/store.md) | The settings object, defaults, saving and loading safely, versions, applying changes, reset |
| [references/options.md](references/options.md) | Each setting in detail: graphics, audio (the volume bus and curve), controls (remapping, sensitivity, touch), accessibility, general |
| [references/screen.md](references/screen.md) | The settings screen: layout, controls for each kind of setting, keyboard, controller and touch, phones, previews, confirmations |
