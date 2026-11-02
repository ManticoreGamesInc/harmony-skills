# Preview movie (6 s, 1.0 MB, muted)

The movie plays on a loop, muted, while a player points at the game's card. Players see it at about 320x180 for a second or two, so one clear beat of the core loop works better than a tour: a hit, a save, a combo, a piece dropping into place. Keep the camera steady and the subject big. No menus, no text, no fade to black. Nobody hears it, so the action has to read without sound.

1. Set up as for the thumbnail: 1920x1080 viewport, highest quality, muted, debug panels and fps counter off. The take records only the game canvas, so the HTML HUD stays out on its own. HUD drawn inside the canvas stays in. A game with no canvas (drawn in HTML, CSS or SVG) records its takes with Playwright's video recorder instead, zoomed in memory so the game fills the frame: see "Games with no canvas" in [capture.md](capture.md). Steps 3 to 6 work the same on those takes.
2. Record 2 or 3 takes of 10 to 20 s around the beat:

   ```js
   t.startRecording(60);
   // drive the game: input, bots, a posed camera
   await t.stopRecording("take_1");
   ```

   The result's `fps` is how often the page drew while recording, so it shows the display's refresh rate (60, 120, 144). Under about 20 means the page stopped drawing (see capture.md), and an empty take throws an error. For games whose UI carries the game, use `t.startRecording(60, { ui: true })`.
3. Pick the 6 seconds from a contact sheet of the take (a frame every 0.5 s with its time):

   ```
   python <skill>/scripts/store_media.py take-sheet --input take_1.webm --out take_1_sheet.png
   ```

4. Cut and squeeze it:

   ```
   python <skill>/scripts/store_media.py preview --input take_1.webm --start 3.5 --out store-media/preview.mp4
   ```

   It crops to 16:9 (`--focus x,y` moves the crop), scales to 1280x720 at 30 fps, drops the audio, and runs a two-pass H.264 encode under 1,000,000 bytes (`--max-bytes`), lowering the bitrate until the file fits. `--loop 0.4` (the default) crossfades the last 0.4 s into the start so the loop has no jump; `--loop 0` gives a hard cut when the beat ends cleanly. An `.webm` output gives VP9. If a busy scene looks blocky at 1 MB, try `--size 960x540` or a calmer beat.

   The crossfade reads extra footage: the take needs `--duration` plus `--loop` seconds after `--start` (6.4 s with the defaults). A clip that starts at 3.5 s needs a take of at least 9.9 s. When `--start` is too late for that, the script moves it earlier and prints a note with the new start; use that start in `preview.json`. A take shorter than `--duration` plus `--loop` stops with an error.
5. Check it: run `take-sheet` on `store-media/preview.mp4` and look at it. The script prints the size, length and bytes. Show the developer the file.
6. Write `store-media/preview.json`: `take`, `start`, `duration`, `bytes`, `shows` (one line), `gameVersion`, `date`.

An existing gameplay clip also works as `--input`, but card previews read better without the UI, so record a fresh take when you can. Games whose UI carries the game, including games with no canvas, keep that UI in the take.
