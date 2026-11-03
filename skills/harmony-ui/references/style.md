# Style

A look for the UI that belongs to this game, written down as tokens before the first screen is
built.

## Contents
- Choosing a direction
- Theme tokens
- Fonts
- Palette and meaning colors
- Shapes and surfaces
- Motion
- Pixel art
- HTML overlay or engine UI

## Choosing a direction

Start from the game, not from a generic dark theme. Look at its world, its art, its mood and
its genre, then write two or three directions, each with:

- a name and one line of mood ("Arcade neon: loud, fast, glowing edges");
- a display font and a body font;
- a palette of five to seven colors;
- a shape language (rounded and soft, sharp and angular, hand-drawn, pixel);
- a motion style (snappy, bouncy, calm).

Show the developer each one as a quick mockup of the title screen and the HUD, over a real frame
of the game when one exists, and let them pick. Build the mockups in code (one static HTML page
per direction is enough), or with an image generator when the developer has one
(`generators.md`). Then build every screen from the chosen one.

Avoid the default look many generated UIs share: a system sans-serif on near-black panels with
one accent color and rounded rectangles. It reads as unfinished. Even a simple game benefits
from one distinctive choice (a characterful font, a strong color pair, a frame shape from the
game's world).

## Theme tokens

Every color, font, size, radius, shadow and duration is a token, defined once:

```css
:root {
  --ui-font-display: "Lilita One", system-ui, sans-serif;
  --ui-font-body: "Nunito", system-ui, sans-serif;
  --ui-bg: #14102a;
  --ui-panel: #231b45;
  --ui-line: #4b3d8a;
  --ui-text: #f6f1ff;
  --ui-muted: #b9add9;
  --ui-accent: #ffcc33;
  --ui-good: #4fc3ff;     /* meaning colors: chosen to stay apart for color-blind players */
  --ui-bad: #ff7a2f;
  --ui-radius: 14px;
  --ui-gap: clamp(8px, 1.6vmin, 16px);
  --ui-text-size: clamp(16px, 2.2vmin, 20px);
  --ui-fast: 150ms;
  --ui-slow: 250ms;
}
```

- Screens use only tokens; no color or size written straight into a component.
- Canvas and engine UI read the same values (export them from one module for code to use).
- A token changes once and the whole UI follows, which makes themes, color-blind modes and text
  scaling cheap.
- Token values come from the game's own code. A theme or color-blind mode saved in settings picks
  one of the game's own token sets by name, checked against the list
  (`root.dataset.theme = THEMES.includes(saved) ? saved : "default"`), and a text scale is a
  number clamped to its range before it goes into a custom property. Never write a color, size,
  font or `url()` read from a save, a file or another player into a token or a `style`.
- A game that uses the Harmony SDK can match the Harmony overlay to these tokens with its
  `--mtc-*` custom properties, set on an ancestor of the SDK's container (see "Theming the
  overlay" in the harmony-sdk skill). Without the SDK, the overlay keeps Harmony's own theme.

## Fonts

- One display font for titles and big numbers, one readable body font for everything else.
  Two families at most.
- Ship them as WOFF2 with the game; don't load fonts from a third-party site at run time.
- Check the license allows embedding in a game (SIL Open Font License fonts do), and credit it.
- Check the fonts cover every language the game ships, and end the stack with `system-ui` for
  player names in any script.
- Wait for fonts to load before the title screen shows, so it never flashes a fallback.

## Palette and meaning colors

- A background, a panel, a line, text, muted text, one accent, and the meaning colors (good,
  bad, warning, and team colors if any).
- Meaning colors that stay apart for color-blind players: blue and orange rather than green and
  red; and always paired with a shape, icon or label.
- Check text contrast: at least 4.5:1 for body text, 3:1 for large text and icons.
- Test the screens in grayscale: if something important disappears, it relied on color alone.

## Shapes and surfaces

- Panels and buttons in one shape language that echoes the game (a cut corner for sci-fi, a
  wobbly hand-drawn edge for a cartoon game, a beveled frame for fantasy).
- Text sits on solid or dimmed panels, never straight on a busy scene.
- Buttons look pressable: a clear edge or fill, a hover and focus state, a pressed state.
- Theme every control the game uses: buttons, toggles, sliders, selects, text fields,
  scrollbars and tooltips. A single browser-default widget breaks the look.

## Motion

- Short and purposeful: 150 ms for hover and press, 250 ms for panels opening, longer only for
  celebrations.
- Ease out for things arriving, ease in for things leaving.
- A little life on interaction: buttons scale or brighten slightly on focus, panels slide a few
  pixels as they fade in, numbers count up.
- With reduced motion on, keep fades and drop slides, scaling and bounces.
- Never make the player wait for an animation before they can act.

## Pixel art

- `image-rendering: pixelated` on the canvas and pixel images, and scale by whole numbers (2x,
  3x), letterboxing the rest.
- A pixel font at its native size or whole multiples of it.
- Keep UI motion on the pixel grid, or it shimmers.

## HTML overlay or engine UI

| HTML/CSS overlay | Engine or canvas UI |
| --- | --- |
| Sharp text at any size, layout and wrapping for free | One rendering path; fits pixel art and in-world UI |
| Screen readers, text scaling and focus work natively | Text wrapping, focus and accessibility built by hand |
| Easy theming with tokens | Theming through the same tokens, read from code |
| Costs layout time if updated every frame | Costs draw calls; cache static text |

The usual choice: HTML for menus and most of the HUD, engine UI only for elements that live in
the world (name tags, health bars over enemies). Keep both on the same tokens.
