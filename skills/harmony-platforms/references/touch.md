# Touch

Touch play needs three things: a page that behaves like an app (no zoom, scroll or text selection), controls a thumb can use, and the same game actions the keyboard already drives.

## Make the page behave

In the page's `<head>`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

`viewport-fit=cover` lets the game fill the screen around a camera cutout. The game then pads its own HUD with the safe-area insets (below).

In the game's CSS:

```css
html, body {
	margin: 0;
	height: 100%;
	overflow: hidden;
	overscroll-behavior: none;
}

#game {
	position: fixed;
	inset: 0;
	height: 100dvh;
	touch-action: none;
	user-select: none;
	-webkit-user-select: none;
	-webkit-touch-callout: none;
	-webkit-tap-highlight-color: transparent;
}

#hud {
	padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
```

| Rule | Stops |
| --- | --- |
| `touch-action: none` on the game area | scrolling, pinch zoom and double-tap zoom while playing |
| `overscroll-behavior: none` | pull-to-refresh and the page bouncing |
| `100dvh` instead of `100vh` | the browser's address bar covering the bottom of the game |
| `user-select`, `-webkit-touch-callout` | text selection and the long-press menu on game UI |
| `-webkit-tap-highlight-color` | the gray flash on tapped elements |
| `env(safe-area-inset-*)` | HUD and buttons under the camera cutout, rounded corners or the gesture bar |

Keep `touch-action: none` off scrolling panels (a long settings list, a shop): give those `touch-action: pan-y` so they still scroll.

## Use pointer events

Pointer events cover mouse, touch and pen with one set of listeners. Listen on the game's element, capture each pointer so its moves keep arriving when the finger slides off a button, and track fingers by `pointerId`:

```js
const fingers = new Map();

gameElement.addEventListener("pointerdown", (e) => {
	gameElement.setPointerCapture(e.pointerId);
	fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
});

gameElement.addEventListener("pointermove", (e) => {
	const f = fingers.get(e.pointerId);
	if (f) {
		f.x = e.clientX;
		f.y = e.clientY;
	}
});

for (const type of ["pointerup", "pointercancel"]) {
	gameElement.addEventListener(type, (e) => fingers.delete(e.pointerId));
}
```

- `e.pointerType` is `"touch"`, `"mouse"` or `"pen"`: use it to tell which device the player used last.
- `pointercancel` fires when the browser takes the touch over (a system gesture). Treat it as a release, or a held button sticks down.
- Convert `clientX` and `clientY` to game coordinates through the canvas's `getBoundingClientRect()` and the camera, not the canvas's pixel size.

## Pick the control scheme

| The game | Touch controls |
| --- | --- |
| Point and click, board, card, puzzle | tap and drag on the game itself; no on-screen buttons |
| Aim or steer toward a spot | the finger is the target; the controlled thing follows it with no lag |
| Move plus actions (platformer, twin-stick, racer) | an on-screen stick on the left, 1 to 3 action buttons on the right |
| One-button (runner, flappy) | tap anywhere |

Fewer on-screen buttons is better. Fold rare actions into context (tap the door to open it) rather than adding a fifth button.

## On-screen stick

A floating stick: it appears where the left thumb lands, so players never miss it. It feeds a move vector into the same action the arrow keys drive.

```js
// A floating stick for the left part of the screen. Read stick.x and stick.y (-1 to 1) each frame.
const stick = { id: null, originX: 0, originY: 0, x: 0, y: 0 };
const STICK_RADIUS = 60;
const DEAD_ZONE = 0.15;

gameElement.addEventListener("pointerdown", (e) => {
	if (e.pointerType !== "touch" || stick.id !== null || e.clientX > window.innerWidth * 0.45) {
		return;
	}
	stick.id = e.pointerId;
	stick.originX = e.clientX;
	stick.originY = e.clientY;
	stick.x = 0;
	stick.y = 0;
	showStickAt(stick.originX, stick.originY);
});

gameElement.addEventListener("pointermove", (e) => {
	if (e.pointerId !== stick.id) {
		return;
	}
	const dx = (e.clientX - stick.originX) / STICK_RADIUS;
	const dy = (e.clientY - stick.originY) / STICK_RADIUS;
	const length = Math.hypot(dx, dy);
	// Past the rim counts as full tilt; inside the dead zone counts as none.
	const strength = Math.min(1, length);
	const scaled = strength < DEAD_ZONE ? 0 : (strength - DEAD_ZONE) / (1 - DEAD_ZONE);
	stick.x = length > 0 ? dx / length * scaled : 0;
	stick.y = length > 0 ? dy / length * scaled : 0;
	moveStickKnob(stick.x, stick.y);
});

for (const type of ["pointerup", "pointercancel"]) {
	gameElement.addEventListener(type, (e) => {
		if (e.pointerId === stick.id) {
			stick.id = null;
			stick.x = 0;
			stick.y = 0;
			hideStick();
		}
	});
}
```

`showStickAt`, `moveStickKnob` and `hideStick` are the game's own: two circles in the HUD, the base at the origin and the knob offset by `x * STICK_RADIUS`, `y * STICK_RADIUS`. Draw them semi-transparent and hide them on desktop.

## Action buttons

Make action buttons real elements in the HUD, so they get their own pointer events and the stick's handler never sees them:

```js
function holdButton(element, action) {
	element.addEventListener("pointerdown", (e) => {
		e.stopPropagation();
		element.setPointerCapture(e.pointerId);
		actions.press(action);
	});
	for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
		element.addEventListener(type, () => actions.release(action));
	}
}

holdButton(document.getElementById("jump-button"), "jump");

// Any touch switches the prompts back to touch, so the touch controls return after a controller
// was used.
window.addEventListener("pointerdown", (e) => {
	if (e.pointerType === "touch") {
		actions.setDevice("touch");
	}
}, { capture: true });
```

`actions` is the game's input layer (see "One input layer" in controller.md). Size and place buttons for thumbs:

- At least 44 CSS pixels across, 64 or more for the main action, with 8 px or more between them.
- Not within about 20 px of the left or right screen edge, where Android's back swipe starts.
- Clear of the Harmony overlay badge's corner (bottom right by default, and always bottom right without the Harmony SDK).
- Inside the safe-area insets.
- Show a pressed state, since a thumb hides the button it presses.

## Taps on the game itself

For tap and drag games, tell a tap from a drag by how far the finger moved: under about 10 CSS px between down and up is a tap. Make tap targets in the game world at least as big as a fingertip (44 CSS px), even when the art is smaller, and show what was selected, since the finger covers it.

## Audio unlock and hidden pages

Phone browsers keep audio silent until the player touches the page. Resume the game's `AudioContext` on the first press of any kind:

```js
function unlockAudio() {
	if (audioContext.state !== "running") {
		audioContext.resume();
	}
}

// pointerup and touchend, not pointerdown: browsers only count the end of a tap as the player's
// action, so audio started on pointerdown can stay silent on phones.
for (const type of ["pointerup", "touchend", "keydown"]) {
	window.addEventListener(type, unlockAudio, { capture: true });
}
```

A controller press doesn't count as a page gesture in every browser: show a "Press to start" screen that a tap or click dismisses on phones.

Pause the game and its audio when the player switches apps:

```js
document.addEventListener("visibilitychange", () => {
	if (document.hidden) {
		pauseGame();
	}
});
```

## Engines

- **Three.js, Babylon.js, PlayCanvas, PixiJS:** the code above works as written on the canvas or a wrapper element. Babylon also ships a virtual joystick in its GUI library, and PixiJS has pointer events on display objects for buttons drawn in the scene.
- **Phaser:** call `this.input.addPointer(2)` for multi-touch (one pointer is active by default), and use `pointerdown` on game objects for buttons. Set `touch-action: none` on the canvas's parent.
- **Unity web builds:** the Input System's On-Screen Stick and On-Screen Button components feed the same actions as the gamepad. The CSS rules above still go in the build's page template.
- **Godot web exports:** a `TouchScreenButton` or a virtual joystick scene; set the stretch mode so the HUD scales with the screen. The CSS rules above go in the export's custom HTML shell.
