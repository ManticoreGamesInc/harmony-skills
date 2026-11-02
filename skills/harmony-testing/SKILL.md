---
name: harmony-testing
description: Add automated tests to a web game - seeded randomness, unit tests for rules, saves and settings, test hooks, a Playwright smoke test of the production build served from a subfolder with no console errors, two-player and phone-size runs, and screenshot comparisons. Use when a game needs tests, a smoke test, browser or end-to-end tests, Playwright, reproducible bugs, or a check that a build works before upload.
license: MIT
compatibility: Web games in any browser engine. Browser tests need Node 18 or newer and Playwright; unit tests use the game's test runner (Vitest, Jest or node:test). Guidance only; no scripts.
---

# Tests for web games

Games break in ways players see at once: a black screen after an update, a menu that won't
open, a save that won't load. A few automated tests catch most of it before the game is
uploaded. This skill is guidance: write the tests into the game's own project, with its own
test runner.

## Ask the developer first

Read the project before asking: its test runner, its build command, whether it has online play,
touch controls or a WebGPU renderer, and where it calls `Math.random()`. Then ask in one round,
with a recommendation for each:

- **May gameplay randomness move to one seeded generator?** It touches every `Math.random()`
  call in game code. Recommended: yes.
- **Which browser tests besides the smoke test?** Recommended: phone size if the game has touch
  controls, two players if it has online play, and screenshots of the title and results
  screens.
- **The test runner,** only if the project has none. Recommended: Vitest for a Vite project,
  `node:test` otherwise.

If the developer says "you decide", use the recommendations and list them as assumptions in the
report.

## What to build, in order

1. **Seeded randomness** ([references/unit.md](references/unit.md)): every random number from one
   seeded generator, so any run can be replayed exactly.
2. **Unit tests** for the rules: scoring, damage, win and loss, level generation, reward math,
   save and settings parsing. Fast, no browser. In a game that uses the Harmony SDK, add tests of
   its Harmony code against the SDK's fake ([references/unit.md](references/unit.md)).
3. **Test hooks** ([references/browser.md](references/browser.md)): a small, test-only object on
   `window` that tells the tests what state the game is in and lets them start a round, skip a
   level or set a seed.
4. **A browser smoke test** ([references/browser.md](references/browser.md)): the production
   build with the test hooks in, served from a subfolder, opened in a real browser. It loads,
   reaches the title, plays a round to the results screen, and the console stays clean.
5. **The other browser tests** the developer chose: two players (with a local signaling
   server), phone size, slow network, screenshots of key screens.
6. **Run everything** with one command (the `check` script in browser.md), and fix what fails.
7. **Report:** the tests added, the command that runs them, the result, the seed of any failure,
   and what isn't covered (for example the WebGPU path, when no machine with a GPU ran it).

## Rules

- **Test a production build** for the smoke test, served from a subfolder (`/game/`) the way
  Harmony serves it, not the dev server at the root. It is minified like the upload but keeps the
  test hooks, and goes to a folder of its own (with Vite,
  `vite build --mode test --outDir dist-test`). Build the upload itself separately, without the
  hooks.
- **No Harmony needed.** Harmony adds its overlay to every uploaded game with no code, so many
  games never install the Harmony SDK or get a Game ID. Every test here works for those games
  as they are. A game that does use the SDK tests it against the SDK's fake, never a mock or
  stub written by hand:
  - The dev server and other development builds attach to the fake on their own (bot friends
    and chat, no sign-in; the overlay shows `fake`). A page that loads the SDK with a script tag
    loads `fake-loader.js` while developing instead. Play the Harmony features there.
  - Tests of the game's Harmony code run in jsdom with `loadFakeGameServices` from
    `@playharmony/sdk/testing`, with a raised hook timeout (unit.md).
  - The smoke test runs a release build (`vite build`, whatever its `--mode`), which attaches to
    the real Harmony. Harmony isn't there locally, so the game must start and play on without
    it, and the smoke test proves it.
- **Keep the runners apart.** The unit test runner skips `tests/browser`, and Playwright runs
  only that folder, on a port of its own (see Setup in browser.md).
- **Fail on console errors** and uncaught exceptions, not only on failed assertions.
- **Wait for state, never for time.** Wait until the test hook says "title" or "playing";
  never `sleep(3000)`.
- **Seeds in every report.** A failing randomized test prints its seed so the failure can be
  replayed.
- **Hooks stay out of the shipped build**, or are inert in it: build them only in test and
  development builds.
- **Fast enough to run every time:** unit tests in seconds, the smoke test in under a minute.
  Tests against the Harmony fake download it first, which can take up to 30 seconds and needs a
  network connection.
  Run both before every build that's uploaded.

## Reference files

| File | Read when |
| --- | --- |
| [references/unit.md](references/unit.md) | Seeded randomness, testing rules, fixed-step simulation and replays, saves and settings, fuzzing inputs, Harmony SDK code against the fake |
| [references/browser.md](references/browser.md) | Playwright setup and keeping Vitest off the browser specs, serving from a subfolder on a port of its own, test hooks, the smoke test, console errors, GPU in test browsers, two players with a local signaling server, phone size, slow networks, screenshots |
