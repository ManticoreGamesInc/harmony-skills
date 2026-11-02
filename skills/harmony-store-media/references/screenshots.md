# Store screenshots

Pictures of the game as a player sees it, as many as the upload form shows, UI included, shown in order under the thumbnail. The thumbnail is the hook; these show what else the game has.

## Shot list

Write the list first: one line per screenshot the form takes, each a screen and the moment on it, in page order. Use fewer only when the game has less to show.

1. The best gameplay moment with the HUD. Use a different angle or beat from the thumbnail.
2. The core loop mid-action.
3. The main menu or hub.
4. onward: what makes the game more than its loop: modes, levels with their UI, tutorials, progression (shop, unlocks), online lobby, results, stats.

Each shot shows something no other shot shows. Put the strongest first and never a menu first.

When redoing some slots, keep the others and pick subjects that still add to the set.

## Orientation

Use one orientation for the whole set: landscape 1920x1080 for desktop games, portrait 1080x1920 only for phone-first games (with the phone layout on screen). The page crops each to its slot, so never mix the two.

## Capture with the UI on

```js
t.showUi();
await t.freeze();
await t.withUi();
await t.save("screen_1");
t.resume();
```

The saved PNG is the canvas size (1920x1080 times the device pixel ratio). Scale it to exactly 1920x1080 when copying it to `store-media/screens/<n>.png`.

A game with no canvas (drawn in HTML, CSS or SVG) has nothing for `freeze()` and `withUi()` to work on. Take page screenshots instead, at a 1280x720 viewport with a device scale factor of 1.5, which gives 1920x1080 pictures with the layout filling the frame. See "Games with no canvas" in [capture.md](capture.md). The tips below about scrollbars and transitions apply to those screenshots too, done in memory with a style tag. Scrolling works normally in a page screenshot.

- Menus with fixed-width panels fill only a small middle of a 1920x1080 frame. Capture those at a 1280x720 or 1600x900 viewport (still 16:9) so the panel fills the frame, and note the viewport.
- Compare the capture with a browser screenshot of the same screen. Text that wraps or clips only in the capture is a `withUi()` limit.
- `withUi()` drops scroll positions: to show a lower part of a scrolling screen, shift its content in memory (`el.style.transform = "translateY(-400px)"`) instead of scrolling. It draws scrollbars as stray lines, so add `*{scrollbar-width:none} ::-webkit-scrollbar{display:none}` in memory before menu shots. It doesn't render `backdrop-filter` blur.
- Disable CSS transitions (`*{transition:none!important}`) in memory once a screen has settled, so no panel is caught mid-slide.

## Clean, real states

- Highest graphics quality, no debug panel, no fps counter, no build or dev stamp, no toast caught mid-fade.
- Real content, never placeholder text.
- Nothing personal: no real names (set a neutral display name like "Player" in memory), emails, file paths or room codes from real sessions.

## Check and record

- Look at every shot at 480x270: it reads, no text is clipped or overlapping, and no two shots are near-duplicates. Retake any that fail.
- Write `store-media/screens/screens.json`, keyed by slot number: `{ "1": { "caption", "shows", "size", "gameVersion", "date" } }`. The caption is one short line a store page could show. When redoing some slots, change only their entries.
- Make a contact sheet of the set in order (a 2x4 grid) and show it to the developer.
