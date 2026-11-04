---
name: harmony-platforms
description: Make a web game playable on phones, tablets and game controllers - touch controls, phone layouts, safe areas and orientation, Gamepad API support with controller-friendly menus and button prompts - and decide what to mark under Supported platforms when uploading to Harmony. Use when a game should work on mobile, touch or a controller, the developer asks about portrait or landscape, or needs its supported platforms picked.
license: MIT-0
compatibility: Web games in any browser engine. Testing uses a desktop browser's device mode (Chrome, Edge or Firefox); a real phone and a real controller give the final check.
---

# Harmony platforms

Harmony's upload form has a **Supported platforms** step. It lists PC, Mobile, Game controller and VR, and each is Not supported, Unknown or Supported. Once Mobile is Supported, the form also asks which ways the game plays: Portrait, Landscape or both. Players rely on these marks, so set each one honestly from what was tested.

Most web games start with a mouse and keyboard. This skill adds touch and controller play to a game, checks it, and ends with what to mark on the form.

## What each choice should mean

"Supported" means the game was played that way and works from start to finish, menus included.

| Row | Mark Supported when |
| --- | --- |
| PC | the whole game, menus included, works with keyboard and mouse |
| Mobile | it was played on a phone, or in the browser's device mode at phone size, menus included, with no keyboard needed. A real phone also shows the frame rate and the browser's own bars, so try one when you can |
| Portrait / Landscape | the game lays out and plays that way up on a phone. Tick only the ways you checked |
| Game controller | menus and play both work with a controller, without touching the mouse or keyboard |
| VR | the game has a VR mode that was tried in a headset. This skill doesn't cover WebXR, so this is usually Not supported |

- **Unknown** when the code is there but nobody has tried it.
- **Not supported** when the game clearly can't be played that way: a typing game on Mobile, a game with no controller code at all.
- Don't mark a platform Supported to reach more players. A player who can't get past the menu leaves.

## Order of work

1. **Look at the game first.** Find its input code, its UI (HTML over the canvas or drawn in the engine), how it sizes the canvas, any touch or controller code it already has, and whether it uses the Harmony SDK. Then ask the questions below.
2. **Touch.** Add touch controls and fix the page for phones: [references/touch.md](references/touch.md).
3. **Phone layout.** Lay out the HUD and menus at phone size, add the orientation cover if the game plays one way only, and fit the frame rate: [references/phone-layout.md](references/phone-layout.md).
4. **Controller.** Add Gamepad API support, controller menus and button prompts: [references/controller.md](references/controller.md).
5. **Test** every platform you plan to mark, including PC: [references/testing.md](references/testing.md).
6. **Report** what to mark on the form, row by row, with what you checked and what you couldn't (a real phone, a real controller).

Skip the steps for platforms the developer doesn't want. Ask before large changes to the game's controls or layout (changing existing key bindings, removing or merging screens), and keep the existing keyboard and mouse play working throughout.

## Ask the developer first

Ask in one round, with a recommendation for each. Don't ask what the code already shows.

- **Which platforms?** Phones and tablets, game controllers, or both. Recommended: both, unless the game needs a keyboard (typing, many keys at once).
- **Which orientation on phones?** Portrait, landscape or both. Recommended: the one the table in "Choose the orientation" ([references/phone-layout.md](references/phone-layout.md)) gives for the game's shape, with a one-line reason.
- **Touch controls:** the scheme from "Pick the control scheme" ([references/touch.md](references/touch.md)) that fits the game. Recommended: that table's choice, named with a one-line reason.
- **Can you test on a real phone and a real controller?** Recommended: yes for the final check. Without them, Game controller can only be marked Unknown, and the report says the phone checks were done in device mode.

If the developer says "you decide", use the recommendations and list them in the report as choices they can change.

## Rules that are easy to get wrong

- **One input layer, many devices.** Map keys, touch and controller buttons to the same game actions (move, jump, confirm, back). Game code reads actions, never devices.
- **The last device used wins.** Switch button prompts and on-screen controls to whatever the player touched last, so a player who picks up a controller sees controller prompts and the touch buttons hide.
- **Pointer events, not mouse events,** for anything a finger should do. Track each pointer by `pointerId` for multi-touch.
- **Keep on-screen controls clear of Harmony's overlay badge.** Harmony puts the overlay's badge in one corner of every game it hosts, bottom right by default, with or without the Harmony SDK. Without the SDK the badge stays there, so lay out the controls around it. A game that already uses the SDK can move it with the `badgeCorner` option of `attach`.
- **A controller can't press Shift+Tab,** the overlay's default hotkey. Without the Harmony SDK the game can't open the overlay; players reach it with its badge or Shift+Tab. If the game uses the SDK, open and close the overlay from a controller button (the View or Select button) with `harmony.toggle()`, and pause while it is open with `harmony.on("open", ...)` and `harmony.on("close", ...)`. Don't add the SDK only for this unless the developer wants it.
- **Fullscreen works, an orientation lock doesn't count.** On Harmony, call `requestFullscreen` from a tap or key handler, and Harmony makes the whole page fullscreen with the overlay above the game. Don't rely on `screen.orientation.lock()`: iOS never allows it and Android only in fullscreen. A "turn your phone" cover works everywhere.
- **Unlock audio on the first tap or button press.** Phone browsers start audio muted until the player touches the page.
- **Pause when the page is hidden** (`visibilitychange`) and when a controller disconnects mid-game.

## Engines

The references give plain browser code (pointer events, the Gamepad API, CSS) that works in a plain canvas game and in Three.js, Babylon.js, PlayCanvas and PixiJS. Engines with their own input systems get notes in each reference:

- **Phaser:** its input plugin handles pointers and gamepads (`this.input.addPointer`, `this.input.gamepad`); enable gamepads in the game config.
- **Unity web builds:** use the Input System's on-screen controls and its Gamepad support, and test the build in the browser, since the editor's input doesn't match the browser's.
- **Godot web exports:** use `TouchScreenButton` or a virtual joystick scene for touch, and joypad events mapped to Input Map actions for controllers. "Emulate Mouse From Touch" is on by default: turn it off once the game has its own touch controls, so a tap doesn't also arrive as a mouse click.
