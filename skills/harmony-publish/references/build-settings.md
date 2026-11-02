# Build settings

Harmony serves a game's build under a folder of its own, so every file must load by a relative
address (`./assets/main.js`, `assets/main.js`), never one starting with `/`. Hosted games also
can't register service workers, so turn off any PWA output.

## Contents
- Vite
- webpack
- Parcel
- esbuild and Rollup
- Create React App and similar
- Engines built on a bundler
- Unity
- Godot
- Paths in the game's own code

## Vite

```js
// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
});
```

Remove `vite-plugin-pwa`, or leave it out of the Harmony build. Files in `public/` are copied
as they are, so reference them relatively too (`"./sounds/hit.ogg"`, not `"/sounds/hit.ogg"`).

## webpack

```js
// webpack.config.js
module.exports = {
  output: { publicPath: "" },   // or "./"; "auto" also works for most setups
};
```

Remove `workbox-webpack-plugin` and any `WebpackPwaManifest` from the Harmony build.

## Parcel

```
parcel build src/index.html --public-url ./
```

## esbuild and Rollup

They emit relative imports between chunks already. Check the `index.html` you write by hand:
`<script src="./main.js">`, not `<script src="/main.js">`.

## Create React App and similar

Set `"homepage": "."` in `package.json`. Unregister the service worker the template adds (keep
`serviceWorker.unregister()`, or delete the registration).

## Engines built on a bundler

Phaser, three.js, Babylon and PixiJS projects use one of the bundlers above, so set that. Then
check the game's own loader calls (`this.load.image("hero", "/img/hero.png")`,
`new GLTFLoader().load("/models/ship.glb")`) for leading `/`, and make them relative.

PlayCanvas: download the project as a web build ("Download" in the editor). Its paths are
relative already.

## Unity

- WebGL template: **Default** or **Minimal**, not **PWA** (Player Settings > Resolution and
  Presentation > WebGL Template).
- Build into an empty folder; zip what's inside it (`index.html`, `Build/`, `TemplateData/`).
- Leave WebGL multithreading off: a hosted game can't count on cross-origin isolation, which
  threads need, so ship a single-threaded build.
- Compressed builds (Brotli or Gzip) need the server to send the right `Content-Encoding`, or the
  loader to decompress them itself (**Decompression Fallback**, in Player Settings > Publishing
  Settings). Check that the uploaded build loads; if it fails with a decompression error, turn on
  Decompression Fallback or build with compression disabled.

## Godot

- Export with the **Web** preset, and turn off **Progressive Web App** in it.
- Turn off **Thread Support** (Godot 4.3 or newer): a hosted game can't count on cross-origin
  isolation, so ship a single-threaded build.
- Export to `index.html` in an empty folder; zip what's inside it.

## Paths in the game's own code

The bundler fixes paths it knows about. It doesn't see strings the game builds at run time:

- `fetch("/data/levels.json")` -> `fetch("./data/levels.json")`
- `new Audio("/sfx/jump.ogg")` -> `new Audio("./sfx/jump.ogg")`
- CSS `url(/img/bg.png)` -> `url(./img/bg.png)` (relative to the CSS file)
- `new Worker("/worker.js")` -> `new Worker(new URL("./worker.js", import.meta.url))`

Search the source for `"/` and `'/` and `url(/` before building, and run the checker on the
build after.
