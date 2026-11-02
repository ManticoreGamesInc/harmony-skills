# Banner (background art and title logo)

In the upload form's words: "If we feature your game, this banner appears at the top of the Harmony site." The background art fills it, and the site puts the title logo, the description and the Play and Details buttons over its left third (at the bottom on phones). It takes two separate files, plus an optional mobile portrait when the form shows a step for it.

## Background art

A clean frame, like the thumbnail's, framed for a wide banner. Never paint over it, and keep all text out: no title, no in-canvas labels, scores or name tags.

- **Framing:** the subject center or right (about 45% to 70% across), the left third calm and fairly dark so the text over it reads. Ultrawide screens cut about 12% off the top and bottom, and phones show only a middle column about a quarter of the width (unless there is a mobile portrait, which phones show instead), so keep what matters near the center. This usually needs a camera posed for it; the thumbnail's centered frame rarely fits.
- **Size:** capture big. Set the viewport to 3840x2160 (with the driver, `viewport?w=3840&h=2160`); `freeze()` returns the canvas size. If the game caps its resolution, take what comes: anything from 1920x1080 is accepted. Put the viewport back to 1920x1080 afterwards.
- For games whose UI carries the game (see SKILL.md), capture at 1920x1080 with that UI on. The UI is sized in CSS pixels, so a 3840x2160 viewport shrinks it to a speck.
- For games with no canvas, take a page screenshot at a 1920x1080 viewport with a device scale factor of 2, which gives 3840x2160 with the UI at its normal size (see "Games with no canvas" in [capture.md](capture.md)).

```js
t.hideUi();
await t.freeze();
await t.save("bg_1");
t.resume();
```

```
python <skill>/scripts/store_media.py background --shot bg_1.png --out store-media/banner/background.webp
```

It crops to 16:9 (`--focus x,y`) at 3840x2160, or at the frame's own 16:9 size when that is smaller (never under 1920x1080; `--upscale` forces 3840x2160), and saves WebP under 10 MB.

## Mobile portrait (if the form shows it)

An optional third file, made only when the upload form shows a step for it. Phones show it instead of the background art. In the form's words, "You can crop it from the background art or make a separate picture."

- **Shape and size:** 9:16 portrait, 1440x2560 preferred, at least 1080x1920; WebP, JPEG or PNG up to 10 MB.
- **Content:** real game art, like the background art. No text, titles, logos or in-canvas labels. Games whose UI carries the game follow the same rule as their background art.
- **Framing:** the title logo, name, description and buttons sit over its lower part, so the main subject goes in the upper half and nothing important sits in the lower part.

When a 9:16 crop of the background art is at least 1080x1920 (a 3840x2160 background gives 1215x2160), crop it:

```
python <skill>/scripts/store_media.py portrait --shot store-media/banner/background.webp --focus 0.6,0.6 --zoom 1.1 --out store-media/banner/portrait.webp
```

It cuts the largest 9:16 box centered on `--focus` (kept inside the frame) and scales it to 1440x2560, or keeps the crop's own size when that is smaller (never under 1080x1920; `--upscale` forces 1440x2560). It saves WebP under 10 MB and prints where the crop sits. On a landscape frame the full-height crop can only move sideways; `--zoom 1.1` cuts a box 1/1.1 the size, which can also move up or down. A focus below the subject puts the subject higher in the portrait.

Otherwise, or when no crop puts the subject in the upper half, capture a portrait frame from the game. Set the viewport to 1440x2560 (or at least 1080x1920), pose the camera with the subject high in the frame, hide the UI as for the background art, `freeze()` and `save("portrait_1")`, then run `portrait` on that frame. For games with no canvas, a 720x1280 viewport at a device scale factor of 2 gives 1440x2560. Put the viewport back afterwards. If the game only lays out for landscape and looks wrong in portrait, use the crop.

With an image generator the developer named, the same rule applies as for the background art: it may paint the portrait's art only, never text or the title logo (see [generators.md](generators.md)).

## Title logo

1024x1024, the stylized title centered with its emblem, transparent, at most 10 px from the nearest edge, readable on dark and bright art.

A wide one-line lockup fills only a strip of the square, so make a square version (see title-logo.md):

- **Code-built:** the same config with `"layout": "square"`. A title of several words may stack between whole words (`"lines"`); a one-word title stays on one line and the backing, an emblem and the tagline fill the height. `"backing": "badge"` makes a crest that fills a square well.
- **Image generator:** the chosen lockup as the reference, recomposed for a square with a taller backing or emblem and the tagline below. Say "on one line, never split a word" in the brief, and reject a result that splits one.
- **Colors:** the logo sits over the dark left side of the banner, under the site's fade. Give it a light face with a dark outline, or the reverse, rather than the game's darkest colors; a dark face with a dark outline almost disappears there. See "Colors for the square banner logo" in [title-logo.md](title-logo.md).

Then fit it:

```
python <skill>/scripts/store_media.py logo --title title_square.png --out store-media/banner/logo.png
```

It trims the logo, bakes in a dark outline (`--outline`) and drop shadow (`--shadow`) so it reads on any art, centers it with `--pad` (6 px, at most 10) to the nearest edge, and prints each edge's gap. It warns when the logo fills less than 40% of the square.

Check it on dark before the full sheet:

```
python <skill>/scripts/store_media.py banner-sheet --logo store-media/banner/logo.png --out logo_check.png
```

With only `--logo`, the sheet shows the logo alone on dark, bright and blue. If the face fades into the dark tile, change its colors and make the logo again.

## Check and record

```
python <skill>/scripts/store_media.py banner-sheet --background store-media/banner/background.webp --portrait store-media/banner/portrait.webp --logo store-media/banner/logo.png --out banner_sheet.png
```

Leave out `--portrait` when there is no mobile portrait. The sheet shows the art at 16:9, 16:10, 21:9 and phone shapes, with a rough stand-in for the site's fade, logo, text and buttons, and the logo alone on dark, bright and blue. With `--portrait`, the phone tile shows the portrait, and a second 9:16 tile has a dashed line across its middle. Check that:

- the subject stays clear of the left third and shows in every shape;
- the logo reads on all three backings;
- in the portrait, the subject sits above the dashed line, nothing important sits in the lower part under the stand-in text and buttons, and there is no text anywhere.

Show the developer the sheet.

Write `store-media/banner/banner.json`: `moment`, `backgroundSize`, `logoSource` (and the lockup config or image brief), `gameVersion`, `date`, and with a mobile portrait, `portraitSize` and `portraitSource` (cropped from the background art with its focus and zoom, or the captured frame).
