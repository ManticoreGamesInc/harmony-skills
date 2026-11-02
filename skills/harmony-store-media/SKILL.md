---
name: harmony-store-media
description: Make the media for a game's Harmony page from the running game - a titled 1280x720 thumbnail, a title logo in the game's own font, store screenshots, a muted 6-second preview movie, the featured banner and an optional mobile portrait, each sized to Harmony's upload rules. Works for canvas, WebGL and HTML games in any engine. Use when a developer wants a thumbnail, cover image, title logo, banner, screenshots, a preview or hover clip, or all the store media for Harmony.
license: MIT
compatibility: Needs a browser page the agent can run JavaScript in (its own browser tool, or Chrome or Edge through the bundled Playwright driver; games with no canvas need Playwright), Node 18 or newer, Python 3 with Pillow, and ffmpeg for the preview movie. Title lockups render with an installed Chrome, Edge or Chromium.
---

# Harmony store media

This skill makes the pictures and the clip a game's page on Harmony shows. Each file is a real frame from the running game, or the game's title drawn in its own font, so the store page shows the game a player will get.

It works for games that draw to a canvas, in any engine, and for games built from HTML, CSS and SVG with no canvas (see "Games with no canvas" in [references/capture.md](references/capture.md)). The game doesn't need the Harmony SDK.

`<skill>` below is the folder this file is in.

## What it makes

Put everything in a `store-media/` folder at the game's root. Keep that folder out of the game's build, so it doesn't end up in the upload.

| File | What it is |
| --- | --- |
| `thumbnail.png` | 1280x720 thumbnail with the title on it |
| `screenshot.png` | the same frame without the title |
| `title.png` | the transparent title logo, trimmed |
| `screens/1.png`, `screens/2.png`, ... | store screenshots with the game's UI, in page order, as many as the form shows |
| `preview.mp4` | the card's preview movie: 1280x720, at most 6 s and 1.0 MB, no audio |
| `banner/background.webp` | banner art: 3840x2160 (at least 1920x1080), no text |
| `banner/portrait.webp` | optional banner mobile portrait: 9:16, 1440x2560 (at least 1080x1920), no text, only if the form shows it |
| `banner/logo.png` | banner title logo: 1024x1024, transparent |
| `*.json` beside each piece | how it was made: moment, title source, sizes, game version, date |

## Harmony's upload rules

Developers upload these on the game's page in My Creations on Harmony. These are the rules the upload form gave when this skill was written. **The limits shown in My Creations win where they differ**, so check the form when you can. If the form doesn't show a step for a piece yet, that piece can wait.

| Upload | Rules |
| --- | --- |
| Thumbnail | 16:9 picture: PNG, JPEG, WebP, GIF, AVIF or BMP |
| Screenshots | up to the number the form shows, shown in this order on the game's page and cropped to landscape 16:9 or portrait 9:16 |
| Preview movie (if the form shows it) | plays muted and looping over the game's card while a player points at it; MP4 or WebM, 16:9, at most 6 s and 1 MB |
| Banner background art (optional) | 16:9, 3840x2160 preferred, at least 1920x1080; WebP, JPEG or PNG up to 10 MB; no text, titles or logos. The title, description and buttons sit over the left third, so the subject goes center or right. Ultrawide screens cut the top and bottom, phones cut the sides |
| Banner mobile portrait (optional, if the form shows it) | 9:16, 1440x2560 preferred, at least 1080x1920; WebP, JPEG or PNG up to 10 MB; shown instead of the background art on phones; cropped from the background art or a separate picture; no text, titles or logos. The title logo, name, description and buttons sit over its lower part, so the main subject goes in the upper half |
| Banner title logo (optional) | 1024x1024, PNG or WebP, transparent; the stylized title centered with any emblem; at most 10 px of empty space to the nearest edge; readable on dark and bright art |

In the form's words: "If we feature your game, this banner appears at the top of the Harmony site."

## Decide what to make

- "All", "everything", "store media", or a list ending in "etc": make the full set (thumbnail and title logo, screenshots, preview movie, banner).
- A request that names pieces: make only those.
- Otherwise, look in `store-media/` first, say in one line what's there, and ask which pieces to make (in the round below).

Each piece can be made or redone on its own later.

## Look in the project first

Find these yourself; don't ask for them:

- The game's title exactly as the game spells it (title screen, page title, `package.json`, README).
- Its look: the display and UI fonts (font files in the project or the CSS) and the main colors.
- How to run it: the dev server command, or a static server over the web build. Use a port nobody else is using.
- Whether it is phone-first: a portrait layout, touch controls, or Mobile listed as its main platform.

## Ask the developer first

Ask in one round, with a recommendation for each:

- **Which pieces?** Only when the request doesn't say. Recommended: only what's missing when `store-media/` has files, the full set otherwise.
- **"Do you have an image generator set up? (default: none)"** For example OpenAI's image models through Codex or the API, Gemini, a local ComfyUI or Stable Diffusion, or any tool that outputs a PNG. One can upgrade the title logo and paint the banner background art; screenshots and the preview movie are always real captures. Never scan for tools. With one, follow [references/generators.md](references/generators.md); without one, everything here still works.
- **The tagline for the logo:** 2 to 4 words of genre or hook. Recommended: one you draft from the game's genre and core loop. Never invent claims like "#1" or "award-winning".
- **The title's spelling,** only when the sources disagree. Recommended: the title screen's spelling.
- **Screenshot orientation,** only when the game plays on phones. Recommended: landscape, unless the game is phone-first (see [references/screenshots.md](references/screenshots.md)).

If the developer says "you decide", use the recommendations, with no image generator, and list them as assumptions in the report.

## While you work

- Ask before changing the game's code or saved settings. Do every capture tweak (hidden debug panels, a posed camera, muted volume) in memory in the running page.
- Don't commit unless the developer asks.

## UI that carries the game stays in

In word games (word search, crosswords, anagrams) the word list or letter rack is the game, and a grid without its list reads as random letters. The same goes for any game whose core state lives in the HTML UI, such as a card hand or a target to match, and for games with no canvas at all, where the HTML is the whole game. For these games keep that UI on for the thumbnail, the preview movie and the banner art, and hide only what isn't the game (pause buttons, toasts, fps counters). Note it in the `.json`.

## Steps

Skip the steps for pieces you aren't making.

1. **Open the game and load the capture script.** Run the capture server, open the game in a browser on the machine's real GPU, and load `capture.js` into the page. See [references/capture.md](references/capture.md) for the server, the in-page calls, the Playwright fallback, and what to do when frames come back blank. A game with no canvas skips `capture.js` and uses page screenshots and Playwright's video recorder, as that file's "Games with no canvas" section says.
2. **Find the moment.** Play the game (or let its bots play) to the frame that sells it: a hit with particles on screen, a near-win, a full board. Leave calm space where the title will go. Save 2 to 4 candidates with the UI hidden (or, when the UI carries the game, with only the non-game parts hidden) and pick the best at card size (320x180).
3. **Make the title logo.** Use the game's own logo, or build one in code with `lockup.html`, and optionally upgrade it with an image generator. See [references/title-logo.md](references/title-logo.md).
4. **Compose the thumbnail:**

   ```
   python <skill>/scripts/compose_thumbnail.py --shot <best frame> --title <title png> --out store-media/thumbnail.png --clean-out store-media/screenshot.png --title-out store-media/title.png --anchor center
   ```

   Keep the important part of the thumbnail away from its edges, where it can be covered or cropped (`--top-margin`, default 0.3, keeps a title placed at the top clear of the edge). Check the result at 320x180: the title reads at a glance and the scene still shows. Raise `--scrim` or `--outline` when the title blends in. Move the crop with `--focus x,y` rather than shrinking the title. Write `store-media/thumbnail.json`: `moment`, `titleSource`, `sizes`, `gameVersion`, `date`.
5. **Store screenshots.** See [references/screenshots.md](references/screenshots.md).
6. **Preview movie.** See [references/preview-movie.md](references/preview-movie.md).
7. **Banner.** The background art, the title logo, and the mobile portrait when the form shows it. See [references/banner.md](references/banner.md).
8. **Report and clean up.** List every file made, with sizes, the screenshot captions in order, and the movie's length and bytes. Show the developer the thumbnail, a contact sheet of the screenshots and the banner check sheet. Then stop the capture server and any browser or game server you started, and put back anything you changed in memory. Ask before deleting the work folder of candidates and takes.

## Scripts

| Script | Does |
| --- | --- |
| `capture_server.mjs` | serves `capture.js` and saves frames and takes the page posts to it |
| `capture_client.js` | the in-page half: hide the UI, freeze a frame, add the UI back, record the canvas |
| `drive_chrome.mjs` | Playwright fallback: opens the game in Chrome or Edge and runs commands sent over HTTP; `--scale`, `--record` and `--headless` cover games with no canvas |
| `lockup.html`, `render_lockup.mjs` | the code-built title lockup, rendered to a transparent PNG with headless Chrome or Edge |
| `compose_thumbnail.py` | crops a frame to 16:9 and lays the title over it with a scrim, outline, shadow and glow |
| `store_media.py` | `preview`, `take-sheet`, `background`, `portrait`, `logo`, `banner-sheet`, and `key` (makes a solid background transparent) |

Install Pillow with `pip install pillow`. The preview movie needs `ffmpeg` and `ffprobe` on the PATH.
