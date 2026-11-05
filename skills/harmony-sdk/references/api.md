# Harmony SDK API reference

Every public call in `@playharmony/sdk`, for games that use the SDK. Most games don't need it: see "Decide whether the game needs the SDK" in [../SKILL.md](../SKILL.md). The SDK is in preview: calls and options are added often, and an update may still change or remove one, so use the latest version and only the calls documented here. Harmony's docs for agents are at https://playharmony.ai/developers/sdk.md; where they differ from this file, follow them.

Use only the calls listed here. Anything else in the package is internal and can change in any release. Friend requests, chat and account changes happen in the overlay: open it with `harmony.open()` rather than building screens for them.

The examples call the handle `harmony`: the value `attach` or `PlayHarmony.attach()` resolves to. Until it is set, and if it never is, `harmony` is `null`, so code that can run earlier checks it first. Names such as `game`, `nameLabel` or `showToast` stand for the game's own code.

## Contents

- [attach](#attach)
- [PlayHarmony.attach, from a script tag](#playharmonyattach-from-a-script-tag)
- [The handle, and errors from every call](#the-handle-and-errors-from-every-call)
- [harmony.detach](#harmonydetach)
- [harmony.getJoinUrl](#harmonygetjoinurl)
- [Overlay: open, close, toggle, isOpen, on](#overlay)
- [auth: getSession, getBackendToken, signIn, onSessionChanged](#auth)
- [friends: list, onPresenceChanged](#friends)
- [files: save, open](#files)
- [Testing with the fake](#testing-with-the-fake)
- [Theming the overlay](#theming-the-overlay)

## attach

```ts
attach(options?: AttachOptions): Promise<GameServicesHandle>
```

Connects the game to Harmony, adds the overlay over the game's container, and resolves to the handle. Call it once, as the page loads. Hosted games and the fake can call `attach()` without options. Standalone real games require `gameId` and `container`. Start the game without waiting for it: don't `await` it before the game starts, or at the top level of a module. In the window a player signs in through, the promise never settles. When Harmony can't start, it rejects, which can take a while. Catch it, and let the game play on without Harmony's features.

Import the SDK before any code that changes the page's address, such as a client-side router: sign-in returns to the address the game started at.

| Option | Type | Meaning |
| --- | --- | --- |
| `gameId` | `string` | The game's Game ID. Required only for standalone real games; hosted games use host metadata and the fake supplies a development ID. |
| `container` | `HTMLElement` | The canvas or wrapper. Hosted games and the fake default to the document; standalone real games require a connected wrapper or canvas, never `body` or `html`. |
| `gameInfo` | `{ name?: string }` | Display metadata for standalone and fake games; ignored in hosted games, which use their backend listing. |
| `hotkey` | `{ key, shift?, ctrl?, alt?, meta? } \| null` | The key that opens and closes the overlay, matched against `KeyboardEvent.key`. Shift+Tab by default. `null` turns it off. |
| `badgeCorner` | `"bottom-right" \| "bottom-left" \| "top-right" \| "top-left"` | The corner of the game the overlay's badge sits in. Bottom right by default. |

The promise rejects with a `code`:

| `code` | Means | What to do |
| --- | --- | --- |
| `"sdk_unavailable"` | The SDK couldn't load. | Play on without Harmony's features. |
| `"invalid_params"` | An option is missing or wrong. | Fix the call. |

```ts
import { attach, type GameServicesHandle } from "@playharmony/sdk";

// Hosted games and the fake need no options.
// Set once Harmony is ready. Stays null if it can't start.
let harmony: GameServicesHandle | null = null;

attach()
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

## PlayHarmony.attach, from a script tag

```ts
PlayHarmony.attach(options?: AttachOptions): Promise<GameServicesHandle>
```

A game with no build step loads Harmony with a script tag instead of the package, and attaches through the `PlayHarmony` global. `PlayHarmony.attach` is available immediately after the loader. It takes the same options as `attach`; it returns a promise of the handle. Use `.then()` and `.catch()` while the game starts without waiting.

- Put the loader first in `<head>` as a plain script, without `async` or `defer`. If it fails to load, keep the game running without Harmony.
- A sign-in window returns to the game's page to finish sign-in. There `window.__MANTICORE_AUTH_RETURN__` is set: don't start the game in that window.
- Wrap the call in `try` and `catch`, so the game plays on if Harmony can't start.

```html
<!-- First in <head>: -->
<script src="https://cdn.playharmony.ai/v1/loader.js"></script>

<!-- At the end of <body>, after the game's element exists. startGame is your own. -->
<script>
  // A sign-in window returning to this page finishes sign-in; it doesn't start the game.
  if (!window.__MANTICORE_AUTH_RETURN__) {
    startGame();
    if (window.PlayHarmony) {
      PlayHarmony.attach().then((harmony) => {
        // Read the session and subscribe to the overlay here.
      }).catch((error) => {
        console.warn("Harmony is not available", error);
      });
    }
  }
</script>
```

While developing, load `https://cdn.playharmony.ai/v1/fake-loader.js` in place of the real loader, and swap it back before the game ships: see [Testing with the fake](#testing-with-the-fake).

## The handle, and errors from every call

The handle and its `auth`, `friends` and `files` are frozen. Keep the handle as it is: don't add fields to it, and keep it out of stores that wrap objects in deep proxies, such as Solid's `createStore` or MobX's `observable`. Store it in a plain variable, as the examples do.

Every call can fail. Besides the codes its own section names, any call can reject with the `code` `"invalid_params"`, `"not_connected"`, `"unknown_method"` or `"internal"`. Wrap calls so the game keeps playing without Harmony's features, and branch on `error.code`, never on the message.

```ts
// showFriends and hideFriends are your own. Call this only for an account session.
async function refreshFriends(): Promise<void> {
  if (!harmony) {
    hideFriends();
    return;
  }
  try {
    showFriends(await harmony.friends.list());
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "guest_not_allowed" && code !== "not_signed_in") {
      console.warn("Harmony friends failed", code);
    }
    hideFriends();
  }
}
```

No call reports the SDK's version. It is in the browser console on every attach, and in the overlay's About dialog, opened from the Harmony mark in its header.

## harmony.detach

```ts
harmony.detach(): void
```

Removes the overlay and every listener the SDK added, as when the game shuts down. After detach, `getJoinUrl` still validates its arguments and resolves to `null` for valid calls.

```ts
// showTitleScreen is your own.
function quitToTitle(): void {
  harmony?.detach();
  showTitleScreen();
}
```

## harmony.getJoinUrl

```ts
harmony.getJoinUrl(options?: { params?: Readonly<Record<string, string>> }): Promise<string | null>
```

Builds a website invitation for the attached game in its selected environment. Supply a lobby code with `harmony.getJoinUrl({ params: { join: roomCode } })`, or omit the options for a plain play link. The SDK supplies the game identity and website address; don't construct hosting URLs yourself. This only creates a URL: it does not navigate, copy, send an invitation, authenticate, validate the lobby or make a network request. It works while signed out and does not inherit the current query or any credentials.

Valid calls resolve to `null` in the fake, after detach, on an inert authentication-return handle, or without usable game/website context. Invalid arguments reject with `code: "invalid_params"`, even on fake and detached handles. Enable this feature only with an SDK release that has the helper and a website that forwards creator parameters.

- Pass literal names and values, without pre-encoding. Names must be nonempty strings and values must be strings; both must be valid Unicode. Empty values are allowed.
- At most 32 pairs and 4096 bytes after form URL encoding, including `=` and `&` but not `?`. Invalid input fails rather than being truncated.
- Names are case-sensitive. `mg:*`, `k`, `friend`, `t`, `code`, `state`, `error`, `error_description`, `error_uri` and `iss` are reserved.
- The URL grants no access. The recipient still passes the website's sign-in, legal and game-access checks. A recipient who needs a sharing key needs a separately authorized sharing link; the helper never extracts one. Existing friend joins keep their own behavior.

Prepare the URL when the lobby is ready, before the Copy Invite click. Keep a visible, readonly URL field for manual copying. This example uses controls owned by one lobby: remove them when that lobby closes and create fresh controls for the next one.

```html
<button id="copy-invite" type="button" disabled>Copy Invite</button>
<input id="invite-url" aria-label="Invitation URL" readonly>
<p id="invite-status" role="status"></p>
```

```js
const copyButton = document.getElementById("copy-invite");
const inviteField = document.getElementById("invite-url");
const inviteStatus = document.getElementById("invite-status");

async function prepareInvite() {
  if (!harmony) {
    inviteStatus.textContent = "Invitations are unavailable in this session.";
    return;
  }
  try {
    const url = await harmony.getJoinUrl({ params: { join: roomCode } });
    if (url === null) {
      inviteStatus.textContent = "Invitations are unavailable in this session.";
      return;
    }
    inviteField.value = url;
    copyButton.disabled = false;
  } catch (error) {
    inviteStatus.textContent = error?.code === "invalid_params"
      ? "This lobby code cannot be included in an invitation."
      : "Could not prepare the invitation.";
  }
}

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(inviteField.value);
    inviteStatus.textContent = "Invitation copied.";
  } catch {
    inviteField.focus();
    inviteField.select();
    inviteStatus.textContent = "Copy the selected invitation URL manually.";
  }
});

void prepareInvite();
```

The clipboard write starts directly from the click, without awaiting URL creation first. On the recipient's game page, capture the decoded lobby code before a router changes the address:

```js
const invitedRoom = new URLSearchParams(location.search).get("join");
if (invitedRoom !== null) joinLobby(invitedRoom);
```

`joinLobby` is the game's own lobby validation and connection. Treat the code as untrusted input, handle expired or unavailable rooms, and keep manual room-code entry available. Test the real invitation flow on Harmony; the fake returns `null` and cannot prove forwarding or recipient access.

## Overlay

The overlay is the Harmony panel over the game, with the player's friends, chat and inbox. Players open it with its badge or Shift+Tab. The game can open it too, and should pause while it is open.

While the overlay is open, the game gets no keyboard or pointer input: the SDK stops it before the game's listeners see it, and a click on the game closes the overlay. A key the player was holding still gets its `keyup`. The one exception is a capture listener on `window` that the game added before attaching. It should return early while the overlay is open, and not cancel keys, or typing in the overlay loses characters:

```ts
// Added before attach. handleGameKey is your own.
window.addEventListener(
  "keydown",
  (event) => {
    if (harmony?.isOpen()) {
      return;   // the player is typing in the overlay: don't read or cancel the key
    }
    handleGameKey(event);
  },
  { capture: true },
);
```

### harmony.open

```ts
harmony.open(): void
```

Opens the overlay over the game, where a player who isn't signed in is offered sign-in. Does nothing while it is already open.

```ts
// friendsButton is your own.
friendsButton.addEventListener("click", () => {
  harmony?.open();
});
```

### harmony.close

```ts
harmony.close(): void
```

Closes the overlay and returns focus to the game.

```ts
// game is your own.
function startRound(): void {
  harmony?.close();
  game.resume();
}
```

### harmony.toggle

```ts
harmony.toggle(): void
```

Opens the overlay when it is closed, and closes it when it is open.

```ts
window.addEventListener("keydown", (event) => {
  if (event.key === "F2") {
    harmony?.toggle();
  }
});
```

### harmony.isOpen

```ts
harmony.isOpen(): boolean
```

Whether the overlay is open now.

```ts
// openPauseMenu is your own.
function onPauseKey(): void {
  if (harmony?.isOpen()) {
    harmony.close();
  } else {
    openPauseMenu();
  }
}
```

### harmony.on

```ts
harmony.on(event: "open" | "close", listener: () => void): () => void
```

Calls the listener each time the overlay opens or closes, however it happened. Returns a function that stops listening.

```ts
// game and pauseMenu are your own.
const stopOpen = harmony.on("open", () => {
  game.pause();
  pauseMenu.show();       // the player resumes from it after the overlay closes
});
const stopClose = harmony.on("close", () => {
  pauseMenu.focus();      // don't resume on your own; hand the game back to the player
});

// Later, to stop listening:
stopOpen();
stopClose();
```

## auth

Who is playing. Players sign in, or play as a guest, through the overlay, and the game reads the result. A guest who later creates an account keeps the same `accountId`.

Display names are 3 to 20 characters of letters, digits, `.`, `_` and `-`, starting and ending with a letter or digit. A tag is 4 characters. Two players can share a name, so show the tag beside it where telling them apart matters, and key on `accountId`.

Harmony doesn't store game data. Keep progress in `localStorage` or `IndexedDB`, keyed on the player's `accountId`, so each player on a device has their own. It stays on that device and in that browser.

### harmony.auth.getSession

```ts
harmony.auth.getSession(): Promise<PlayerSession>
```

The player's session now. Its `kind` is `"account"` for a Harmony account, `"guest"` for a guest, `"signedOut"`, or `"legalRequired"` while the player accepts updated terms in the overlay. Treat any kind but `"account"` and `"guest"` as not signed in. A guest or account session also has:

| Field | Type | Meaning |
| --- | --- | --- |
| `accountId` | `string` | The player's id, the same in every session. Key browser saves on this. |
| `displayName` | `string` | The name to show. Not unique, so never key anything on it. Show it as text. |
| `discriminator` | `string \| null` | The 4-character tag that tells players with the same name apart. Never part of `displayName`. |

```ts
// nameLabel is your own element.
const session = await harmony.auth.getSession();
if (session.kind === "guest" || session.kind === "account") {
  nameLabel.textContent = session.displayName;
} else {
  nameLabel.textContent = "Not signed in";
}
```

### harmony.auth.getBackendToken

```ts
harmony.auth.getBackendToken(): Promise<BackendToken>
```

Proves the current guest or account to the game's own server. It works in a Harmony-hosted frame and on the game's own page. The result has `token: string` and `expiresAtMs: number` (Unix epoch milliseconds). It never opens sign-in. It rejects with `not_signed_in` while signed out or awaiting legal acceptance, or `unsupported` on a backend without this feature.

```js
const { token } = await harmony.auth.getBackendToken();
const response = await fetch("https://your-server.example/saves", {
  headers: { Authorization: `Bearer ${token}` },
});
if (!response.ok) {
  throw new Error("Loading saves failed");
}
// showProgress is the game's own. The server chooses the owner from the verified sub.
showProgress(await response.json());
```

The server verifies the RS256 signature using the Harmony environment's trusted JWKS signing keys. Require the configured issuer, audience `urn:ugs:game-backend:<gameId>`, header type `ugs-backend-identity+jwt`, and a valid expiry. Configure the issuer and JWKS address on the server; never take addresses from the token. Use the verified `sub` as the save owner's account ID. An account ID supplied by the browser, including one from `getSession()`, cannot authenticate a request. Verification is local; no token-validation API call is needed.

Tokens last at most five minutes and can expire sooner. They remain usable until expiry after sign-out or revocation. Request one before a server request, send it over HTTPS, and keep it out of URLs, logs and persistent storage. They grant no Game Services API permissions.

The fake signs with a public development key and a separate `.invalid` issuer. Accept these tokens only with an explicitly configured local-development verifier, never against production data.

### harmony.auth.signIn

```ts
harmony.auth.signIn(): Promise<PlayerSession>
```

Starts sign-in in the overlay and resolves with the session it ends in. It may open a window, so call it from the player's click or key press. Check the session's `kind`, as for `getSession`.

```ts
// signInButton is your own.
signInButton.addEventListener("click", async () => {
  if (!harmony) {
    return;
  }
  try {
    const session = await harmony.auth.signIn();
    if (session.kind === "account" || session.kind === "guest") {
      signInButton.hidden = true;
    }
  } catch {
    // Sign-in didn't start. The game plays on, and the button stays.
  }
});
```

### harmony.auth.onSessionChanged

```ts
harmony.auth.onSessionChanged(listener: (session: PlayerSession) => void): () => void
```

Calls the listener with the whole new session each time it changes: the player signs in, signs out, or a guest creates an account. Returns a function that stops listening.

```ts
// readProgress and showProgress are your own. Progress is kept in this browser, one entry per
// player. A stored save can be anything, so readProgress checks every field, copies the known
// ones into a new object and falls back to defaults rather than trusting it. It never merges the
// parsed save over the defaults with Object.assign, spread or a deep merge.
const stopWatching = harmony.auth.onSessionChanged((session) => {
  if (session.kind === "guest" || session.kind === "account") {
    let saved: unknown = null;
    try {
      saved = JSON.parse(localStorage.getItem(`progress:${session.accountId}`) ?? "null");
    } catch {
      saved = null;           // broken save: start fresh rather than crash
    }
    showProgress(readProgress(saved));
  }
});
```

## friends

The player's friends and what they are doing. Friend requests and changes to the list happen in the overlay.

A guest has no friends list. Check that `session.kind` is `"account"` before calling these.

### harmony.friends.list

```ts
harmony.friends.list(): Promise<Friend[]>
```

The player's friends. Each friend has:

| Field | Type | Meaning |
| --- | --- | --- |
| `accountId` | `string` | The friend's id. |
| `displayName` | `string` | The name to show, as for the player. Not unique. |
| `discriminator` | `string \| null` | The 4-character tag beside the name. |
| `online` | `boolean` | Whether the friend is online now. |
| `playingSameGame` | `boolean` | Whether the friend is visibly playing your authenticated game. Game titles and other activity stay in the overlay. |

It rejects with a `code` when there is no list to give. Show the game without friends then.

| `code` | Means |
| --- | --- |
| `"guest_not_allowed"` | The player is a guest. |
| `"not_signed_in"` | No one is signed in. |

```ts
// statusLabel is your own element.
// Call this only for an account session: guests have no friends list.
try {
  const friends = await harmony.friends.list();
  const online = friends.filter((friend) => {
    return friend.online;
  });
  const here = friends.filter((friend) => {
    return friend.playingSameGame;
  });
  statusLabel.textContent = `${online.length} of ${friends.length} friends online, ${here.length} in this game`;
} catch {
  statusLabel.textContent = "";   // no friends list: show the game without friends
}
```

### harmony.friends.onPresenceChanged

```ts
harmony.friends.onPresenceChanged(listener: (friend: Friend) => void): () => void
```

Calls the listener with a friend's whole, current entry each time they come online, go offline or change game. Returns a function that stops listening.

```ts
// showToast is your own, and sets the toast's textContent. forLabel drops control and invisible
// characters and caps the length (see showing-text.md).
const stopWatching = harmony.friends.onPresenceChanged((friend) => {
  if (friend.playingSameGame) {
    showToast(`${forLabel(friend.displayName)} is playing this game`);
  }
});
```

## files

Real Save, Save As and Open dialogs for files on the player's device. Browsers don't allow file dialogs inside a hosted game's frame, so Harmony shows them for the game. Keep progress in `localStorage` or `IndexedDB`. Use files for things players keep or share, such as levels, drawings or exported saves.

Call both from a click or key handler: browsers show file dialogs only while the player is acting. Called at another time, a first save downloads the file instead, and an open fails. Firefox and Safari have no save dialog, so there a save downloads the file.

### harmony.files.save

```ts
harmony.files.save(options: SaveFileOptions): Promise<SaveFileResult>
```

| Option | Type | Meaning |
| --- | --- | --- |
| `data` | `Blob \| ArrayBuffer \| typed array` | What to write. Required. |
| `suggestedName` | `string` | The name the dialog, or the download, starts with. |
| `types` | `{ description?, accept }[]` | The file types to offer, as MIME types with their extensions, such as `{ "application/json": [".json"] }`. |
| `fileId` | `string \| null` | An id from an earlier save or open. Writes that file again without asking where, so autosave works. |

The result's `outcome` is `"saved"` with a `fileId` to save to again, `"downloaded"` with no id, or `"cancelled"` when the player closed the dialog.

```ts
// saveButton, level and showToast are your own.
let fileId: string | null = null;

saveButton.addEventListener("click", async () => {
  if (!harmony) {
    return;
  }
  try {
    const result = await harmony.files.save({
      data: new Blob([JSON.stringify(level)], { type: "application/json" }),
      suggestedName: "level.json",
      types: [{ description: "Level", accept: { "application/json": [".json"] } }],
      fileId,
    });
    if (result.outcome === "saved") {
      fileId = result.fileId;
    }
  } catch (error) {
    // The codes are in "When a save or open fails" below.
    if ((error as { code?: string }).code === "file_not_found") {
      fileId = null;
    }
    showToast("The level wasn't saved. Try again.");
  }
});
```

### harmony.files.open

```ts
harmony.files.open(options?: OpenFileOptions): Promise<OpenFileResult>
```

Shows an Open dialog, limited to the `types` you pass. The result's `outcome` is `"opened"`, with the file's `data` as an `ArrayBuffer`, its `name` and a `fileId` to save back to it, or `"cancelled"`.

#### When a save or open fails

The player closing a dialog isn't an error: it answers `"cancelled"`. A save or open that can't go ahead rejects with a `code`:

| `code` | Means | What to do |
| --- | --- | --- |
| `"no_user_activation"` | It wasn't called from the player's click or key press, or the player was busy with the overlay. | Ask the player to click Save or Open again. |
| `"busy"` | Another save or open is still waiting on the player. | Wait for it; don't start a second one. |
| `"file_not_found"` | The `fileId` isn't from this visit, or the file was moved or deleted. | Forget the `fileId` and ask where to save again. |
| `"file_too_large"` | The file is bigger than a save or open allows. | Tell the player; don't retry the same file. |
| `"invalid_params"` | An option is missing or wrong. | Fix the call. |
| `"internal"` | The browser couldn't read or write the file, start the download, or show the dialog. | Say it didn't work; let the player try again. |
| `"not_connected"` | The call came after `harmony.detach()`. | Don't call files after detaching. |

Catch the rejection around every save and open, and keep the game running whatever the code.

The player can pick any file, so check its `data` before you use it, and show its `name` as text: a file name can hold any character.

```ts
// openButton, level, readLevel and showToast are your own. readLevel checks every field, copies
// the known ones into a new object (never Object.assign, spread or a deep merge of the parsed
// data), and returns null for anything that isn't a valid level.
openButton.addEventListener("click", async () => {
  if (!harmony) {
    return;
  }
  let result: Awaited<ReturnType<typeof harmony.files.open>>;
  try {
    result = await harmony.files.open({
      types: [{ description: "Level", accept: { "application/json": [".json"] } }],
    });
  } catch {
    showToast("The file couldn't be opened. Try again.");
    return;
  }
  if (result.outcome !== "opened") {
    return;
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(new TextDecoder().decode(result.data));
  } catch {
    parsed = null;
  }
  const opened = readLevel(parsed);
  if (opened) {
    level = opened;
  } else {
    showToast("That file isn't a level for this game.");
  }
});
```

## Testing with the fake

While the developer works on the game, it attaches to the fake: the real SDK with a simulated backend of bot friends and chat, and no sign-in. It downloads like the real SDK, so it needs a network connection. The overlay shows `fake` at the bottom of its panel. The release build attaches to the real Harmony. Develop and test against the fake rather than a mock of the SDK.

- **With the package,** the bundler's development build picks the fake on its own: Vite's dev server, webpack's `--mode development`, esbuild with `--conditions=development`. Parcel needs package exports turned on, and Rollup the `development` export condition. `vite build` is a release build.
- **With a script tag,** load the fake loader in place of the real one while developing, and swap the real one back before the game ships:

```html
<!-- While developing only. The release page loads https://cdn.playharmony.ai/v1/loader.js. -->
<script src="https://cdn.playharmony.ai/v1/fake-loader.js"></script>
```

For automated tests in a DOM emulation such as jsdom, `loadFakeGameServices` from `@playharmony/sdk/testing` downloads the fake into the test and returns its `attach`. Import it only from test files. A download can take up to 30 seconds, so raise the hook's timeout:

```ts
// Vitest with environment "jsdom".
import { beforeAll, expect, test } from "vitest";
import { loadFakeGameServices } from "@playharmony/sdk/testing";

let attachFake: Awaited<ReturnType<typeof loadFakeGameServices>>;

beforeAll(async () => {
  attachFake = await loadFakeGameServices();
}, 90_000);

test("the game attaches to Harmony", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const harmony = await attachFake({ gameId: "YOUR_GAME_ID", container });
  expect(harmony.isOpen()).toBe(false);
  harmony.detach();
});
```

Pass the handle the fake returns to the game's own Harmony code, the same code that gets the real handle from `attach`. The harmony-testing skill covers the rest of a game's tests.

## Theming the overlay

The overlay uses Harmony's light theme by default. Set these CSS custom properties on any ancestor of the game's container to change it, using the game's own palette and font. The panel and its confirmation cards sit on Harmony's art, so they keep their own text and surface colors; the accent, font, radius and the online and danger colors still apply there.

```css
:root {
  --mtc-accent: #ff5c8a;   /* names, links, icons, buttons */
  --mtc-surface: #171320;  /* menus, popups and dialogs */
  --mtc-text: #f2eef7;     /* the text on those */
  --mtc-backdrop: rgba(10, 6, 16, 0.65);
  --mtc-radius: 14px;
  --mtc-font: "Inter", system-ui, sans-serif;
  --mtc-online: #4ade80;   /* presence dots */
  --mtc-danger: #ff6b6b;   /* destructive actions, errors */
}
```

A game with theme tokens can point these at them, as in `--mtc-accent: var(--ui-accent);`.
