---
name: harmony-ui
description: Design and build a web game's menus, HUD and screens - a visual direction as theme tokens, title, pause, results and how-to-play screens, modals and toasts, focus and back routing for keyboard, controller and touch, and a HUD that reads at a glance, keeps clear of the Harmony badge and fits phones. Use when a game needs a title screen, menus, a HUD, dialogs or a UI style, or its UI is hard to read or can't be used with a controller.
license: MIT
compatibility: Web games in any browser engine, with an HTML/CSS overlay or the engine's own UI. Guidance only; no scripts.
---

# Menus, HUD and screens for web games

The UI is the first thing players see and what they touch between every round. This skill
covers its look, the screens and how they flow, and the HUD. It is guidance: build it with the
game's own UI technology. The settings screen follows the same principles.

## Build order

1. **A direction** ([references/style.md](references/style.md)): fonts, palette, shapes and
   motion that fit the game's world, written down as theme tokens before any screen is built.
   Offer the developer two or three directions to pick from.
2. **The screen stack** ([references/screens.md](references/screens.md)): title, pause,
   results, how-to-play, credits, modals and toasts, with one place that routes Esc, back and
   focus.
3. **The HUD** ([references/hud.md](references/hud.md)): only what the player needs while
   playing, placed by priority, clear of the Harmony badge and phone safe areas.
4. **Polish:** transitions, sounds, small motion on interaction, and a pass at phone width,
   with a controller, and with text at 150%.
5. **Check and hand over** (below).

## Ask the developer first

First read the game: its code, its art, and its design brief (`docs/design.md`) if it has one.
Then ask in one round, only what that didn't answer, with a recommendation for each:

- **The game's world and mood**, and any art, logo or font to build from. Recommended: the mood
  of the game's own art and genre, in a few words ("bright arcade, chunky and loud").
- **Where the UI lives:** an HTML/CSS overlay over the canvas, or the engine's own UI.
  Recommended: the overlay (sharp text, accessibility and layout for free), unless the UI must
  live in the 3D world or match pixel art exactly.
- **Inputs:** mouse and keyboard, controller, touch. Read them from the game's input code; ask
  only when it's unclear. Every screen works with each one the game supports.
- **Image generator: "Do you have one set up? (default: none)"** For example OpenAI's image
  models through Codex or the API, Gemini, a local ComfyUI or Stable Diffusion, or any tool that
  outputs a PNG. One can draw concept mockups of each style direction, backgrounds, frames and
  icons; the UI itself is still built in code. Ask; never scan for tools. With one, follow
  [references/generators.md](references/generators.md).

If the developer says "you decide", take the recommendations, pick the direction that fits the
game best, and say why in one line.

## Rules

- **One style everywhere.** All screens use the same theme tokens (colors, fonts, sizes,
  radii, spacing, motion). No one-off colors or fonts in a single screen.
- **No browser defaults showing.** Themed buttons, sliders, checkboxes, scrollbars, focus
  rings and tooltips; never the browser's grey widgets.
- **Readable.** Body text at least 16 CSS pixels on desktop, contrast of at least 4.5:1 for text
  (3:1 for large text and icons), and text on a solid or dimmed surface, never straight on a
  busy scene.
- **Color never carries meaning alone.** Pair every meaningful color (team, danger, rarity,
  correct or wrong) with a shape, icon, pattern or label.
- **Every screen works with every input** the game supports, with a visible focus state, and Esc
  or the controller's back button always goes back one step.
- **Clear of the Harmony badge.** Harmony draws its overlay badge in one corner of every game
  it hosts, with or without the Harmony SDK: bottom right, unless a game with the SDK picks
  another with the `badgeCorner` option of `attach`. Keep HUD elements and buttons
  out of that corner.
- **A pause the player can always reach.** The game's own pause key or button opens the pause
  screen. A game that uses the Harmony SDK also pauses (single player) when the overlay opens
  (`harmony.on("open")`; see the `harmony-sdk` skill or
  https://playharmony.ai/developers/sdk.md), and doesn't resume on its own when it closes; the
  player resumes. Without the SDK the game isn't told when the overlay opens, but opening it
  takes keyboard focus, so pause on the window's `blur` event (which also covers switching tabs
  or apps) and let the player resume. Don't add the SDK only for this.
- **Text from players is text.** Names and anything players type are shown with `textContent`
  or the engine's text call, never HTML.
- **UI text from the language files** when the game is translated, with room for longer
  translations.

## Check and hand over

- Open every screen with each input the game supports: focus is visible, Esc or the
  controller's back button goes back one step, and nothing is reachable only by hover.
- At phone width, in each orientation the game supports, nothing sits under the Harmony badge
  corner or a safe area.
- Text at 150% still fits; text contrast is at least 4.5:1; the screens still read in grayscale.
- Tell the developer the chosen direction, where the theme tokens live, and anything left
  unthemed or untested.

## Reference files

| File | Read when |
| --- | --- |
| [references/style.md](references/style.md) | Choosing a direction, fonts, palette and meaning colors, shapes, theme tokens, motion, HTML overlay or engine UI |
| [references/screens.md](references/screens.md) | The screen stack, title, pause, results, how-to-play, credits, modals, toasts, focus and back routing, controller and touch navigation |
| [references/generators.md](references/generators.md) | Only when the developer has an image generator: ground rules (no paid calls without a yes, no API keys, commercial terms, recording sources) and what it may make |
| [references/hud.md](references/hud.md) | What goes in the HUD, placement and priority, the Harmony badge corner, safe areas, phone layouts, feedback and readability |
