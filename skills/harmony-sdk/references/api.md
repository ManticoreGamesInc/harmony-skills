# Harmony SDK API reference

Every public call in `@playharmony/sdk`, for games that use the SDK. Most games don't need it: see "Decide whether the game needs the SDK" in [../SKILL.md](../SKILL.md). The SDK is in early access, and new calls and options arrive often, so use the latest version. Harmony's docs for agents are at https://playharmony.ai/developers/sdk.md; where they differ from this file, follow them.

Use only the calls listed here. The package's types also declare sign-in, chat, friend-request and account calls. In a hosted game the overlay handles those, and Harmony refuses the game's calls, so don't build screens for them.

The examples call the handle `harmony`, the value `attachGameServices` resolves to, and run once it has resolved. Until then, and if it never does, `harmony` is `null`, so code that can run earlier checks it first. Names such as `game`, `nameLabel` or `showToast` stand for the game's own code.

## Contents

- [attachGameServices](#attachgameservices)
- [harmony.detach](#harmonydetach)
- [Overlay: open, close, toggle, isOpen, on](#overlay)
- [auth: getSession, onSessionChanged](#auth)
- [friends: list, onPresenceChanged](#friends)
- [files: save, open](#files)

## attachGameServices

```ts
attachGameServices(options: AttachOptions): Promise<GameServicesHandle>
```

Connects the game to Harmony, adds the overlay over the game's container, and resolves to the handle. Call it once, as the game boots, and start the game without waiting for it: don't `await` it before the game starts, or at the top level of a module. The promise rejects when Harmony can't start, for example when an option is missing or wrong, or when Harmony can't load, which can take a while. Catch it, and let the game play on without Harmony's features.

| Option | Type | Meaning |
| --- | --- | --- |
| `gameId` | `string` | The game's Game ID, from its page in My Creations. Required. |
| `container` | `HTMLElement` | The element the game draws in, such as its canvas or the element around it. The overlay sits over it. Required. |
| `gameInfo` | `{ name?: string }` | The game's name, which labels its chat channel. |
| `hotkey` | `{ key, shift?, ctrl?, alt?, meta? } \| null` | The key that opens and closes the overlay, matched against `KeyboardEvent.key`. Shift+Tab by default. `null` turns it off. |
| `badgeCorner` | `"bottom-right" \| "bottom-left" \| "top-right" \| "top-left"` | The corner of the game the overlay's badge sits in. Bottom right by default. |

```ts
import { attachGameServices, type GameServicesHandle } from "@playharmony/sdk";

const container = document.getElementById("game") as HTMLElement;

// Set once Harmony is ready. Stays null if it can't start.
let harmony: GameServicesHandle | null = null;

attachGameServices({
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

## harmony.detach

```ts
harmony.detach(): void
```

Removes the overlay and every listener the SDK added, as when the game shuts down. The handle does nothing after this.

```ts
// showTitleScreen is your own.
function quitToTitle(): void {
  harmony?.detach();
  showTitleScreen();
}
```

## Overlay

The overlay is the Harmony panel over the game, with the player's friends, chat and inbox. Players open it with its badge or Shift+Tab. The game can open it too, and should pause while it is open.

### harmony.open

```ts
harmony.open(tab?: "friends" | "chat" | "inbox"): void
```

Opens the overlay on the tab you name. A player who isn't signed in sees no tabs, so the tab is ignored.

```ts
// friendsButton is your own.
friendsButton.addEventListener("click", () => {
  harmony?.open("friends");
});
```

### harmony.close

```ts
harmony.close(): void
```

Closes the overlay.

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
harmony.auth.getSession(): Promise<AuthSession>
```

The player's session now. Its `kind` is `"account"` for a Harmony account, `"guest"` for a guest, or `"signedOut"`. Treat any other kind as not signed in. A guest or account session also has:

| Field | Type | Meaning |
| --- | --- | --- |
| `accountId` | `string` | The player's id, the same in every session. Key browser saves on this. |
| `displayName` | `string` | The name to show. Not unique, so never key anything on it. Show it as text. |
| `discriminator` | `string \| null` | The 4-character tag that tells players with the same name apart. Never part of `displayName`. |
| `pictureUrl` | `string \| undefined` | The address of the player's square profile picture, when they have one. A new picture comes with a new address. Use it only as an image's `src`, and only when it starts with `https://`. |

```ts
// nameLabel is your own element.
const session = await harmony.auth.getSession();
if (session.kind === "guest" || session.kind === "account") {
  nameLabel.textContent = session.displayName;
} else {
  nameLabel.textContent = "Not signed in";
}
```

### harmony.auth.onSessionChanged

```ts
harmony.auth.onSessionChanged(listener: (session: AuthSession) => void): () => void
```

Calls the listener with the whole new session each time it changes: the player signs in, signs out, or a guest creates an account. Returns a function that stops listening.

```ts
// readProgress and showProgress are your own. Progress is kept in this browser, one entry per
// player. A stored save can be anything, so readProgress checks every field and falls back to
// defaults rather than trusting it.
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

The player's friends. It rejects with the `code` `"guest_not_allowed"` for a guest, and `"not_signed_in"` when no one is signed in; show the game without friends then. Each friend has:

| Field | Type | Meaning |
| --- | --- | --- |
| `accountId` | `string` | The friend's id. |
| `displayName` | `string` | The name to show, as for the player. Not unique. |
| `discriminator` | `string \| null` | The 4-character tag beside the name. |
| `online` | `boolean` | Whether the friend is online now. |
| `currentGame` | `string \| null` | The title of the game they are playing, to show only. Creators write titles freely, so a title can hold any character, such as `<` or `&`. Show it as text, never as HTML. Never compare it to decide whether they are in your game. |
| `joinUrl` | `string \| null` | A link to join them in their game, when there is one. Use it as a link only when it starts with `https://`. |
| `pictureUrl` | `string \| undefined` | Their profile picture, as for the player. |

```ts
// statusLabel is your own element.
const friends = await harmony.friends.list();
const online = friends.filter((friend) => {
  return friend.online;
});
statusLabel.textContent = `${online.length} of ${friends.length} friends online`;
```

### harmony.friends.onPresenceChanged

```ts
harmony.friends.onPresenceChanged(listener: (friend: Friend) => void): () => void
```

Calls the listener with a friend's whole, current entry each time they come online, go offline or change game. Returns a function that stops listening.

```ts
// showToast is your own.
const stopWatching = harmony.friends.onPresenceChanged((friend) => {
  if (friend.online && friend.currentGame) {
    showToast(`${friend.displayName} is playing ${friend.currentGame}`);
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
// openButton, level, readLevel and showToast are your own. readLevel checks every field and
// returns null for anything that isn't a valid level.
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
