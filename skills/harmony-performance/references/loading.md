# Loading

From the click on the game's card to a title screen the player can use. The examples are
TypeScript; write them in the game's own language and style.

## Contents
- Measuring
- What the download is made of
- Code
- Images and textures
- Models
- Audio
- Fonts
- Loading in stages
- The loading screen
- Warming up shaders
- Caching

## Measuring

Mark the moments that matter:

```html
<!-- First thing in <head>, before any other script. -->
<script>performance.mark("page-start");</script>
```

```ts
// When the title screen can take input:
performance.mark("title-ready");
```

Measure a production build served locally (not the dev server), with an empty cache, a 4G
network and the CPU slowed 4x, and read two numbers: the time to `title-ready` and the bytes
downloaded before it. Then check on a real phone.

### Automated, with Playwright

For an agent, or a check that runs with the other tests. It needs Chromium, since it throttles
through the Chrome DevTools Protocol (CDP). Each Playwright test gets a new browser context, so
the cache starts empty. Serve the build on a port of its own; with the harmony-testing skill's
setup, the server and `playwright.config.ts` are already there, and the spec goes beside the
smoke test.

```ts
// tests/browser/load.spec.ts
import { expect, test } from "@playwright/test";

// Chrome DevTools' "Fast 4G" preset: latency in ms, throughput in bytes a second.
// Its "Slow 4G" is { latency: 562.5, downloadThroughput: 180000, uploadThroughput: 84375 }.
const FAST_4G = { offline: false, latency: 165, downloadThroughput: 1012500, uploadThroughput: 168750 };

test("reaches the title screen on 4G with a 4x slower CPU", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CDP throttling needs Chromium");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", FAST_4G);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  await page.goto("/game/");
  await page.waitForFunction(() => performance.getEntriesByName("title-ready").length > 0, null, { timeout: 60000 });

  const result = await page.evaluate(() => {
    const title = performance.getEntriesByName("title-ready")[0].startTime;
    const files = [
      ...performance.getEntriesByType("navigation"),
      ...performance.getEntriesByType("resource"),
    ] as PerformanceResourceTiming[];
    const before = files.filter((entry) => entry.responseEnd <= title);
    const bytes = before.reduce((sum, entry) => sum + entry.transferSize, 0);
    return { ms: title, bytes: bytes, files: before.length };
  });

  console.log("to title: " + Math.round(result.ms) + " ms, " + (result.bytes / 1048576).toFixed(2)
    + " MB in " + result.files + " files");
  expect(result.bytes).toBeLessThan(5 * 1048576);
  expect(result.ms).toBeLessThan(5000);
});
```

- The mark's `startTime` counts from the start of navigation, so the time includes the HTML
  download, as the player sees it.
- `transferSize` is 0 for files from the cache, and for files from other sites that don't send
  `Timing-Allow-Origin` (a font or library CDN). Their bytes are missing from the total, so
  list them separately or serve them with the build.
- The browser keeps 250 resource entries by default. A game that fetches more before the title
  calls `performance.setResourceTimingBufferSize(1000)` in the first `<head>` script.
- Without the mark, wait on the game's own state instead (a test hook that reports "title").
- Run it three times and take the middle result; one run can be off.
- On "Slow 4G" every megabyte adds about 6 s. Use it to check that the loading screen shows
  progress and that nothing times out.

### By hand, in DevTools

Open a private window (an empty cache) and DevTools. Set the Network panel's throttling to
Fast 4G and the Performance panel's CPU setting to 4x slowdown, then load the game. Log the
numbers when the title is ready:

```ts
const toTitle = performance.measure("to-title", "page-start", "title-ready");

// Bytes fetched so far. transferSize is 0 for files from the cache, and for files from other
// sites that don't send Timing-Allow-Origin.
const bytes = performance.getEntriesByType("resource")
  .reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).transferSize, 0);
console.info("to title: " + Math.round(toTitle.duration) + " ms, " + (bytes / 1048576).toFixed(1) + " MB");
```

## What the download is made of

List the build by size before changing anything:

- Sort the build folder's files by size; the top ten usually hold most of the bytes.
- For the code, use a bundle visualizer (for Vite, `rollup-plugin-visualizer`; for webpack,
  `webpack-bundle-analyzer`) to see which libraries are large.
- Note what the title screen actually needs. Everything else can come later.

## Code

- Build for production: minified, tree-shaken, no source maps in the upload unless wanted.
- Split by when it's needed: load levels, editors and rarely used screens with dynamic
  `import()`, so the first chunk holds only the boot, the menus and the first level.
- Watch for big dependencies pulled in for one function (a date library, a full lodash, a
  physics engine in a game that only needs boxes).
- Keep game data (levels, dialogue) in JSON files fetched when needed, not baked into the first
  chunk.

## Images and textures

- **2D sprites and UI:** pack them into atlases, and use WebP (lossy for art, lossless for
  pixel art and UI with sharp edges). PNG only when WebP isn't an option.
- **3D textures:** use KTX2 with Basis Universal compression. They stay compressed on the GPU,
  which saves both download and GPU memory, where a PNG or WebP is unpacked to full size.
  Three.js loads them with `KTX2Loader`; Babylon.js and PlayCanvas support KTX2 too.
- **Sizes:** no texture bigger than it ever appears on screen. 2048 is plenty for most; 4096
  only for hero assets. Power-of-two sizes for anything that mipmaps or repeats.
- Strip unused channels: a grayscale mask doesn't need RGBA.

## Models

- Ship glTF binary (`.glb`), not FBX or OBJ.
- Compress geometry with Meshopt or Draco, and textures inside the file, for example with the
  `gltf-transform` command line: `gltf-transform optimize in.glb out.glb --compress meshopt
  --texture-compress webp` (or `ktx2`). Meshopt decodes faster; Draco often packs smaller.
  Both need the matching decoder registered on the loader.
- Remove what the game doesn't use: unused animations, morph targets, hidden meshes, extra UV
  sets, and materials that only differ by name.
- Reuse one model for many objects with instancing rather than duplicating it.

## Audio

- **Music and long ambience:** Opus at about 96 kbit/s stereo is a good default
  (`ffmpeg -i music.wav -c:a libopus -b:a 96k music.ogg`). Stream music with an `<audio>`
  element (or a media element source in Web Audio) instead of decoding the whole track.
- **Sound effects:** Opus or Vorbis, mono unless the sound needs stereo, 48 to 64 kbit/s.
  Decode the ones the title screen and first level need; decode the rest later.
- **Older Safari** may not play Opus. If older iPhones matter, keep an AAC (`.m4a`) copy and
  pick with `new Audio().canPlayType('audio/ogg; codecs="opus"')`.
- Trim silence from the start and end of every sound.
- Never ship WAV.

## Fonts

- WOFF2 only, subset to the characters the game uses (for example with `pyftsubset` from
  fonttools, `--flavor=woff2`). A full font with every script can be several megabytes.
- `font-display: swap` for menus, and preload the one font the title screen uses.
- For canvas text, wait for `document.fonts.load(...)` before the first draw, or the first
  frames draw in a fallback font.

## Loading in stages

1. **Boot:** the HTML loading screen, the game's first chunk and the title screen's assets.
2. **Title screen:** the player can act. In the background, load the first level and the menu
   music.
3. **Play:** each later level or area loads during the one before, or behind a short loading
   screen of its own.

Keep a list (a manifest) of what each stage needs, so the loader knows the total bytes and can
show real progress.

## The loading screen

- Put it in `index.html` itself, styled with inline CSS, so it shows before any script loads.
  Use the game's colors and title, not a white page with a spinner.
- Show real progress: bytes loaded over bytes in the stage's manifest. A bar that sits at 99%
  is worse than none.
- Remove it the moment the title screen can take input, and not before its assets are ready.
- If a file fails to load, say so and offer Retry, rather than hanging on the bar.

## Warming up shaders

The first frame that shows a new material can hitch while the browser compiles its shaders.
Compile them during the loading screen instead:

- Three.js: `await renderer.compileAsync(scene, camera)` with every material of the first level
  in the scene.
- Babylon.js: `await scene.whenReadyAsync()` before hiding the loading screen.
- WebGPU directly: create pipelines with `device.createRenderPipelineAsync` at load, not on
  first use.
- Effects that only appear later (explosions, a boss's material): render them once off screen,
  or with zero opacity, during loading.

## Caching

- Name built files by their content hash (Vite and webpack do by default), so a returning
  player's browser reuses unchanged files and fetches only what changed.
- Don't register a service worker for caching: hosted games on Harmony can't use one.
