---
name: harmony-publish
description: Get a web game ready to upload to Harmony - relative file addresses for every engine and bundler, no service workers or browser file pickers, a script that checks the build or zip by file and line, a .zip with index.html at the top or one .html file, and a listing file for the My Creations upload form. Never uploads. Use when someone wants to publish, upload, package or zip a game for Harmony, or a game works locally but breaks when hosted.
license: MIT
compatibility: Any web game build. scripts/check_build.mjs needs Node 18 or newer and no packages.
metadata:
  harmony-docs: "https://playharmony.ai/developers/sdk.md#preparing-your-game-for-upload"
---

# Publish a web game to Harmony

Harmony hosts web games. The developer uploads a game from My Creations on Harmony, as one
`.html` file or as a `.zip` with `index.html` at the top. This skill gets the build right,
checks it, packages it, and writes a listing file with every field of the upload form filled in,
so the developer only has to copy them across. It never uploads: hand the developer the files and
tell them where to upload them.

A game doesn't need the Harmony SDK or a Game ID to be uploaded. Harmony adds its overlay
(sign-in, friends, chat, the badge and Shift+Tab) to every game it hosts, with no code. The Game
ID matters only to a game that uses the SDK (see the `harmony-sdk` skill).

Harmony's own guide is the "Preparing your game for upload" section of
https://playharmony.ai/developers/sdk.md. Read it when you can reach it, and where the two
differ, follow it.

## What changes when Harmony hosts a game

- The game runs in a frame on an address of its own, and the build is served under a folder of
  its own. Files loaded by an address starting with `/` aren't found. Load every file by a
  relative address.
- Fullscreen works as usual when the game asks for it from a click or key handler. Harmony makes
  the whole page fullscreen with the overlay above.
- The Harmony overlay releases pointer lock when it opens. Lock it again on the player's next
  click, or from `harmony.on("close")` in a game that uses the Harmony SDK.
- Downloads, `<input type="file">`, writing to the clipboard and `navigator.share` work. Reading
  the clipboard doesn't.
- The browser's own file pickers (`showSaveFilePicker`, `showOpenFilePicker`,
  `showDirectoryPicker`) don't work. Use a download and `<input type="file">` instead, or
  `harmony.files.save` and `harmony.files.open` in a game that uses the Harmony SDK.
- Service workers can't be registered, so PWA features don't work: no offline cache, no install.
- Saves in `localStorage` and `IndexedDB` belong to the game alone.
- Upload limits (size, file count) are shown in My Creations when uploading. Never assume a
  number: check there.

## Steps

1. **Read the project, then ask.** Find the engine or bundler, the build command, where the
   build lands (`dist`, `build`, `export`) and the version yourself. Then ask in one round, with
   a recommendation for each:
   - **One `.html` file or a `.zip`?** Recommended: a `.zip`. One file suits only small games
     with no assets loaded at run time.
   - **Where have you played it start to finish?** PC, a phone (and in which orientations), a
     controller, VR. This sets Supported platforms in the listing. Recommended: Supported only
     where they played it; Unknown or Not supported for the rest, as listing.md describes.
   - **Chat on or off?** Recommended: on, the form's default.
   - **The version,** only when the project has none. Recommended: `1.0.0` for a first upload.

   The title, description and tags come later, drafted from the project in step 9. If the
   developer says "you decide", use the recommendations, mark a platform Supported only if you
   played it yourself, and list the assumptions in the hand-over.
2. **Set the build to relative addresses** and turn off PWA output. Per engine:
   [references/build-settings.md](references/build-settings.md).
3. **Fix the code** the checker would flag: service worker registration, the browser's file
   pickers, clipboard reads, root-absolute `fetch("/...")` and asset paths, localhost
   addresses. Don't add the Harmony SDK to replace a file picker; a download and
   `<input type="file">` work without it.
4. **Build**, with the project's own build command.
5. **Test under a folder**, the way Harmony serves it: serve the folder above the build and open
   the build's subfolder, such as `http://localhost:8080/dist/`. Every file must load, with
   nothing missing in the network tab and no console errors.
6. **Check** the build folder:
   `node <this skill>/scripts/check_build.mjs <build folder>`, where `<this skill>` is the folder
   this file is in. Fix every ERROR. Look at each
   WARN and fix it unless it is a false alarm (a string that only looks like a path).
7. **Package**: [references/packaging.md](references/packaging.md). Zip the files inside the
   build folder, not the folder itself.
8. **Check the package** too: `node <this skill>/scripts/check_build.mjs <game.zip>`. It catches
   a zip with `index.html` one folder down.
9. **Write the listing**: `release/<game>-<version>-listing.md`, with every field of the upload
   form in the form's order: title, description, tags, supported platforms, the game file,
   media and chat. Draft them from the project, then go through them with the developer. See
   [references/listing.md](references/listing.md).
10. **Hand over**: give the developer the paths of the package and the listing, the file count
   and size the checker printed, each WARN you left and why, and these next steps: open My Creations on Harmony, fill in the
   form from the listing, upload the package, compare it with the limits shown there, then play
   it on Harmony once before sharing it.

## Rules

- Never upload, and never sign in to Harmony for the developer.
- In the listing, claim only what the game has: a platform is Supported only when it passes the
  "Supported when" test in [references/listing.md](references/listing.md), and the description
  lists only real features.
- Never state or hard-code an upload limit (the game file's size and file count). Point at My
  Creations, which shows them.
- Name the package after the game and its version, such as `star-hopper-1.4.0.zip`, so the
  developer can tell builds apart.
- Rebuild before packaging. A stale build folder is the most common reason a fix "didn't work".
- Keep the build's own structure. Don't flatten folders or rename files to make the zip tidier;
  the game's paths depend on them.

## Files

| File | Use |
| --- | --- |
| [references/build-settings.md](references/build-settings.md) | Relative addresses and PWA settings for Vite, webpack, Parcel, esbuild, Phaser, three.js, PlayCanvas, Unity and Godot |
| [references/packaging.md](references/packaging.md) | Making the `.zip` or the single `.html` on Windows, macOS and Linux |
| [references/listing.md](references/listing.md) | The upload form field by field (limits, tags, supported platforms, media, chat, new versions) and the listing file to write |
| [scripts/check_build.mjs](scripts/check_build.mjs) | Checks a build folder, `.html` or `.zip`: `index.html` at the top, service workers, file pickers, dev cheats left in, clipboard reads, root-absolute addresses, manifests, localhost. Exit code 1 on errors. `--json` for machine-readable output. |
