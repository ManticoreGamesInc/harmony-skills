# Game controller

The browser's Gamepad API reads Xbox, PlayStation, Switch Pro and most other controllers. The game polls it once a frame: there are no button events.

## One input layer

Before adding a controller, make sure the game reads actions, not devices. One small layer maps every device to the same actions and remembers which device the player used last:

```js
// Actions the game reads each frame: held, pressed this frame, and the move vector.
const actions = {
	held: new Set(),
	pressedNow: new Set(),
	move: { x: 0, y: 0 },
	lastDevice: "keyboard",
	press(action, device) {
		if (!this.held.has(action)) {
			this.pressedNow.add(action);
		}
		this.held.add(action);
		if (device) {
			this.setDevice(device);
		}
	},
	release(action) {
		this.held.delete(action);
	},
	isDown(action) {
		return this.held.has(action);
	},
	wasPressed(action) {
		return this.pressedNow.has(action);
	},
	setDevice(device) {
		if (device !== this.lastDevice) {
			this.lastDevice = device;
			document.body.dataset.input = device;
		}
	},
	// Call at the end of each frame, after the game read its input.
	endFrame() {
		this.pressedNow.clear();
	}
};
```

`document.body.dataset.input` (`keyboard`, `mouse`, `touch` or `gamepad`) lets CSS show the right prompts and hide the touch controls: `body[data-input="gamepad"] .touch-controls { display: none; }`. Ignore tiny mouse movements (under a few pixels) when deciding the last device, so a bumped mouse doesn't take over from the keys.

## Read the controller each frame

```js
const BUTTON_ACTIONS = { 0: "confirm", 1: "back", 9: "pause", 8: "overlay", 12: "up", 13: "down", 14: "left", 15: "right" };
const STICK_DEAD_ZONE = 0.2;
const padButtonsDown = new Set();

function deadZone(x, y) {
	const length = Math.hypot(x, y);
	if (length < STICK_DEAD_ZONE) {
		return { x: 0, y: 0 };
	}
	const scale = Math.min(1, (length - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE)) / length;
	return { x: x * scale, y: y * scale };
}

function pollGamepads() {
	const pads = navigator.getGamepads ? navigator.getGamepads() : [];
	const pad = Array.from(pads).find((p) => p && p.connected && p.mapping === "standard") || Array.from(pads).find((p) => p && p.connected);
	if (!pad) {
		return;
	}
	for (const [index, action] of Object.entries(BUTTON_ACTIONS)) {
		const button = pad.buttons[index];
		const down = !!button && button.pressed;
		const key = pad.index + ":" + index;
		if (down && !padButtonsDown.has(key)) {
			padButtonsDown.add(key);
			actions.press(action, "gamepad");
		} else if (!down && padButtonsDown.has(key)) {
			padButtonsDown.delete(key);
			actions.release(action);
		}
	}
	const stick = deadZone(pad.axes[0] || 0, pad.axes[1] || 0);
	if (stick.x !== 0 || stick.y !== 0) {
		actions.setDevice("gamepad");
	}
	if (actions.lastDevice === "gamepad") {
		actions.move = stick;
	}
}
```

Call `pollGamepads()` at the start of every frame, before the game reads `actions`.

- **The standard mapping.** When `pad.mapping === "standard"`, the buttons and axes follow the W3C layout below, whatever the brand. Other pads (`mapping === ""`) have their own order: support them only if the developer asks, with a remap screen.
- **Dead zones.** Sticks never rest at exactly 0. Use a radial dead zone (about 0.15 to 0.25) as above, not one per axis, so diagonals stay smooth.
- **Edges.** A button held across frames is one press. The game reads `wasPressed` for jumps and menu moves, and `isDown` for held actions.
- **Triggers** are analog: `pad.buttons[6].value` and `pad.buttons[7].value` run from 0 to 1.

| Index | Standard button | Typical action |
| --- | --- | --- |
| 0 | A / Cross (bottom) | confirm, jump |
| 1 | B / Circle (right) | back, cancel |
| 2, 3 | X / Square, Y / Triangle | secondary actions |
| 4, 5 | LB, RB / L1, R1 | switch tabs, cycle |
| 6, 7 | LT, RT / L2, R2 (analog) | accelerate, fire |
| 8 | View / Share / Select | open the Harmony overlay (with the Harmony SDK) |
| 9 | Menu / Options / Start | pause |
| 10, 11 | left and right stick presses | sprint, look back |
| 12 to 15 | D-pad up, down, left, right | menus, discrete moves |
| axes 0, 1 | left stick x, y (down is +1) | move |
| axes 2, 3 | right stick x, y | aim, camera |

## Connect and disconnect

```js
window.addEventListener("gamepadconnected", () => actions.setDevice("gamepad"));

window.addEventListener("gamepaddisconnected", () => {
	padButtonsDown.clear();
	for (const action of Object.values(BUTTON_ACTIONS)) {
		actions.release(action);
	}
	if (gameIsRunning()) {
		pauseGame();
	}
});
```

- Browsers hide controllers until the player presses a button on one, for privacy. "No controller" on load is normal: show "Press any button" on the title screen rather than an error.
- Pause when the controller disconnects mid-game (a dead battery), and keep play going with whichever device the player picks up next.

## Menus with a controller

A controller player has no pointer, so every screen needs a focused element and a way to move it.

- **Focus.** When a screen opens, focus its first button. Show focus clearly (`:focus-visible` with a thick outline or a glow), since the default ring is easy to miss on a game background.
- **Move focus** with the D-pad and the left stick (with a repeat delay of about 250 ms when held). For a vertical list, up and down move to the previous and next focusable element; for grids, pick the nearest element in the pressed direction.
- **Confirm and back.** Button 0 clicks the focused element (`document.activeElement.click()`), button 1 goes back, the same as Esc.
- **Sliders and toggles.** Left and right change a focused slider (`input.stepUp()`, `input.stepDown()`, then fire an `input` event). Confirm flips a toggle.
- **Text fields.** A controller can't type. Offer defaults (a generated player name) and keep typing optional.
- **Keyboard first.** Menus that work with Tab, arrows, Enter and Esc are most of the way there: the controller code moves focus and clicks, the same as the keys.

## Button prompts

- Show prompts for the device in use: "A Jump" with a controller, "Space Jump" on a keyboard, a jump button on touch. Switch them when `actions.lastDevice` changes.
- Use generic face-button positions (bottom, right, left, top) or neutral icons when you can't tell the brand. `pad.id` often names it (it contains "Xbox", "DualSense", "054c" for Sony), but it isn't reliable.
- Never show a keyboard key to a controller player, in tutorials as well as the HUD.

## The Harmony overlay and a controller

Shift+Tab opens the Harmony overlay by default, which a controller can't press. Without the Harmony SDK the game can't open the overlay or tell when it opens: players open it with its badge or Shift+Tab, and the controller's Menu button pauses the game as usual. Leave button 8 unbound, or give it a game action.

If the game uses the Harmony SDK:

```js
// Button 8 (View / Share / Select) opens and closes the overlay.
if (actions.wasPressed("overlay") && harmony) {
	harmony.toggle();
}
```

Pause the game while the overlay is open (`harmony.on("open", ...)` and `harmony.on("close", ...)`), and tell controller players which button opens it, for example in the pause menu. `harmony` is the handle from `attach`, and is `null` when Harmony isn't available, as in local development.

## Engines

- **Three.js, Babylon.js, PlayCanvas, PixiJS:** use the code above. Babylon also has `GamepadManager`, and PlayCanvas `app.gamepads` (`pc.PAD_FACE_1` and so on), which wrap the same API.
- **Phaser:** turn gamepads on in the config (`input: { gamepad: true }`) and read `this.input.gamepad.pad1`; its buttons follow the standard mapping.
- **Unity web builds:** the Input System's Gamepad device works in the browser for standard-mapped controllers. Bind actions in an Input Actions asset so keyboard, touch and gamepad share them, and use the UI's EventSystem navigation for menus.
- **Godot web exports:** map joypad buttons and axes to Input Map actions, and set focus neighbors on Control nodes (`grab_focus()` on the first button) so `ui_up`, `ui_down`, `ui_accept` and `ui_cancel` drive the menus.
