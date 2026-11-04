---
name: harmony-performance
description: Make a web game load fast and run smoothly - measure first, shrink the download (textures, audio, models, fonts, code splitting), add a real loading screen and shader warm-up, and hold a steady frame rate on low-end laptops and phones with quality presets and a WebGL fallback for WebGPU. Use when a game loads slowly, stutters, drops frames, runs hot on phones, uses too much memory or has a big download.
license: MIT-0
compatibility: Web games in any browser engine. The automated measurements need Node 18 or newer and Playwright with Chromium. Guidance only; no scripts.
---

# Performance for web games

Players open a web game from a card and leave if it's slow to start or stutters. This skill
covers both: getting to the title screen fast, and holding a steady frame rate on modest
hardware. It is guidance: write the code into the game, in its own style.

## Ask the developer first

Read the project before asking: the engine, the renderer (WebGPU, WebGL or canvas 2D), the
bundler and the build command are all in it. Then ask in one round, with a recommendation for
each:

- **What's wrong: slow to load, stutter, or both?** Only when the request doesn't say.
  Recommended: both, loading first.
- **The slowest devices it must run well on.** Recommended: a five-year-old laptop with
  integrated graphics and a mid-range phone, as in the targets below.
- **The frame rate to hold.** Recommended: a steady 60 fps for action games, a steady 30 at
  least for anything slower.
- **A real phone to test on,** if the game runs on phones. Recommended: a mid-range phone the
  developer can play the build on. Without one, report the phone numbers as not measured.

If the developer says "you decide", use the recommendations and list them as assumptions in the
report.

## Steps

Never optimize from a guess. Every measurement here works on the game as it is, with or without
the Harmony SDK.

Each measurement has two ways to run it: an automated Playwright script that an agent or a
build script can run, and the browser's DevTools for a person at the keyboard. The reference
files show both.

1. **Measure loading:** a production build (not the dev server), served locally, with an empty
   cache, the network slowed to a 4G profile and the CPU slowed 4x. Record the bytes downloaded
   before the title screen, and the time to it. Add the timing marks and follow the steps in
   [references/loading.md](references/loading.md).
2. **Measure the frame rate:** frame times over a minute of real or automated play, with the
   frame recorder in [references/runtime.md](references/runtime.md), on the slowest machine at
   hand or with the CPU slowed 4x. Look at the slow frames, not the average. Record only in a
   page that is showing: a hidden or background tab, or a browser pane that isn't on screen,
   pauses `requestAnimationFrame`, so its frame times are missing or wrong.
3. **Find the biggest cost** with a CPU profile (the browser's performance panel, or the
   automated profile in [references/runtime.md](references/runtime.md)), and fix that first,
   following the rules below.
4. **Measure again** after each change. Keep a change only if the numbers improved; undo it
   otherwise.
5. **Repeat** from step 3 until the game meets the targets or the next fix isn't worth its cost.
6. **Test on a real phone,** if the game runs on phones.
7. **Report:** the numbers before and after each change, what you changed, the targets the game
   still misses, and what you couldn't measure (a real phone, the slowest laptop).

## Suggested targets

Rules of thumb, not Harmony limits. Harmony shows its own upload limits in My Creations; check
those separately.

| Measure | Suggested target |
| --- | --- |
| Download before the title screen | under 5 MB; load the rest while the player is on the menu |
| Time to the title screen | about 3 s on desktop broadband, about 5 s on a mid-range phone on 4G |
| Frame rate, laptop | 60 fps (16.7 ms a frame) on a five-year-old laptop with integrated graphics |
| Frame rate, phone | a steady 60 fps for action games, a steady 30 at least for anything else |
| Slow frames | under 1% of frames over 33 ms in normal play |
| Memory | runs on a phone with 4 GB of RAM without the tab reloading |

A steady 30 beats a frame rate that swings between 60 and 20.

## Rules

- **Measure production builds.** Dev servers skip minification and bundle differently.
- **Show something at once.** A styled loading screen in the HTML itself, before any script
  loads, then real progress. Never a blank page.
- **Load in stages.** Only what the title screen needs comes first; levels, music and later
  content load in the background or when first needed.
- **Don't wait on services to start.** Never block the first frame on a network call. A game
  that uses the Harmony SDK attaches it without waiting for it (the SDK docs at
  https://playharmony.ai/developers/sdk.md explain how).
- **Use the right formats.** Compressed textures or WebP for images, Opus for music, compressed
  glTF for models, subset WOFF2 for fonts. Details in
  [references/loading.md](references/loading.md).
- **Cap the device pixel ratio.** Rendering at a phone's full DPR of 3 costs about nine times
  the pixels of DPR 1; cap it around 2, lower on weak devices.
- **Offer quality presets** (Low, Medium, High), pick one automatically from the first seconds
  of play, and let the player change it.
- **Allocate nothing per frame** in hot code. Reuse vectors, arrays and objects.
- **Stop when hidden.** Pause rendering when the tab is hidden. A game that uses the Harmony SDK
  can also pause while the overlay is open (`harmony.on("open")` and `harmony.on("close")`).
- **Support WebGL when using WebGPU.** Detect WebGPU, and fall back to WebGL where it's missing
  or fails. See [references/runtime.md](references/runtime.md).
- **Test on a real phone** before calling it done, or say in the report that you couldn't.
  Desktop device mode shows the layout, not the speed.

## Reference files

| File | Read when |
| --- | --- |
| [references/loading.md](references/loading.md) | Measuring load time (automated with Playwright, or in DevTools), shrinking the download, asset formats, loading in stages, the loading screen, shader warm-up, caching |
| [references/runtime.md](references/runtime.md) | Measuring frame times (automated with Playwright, or by hand), CPU profiles, the frame budget, DPR and resolution scaling, draw calls, garbage, memory, quality presets, WebGPU and WebGL, per-engine notes |
