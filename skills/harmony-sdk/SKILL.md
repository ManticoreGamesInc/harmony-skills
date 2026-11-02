---
name: harmony-sdk
description: Add the Harmony SDK (@playharmony/sdk) to a web game that needs Harmony features in the game itself - the player's name, friends and presence, opening the overlay or pausing while it is open, and Save and Open file dialogs - showing Harmony text safely. Most games don't need it, since Harmony adds its overlay at upload. Use when a game should show the player's Harmony name or friends, control the overlay, or save files through Harmony.
license: MIT
metadata:
  sdk-package: "@playharmony/sdk"
  sdk-status: early-access
---

# Harmony SDK

Harmony hosts web games. Players play them in the browser, as a guest or with a Harmony account. The Harmony SDK (`@playharmony/sdk`) lets a game read who is playing and their friends, control the Harmony overlay, and show file dialogs.

Most games don't need the SDK. A game with no SDK and no Game ID uploads and plays on Harmony as it is, and its players still get the overlay, sign-in, friends and chat. Add the SDK only when the game itself uses one of the features below.

The SDK is in early access, and new calls and options arrive often. Harmony aims to keep updates compatible with existing games, so install the latest version and keep it up to date. Check each call against [references/api.md](references/api.md) before you use it.

Harmony publishes the SDK docs for agents as plain Markdown at https://playharmony.ai/developers/sdk.md. Read it when you can reach it, and where the two differ, follow it. Don't fetch https://playharmony.ai/developers/sdk for this, since that page is drawn by JavaScript and a plain fetch returns an empty shell.

## Decide whether the game needs the SDK

Harmony adds its overlay to every game it hosts, with no code. Players already get:

- sign-in with a Harmony account, or play as a guest
- their friends, who is online and what they are playing
- chat with friends while they play
- the overlay, which opens over the game with Shift+Tab

Add the SDK only when the game itself needs one of these:

- the player's name, tag or id (`harmony.auth`), for example to keep a save per player
- the player's friends and their presence (`harmony.friends`, for players signed in with an account)
- to open or close the overlay from the game, or pause while it is open (`harmony.open`, `harmony.on`)
- to move the overlay's badge to another corner, or change the overlay's hotkey (the `badgeCorner` and `hotkey` options)
- Save, Save As or Open dialogs for files on the player's device (`harmony.files`)

If the game needs none of these, don't add the SDK, and don't ask for a Game ID: skipping it is the normal case. Without the SDK:

- The game keeps one save for the device, since it doesn't know who is playing.
- The overlay's badge sits in the bottom-right corner, and Shift+Tab opens the overlay. The game can't move the badge or change the key, so it keeps that corner clear and doesn't use Shift+Tab.
- The game isn't told when the overlay opens. Opening it moves keyboard focus out of the game, so the window gets a `blur` event: pause on `blur` (which also covers switching tabs or apps), and let the player resume rather than resuming on `focus`. The game's own pause key or button stays as well.
- Downloads and `<input type="file">` still work in a hosted game, so a save can be exported as a download and imported from a file. Only the browser's own Save and Open pickers (`showSaveFilePicker` and the like) don't.

The SDK can be added later, when the game's design calls for one of its features.

Once a game attaches to Harmony itself, Harmony sees this on upload and doesn't add a second overlay.

## Ask the developer first

Ask in one round, and only what the game's code and design brief (`docs/design.md`, if there is one) don't already answer:

- **Which features the game uses:** the player's name, friends and presence, a button that opens the overlay, pausing while the overlay is open, file dialogs. Recommended: only the features the game's design uses. With none, don't add the SDK, and stop here.
- **The Game ID,** only when the game uses at least one feature. It is on the game's page in My Creations on Harmony. There is no default; never invent one. If they don't have it yet, put the placeholder `YOUR_GAME_ID` in one constant and list it as open when you finish.

Don't ask whether the game uses Shift+Tab: search its input code. If the developer says "you decide", use the recommendation and say which features you picked.

## Install and attach

The SDK comes two ways, with the same options and the same handle:

- **The package,** `attach` from `@playharmony/sdk`, for a game built with a bundler such as Vite or webpack. Use it when the game has a `package.json` and a build step.
- **A script tag,** `PlayHarmony.attach` from Harmony's loader, for a game with no build step, such as plain HTML and JavaScript files. Use it when the game has no bundler, rather than adding one.

Either way, attach once, as the page loads. It connects the game to Harmony, adds the overlay over the game's container, and gives back the handle used for every other call. Start the game without waiting for it, and catch failures so the game plays on without Harmony's features: every feature that uses the handle has to cope with it being `null`.

### With the package

```
npm install @playharmony/sdk
```

This installs the latest version. Update it when a new one comes out: `npm install @playharmony/sdk@latest`.

`attach` returns a promise of the handle. Don't `await` it before the game starts, or at the top level of a module: in the window a player signs in through, it never settles, and when Harmony can't load it can take a while to reject. It rejects with a `code`: `"sdk_unavailable"` when the SDK couldn't load, or `"invalid_params"` when an option is missing or wrong.

```ts
import { attach, type GameServicesHandle } from "@playharmony/sdk";

// In the page from the start, around the title screen and canvas.
const container = document.getElementById("game") as HTMLElement;

// Set once Harmony is ready. Stays null if it can't start.
let harmony: GameServicesHandle | null = null;

attach({
  gameId: "YOUR_GAME_ID",
  container,
  gameInfo: { name: "Star Hopper" },
})
  .then((handle) => {
    harmony = handle;
    // onHarmonyReady is your own: read the session, listen to the overlay.
    onHarmonyReady(handle);
  })
  .catch((error) => {
    // The game plays on without Harmony's features.
    console.warn("Harmony is not available", error);
  });

// startGame is your own. It runs now, without waiting for Harmony.
startGame();
```

### With a script tag

Load Harmony's loader first in `<head>`, then attach through the `PlayHarmony` global. `PlayHarmony.attach` takes the same options and returns the handle itself, not a promise. The loader can arrive after the game's own script, so wait for the global, and give up after a while so the game plays on without it. A sign-in window returns to the game's page to finish sign-in, with `window.__MANTICORE_AUTH_RETURN__` set: don't start the game in that window. The attach code can go in an inline script at the end of `<body>` or in the game's own script file.

```html
<!-- First in <head>: -->
<script src="https://cdn.playharmony.ai/v1/loader.js"></script>

<!-- At the end of <body>, after the game's element exists. -->
<script>
  const gameRoot = document.getElementById("game");

  // Set once Harmony is ready. Stays null if it can't start.
  let harmony = null;

  // Resolves with the PlayHarmony global once the loader has run, or null after timeoutMs.
  function whenHarmonyLoads(timeoutMs) {
    return new Promise((resolve) => {
      const startedAtMs = performance.now();
      (function poll() {
        if (window.PlayHarmony) {
          return resolve(window.PlayHarmony);
        }
        if (performance.now() - startedAtMs > timeoutMs) {
          return resolve(null);
        }
        setTimeout(poll, 50);
      })();
    });
  }

  // A sign-in window returning to this page finishes sign-in; it doesn't start the game.
  if (!window.__MANTICORE_AUTH_RETURN__) {
    // startGame is your own. It runs now, without waiting for Harmony.
    startGame();
    whenHarmonyLoads(15000).then((PlayHarmony) => {
      if (!PlayHarmony) {
        console.warn("Harmony is not available");
        return;
      }
      try {
        harmony = PlayHarmony.attach({
          gameId: "YOUR_GAME_ID",
          container: gameRoot,
          gameInfo: { name: "Star Hopper" },
        });
        // onHarmonyReady is your own: read the session, listen to the overlay.
        onHarmonyReady(harmony);
      } catch (error) {
        // The game plays on without Harmony's features.
        console.warn("Harmony is not available", error);
      }
    });
  }
</script>
```

### For both

- `gameId` is the Game ID from the game's page in My Creations on Harmony. Ask the developer for it. Never invent one.
- `container` is the element the game draws in, such as its canvas or the element around it. It must be in the page when you attach.
- Attach as the page loads, not after a title screen or menu, since a sign-in returns to the game's page to finish. If the canvas comes later, attach to a wrapper element that is in the page from the start, and put the title screen and canvas inside it.
- Call `harmony.detach()` when the game shuts down. The handle does nothing after that.

## Show text from Harmony as text, never as HTML

Treat any text the SDK gives your game as written by a player or a creator. Harmony passes it on exactly as written: plain text, never HTML. That covers display names, tags, game titles in `currentGame`, and file names.

- Put text on the page with `textContent`, or draw it with the canvas's or engine's text call, such as `fillText`.
- Never pass it to `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`, and never build HTML from it with strings. Text such as `<img src=x onerror="…">` runs as code there, inside the game.
- React and Vue show text safely, except through `dangerouslySetInnerHTML` and `v-html`.
- Set attributes through the element, as in `element.setAttribute("title", name)`, never by writing them into HTML.

See [references/showing-text.md](references/showing-text.md) for examples in plain DOM, canvas, React and Vue, and the patterns to look for when reviewing a game.

## Rules that are easy to get wrong

- **Use only the documented calls.** Anything in the package that [references/api.md](references/api.md) doesn't list is internal and can change in any release. Friend requests, chat and account changes happen in the overlay. Don't build screens for them: open the overlay with `harmony.open()`, which takes no argument.
- **Sign in from a player action.** To offer sign-in from the game's own button, call `harmony.auth.signIn()` from the player's click or key press, since it may open a window. It resolves with the session sign-in ends in, so check its `kind`.
- **Guests have no friends list.** Check that `session.kind` is `"account"` before calling `friends.list` or showing friends; otherwise it rejects with `"guest_not_allowed"` (a guest) or `"not_signed_in"`. For a guest, show the game without friends, and offer a sign-in button that calls `harmony.auth.signIn()`.
- **Names are not unique.** Two players can share a display name. Key everything on `accountId`, and show the 4-character `discriminator` tag beside the name where players need telling apart. The tag is never part of `displayName`.
- **Check the session kind.** `auth.getSession()` returns a session whose `kind` is `"account"`, `"guest"` or `"signedOut"`. Treat any other kind as signed out. Only account and guest sessions have `accountId`, `displayName` and the other fields.
- **A guest keeps their id.** A guest who creates an account keeps the same `accountId`, so their saves carry over. Listen with `auth.onSessionChanged` to load the right player's saves when someone signs in or out.
- **Harmony doesn't store game data.** Keep progress in `localStorage` or `IndexedDB`, keyed on `accountId`, so each player on a device has their own. It stays in that browser on that device. Saves there belong to the game alone: no other game can read them.
- **Pause while the overlay is open.** Use `harmony.on("open", …)` and `harmony.on("close", …)`. They fire however the overlay opened, including the player's Shift+Tab. The overlay releases pointer lock when it opens, so a game that locks the pointer locks it again from `harmony.on("close", …)` or on the player's next click.
- **Don't fight the overlay's hotkey.** Shift+Tab opens the overlay by default. If the game uses Shift+Tab, pass a different `hotkey` to `attach`, or `null` to turn it off and open the overlay from the game's own button.
- **File dialogs need a player action.** Call `files.save` and `files.open` from a click or key handler. Called at any other time, a first save downloads the file instead, and an open fails. Firefox and Safari have no save dialog, so there a save always downloads. Handle the `"cancelled"` and `"downloaded"` outcomes, and catch rejections: each has a `code` (`"no_user_activation"`, `"busy"`, `"file_not_found"`, `"file_too_large"` and others) listed in [references/api.md](references/api.md).
- **Check files the player opens.** The player can pick any file. Validate `data` before using it, and show its `name` as text.
- **Use `currentGame` only for display.** Creators write game titles freely. Never compare a friend's `currentGame` to decide whether they are in your game.
- **Compare `currentGameId` to find friends in your game.** A friend whose `currentGameId` equals the game's own `gameId` is in it. When `currentGameId` is absent, Harmony doesn't know: treat it as unknown, never as a different game.
- **Every listener returns a stop function.** Call it when the screen or component that listens goes away.

## Check your work

- Run the game outside Harmony (a local dev server). It starts and plays at once, and every Harmony feature copes with `harmony` being `null`: hidden, or replaced by a fallback.
- Search the code for the patterns in "Reviewing a game" in [references/showing-text.md](references/showing-text.md).
- Check every SDK call against [references/api.md](references/api.md), and, with the package, that the game has the latest SDK version (`npm outdated @playharmony/sdk` lists nothing).
- The real SDK runs only on Harmony. After upload, test as a guest and with an account: the name, friends, pausing on Shift+Tab, and any file dialogs.

When you finish, tell the developer which features you added (or that the game doesn't need the SDK), the SDK version installed, that they should update it when a new one comes out, whether the Game ID is still a placeholder, and what to test on Harmony.

## Upload to Harmony

Upload the game from My Creations on Harmony, as one `.html` file or as a `.zip` of a web build with its `index.html` at the root of the zip. Any engine that exports to the web works. The game runs in a frame on an address of its own, with the overlay in the page around it. A game without the SDK uploads the same way; the Game ID matters only to `attach`.

## API reference

[references/api.md](references/api.md) lists every public call, its options and the fields of what it returns, with an example of each. Read it before writing code that calls the SDK, and use only the calls it lists.
