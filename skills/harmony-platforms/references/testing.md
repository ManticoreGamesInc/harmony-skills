# Testing each platform

Test every platform before marking it Supported. Most checks run in a desktop browser; a real phone and a real controller give the final word, and the report says when they weren't available.

## Phones in the browser's device mode

Chrome and Edge: DevTools > Toggle device toolbar (Ctrl+Shift+M, Cmd+Shift+M on a Mac). Firefox: Responsive Design Mode (Ctrl+Shift+M). Device mode sets the viewport, the device pixel ratio and touch input, and reports `(pointer: coarse)`.

Reload after switching device mode on, so code that checks for touch at load runs again. Then, for each orientation the game plays in:

1. **Sizes.** 360x780 and 390x844 portrait, 780x360 and 844x390 landscape, and a tablet (820x1180). For a one-way game, the other orientation shows the "turn your phone" cover and pauses.
2. **Play by touch only.** Start from the title, play a round, pause, change a setting, finish, and get back to the menu, without the keyboard. With touch emulation, a mouse drag is one finger; multi-touch needs a real phone.
3. **Look** at every screen: the checklist below.

Device mode doesn't show the camera cutout, the browser's address bar, the on-screen keyboard, real multi-touch, phone GPU speed or Android's back swipe. Those need a real phone.

## The checklist

| Area | Look for |
| --- | --- |
| Safe areas | HUD or buttons under the camera cutout, rounded corners or the gesture bar |
| Touch targets | buttons under 44 CSS px, closer than 8 px, within 20 px of the left or right edge, or in the Harmony overlay badge's corner |
| Text | clipped, overflowing, badly wrapped, under 12 CSS px, low contrast over the scene |
| Layout | overlaps, parts off screen, black bars, a stretched or squashed canvas, a page you can zoom or scroll |
| Browser | the address bar or keyboard covering the bottom (`100vh`), pull-to-refresh, text selection or tap flashes on game UI |
| Rendering | a blurry canvas (render scale below the pixel ratio), effects missing in the WebGL fallback |
| Input | stuck buttons after a finger slides off, the stick drifting, taps landing in the wrong place (coordinates not converted) |

## A real phone, by hand

Serve the game where the phone can reach it: the game's dev server on the local network (most dev servers take a `--host` flag), or upload a build to Harmony and open it there. A plain `http://` address on the network blocks WebGPU (it isn't a secure page), so test WebGPU games over `https`, or check the WebGL fallback that way.

On the phone, with the developer:

- Play a full round in each orientation the game claims. Turn the phone mid-round.
- Hold two thumbs down at once (stick and a button).
- Switch to another app and back: the game pauses and its audio stops.
- Check sound starts after the first tap.
- Watch the frame rate for a minute of play. A phone that gets hot or stutters needs lower settings.
- On an iPhone too, when one is at hand: Safari differs from Chrome on audio unlock, the safe areas and fullscreen.

For console errors on the phone, use remote debugging: `chrome://inspect` on the computer for Android Chrome over USB, or Safari's Develop menu on a Mac for an iPhone. Look only at the game's tab.

## A controller

- **Real controller:** plug it in or pair it, press a button (browsers hide controllers until then), and play the whole game: title, menus, a round, pause, settings, results, back to the menu. Never touch the mouse or keyboard.
- **Without one:** check the code paths with a fake controller in the console. It only proves the game reads the API, so say a real controller wasn't tested:

  ```js
  // Pretend button 0 (A) is held and the left stick is pushed right, for the next few frames.
  const fakePad = { id: "test pad", index: 0, connected: true, mapping: "standard", axes: [1, 0, 0, 0], buttons: Array.from({ length: 17 }, (v, i) => ({ pressed: i === 0, value: i === 0 ? 1 : 0 })) };
  const realGetGamepads = navigator.getGamepads.bind(navigator);
  navigator.getGamepads = () => [fakePad, null, null, null];
  setTimeout(() => { navigator.getGamepads = realGetGamepads; }, 500);
  ```

- Check the prompts switch to controller buttons when the controller is used, and back when the mouse or keyboard is.
- If the game uses the Harmony SDK, open the overlay with the controller's View or Select button, and check the game pauses. This needs the hosted game on Harmony, since the overlay isn't there locally.

## PC

After the touch and controller work, check the desktop didn't break:

- Keyboard and mouse play every part of the game.
- The on-screen controls are hidden with a mouse, and keyboard prompts show.
- The window resizes from about 1024x640 to a large monitor without the layout breaking.
- Nothing relies on hover alone on touch, or on touch alone on a desktop.

## What to mark

Report each row of the Supported platforms step with what you checked:

| Row | Mark |
| --- | --- |
| PC | Supported when the PC check passed |
| Mobile | Supported when the whole game played by touch on a phone, or in device mode at phone size. Say which, and suggest a real phone when only device mode was used |
| Portrait, Landscape | the orientations that passed |
| Game controller | Supported when a real controller played the menus and the game. The fake controller alone: Unknown |
| VR | Supported only for a VR mode tried in a headset; otherwise Not supported, or Unknown if the code is there but untried |

The developer marks these on the game's page in My Creations on Harmony. Re-check them when a new version changes the controls or the layout.
