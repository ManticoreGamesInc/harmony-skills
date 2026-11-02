# Runtime

Holding a steady frame rate on modest laptops and phones, without running hot. The examples are
TypeScript; write them in the game's own language and style.

## Contents
- Measuring frame times
- The frame budget
- Pixels: device pixel ratio and resolution
- Draw calls
- Garbage
- Memory
- Quality presets
- Heavy work off the main thread
- High refresh rates, heat and battery
- WebGPU and WebGL
- Per-engine notes

## Measuring frame times

Averages hide stutter. Record every frame time and look at the slow end:

```ts
const frameTimes: number[] = [];
let last = performance.now();

function recordFrame(now: number): void {
  frameTimes.push(now - last);
  last = now;
}

// Call once a minute of play is recorded (a dev key or a debug menu).
function frameReport(): string {
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const slow = sorted.filter((t) => t > 33.4).length;
  return "median " + at(0.5).toFixed(1) + " ms, p95 " + at(0.95).toFixed(1) + " ms, p99 "
    + at(0.99).toFixed(1) + " ms, over 33 ms: " + (100 * slow / sorted.length).toFixed(1) + "%";
}
```

Call `recordFrame(now)` at the top of the `requestAnimationFrame` callback. Then use the
browser's performance panel on the slow frames to see whether the time goes to script, layout,
garbage collection or the GPU.

Test on the weakest hardware you expect players to have: an old laptop with integrated graphics
and a mid-range phone. A fast desktop tells you little.

**Record only in a page that is showing.** A hidden or background tab, or a browser pane built
into an agent's app while it isn't on screen, pauses `requestAnimationFrame` or slows it to about
once a second, and such a pane can still report `document.hidden` as false. Frame times recorded
there are missing or far too long.

### Automated, with Playwright

An agent can't play for a minute at a keyboard, so a Playwright test plays instead while the
page records its frame times. It needs Chromium for the CPU slowdown. With the harmony-testing
skill's setup, it uses that skill's test hooks and server, and goes beside the smoke test.

```ts
// tests/browser/frames.spec.ts
import { expect, test } from "@playwright/test";

const SECONDS = 30;

test("holds the frame budget through a round on a 4x slower CPU", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CDP throttling needs Chromium");
  test.setTimeout(SECONDS * 1000 + 60000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  await page.goto("/game/");
  await page.waitForFunction(() => (window as any).__test?.state === "title", null, { timeout: 30000 });
  await page.evaluate(() => (window as any).__test.start(42));
  await page.waitForFunction(() => (window as any).__test.state === "playing");

  // Record every frame from here on, inside the page.
  await page.evaluate(() => {
    const times: number[] = [];
    let last = performance.now();
    (window as any).__frameTimes = times;
    const tick = (now: number): void => {
      times.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // Play for a fixed stretch: hold keys, run the game's bot, or replay a recorded round.
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(SECONDS * 1000);
  await page.keyboard.up("ArrowRight");

  // The first frames include setup work, so skip them.
  const times: number[] = await page.evaluate(() => (window as any).__frameTimes.slice(10));
  expect(times.length, "too few frames: was the page hidden or paused?").toBeGreaterThan(SECONDS * 20);

  const sorted = [...times].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const slowPercent = 100 * sorted.filter((t) => t > 33.4).length / sorted.length;
  console.log("frames " + sorted.length + ", median " + at(0.5).toFixed(1) + " ms, p95 " + at(0.95).toFixed(1)
    + " ms, p99 " + at(0.99).toFixed(1) + " ms, over 33 ms: " + slowPercent.toFixed(1) + "%");
  expect(slowPercent).toBeLessThan(1);
});
```

- Without test hooks, start the round with real input (`page.keyboard.press("Enter")`) and wait
  for something on screen that only shows during play.
- Keep the game playing for the whole stretch (start another round if one ends), or the numbers
  describe the results screen.
- A browser that Playwright launches keeps its pages rendering, headless or headed. The frame
  count check catches a page that stopped anyway.
- 4x CPU slowdown stands in for a mid-range phone. It slows script, layout and painting, not the
  GPU.
- Headless Chromium often draws WebGL in software, so a 3D game's frame times there measure that
  renderer, not the game. For GPU-heavy games, run headed Chrome on a machine with a GPU
  (`use: { channel: "chrome", headless: false }`). A DOM, SVG or light 2D canvas game measures
  fine headless.
- It takes about a minute. Run it on its own while measuring (`npx playwright test frames`).

### Finding the cost without DevTools

A CPU profile from the same kind of test shows where the time goes. Run it separately from the
frame times, since profiling slows the page a little:

```ts
// Around the stretch of play, with cdp from newCDPSession as above.
await cdp.send("Profiler.enable");
await cdp.send("Profiler.start");
// ... play ...
const { profile } = await cdp.send("Profiler.stop");

// Time spent in each function itself, in ms, largest first.
const frames = new Map(profile.nodes.map((node) => [node.id, node.callFrame] as const));
const self = new Map<string, number>();
profile.samples?.forEach((id, i) => {
  const frame = frames.get(id)!;
  const name = (frame.functionName || "(anonymous)") + " " + frame.url.split("/").pop() + ":" + (frame.lineNumber + 1);
  self.set(name, (self.get(name) ?? 0) + (profile.timeDeltas?.[i] ?? 0) / 1000);
});
console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 15)
  .map(([name, ms]) => ms.toFixed(0) + " ms  " + name).join("\n"));
```

- `(garbage collector)` near the top means garbage made every frame (see Garbage below).
  `(program)` is the browser's own work: style, layout, painting and GPU commands.
- Names in a minified build are short and unreadable. Profile a build with minifying off (with
  Vite, `vite build --mode test --outDir dist-test --minify false`), and take the frame times from
  the minified one.

## The frame budget

At 60 fps a frame has 16.7 ms, and the browser needs a few of them. Aim for the game's own work
(update plus render submission) to stay under about 10 ms on the target hardware. At 30 fps,
the budget is 33 ms.

When over budget, find out which side is slow:

- **CPU-bound:** frame time stays the same when the canvas is made much smaller. Look at script
  time, draw calls and garbage.
- **GPU-bound:** frame time drops when the canvas is made smaller. Look at pixels, overdraw,
  shader cost, shadows and post effects.

## Pixels: device pixel ratio and resolution

Phones report a device pixel ratio (DPR) of 2 to 3; rendering at full DPR 3 costs nine times the
pixels of DPR 1.

- Cap it: `Math.min(window.devicePixelRatio, 2)`, and 1.5 or 1 on the Low preset.
- Render the 3D scene at a lower resolution than the UI when needed: the UI stays sharp in HTML
  or a separate canvas while the scene scales.
- Dynamic resolution: when the GPU-bound frame time stays over budget for a second or two,
  lower the render scale a step; raise it again when there's room. Change it rarely, not every
  frame.

## Draw calls

Each object drawn separately costs CPU time. Fewer, bigger draws are faster.

- **Instancing:** one draw for many copies of a mesh (trees, rocks, bullets, enemies of one
  kind).
- **Merge static geometry** that never moves (level walls, props) into a few meshes per
  material.
- **Atlases:** sprites and UI from one texture atlas batch together in 2D engines.
- **Fewer materials:** share materials, and use vertex colors or one texture atlas instead of a
  material per color.
- **Cull:** don't draw what's off screen or too far away; use levels of detail for big scenes.

Most engines report draw calls: Three.js `renderer.info.render.calls`, Babylon.js's
instrumentation and inspector, the PlayCanvas profiler. A few hundred is fine on phones; a few
thousand isn't.

## Garbage

Garbage collection pauses show up as stutters every few seconds.

- Allocate nothing per frame in hot code: reuse vectors, matrices, arrays and event objects.
- Pool short-lived objects: bullets, particles, damage numbers, network messages.
- Avoid `map`, `filter`, spread and closures inside per-frame loops over many objects; use plain
  loops over reused arrays.
- Typed arrays (`Float32Array`) for large numeric data such as particle positions.
- Check with the performance panel's memory track: a sawtooth that drops every few seconds means
  garbage is being made each frame.

## Memory

- Free GPU resources when they're no longer needed (between levels): Three.js `.dispose()` on
  geometries, materials and textures; the equivalent in other engines.
- Compressed textures (KTX2) use a fraction of the GPU memory of PNG or WebP, which are unpacked
  to full size.
- Phones reload a tab that uses too much memory. Test a full session, including several level
  changes, on a phone with about 4 GB of RAM.

## Quality presets

Give the game Low, Medium and High, each a bundle of settings:

| Setting | Low | Medium | High |
| --- | --- | --- | --- |
| DPR cap | 1 | 1.5 | 2 |
| Shadows | off | one light, small map | soft, larger map |
| Post effects (bloom, ambient occlusion) | off | cheap ones | all |
| Particles | a third | two thirds | all |
| Draw distance and level of detail | short | medium | long |

- Start new players on Medium (Low on phones), measure the first few seconds of real play, then
  step down if the 95th percentile frame time is well over budget, or up if it's well under.
  Step at most once or twice, then stop, so the setting doesn't flip back and forth.
- Save the choice, and show it in settings so the player can change it.

## Heavy work off the main thread

- Run the game's update at a fixed step (for example 60 updates a second) with an accumulator,
  separate from the render rate, so physics behaves the same at any frame rate.
- Move heavy, occasional work into a Web Worker: path finding over large maps, procedural
  generation, level loading and parsing.
- Spread big jobs over several frames instead of doing them in one.

## High refresh rates, heat and battery

- `requestAnimationFrame` runs at the display's rate: 120 Hz or more on many phones and gaming
  laptops. Use delta time everywhere, and consider capping the render rate at 60 on phones to
  save heat and battery.
- Phones slow down as they heat up. Test for at least ten minutes of play, not one.
- Stop rendering when the tab is hidden, and when the game is paused behind a menu, drawing
  nothing until it resumes. A game that uses the Harmony SDK can pause the same way while the
  overlay is open (`harmony.on("open")` and `harmony.on("close")`).

## WebGPU and WebGL

WebGPU isn't available everywhere. Detect it and fall back to WebGL:

```ts
async function hasWebGpu(): Promise<boolean> {
  if (!("gpu" in navigator)) {
    return false;
  }
  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}
```

- **Three.js:** `WebGPURenderer` (from `three/webgpu`) falls back to WebGL 2 by itself when
  WebGPU is missing. Test both paths.
- **Babylon.js:** check `await WebGPUEngine.IsSupportedAsync`; create a `WebGPUEngine` (and
  `await engine.initAsync()`) when it is, an `Engine` otherwise.
- **Your own renderer:** keep a WebGL 2 path, or show a clear message when neither works.
- **Lost devices:** handle WebGPU's `device.lost` and WebGL's `webglcontextlost` (call
  `preventDefault()`, then rebuild on `webglcontextrestored`), or the game goes black after a
  driver reset or a long time in the background.

## Per-engine notes

- **Three.js:** `renderer.info` for draw calls and memory; `InstancedMesh`; merge static
  geometry; `.dispose()` between levels; `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- **Babylon.js:** the inspector and instrumentation for frame costs; instances or thin
  instances; `scene.freezeActiveMeshes()` for static scenes; `SceneOptimizer` for automatic
  quality steps.
- **PlayCanvas:** the profiler; batch groups for static meshes; texture compression settings in
  the editor.
- **Phaser:** texture atlases; avoid redrawing `Graphics` objects every frame (draw once to a
  texture); limit active physics bodies; `pixelArt: true` for crisp scaling of pixel art.
- **PixiJS:** spritesheets; `ParticleContainer` for many simple sprites; cache static containers
  as textures (`cacheAsTexture` in v8).
- **Plain canvas 2D:** draw static layers once to an offscreen canvas and copy it each frame;
  avoid `shadowBlur` and `filter` per frame; group draws by fill style; round positions to
  whole pixels for sprites.
