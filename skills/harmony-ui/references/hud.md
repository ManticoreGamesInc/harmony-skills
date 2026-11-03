# The HUD

What the player sees while playing, on top of the game. It should read at a glance and stay out
of the way.

## Contents
- What goes in it
- Placement
- The Harmony badge corner
- Safe areas and phones
- Readability
- Feedback
- Building it

## What goes in it

Only what the player needs to decide what to do next. List it, then cut:

1. **Survival:** health, lives, shield.
2. **The core resource:** ammo, energy, moves left, money in a shop round.
3. **The goal:** objective, timer, laps, wave number.
4. **Score.**
5. **Navigation:** a minimap or an off-screen arrow, only if the world is bigger than the screen.

- Anything the player checks less than once a minute belongs in the pause menu.
- Show temporary information when it changes, then fade it (a combo counter, a pickup name).
- Keep the center of the screen clear: that's where the action is.

## Placement

- **Corners and edges**, grouped by meaning: survival together, goal together.
- **Top left** for what's checked most in left-to-right languages (mirrored in right-to-left).
- **Near the action** for what's tied to it: a health bar over an enemy, a reload ring at the
  cursor.
- The same element is always in the same place, in every level and mode.
- In online play, teammates' status goes together on one side.

## The Harmony badge corner

Harmony shows its overlay badge in one corner of every game it hosts, with or without the
Harmony SDK: bottom right by default. Only a game that uses the SDK can move it, with the
`badgeCorner` option of `attach`.

- Keep HUD elements, buttons and touch controls out of that corner, with some margin.
- Without the SDK, the badge stays bottom right, so lay out the HUD to leave that corner free
  (a fire button for right thumbs sits a little above or left of it).
- In a game that already uses the SDK, if the layout needs the bottom-right corner (a fire
  button, a minimap), move the badge to a corner the game leaves free with `badgeCorner`.
- Toasts and banners avoid it too.

## Safe areas and phones

- Respect the phone's safe areas: padding from `env(safe-area-inset-top)` and the others, and
  `viewport-fit=cover` in the viewport meta tag, so nothing sits under a notch, a rounded corner
  or the home bar.
- On touch screens, thumbs cover the bottom corners: HUD information goes along the top, touch
  controls along the bottom.
- Portrait and landscape need their own layouts if the game supports both; check both at phone
  size.
- Size HUD elements relative to the viewport with limits (`clamp(14px, 2.2vmin, 22px)`), so they
  are readable on a phone and not huge on a desktop.

## Readability

- Text and icons on a solid or semi-transparent backing, or with an outline or shadow, so they
  read over any part of the scene.
- Numbers in a font with tabular figures (`font-variant-numeric: tabular-nums`), so a changing
  score doesn't jiggle.
- Health and bars show their state by length and a number or a segment count, not by color
  alone.
- Respect the game's text size setting; the HUD grows with it.
- Low health or danger: add a shape or motion (a pulse, a cracked edge), not only red.

## Feedback

The HUD confirms what happened, quickly:

- Damage: the bar drops at once, with a lighter "lost" section that drains after half a second.
- Score: counts up over a fraction of a second, with a small pop on big gains.
- Pickups: the item's icon flies toward its counter, or the counter pulses.
- Off-screen threats: an arrow at the screen edge pointing toward them.
- Keep these short (under half a second), and tone them down with reduced motion on.

## Building it

- **HTML overlay:** one absolutely positioned layer over the canvas with
  `pointer-events: none`, turned back on for any buttons. Update the DOM only when a value
  changes, never every frame; changing text and layout each frame costs real time.
- **Canvas or engine UI:** draw the HUD in its own pass or layer after the scene, in screen
  space, with the same theme tokens. Cache text that doesn't change.
- Hide the HUD for photo modes, cutscenes and screenshots with one switch.
- Names in the HUD (teammates, name tags over players, a kill feed) are text from outside:
  cleaned and capped, and set with `textContent`, `fillText` or the engine's plain text object
  with rich text off (`screens.md`, "Names and other text from outside").
