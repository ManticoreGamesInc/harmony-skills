# Text and layout

Fonts, right-to-left languages, player names, longer text, and canvas text. The examples are
TypeScript and CSS; write them in the game's own style.

## Contents
- Fonts and scripts
- Right-to-left languages
- Player names and other text from players
- Text that grows
- Canvas text
- Upper case
- The HTML loading screen

## Fonts and scripts

A display font made for a game almost always covers Latin only. Anything it doesn't cover
falls back to another font, or shows as boxes.

- Keep the game's display font for the languages it covers, and give every other script a
  matching fallback in the same stack:

  ```css
  :root {
    --font-ui: "Game Display", "Noto Sans", system-ui, sans-serif;
  }
  :lang(ja) { --font-ui: "Game Display", "Noto Sans JP", system-ui, sans-serif; }
  :lang(ko) { --font-ui: "Game Display", "Noto Sans KR", system-ui, sans-serif; }
  :lang(zh-Hans) { --font-ui: "Game Display", "Noto Sans SC", system-ui, sans-serif; }
  :lang(ar) { --font-ui: "Noto Sans Arabic", system-ui, sans-serif; }
  :lang(he) { --font-ui: "Noto Sans Hebrew", system-ui, sans-serif; }
  body { font-family: var(--font-ui); }
  ```

- Chinese, Japanese and Korean fonts are several megabytes. Load them only when that language
  is chosen, subset them to the characters the strings use when the text is fixed, and keep
  `system-ui` last for characters outside the subset (player names).
- Check Cyrillic, Greek and Vietnamese too: many Latin display fonts lack them.
- Line height of at least 1.3 to 1.4 for scripts with tall marks (Thai, Vietnamese, Arabic).
- No letter spacing on Arabic: it breaks the joined letters.
- Canvas text uses the same font stack; wait for `document.fonts.load()` of each font before
  drawing, or the first frames draw in a fallback.

## Right-to-left languages

Arabic, Hebrew, Persian and Urdu read right to left, and the interface mirrors.

- Set `dir` on the page from the language (`document.documentElement.dir`), so the browser lays
  out text and flex rows right to left by itself:

  ```ts
  function isRightToLeft(code: string): boolean {
    const locale = new Intl.Locale(code) as any;
    const info = locale.getTextInfo?.() ?? locale.textInfo;
    if (info) {
      return info.direction === "rtl";
    }
    return ["ar", "he", "fa", "ur"].includes(locale.language);
  }
  ```

- Use logical CSS properties: `margin-inline-start`, `padding-inline-end`,
  `inset-inline-start`, `text-align: start`, `border-inline-start`, instead of left and right.
  Then most menus mirror with no extra work.
- Mirror icons that point along the reading direction: back and next arrows, progress, a
  "continue" chevron. Don't mirror icons that don't (play, a clock, a checkmark, logos).
- Numbers stay left to right inside right-to-left text; the browser does this.
- Leave the game world alone: a platformer that scrolls right stays that way. Mirror the menus
  and the HUD layout, and decide per element for the HUD.
- Canvas: set `ctx.direction = "rtl"` and use `textAlign = "start"` and `"end"`, not
  `"left"` and `"right"`.

## Player names and other text from players

Names from Harmony (`displayName`, a friend's `currentGame`), messages in the game's own chat,
and anything players type can be in any script, in either direction, whatever language the game
is in.

- Never translate them, and always show them as text (`textContent` or the engine's plain text
  object with rich text off), never HTML, also when they sit inside a translated sentence.
- Clean names before showing them: keep letters, marks, digits, spaces and `.`, `_`, `-`, which
  drops bidi overrides (U+202E), zero-width characters and line breaks, and cap the length by
  code point (`Array.from(name).slice(0, 16)`), so a name can't reverse or break the text
  around it. Cleaning removes characters; it never rewrites or translates what's left.
- Isolate them so a right-to-left name doesn't reorder the sentence around it:
  - HTML: `<bdi>` around the name, or `dir="auto"` on the element that holds only the name.
  - Canvas and engines: wrap the name in the Unicode isolate marks U+2068 and U+2069
    (`"\u2068" + name + "\u2069"`) before putting it in a sentence.
- The font stack ends in `system-ui` so names in any script show, even in a Latin-only game.

## Text that grows

Translations are often longer than English: German and French about 30% for sentences, and
short labels can double ("Play" becomes "Spielen", "Play again" becomes "Jouer à nouveau"). Chinese, Japanese and
Korean are usually shorter but need taller lines.

- No fixed widths sized to the English text. Buttons and panels grow with their label, up to a
  maximum, then wrap.
- Where space is fixed (a HUD chip, a tab), shrink the text down to a minimum size, then wrap,
  and only as a last resort cut it with an ellipsis and show the full text on focus or hover.
- Give each string's note the room it has ("about 12 characters"), so translators can aim for
  it.
- Check every screen in the longest language and in the pseudo-language before release.

## Canvas text

Canvas and engine text don't wrap by themselves. Wrap by words, using `Intl.Segmenter`, which
also finds word breaks in Chinese and Japanese, where there are no spaces:

```ts
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, language: string): string[] {
  const words = [...new Intl.Segmenter(language, { granularity: "word" }).segment(text)].map((s) => s.segment);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line + word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line.trimEnd());
      line = word.trimStart();
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line.trimEnd());
  }
  return lines;
}
```

- Measure with the same font that draws, after it has loaded.
- Cache wrapped lines per string and width; don't wrap every frame.
- Fit to a box: try the normal size, step the font size down to a minimum, then wrap.
- Engines with their own text objects (Phaser, PixiJS, Babylon GUI) have word-wrap options;
  check they handle text without spaces, and fall back to the segmenter when they don't.

## Upper case

`text-transform: uppercase` follows the page's `lang`, so it is right for Turkish dotted `i`
and German `ß`. In code, use `text.toLocaleUpperCase(language)`, never plain `toUpperCase()`.
Don't upper-case Chinese, Japanese or Korean styling at all; it has no effect, and the design
may need another way to stand out (weight, color, size).

## The HTML loading screen

The loading screen shows before the language files load. Either keep it free of words (the
game's logo and a progress bar), or put its two or three strings for each language inline in
`index.html` and pick them with `navigator.language` in a small inline script.
