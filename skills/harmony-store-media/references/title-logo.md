# Title logo

The title catches the eye on a store page, so it gets a finished logo lockup: the title in heavy display lettering with depth and an outline, a small tagline, and a backing shape from the game's world. Try these sources in order.

Two rules hold for every source:

- **Spell it exactly** as the game does, capitals included. Check every letter of the title and the tagline.
- **Never break a word across lines.** A one-word title stays on one line, in every layout. A title of several words may stack only between whole words, and only in the square banner logo.

## 1. The game's own logo

- A logo file in the project (title screen art, a loading-screen image, press kit). Use it if it's transparent or can be keyed (see step 3).
- A title drawn in HTML and CSS on the game's menu. Capture only that element on a transparent background:

  ```js
  await t.captureElement(".title", 4);
  await t.save("title_raw");
  ```

  This only works for HTML titles, and it works on pages with no canvas too. A title drawn inside the game canvas can't be lifted out.

## 2. Build it in code (the default)

`scripts/lockup.html` draws the lockup as SVG text in the game's font, so the spelling is always right and no AI tool is needed. Write a config file and render it:

```
node <skill>/scripts/render_lockup.mjs --config lockup.json --out title_raw.png
```

It finds Chrome, Edge or Chromium on the machine (or takes `--browser <path>` or `CHROME_PATH`) and writes a transparent PNG: 2400x1300 for `"layout": "wide"`, 2048x2048 for `"square"`. Paths in the config are relative to the config file. A font that fails to load stops the render with an error, instead of quietly falling back.

```json
{
	"title": "Star Hopper",
	"tagline": "A Comet-Dodging Space Race",
	"layout": "wide",
	"backing": "sign",
	"metal": "chrome",
	"bulbs": true,
	"streak": true,
	"emblem": null,
	"slant": 0,
	"font": { "file": "fonts/archivo-italic.woff2", "weight": 900, "style": "italic", "stretch": "72%" },
	"taglineFont": { "file": "fonts/inter-tight.woff2", "weight": 900 },
	"colors": {
		"ink": "#0e2233",
		"faceTop": "#ffe9a8", "faceMid": "#ffa21f", "faceLow": "#e8431a",
		"side": "#b8380f", "sideDark": "#7a1f08",
		"accent": "#ff6a2b", "glow": "#ffd27a",
		"backingTop": "#1d3d5c", "backingBottom": "#0e2233",
		"ribbon": "#1fb5a7", "ribbonText": "#f7f3ec"
	}
}
```

A field left out of the config takes its default.

| Field | Values | Default |
| --- | --- | --- |
| `title` | the title, spelled and capitalized exactly as the game shows it | `"MY GAME"` |
| `tagline` | the ribbon text under the title; empty for no ribbon | `""` |
| `layout` | `wide` for the thumbnail, `square` for the banner logo | `wide` |
| `lines` | square only: the title split into lines of whole words, such as `["Star", "Hopper"]`. The render fails if the lines aren't the title's words in order | `null` (one line) |
| `backing` | `sign` (rounded sign with a metal rim), `plaque` (chamfered plate with bolts), `badge` (a slab leaning forward when wide, a crest when square), `none` | `sign` |
| `metal` | `chrome` or `gold` for rims, bolts and chains | `chrome` |
| `bulbs` | marquee lights around a `sign` or `plaque` | `false` |
| `streak` | a glowing streak with a comet head under the title, for speed | `false` |
| `emblem` | optional transparent PNG drawn above the title: a character, a piece, an icon from the game. Trim it to its edges first, or its empty margin leaves a gap above the title | `null` |
| `slant` | degrees of forward lean, for an upright font in a fast game | `0` |
| `font` | the title font: `file` (woff2, woff, ttf or otf), `family` fallback, `weight`, `style`, `stretch`, `letterSpacing` and `wordSpacing` in em, `uppercase` | no file, `family` Impact then Arial Black, `weight` 900, `style` `normal`, `stretch` `100%`, `letterSpacing` 0.01, `wordSpacing` 0.12, `uppercase` `false` |
| `taglineFont` | the same fields for the tagline | no file, `family` Arial Black then Arial, `weight` 800, `style` `normal`, `stretch` `100%`, `letterSpacing` 0.06, no `wordSpacing`, `uppercase` `false` |
| `colors` | the face gradient (`faceTop`, `faceMid`, `faceLow`), the extrusion (`side`, `sideDark`), the outline (`ink`), effects (`accent`, `glow`), the backing (`backingTop`, `backingBottom`), the ribbon (`ribbonTop`, `ribbon`, `ribbonBottom`) and its text (`ribbonText`) | an orange face on a navy sign with a teal ribbon: `ink` #101828, `faceTop` #fff1b8, `faceMid` #ffc233, `faceLow` #ff7a1a, `side` #b33c0c, `sideDark` #5c1a04, `accent` #ff7a1a, `glow` #ffd27a, `backingTop` #24466b, `backingBottom` #101828, `ribbonTop` #5fe0d2, `ribbon` #1fb5a7, `ribbonBottom` #0d6f67, `ribbonText` #ffffff |

`uppercase` is off by default, so the lockup draws the title and tagline exactly as written in the config. Set `"uppercase": true` only when the game itself shows its title in capitals, or write the title in capitals in `title`.

Fill it from the game: its display font for the title, its UI font for the tagline, and its palette, a little brighter and more saturated than the scene so the logo stands out from it. Make 2 or 3 versions that differ in backing and colors, compose each on the chosen frame at card size, and let the developer pick by eye. If the developer said "you decide", pick the one that reads best at card size and say why in the report.

Use the game's own font files, or an open-licensed font (such as one from Google Fonts). Check that the font's license allows using it in images.

### Colors for the square banner logo

The banner logo sits over the left of the banner art, which the banner rules keep calm and fairly dark, under the site's fade (see [banner.md](banner.md)). A face in the game's own dark colors (graphite, navy, deep green) almost disappears there, even with the dark outline that `store_media.py logo` bakes in. So for the square lockup:

- Use a light face with a dark outline: light `faceTop`, `faceMid` and `faceLow`, and a dark `ink`. This is the safe choice.
- Or the reverse: a dark face with a light `ink` outline thick enough to read. The baked dark outline then rings the light one, so it still reads on bright art.
- Check the logo on dark before the full check sheet. Run `store_media.py logo`, then `store_media.py banner-sheet --logo store-media/banner/logo.png --out logo_check.png`, which shows only the logo on dark, bright and blue. If the face fades into the dark tile, change the face colors and render again.

## 3. Upgrade it with an image generator (optional)

Only when the developer said they have an image generator set up, and following the ground rules in [generators.md](generators.md): no paid calls without their yes, no API keys, commercial terms checked, and the source recorded.

A painted logo can carry more material detail than the code-built one. Use the code-built lockup as the reference image, so the spelling and layout carry over.

Write the brief to `store-media/title-brief.md` and attach the code-built PNG. If you can run the tool the developer named, run it yourself. Otherwise hand the brief to the developer to run in that tool and drop the result back. The brief covers:

- the exact text: "the title reads exactly Star Hopper on one line, with these capitals" (spell it out letter by letter as well), plus the tagline, and "no other words, numbers or letters"
- keep the reference's layout and lettering, and render it at finished key-art quality: deep extrusion, beveled edges, glossy or metallic faces, a thick dark outline, a cast shadow
- the game's materials and palette (name the hex colors and the real materials, such as enamel, chrome, neon glass or teak) and one effect from the game (a puck streak, sparks, splashes)
- the backing shape from the game's world (a marquee sign, a nameplate, a carved board, a crest)
- "on a flat solid #ff00ff background, nothing else in the background, no scene, no characters, no watermark". Most generators can't make true transparency. Pick a key color the logo doesn't use: green (`#00ff00`) when the logo has pinks or purples.

Then key out the background and trim:

```
python <skill>/scripts/store_media.py key --input generated.png --out title_raw.png --trim
```

It reads the background color from the corners (or `--color #00ff00`). For a saturated key it makes each pixel as transparent as the amount of key color it carries, so soft shadows and glows survive. It then takes the key color back out of the edge pixels so no colored fringe is left. Other background colors fade by distance (`--tolerance`, `--softness`).

Check the result letter by letter before using it. Regenerate when a letter is wrong, a word is split, or extra text appears. If it keeps failing after two tries, use the code-built lockup.

## Record it

Note the source in `thumbnail.json` and `banner/banner.json`: the game's file, the captured element, the lockup config, or the image tool and its brief.
