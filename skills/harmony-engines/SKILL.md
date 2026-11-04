---
name: harmony-engines
description: Get a Unity or Godot game onto Harmony - a lean, single-threaded web build packaged for upload and, only if the game needs Harmony features, a small bridge so C# or GDScript can use the player's name, friends, the overlay and files, with an editor fake for testing. Use when a Unity WebGL or Godot web build should run on Harmony, is too big, slow or broken when hosted, or needs Harmony features.
license: MIT-0
compatibility: Unity 2022.3 or newer with WebGL (Web) build support; Godot 4.3 or newer with the Web export templates. The bridge loads the SDK from Harmony's CDN and needs no build tools; bridging other JavaScript modules needs Node 18 or newer and npm. Guidance only; no scripts.
---

# Game engines on Harmony

Harmony hosts web games, and game engines export to the web. This skill covers engines whose
games aren't written in JavaScript: a web build that works when hosted, and Harmony's features
from the engine's own language through a bridge. It is guidance: write the settings and code
into the game's own project.

**Which engines:** Unity ([references/unity.md](references/unity.md)) and Godot
([references/godot.md](references/godot.md)). Games built with JavaScript engines (Phaser,
Three.js, PixiJS, Babylon.js, PlayCanvas, plain canvas) don't need a bridge: they import the
Harmony SDK and call it directly, as Harmony's SDK docs show. Unreal Engine 5 has no official
web export, so this skill doesn't cover it.

Harmony's docs for agents are at https://playharmony.ai/developers/sdk.md (called sdk.md below).
Read them when you can reach them; where they differ from this skill, follow them. The SDK is in
preview: Harmony adds calls and options often and keeps updates compatible with existing games
where it can, but an update may still change or remove a call. The bridge loads the SDK from
Harmony's loader script, which serves the current version, so the game stays up to date without
a rebuild; when sdk.md changes, check the bridge's calls against it.

## Steps

1. **Look, then ask** in one round. Read the engine and its version from the project
   (`ProjectSettings/ProjectVersion.txt` in Unity, `project.godot` in Godot) instead of asking;
   ask only when there is no project yet. Then ask:
   - **Harmony features, or only hosting?** The player's name, friends, a button that opens the
     overlay or signs in, pausing while the overlay is open, files. Recommended: only hosting,
     unless the game's design uses one of these; the bridge can be added later.
   - **The Game ID** (from My Creations), only for a standalone real game. Hosted games and the
     fake attach without it. Never invent one; if they don't have it yet, use the placeholder `YOUR_GAME_ID`
     and list it as open when you finish.

   If the developer says "you decide", take the recommendation and say so.
2. **Export settings** from the engine's reference.
3. **The bridge**, only if the game wants Harmony features: the shared JavaScript file
   ([references/bridge-js.md](references/bridge-js.md)), loaded after Harmony's loader script in
   the build's page, then the engine's side from its reference.
4. **The editor fake**, only with the bridge, so the features can be built and tested in the
   engine without a web build.
5. **Pause and text:** with the bridge, pause on the overlay opening, and show names with rich
   text or BBCode off. Without it, the game isn't told when the overlay opens, but the page
   loses focus: pause when the game loses focus (Unity's `OnApplicationFocus(false)`, Godot's
   `NOTIFICATION_APPLICATION_FOCUS_OUT`) and let the player resume.
6. **Test** as in [Testing](#testing), then **package**: zip what's inside the build folder so
   `index.html` is at the top of the zip.
7. **Hand over:** tell the developer the zip's path and the settings you changed. With the
   bridge, add which features it has, whether a standalone real game still needs its Game ID, and that the
   loader script keeps the SDK current, so they only need to check sdk.md for new calls the game
   could use. They upload the zip from My Creations; a game without the bridge needs no Game ID.

## The bridge contract

Every engine's bridge follows the same rules:

- **The game's own code.** Write it into the project under a name from the game
  (`StarHopperServices`), never one that looks like an official Harmony package. There is no
  official Unity or Godot package for Harmony; don't name or promise one.
- **Only documented calls.** The bridge calls only what sdk.md documents: attaching, the
  overlay, the session and sign-in, friends and files. Chat, friend requests and account actions
  belong to the overlay in a hosted game; the game opens the overlay instead.
- **Attach as the page loads, without waiting.** The JavaScript file waits for Harmony's loader
  and attaches while the engine is still loading. The game plays on if the loader doesn't arrive
  or attaching fails, and in the window a player signs in through, the page doesn't attach.
- **Sign-in from the player's action.** Sign-in may open a window, so the game calls the bridge's
  sign-in only from the player's click or key press. Without a button of its own, players sign
  in from the overlay.
- **Text is text.** Names, game titles and file names are written by players and creators: show
  them with rich text or BBCode off (Unity: `richText`, `supportRichText` or `enableRichText`
  false; Godot: a plain `Label`). The same goes for anything a peer sends in multiplayer.
- **Data is never code.** Values cross the bridge as function arguments and JSON strings only.
  Never build JavaScript from them for `eval`, `JavaScriptBridge.eval` or
  `Application.ExternalEval`, never let them pick a method by name, and never open a URL from
  them. Parse JSON into known fields and check each one; opened files and peer messages too.
- **Guests have no friends list.** Check the session is an account before asking for friends (the
  bridge answers a guest with `friendsFailed`); offer a guest a button that opens the overlay, or
  one that signs in, instead.
- **Friends in this game.** Use `playingSameGame`; titles and other activity stay inside the overlay.
- **Stay on the latest SDK.** Load the SDK from Harmony's loader script
  (`https://cdn.playharmony.ai/v1/loader.js`), never a copied or bundled one, so the game gets
  each new SDK without a rebuild. New calls arrive often, so check sdk.md for any the game could
  use.

## The editor fake

The engine side has three implementations behind one interface: the real bridge in web builds,
a local fake in the editor and development or debug builds, and a do-nothing fallback in release
builds for other platforms. The fake lets the game's Harmony features be played without a web
build:

- signed-out, guest and account sessions, switchable in the editor and with a key while playing;
- session changes, raised when the setting changes, and sign-in from the game's own button;
- a sample friends list with the documented shapes (`online`, `playingSameGame`),
  one friend in this game and one name containing markup to catch labels with rich text on;
- friends failing for guests and signed-out players, as on Harmony;
- the overlay opening and closing from a key, to test pausing and resuming;
- saving and opening files through a local file dialog or a folder in the game's data;
- attaching after a short delay, as it's asynchronous, and an option to make attaching fail, to
  test the game without Harmony.

It is clearly labeled as a local fake, logs that it's running, and never reaches a web or release
build. It shows how the game reacts; only a web build shows the real SDK.

## Web build rules

- **Relative paths** for every file, so the build works from the folder Harmony serves it in.
- **No service worker:** Unity's template is Default or Minimal, never PWA; Godot's Progressive
  Web App option is off.
- **Single-threaded:** a hosted game can't count on cross-origin isolation, so don't enable the
  engine's web threading.
- **Compression:** the engine references give general advice; always check that the uploaded
  build loads.
- **Shift+Tab** opens the Harmony overlay in every hosted game; don't bind it to a game action.
- **The overlay's badge** sits in the bottom-right corner of every hosted game. Keep the HUD
  clear of it; only a game with the bridge could move it.
- **Saves** in the engine's web storage (`PlayerPrefs`, `user://`): one save for the device
  without the bridge, keyed on `accountId` with it.

## Testing

- With the bridge, play in the engine with the fake: every session kind, the overlay key,
  friends as a guest and as an account, and attaching failing.
- Then a web build: serve the build folder's parent with a static server and open the build's
  subfolder, the way Harmony serves it. Every file should load and the game should play. With
  the bridge, also block `cdn.playharmony.ai` in the browser's developer tools and reload: after
  15 seconds the console shows the bridge's warning that Harmony isn't available, and the game
  plays on. A browser smoke test of that build (the
  harmony-testing skill covers one) catches regressions.
- With the bridge, to try it against the SDK in a local web build, swap the loader tag in the
  served build's `index.html` for `https://cdn.playharmony.ai/v1/fake-loader.js`. The bridge then
  attaches to Harmony's fake: the real SDK with bot friends and chat, and no sign-in. It needs
  a network connection, and the overlay shows `fake`. Swap `loader.js` back before you package,
  and check the zipped `index.html` loads `loader.js`. The engine's editor fake stays as it is.
- Finally, upload it and play it on Harmony, where the overlay appears and, with the bridge,
  the real SDK runs with real sign-in.

## Reference files

| File | Read when |
| --- | --- |
| [references/bridge-js.md](references/bridge-js.md) | Step 3, for either engine: the shared JavaScript file, its events, loading it after Harmony's loader script |
| [references/unity.md](references/unity.md) | Steps 2 to 6 for Unity: export settings, the WebGL template, the .jslib, the C# component, the web implementation, the editor fake |
| [references/godot.md](references/godot.md) | Steps 2 to 6 for Godot: export settings, the Head Include, the autoload with JavaScriptBridge, the editor fake |

Other JavaScript modules, such as a peer-to-peer multiplayer room, are bridged the same way:
see "Bridging other JavaScript modules" in `bridge-js.md` and in each engine reference. The
editor fake can't test networking; test multiplayer in the web build with two browser windows.
