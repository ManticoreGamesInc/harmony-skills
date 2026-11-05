# Phone layout and performance

## Choose the orientation

Ask the developer, and recommend by the shape of the game:

| Orientation | Suits | Costs |
| --- | --- | --- |
| Portrait only | tall games: stackers, vertical scrollers, card hands, one-thumb puzzles | a "turn your phone upright" cover for phones held sideways |
| Landscape only | wide games: racers, side-scrollers, arenas, twin-stick, fighting | the same cover, asking to turn sideways |
| Both | boards and menu-heavy games that lay out well either way | every screen needs a phone-landscape layout about 360 CSS px tall, which is real work |

Tablets and desktops always play in any orientation: only cover a phone. Tick the matching Portrait and Landscape boxes on Harmony's upload form, and only the ones you checked.

## The "turn your phone" cover

Browsers can't force a page's orientation. `screen.orientation.lock()` only works in fullscreen on Android and never on iOS, so don't count on it. A full-screen cover that pauses the game works everywhere.

Fullscreen itself works on Harmony: call `requestFullscreen` from a tap or key handler, and Harmony makes the whole page fullscreen with its overlay still above the game. A fullscreen button helps on phones, where the browser's bars take a lot of the screen.

```css
.rotate-cover { display: none; }

/* A phone (coarse pointer, short side under 540 px) held sideways. For a landscape-only game,
   use (orientation: portrait) and (pointer: coarse) and (max-width: 540px). */
@media (orientation: landscape) and (pointer: coarse) and (max-height: 540px) {
	.rotate-cover {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background: #101418;
		color: #ffffff;
		text-align: center;
		font: 700 1.4rem sans-serif;
	}
}
```

```js
const PHONE_SIDEWAYS = "(orientation: landscape) and (pointer: coarse) and (max-height: 540px)";

const cover = document.createElement("div");
cover.className = "rotate-cover";
cover.setAttribute("role", "alert");
cover.textContent = "Turn your phone upright to play";
document.body.append(cover);

const sideways = window.matchMedia(PHONE_SIDEWAYS);
function syncOrientation() {
	gameUi.inert = sideways.matches;
	if (sideways.matches) {
		pauseGame();
	}
}
sideways.addEventListener("change", syncOrientation);
syncOrientation();
```

- Keep the media query in the CSS and the script identical, or the cover and the pause disagree.
- Put the cover above the loading screen too (a higher `z-index`).
- `pauseGame()` must do nothing outside a match: the menus are already covered and inert.
- Don't resume on its own when the phone turns back. Leave the pause menu up so the player is ready.

## Lay out at phone size

Common phone viewports in CSS pixels: 360x780 and 390x844 portrait, 780x360 and 844x390 landscape. Tablets: 768x1024 and 820x1180.

- **Scale the UI with the screen,** not fixed pixel panels made for 1920x1080. Use `clamp()` for font sizes and `min()` for panel widths, or the engine's canvas scaler.
- **Text** at least 12 CSS px, 16 for anything the player reads during play. Keep contrast over the scene with a backing or shadow.
- **HUD** in the corners and edges, inside the safe-area insets, away from where the thumbs rest and from the overlay badge's corner (top right on a phone unless a game with the Harmony SDK moves it).
- **Menus** as one column of large buttons on phones. Long lists scroll (`touch-action: pan-y`), and nothing important sits below the fold without a hint.
- **No hover-only information.** Tooltips need a tap (or a long press) on touch screens.
- **Pick the layout by size and pointer, not the user agent:** `(pointer: coarse)` for touch-first, and the viewport size for the layout.
- **Keyboards:** a text field (a player name) opens the on-screen keyboard, which shrinks the visible area. Keep the field and its buttons above it, and don't treat the resize as a new orientation.

## Performance on phones

Phones have a fraction of a desktop GPU and heat up fast. Aim for a steady frame rate on a mid-range phone, not a peak on a flagship.

- **Cap the render resolution.** Render at `Math.min(devicePixelRatio, 2)` times the CSS size, or lower (1.5) for heavy 3D scenes. A phone at DPR 3 renders more pixels than a 1080p monitor.
- **Turn down effects on phones:** bloom, shadows, particle counts, post-processing passes. Pick a quality level from the screen size and pointer, and let the player change it in settings.
- **Fall back to WebGL.** Many phones have no WebGPU adapter. A WebGPU game needs a WebGL2 (or Canvas 2D) path to run on them; check `navigator.gpu` and `requestAdapter()` before choosing.
- **Keep loading light.** Phones on mobile data load slowly: compress textures and audio, and show progress.
- **Measure** the frame time on a real phone with the browser's remote debugging, or an on-screen frame counter in a debug build.

## Engines

- **Three.js, Babylon.js, PlayCanvas:** set the pixel ratio yourself (`renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`, Babylon's `engine.setHardwareScalingLevel(1 / ratio)`, PlayCanvas's `app.graphicsDevice.maxPixelRatio`).
- **Phaser:** use the Scale Manager (`scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }`) and lay out the HUD from the game size.
- **Unity web builds:** set the canvas to match the window in the page template, use the Canvas Scaler set to "Scale With Screen Size", and set `config.devicePixelRatio` lower on phones in the template's `createUnityInstance` config.
- **Godot web exports:** stretch mode `canvas_items` with aspect `expand`, and anchors on the HUD so it follows the safe area (`DisplayServer.get_display_safe_area()`).
