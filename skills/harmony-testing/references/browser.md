# Browser tests

The game in a real browser, driven by Playwright. The examples are TypeScript; adapt the build
and serve commands to the project.

## Contents
- Setup
- Serving from a subfolder
- Test hooks
- The smoke test
- Console errors and missing files
- Playing with real input
- GPU in test browsers
- Two players
- Phone size and slow networks
- Screenshots
- Running before an upload

## Setup

```
npm install --save-dev @playwright/test
npx playwright install chromium
```

Add more browsers (`firefox`, `webkit`) once the Chromium tests pass; WebKit catches many Safari
problems.

Keep unit tests and browser tests apart, so each runner only runs its own files. Playwright
only looks in its `testDir` (`tests/browser` below). Vitest's default include matches every
`*.test.ts` and `*.spec.ts` in the project, so without a config `vitest run` also picks up
`tests/browser/smoke.spec.ts` and fails on it. Exclude the folder:

```ts
// vitest.config.ts
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The specs in tests/browser run under Playwright, not Vitest.
    exclude: [...configDefaults.exclude, "tests/browser/**"],
  },
});
```

- A `vitest.config.ts` replaces `vite.config.ts` for Vitest. If the unit tests need the game's
  Vite settings (plugins, `define` constants), put the `test` block in `vite.config.ts` instead,
  with `defineConfig` imported from `vitest/config`.
- Jest: `"testPathIgnorePatterns": ["/node_modules/", "/tests/browser/"]`. `node:test`: list the
  unit test files in the script (`node --test tests/*.test.mjs`).
- Add what the tests write to `.gitignore`: `dist-test/`, `test-results/`, `playwright-report/`.

## Serving from a subfolder

Harmony serves a build under a folder of its own, so the smoke test does too. A tiny static
server, `tests/serve.mjs`, serves the test build in `dist-test/` at `/game/`:

```js
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, normalize } from "node:path";

const ROOT = join(process.cwd(), "dist-test");
const PORT = 4790;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ogg": "audio/ogg", ".mp3": "audio/mpeg",
  ".wasm": "application/wasm", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".ktx2": "image/ktx2" };

createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (!url.pathname.startsWith("/game/")) {
    response.writeHead(404).end();
    return;
  }
  let requested;
  try {
    requested = decodeURIComponent(url.pathname.slice("/game/".length));
  } catch {
    response.writeHead(400).end();             // a malformed % escape
    return;
  }
  if (requested === "" || requested.endsWith("/")) {
    requested += "index.html";
  }
  const path = normalize(requested);
  if (path.startsWith("..") || isAbsolute(path)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(join(ROOT, path));
    response.writeHead(200, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream" }).end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(PORT, "127.0.0.1");
```

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

// Not 5173 or 4173 (Vite's dev and preview ports), so the developer's own servers never clash.
const PORT = 4790;

export default defineConfig({
  testDir: "tests/browser",
  use: { baseURL: "http://127.0.0.1:" + PORT },
  webServer: {
    command: "node tests/serve.mjs",
    url: "http://127.0.0.1:" + PORT + "/game/",
    // false: if another server already answers on this port, fail instead of testing it.
    reuseExistingServer: false,
  },
});
```

A file loaded by an address starting with `/` now 404s, the same as it would on Harmony. Pick
any free port that no other tool in the project uses, and keep the two files in step.

## Test hooks

A small object the tests read and drive, built only into test and development builds:

```ts
// In the game, where its state machine lives.
if (import.meta.env.MODE !== "production") {
  (window as any).__test = {
    get state(): string {
      return game.state;                 // "loading" | "title" | "playing" | "results"
    },
    start(seed: number): void {
      game.startRound(seed);
    },
    finishRound(won: boolean): void {
      game.endRound(won);                // skips play, for testing what comes after
    },
    get score(): number {
      return game.score;
    },
  };
}
```

Build the version the smoke test runs with the same minification as production but with the
hooks in, into its own folder so it never ends up in an upload (with Vite,
`vite build --mode test --outDir dist-test`).

## The smoke test

```ts
// tests/browser/smoke.spec.ts
import { expect, test } from "@playwright/test";

test("loads, plays a round and shows the results with no errors", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push("console: " + message.text());
    }
  });
  page.on("pageerror", (error) => problems.push("exception: " + error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      problems.push(response.status() + " " + response.url());
    }
  });

  await page.goto("/game/");
  await page.waitForFunction(() => (window as any).__test?.state === "title", null, { timeout: 20000 });

  await page.evaluate(() => (window as any).__test.start(42));
  await page.waitForFunction(() => (window as any).__test.state === "playing");

  await page.evaluate(() => (window as any).__test.finishRound(true));
  await page.waitForFunction(() => (window as any).__test.state === "results");

  expect(problems).toEqual([]);
});
```

- The test needs nothing from Harmony: no Harmony SDK and no Game ID. Harmony adds its overlay
  to every uploaded game, so many games never install the SDK, and this test runs them as they
  ship.
- In a game that does use the SDK, Harmony isn't present in tests, so attaching fails. The game
  must handle that quietly (a `console.warn`, not `console.error`) and play on; this test
  proves it.
- Wait on the hook's state, never on a fixed delay.

## Console errors and missing files

Collect them on every test, as above, and fail on any. Common causes: an asset loaded from `/`,
a missing file after a rename, an exception in a menu nobody opened since a change.

## Playing with real input

Some bugs only show with real input. Drive the game as a player would for at least one test:

```ts
await page.keyboard.press("Enter");                 // start from the title
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(500);                     // the only fixed wait: holding a key
await page.keyboard.up("ArrowRight");
await page.mouse.click(400, 300);
```

Check the result through the hook (the player moved, the score changed), not by reading pixels.

## GPU in test browsers

Headless browsers often have no real GPU. WebGL usually still works through a software renderer
(slowly); WebGPU often doesn't.

- Run the smoke test headless to check the WebGL fallback path.
- Run a second project with a headed Chrome (`use: { channel: "chrome", headless: false }`) on a
  machine with a GPU to check the WebGPU path.
- Frame rates from a headless test browser with a software renderer say little about players'
  devices. The harmony-performance skill has an automated frame-time check; confirm its numbers
  on real devices.

## Two players

Two browser contexts are two separate players, each with its own storage:

```ts
test("two players can join a room", async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  await host.goto("/game/");
  await guest.goto("/game/");
  const code = await host.evaluate(() => (window as any).__test.hostRoom());
  await guest.evaluate((c) => (window as any).__test.joinRoom(c), code);
  await host.waitForFunction(() => (window as any).__test.players === 2);
});
```

Use a local signaling server for these, not a public one, so the tests don't depend on someone
else's service. For a game on PeerJS:

1. Add the PeerJS server (the `peer` package, MIT) as a dev dependency:
   `npm install --save-dev peer`.
2. Start it from `tests/peer_server.mjs`, on a port of its own:

   ```js
   // The signaling server for the two-player tests.
   import { PeerServer } from "peer";

   PeerServer({ host: "127.0.0.1", port: 4791, path: "/" });
   ```

3. Have Playwright start it beside the game server. `webServer` takes a list:

   ```ts
   webServer: [
     { command: "node tests/serve.mjs", url: "http://127.0.0.1:4790/game/", reuseExistingServer: false },
     { command: "node tests/peer_server.mjs", url: "http://127.0.0.1:4791/", reuseExistingServer: false },
   ],
   ```

4. Point the test build at it, and only the test build:

   ```ts
   // Where the game creates its PeerJS peer. Other builds keep their own signaling server.
   const signalOptions = import.meta.env.MODE === "test"
     ? { host: "127.0.0.1", port: 4791, path: "/", secure: false }
     : {};
   const peer = new Peer(id, { ...signalOptions, config: { iceServers } });
   ```

   With the room module from the harmony-p2p-multiplayer skill, pass the same object as its
   `peerOptions` option. With another bundler, use a constant defined only in the test build.

- Switch the server at build time, not with a URL parameter, so nobody can point a release build
  at a server of their own. The harmony-p2p-multiplayer skill's `references/self_hosting.md`
  ("Dev overrides") explains the risk.
- That skill's `references/testing.md` covers the rest of two-player testing: separate storage
  per player, why two visible windows beat two tabs, and a fake-peer harness for faster tests.
- A game on another networking library follows the same steps with that library's own server.

## Phone size and slow networks

- Phone size: add a project with one of Playwright's device presets (for example
  `devices["Pixel 7"]`), and check the title and HUD fit (no horizontal scroll:
  `document.documentElement.scrollWidth <= innerWidth`) and touch controls appear.
- Slow loading: delay responses with `page.route("**/*", async (route) => { await new
  Promise((r) => setTimeout(r, 200)); await route.continue(); })`, and check the loading screen
  shows progress and the game still starts.

## Screenshots

Compare key screens with stored screenshots to catch layout breaks:

```ts
await expect(page).toHaveScreenshot("title.png", { maxDiffPixelRatio: 0.02, animations: "disabled" });
```

- Fix the seed and hide moving parts (or mask them with the `mask` option), or the comparison
  never settles.
- Update the stored screenshots on purpose, when a screen changes by design.

## Running before an upload

One command for everything, run before every build that's uploaded:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:smoke": "vite build --mode test --outDir dist-test && playwright test",
    "check": "npm test && npm run test:smoke"
  }
}
```

- `npm test` runs only the unit tests, since Vitest skips `tests/browser` (see Setup).
- `test:smoke` builds the test build into `dist-test/`; Playwright starts its servers itself and
  stops them when it's done.

Then build the real production build for the upload, into `dist/`.
