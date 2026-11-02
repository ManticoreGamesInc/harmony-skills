# Packaging

Harmony takes one `.html` file, or a `.zip` with `index.html` at the top. The most common
mistake is zipping the build folder itself, which puts `index.html` one folder down. Zip the
files inside it.

Name the package after the game and its version, such as `star-hopper-1.4.0.zip`, and put it
outside the build folder (a `release/` folder works), since the next build may empty the build
folder.

## A .zip

From the project folder, with the build in `dist`:

Windows: use the Python line below. Windows PowerShell 5.1's `Compress-Archive` writes paths with
`\` separators, which break on other systems (PowerShell 7's is fine, with `-Path dist\*` so it
zips the contents, not the folder). The build checker flags a zip with `\` paths.

macOS and Linux:

```bash
mkdir -p release
(cd dist && zip -r -X ../release/star-hopper-1.4.0.zip .)
```

Any system, with Python:

```bash
python -c "import shutil; shutil.make_archive('release/star-hopper-1.4.0', 'zip', 'dist')"
```

`make_archive` zips the contents of `dist`, and adds `.zip` itself.

Leave out files the game doesn't need: source maps (`*.map`) unless the developer wants them,
`.DS_Store`, `Thumbs.db`.

Then check the zip:

```bash
node <this skill>/scripts/check_build.mjs release/star-hopper-1.4.0.zip
```

## One .html file

For small games, one file is simplest: every script, style, image and sound inlined.

- **Vite:** add `vite-plugin-singlefile`, keep `base: "./"`, and build. Assets the game loads at
  run time with `fetch` or `new Audio` aren't inlined: import them so Vite can inline them, or
  turn them into data URLs.
- **A hand-written game:** put the scripts and styles inside the page, and images and sounds as
  `data:` URLs.

Check it the same way:

```bash
node <this skill>/scripts/check_build.mjs release/star-hopper-1.4.0.html
```

Inlining makes the file bigger than the sum of its assets (base64 adds about a third), so
compare its size with the limits shown in My Creations, and switch to a zip if it's too big.
