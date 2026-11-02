# Performance metrics

An overlay with the numbers that explain a slow frame: frame times, CPU and GPU time, draw calls,
triangles, textures and memory. All of it lives behind the dev switch from `tuning.md`. The
examples are TypeScript.

## Contents
- What to show
- Frame times and the graph
- CPU time
- GPU time
- Draw calls, triangles and textures
- Memory
- The device
- Ready-made panels
- Reading the numbers

## What to show

A compact corner overlay, collapsed to one line by default:

```
16.4 ms  p95 19.2  slow 0.4%  |  CPU 6.1  GPU 9.8  |  calls 142  tris 210k  tex 38  |  heap 84 MB
```

Expanded: a frame time graph, and the same numbers with their history.

## Frame times and the graph

```ts
const SAMPLES = 240;
const frames = new Float32Array(SAMPLES);
let index = 0;
let last = performance.now();

export function recordFrame(now: number): void {
  frames[index] = now - last;
  index = (index + 1) % SAMPLES;
  last = now;
}

export function drawGraph(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const scale = height / 50;                               // 50 ms at the top
  ctx.clearRect(0, 0, width, height);
  for (const [ms, color] of [[16.7, "#4fc3ff"], [33.3, "#ff7a2f"]] as const) {
    ctx.fillStyle = color;
    ctx.fillRect(0, height - ms * scale, width, 1);        // the 60 and 30 fps lines
  }
  for (let i = 0; i < SAMPLES; i++) {
    const ms = frames[(index + i) % SAMPLES];
    ctx.fillStyle = ms > 33.3 ? "#ff7a2f" : ms > 16.8 ? "#ffcc33" : "#8fe388";
    ctx.fillRect((i / SAMPLES) * width, height - ms * scale, width / SAMPLES, ms * scale);
  }
}
```

- Show the median, the 95th percentile, and the share of frames over 33 ms; averages hide
  stutter.
- Draw the graph on its own small canvas, redrawn a few times a second, not every frame.
- Phones and 120 Hz screens: show the display's own frame budget (8.3 ms at 120 Hz).

## CPU time

Time the game's own work each frame:

```ts
const start = performance.now();
update(dt);
const afterUpdate = performance.now();
render();
const end = performance.now();
// update: afterUpdate - start; render submission: end - afterUpdate
```

- Break it down further around expensive systems (physics, AI, particles) to find the culprit.
- This is time on the main thread; rendering also costs GPU time, measured separately.
- `performance.mark` and `performance.measure` make the same sections show up in the browser's
  performance panel.

## GPU time

GPU timing is optional in browsers and often unavailable or coarse; show it when it's there, and
fall back to "n/a".

- **WebGL 2:** the `EXT_disjoint_timer_query_webgl2` extension. Begin a `TIME_ELAPSED_EXT` query
  around the frame's draws, read the result a few frames later, and discard results when
  `GPU_DISJOINT_EXT` is set. Many browsers and devices don't expose it.
- **WebGPU:** the `timestamp-query` feature, requested when creating the device, with timestamp
  writes on render and compute passes. Browsers may round the values. Three.js's
  `WebGPURenderer` can track timestamps for you; check its docs for your version.
- **Babylon.js:** `EngineInstrumentation` with `captureGPUFrameTime = true` reads it where
  supported.
- When GPU time is unavailable, test by halving the render size: if the frame time drops, the
  GPU is the limit.

## Draw calls, triangles and textures

- **Three.js:** `renderer.info.render.calls` and `.triangles` (set `renderer.info.autoReset =
  false` and call `renderer.info.reset()` once per frame if the game renders more than one pass),
  and `renderer.info.memory.geometries` and `.textures`.
- **Babylon.js:** `SceneInstrumentation` (draw calls, frame, render and evaluation time), and the
  Inspector's statistics panel.
- **PlayCanvas:** the profiler (mini-stats), with draw calls, frame time and memory.
- **Own renderer:** count draws and triangles as they're submitted, and textures as they're
  created and destroyed.

Rising texture or geometry counts between levels mean something isn't being freed.

## Memory

- **JS heap:** `performance.memory.usedJSHeapSize` in Chromium browsers only (non-standard).
  Watch it over a few minutes: a sawtooth is normal garbage collection; a line that keeps rising
  is a leak.
- **GPU memory:** browsers don't report it. Estimate it from what the game created: each texture's
  width x height x 4 bytes (x 1.33 with mipmaps), less for compressed textures, plus buffers.
- `performance.measureUserAgentSpecificMemory()` needs cross-origin isolation, which a game
  hosted on Harmony can't count on; use it only in local testing, if at all.

## The device

Show what the game is running on, so numbers from different machines can be compared:

- WebGPU: `adapter.info` (vendor, architecture), where the browser exposes it.
- WebGL: the renderer string from `WEBGL_debug_renderer_info`, where it isn't masked.
- The canvas size, device pixel ratio, render scale and quality preset in use.

## Ready-made panels

- **stats.js** (MIT): the classic FPS and frame time panel.
- **stats-gl** (MIT): frame time with GPU time where the browser supports it, for WebGL and
  WebGPU.
- **lil-gui** or **Tweakpane** (both MIT): Tweakpane has graph monitors for showing values over
  time.

Load them behind the dev switch like the rest.

## Reading the numbers

- Read them on the target hardware: a fast desktop says little about a phone.
- Dev builds are slower than production builds; confirm a problem in a production-like build
  before optimizing.
- The tools cost time too: the graph and the stats should take well under a millisecond a frame.
  Turn the overlay off when measuring the last few percent.
