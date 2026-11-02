# Capturing frames from the game

Captures come from inside the page: `capture.js` copies the game canvas at its full resolution, right after the game draws a frame. A browser screenshot only gives you the window's size and can't hide the UI cleanly.

A game with no canvas, drawn in HTML, CSS or SVG, has nothing for `capture.js` to copy. Read [Games with no canvas](#games-with-no-canvas-html-svg-dom) below and use page screenshots and Playwright's video recorder instead. The game doesn't need the Harmony SDK for any of this.

## 1. Run the game

- Start the game's dev server, or serve its web build with any static server, on a free port. Don't take a port the developer uses for their own dev server.
- Open it in a browser that uses the real GPU. A headless browser often has no GPU, so WebGL games render slowly or wrong and WebGPU games don't start.
- Set the viewport to 1920x1080 (16:9). Pick the game's highest graphics quality, turn reduced motion off, and close any debug panel or fps counter.
- Mute the game. Set its volume to 0 in memory if it has a volume setting, without saving it.

## 2. Start the capture server

```
node <skill>/scripts/capture_server.mjs --out <work folder>
```

Run it in the background. It only answers pages on `localhost` or `127.0.0.1`; if the game runs
from another address, add `--allow-origin <that address>` (for example
`--allow-origin https://staging.example.com`). It prints a base URL with a random token, and the
line to paste into the page:

```js
const t = await import("http://127.0.0.1:<port>/<token>/capture.js");
```

Keep the work folder outside the game's source (a temp folder), or in `store-media/work/` added to `.gitignore`.

## 3. Get JavaScript into the page

Use whatever the agent has:

- **Its own browser tool** that can run JavaScript in the page: run the import line there and keep `t` on `window` (`window.t = await import(...)`) so later calls can use it.
- **No browser tool:** use the bundled Playwright driver. In the game folder:

  ```
  npm install --no-save playwright-core
  node <skill>/scripts/drive_chrome.mjs --url http://localhost:<game port> --out <work folder> --size 1920x1080
  ```

  It opens a visible Chrome window (`--browser msedge` for Edge) and prints a base URL. Send JavaScript as the body of `POST <base>/eval`, with `return` for the value you want back. It also takes `screenshot?name=`, `viewport?w=&h=`, `key?key=`, `mouse?x=&y=` and `goto?url=` (see the top of the script). Keep the window on screen: a minimized window stops drawing.

To judge a frame, look at the page (a screenshot from the browser tool, or the driver's `screenshot`). Judge with screenshots, but save the real captures with `t.save`.

Check the tab shows the right game before every capture batch: its title and port.

## In-page calls

| Call | Does |
| --- | --- |
| `t.hideUi()` | hides every element that isn't the canvas (HUD, menus, toasts, debug panels) |
| `t.showUi()` | puts them back |
| `await t.freeze()` | copies the next rendered frame and holds the game loop on it; returns `{ width, height, blank }` |
| `await t.snap()` | copies the next frame without stopping the game |
| `t.resume()` | restarts the game loop |
| `await t.withUi()` | draws the page's HTML UI over the copied frame at full size (for store screenshots) |
| `await t.captureElement(selector, scale)` | renders one HTML element, such as the title on the menu, on a transparent background (default scale 4) |
| `await t.save("<name>")` | writes the copy to `<work folder>/<name>.png` |
| `t.startRecording(60)` and `await t.stopRecording("<name>")` | record the game canvas (no HTML UI, no sound) to `<name>.webm`; returns its seconds and measured fps |
| `t.startRecording(60, { ui: true })` | records the HTML UI too, for games whose UI carries the game |
| `await t.record("<name>", <seconds>)` | the same in one call; keep it shorter than the agent's tool timeout |
| `t.status()` | frozen or running, hidden count, copy size, recording |

The server reads `capture_client.js` on every import, so a fixed script only needs a fresh `import(".../capture.js?v=2")`.

## When it goes wrong

- **`blank: true`**: the copy came back black. Wait for the scene to load and try again.
- **"no frame was rendered in 3 s"**: the page isn't drawing. Bring the window to the front (a hidden tab or minimized window pauses rendering) and retry that one shot. Before a batch, count `requestAnimationFrame` callbacks for a second; under about 20 means it's paused.
- **The game draws but `freeze()` never fires**: the loop doesn't run through `window.requestAnimationFrame` (a `setTimeout` loop, or an engine that saved the function before the script loaded). Fall back to page screenshots and video as in [Games with no canvas](#games-with-no-canvas-html-svg-dom), with the HTML UI hidden in memory unless it carries the game.
- **The import fails**: the page's Content Security Policy blocks scripts from `127.0.0.1`. The driver turns that policy off for its window. With other tools, capture from the dev server, which rarely sets a strict policy.
- **HUD drawn inside the canvas** (scores and labels in WebGL or WebGPU) stays when `hideUi()` runs. Look for a toggle in the game's debug hooks; if there is none, ask the developer before changing the game.

## Better moments

- Start a real match through the menus, then play it with keyboard and mouse input or let bots play.
- If the game exposes debug hooks or a dev console (a global like `window.game`, a tuning panel), use them in memory to pose a hero camera, set the time of day, or let bots play both sides. Never save these changes.
- A main menu whose backdrop shows the real game scene is a fair candidate once `hideUi()` takes the menu off it.
- No pause dimming, no blur from a menu behind, no camera mid-cut.

## Engines

`capture.js` works in any engine whose web build draws to a canvas and runs its loop on `requestAnimationFrame`: plain canvas, Three.js, Babylon.js, PlayCanvas, Phaser, PixiJS, Unity web builds and Godot web exports. With several canvases on the page it takes the largest visible one. Games with no canvas use the path below.

## Games with no canvas (HTML, SVG, DOM)

Card games, word games, board games and puzzles are often built from HTML elements, CSS and SVG with no canvas at all. `hideUi()`, `freeze()`, `snap()`, `withUi()` and the recording calls all need a canvas, so these games use page screenshots for frames and Playwright's video recorder for preview takes. `t.captureElement()` still works for lifting an HTML title off the menu.

### What changes

- **The UI is the game.** Don't hide it all. Hide only what isn't the game, in memory, with a style tag: build or version stamps, toasts, debug panels, scrollbars, and CSS transitions once a screen has settled. For example `*{transition:none!important;scrollbar-width:none} ::-webkit-scrollbar{display:none} .toast,.version{display:none!important}`, with the game's own class names. For the thumbnail, also hide the HUD parts that would crowd the title (score bar, menu buttons) with `visibility: hidden`, so the rest of the layout doesn't move.
- **Resolution comes from the device scale factor.** A page screenshot is the viewport size times the device scale factor: a 1280x720 viewport at 1.5 gives 1920x1080, and 1920x1080 at 2 gives 3840x2160 for the banner art.
- **A smaller viewport fills the frame.** A layout with a fixed-width column leaves wide empty sides at 1920x1080. A 1280x720 viewport (or 1600x900; keep 16:9) at a higher scale shows the same layout bigger, at full resolution.
- **Zoom in memory when that's not enough**, mostly for preview takes, which record at the viewport size: `document.documentElement.style.zoom = "1.4"`. Check nothing spills off the frame; hide a heading or hint in memory if it pushes the board out. Note the zoom in the `.json`.
- **A screenshot doesn't pause the game.** Wait for animations to settle before each shot, or take it on a calm beat.
- **Headless works.** HTML and SVG need no GPU, so the browser can run without a window.

### With the driver

The bundled driver takes a viewport, a scale and a recorder:

```
npm install --no-save playwright-core
node <skill>/scripts/drive_chrome.mjs --url http://localhost:<game port> --out <work folder> --size 1280x720 --scale 1.5 --headless
```

- Frames: `POST <base>/screenshot?name=shot_1` writes a 1920x1080 PNG. Use `eval` for the in-memory style tag and zoom, and `key` and `mouse` (or `eval` with the game's own debug hooks) to play.
- Banner art: `POST <base>/viewport?w=1920&h=1080` and a driver started with `--scale 2` gives 3840x2160 with the UI at its normal size.
- Takes: start a driver with `--record`. It records the page at the viewport size from the moment it opens. Set the zoom, play the beat, then `POST <base>/save-video?name=take_1`: that ends the take, writes `take_1.webm` and opens the game again for the next take. The take includes the setup, so pick the 6 seconds with `take-sheet` as usual.

### With a Playwright script

When the project already has Playwright (in its tests, say), a short script does the same. Keep it in the work folder or `store-media/`, out of the game's source and build:

- `browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 })`, then `page.screenshot({ path })` for frames.
- For takes, a context with `recordVideo: { dir, size: { width: 1280, height: 720 } }`. Pass `size`: without it Playwright scales the video down to fit 800x800. The file is finished when the page or context closes; `page.video().saveAs(path)` then copies it.
- Drive the game through its UI, its keyboard controls, or test hooks it already has. Don't add hooks to the game for this without asking the developer.

An agent's own browser tool is fine for judging frames, but its screenshots come at the window's size and it can't record video, so save the real frames and takes with the driver or a script.

### The rest is the same

`compose_thumbnail.py` takes a page screenshot as `--shot`; `store_media.py preview` and `take-sheet` take the `.webm`; `store_media.py background` and `portrait` take the banner screenshot.
