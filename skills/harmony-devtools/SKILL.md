---
name: harmony-devtools
description: Add developer-only tools to a web game, left out of the published build - a live tuning panel saved back to the config file, testing cheats with a release check, debug overlays, pause, frame step and slow motion, and performance metrics (frame times, GPU time, draw calls, memory). Use when the developer wants a dev panel, debug menu, tweakable values, cheats or god mode for testing, an FPS counter, or faster tuning and debugging.
license: MIT
compatibility: Web games in any browser engine; the config file write-back uses the game's dev server (examples for Vite). Guidance only; no scripts.
---

# Developer tools inside the game

Tuning and debugging a game is fastest while it runs: change a number, see the result, keep it.
This skill adds those tools to the game itself. They are for the game's developer, to test and
tune it while building it. Players never get them: everything here is removed from the game
before it is published. It is guidance: build the tools into the game's own project, with a small
panel library or the game's own UI.

Because the tools never reach a player, they can do anything that helps testing, including
cheats in online matches. The one hard rule is that the published game contains none of them.

## Ask the developer first

Read the project before asking: the bundler, the engine, the config file the game reads its
numbers from (if any), a panel library it already uses, and the keys the game already binds.
Then ask in one round, with a recommendation for each:

- **Which tools?** Recommended: all five below, in order.
- **Which cheats and setups?** Draft a list from the game's own systems (lives, currency,
  levels, spawns, rare events) and ask the developer to add or cut. Recommended: the draft.
- **The panel library,** only if the project has none. Recommended: lil-gui (MIT); Tweakpane
  (MIT) if the developer wants graphs of values over time.

If the developer says "you decide", use the recommendations and list them as assumptions in the
report.

## What to build, in order

1. **The dev switch** ([references/tuning.md](references/tuning.md)): one flag that turns every
   tool on in development and off in the shipped build.
2. **A performance overlay** ([references/metrics.md](references/metrics.md)): frame time graph,
   slow frames, CPU and GPU time, draw calls, triangles, textures and memory.
3. **The tuning panel** ([references/tuning.md](references/tuning.md)): sliders and toggles for the
   game's numbers, buttons for cheats and shortcuts, saved back to a config file.
4. **Cheats** ([references/cheats.md](references/cheats.md)): god mode, resources, skipping to any
   level, spawning, named setups that start a test where it needs to be, all from one registry,
   with a release check that proves none of it ships.
5. **Debug overlays and time controls** ([references/debug.md](references/debug.md)): what the
   game sees (colliders, paths, state), pause, step, slow motion, and jumps to any level or seed.
6. **Prove the shipped build is clean:** make a production build and search its files for the
   cheats' marker string (`__DEV_CHEATS__`) and the panel's title text. Neither may appear.
7. **Report:** the key that opens the tools, each cheat with its key or URL parameter, the named
   setups, and the result of the build check.

## Rules

- **Removed before publishing.** Every tool sits behind the dev switch (`import.meta.env.DEV` with
  Vite, or the bundler's equivalent), so the production build leaves all of it out: the
  developer keeps the tools in the project and never has to delete them by hand. Before every
  upload, check the production build for the cheats' marker string (step 6); harmony-publish's
  build check fails on it too. A hidden key left in a published game is a cheat menu for players.
- **Online cheats run where the match state lives.** While testing, the developer can use cheats
  in online play, so multiplayer can be tested quickly. A cheat that changes the match (skip a round, set a score,
  pick the next word) runs on the host or server that owns that state, or on the player who
  owns a secret such as a word they set, and reaches the other players as a normal update. Run
  on a guest's copy, it desyncs the match. Debug overlays and metrics work on any player. Details in [references/cheats.md](references/cheats.md#cheats-and-online-play).
- **One key opens everything** (F1 or the backquote key), and it never clashes with a game key or
  Shift+Tab, which opens the Harmony overlay.
- **Tuning changes the game's config, not copies of it.** The panel edits the same values the game
  reads, and saving writes them back to the file they come from, so a tuned number is never lost.
- **Measure, don't guess.** Read performance numbers on the target device. Dev builds and dev
  tools cost time themselves, so confirm a slowdown in a production-like build before
  optimizing it.
- **Out of the way.** Panels are compact, collapsible, readable over any scene, and remember
  whether they were open.
- **Outside text is text, outside input is data.** Overlays, labels, the state inspector and the
  log show other players' names, messages and other strings from outside with `textContent`,
  `fillText` or a panel library that sets text, never HTML. URL parameters and the console run
  cheats only through the registry (`runCheat` with an id from its list); nothing evaluates a
  string or looks a name up on `window` or another plain object. Peer messages never trigger a
  cheat. The tuning writer accepts only its own page on a local host, in the file's shape, and
  writes only that one fixed file.
- **Separate from the game's UI style** on purpose: dev tools look like tools, so nobody mistakes
  them for game screens in screenshots or videos. Hide them with one key for captures.

## Reference files

| File | Read when |
| --- | --- |
| [references/tuning.md](references/tuning.md) | The dev switch, the tuning panel, cheat buttons, saving values back to the config file |
| [references/cheats.md](references/cheats.md) | Cheats for testing: the registry, keys, console and URL triggers, named setups, the release check, saves, online play, tests |
| [references/debug.md](references/debug.md) | Debug overlays, time controls, jumping to a level or seed, a state inspector |
| [references/metrics.md](references/metrics.md) | Frame time graph, slow frames, CPU and GPU timing, draw calls, triangles, textures, memory, per-engine stats |
