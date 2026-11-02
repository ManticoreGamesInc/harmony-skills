# The bridge's JavaScript file

Every engine's bridge starts with the same JavaScript file: it imports the Harmony SDK, attaches
as the page loads, and exposes a few functions on `window` that the engine calls. Events go back
to the engine as JSON strings, so every engine can read them. The engine reference
(`unity.md`, `godot.md`) shows how its side calls these functions and where the bundled file goes.

## Contents
- The file
- Events
- Bundling it
- Keeping it in step with sdk.md
- Bridging other JavaScript modules

## The file

Name it after the game (`star-hopper-services.js`), set the container id for the engine, and ask
the developer for the Game ID; never invent one.

```js
import { attachGameServices } from "@playharmony/sdk";

const GAME_ID = "YOUR_GAME_ID";
const GAME_NAME = "Star Hopper";
// The element the game draws in: Unity's Default template has "unity-container", its Minimal
// template only "unity-canvas"; Godot uses "canvas". Falls back to the first canvas on the page.
const CONTAINER_ID = "unity-container";

const listeners = [];
let harmony = null;
let lastSession = null;
let status = null;          // { type: "ready" } or { type: "unavailable" } once attaching settles

function emit(event) {
  const json = JSON.stringify(event);
  for (const listener of listeners) {
    listener(json);
  }
}

// Only the fields the game needs, and links only when they are https.
function sessionEvent(session) {
  if (session.kind !== "account" && session.kind !== "guest") {
    return { type: "session", kind: "signedOut" };
  }
  return {
    type: "session",
    kind: session.kind,
    accountId: session.accountId,
    displayName: session.displayName,
    discriminator: session.discriminator ?? "",
    pictureUrl: session.pictureUrl?.startsWith("https://") ? session.pictureUrl : "",
  };
}

function attach() {
  const container = document.getElementById(CONTAINER_ID) ?? document.querySelector("canvas");
  attachGameServices({ gameId: GAME_ID, container, gameInfo: { name: GAME_NAME } }).then(
    (handle) => {
      harmony = handle;
      handle.on("open", () => emit({ type: "overlay", open: true }));
      handle.on("close", () => emit({ type: "overlay", open: false }));
      handle.auth.onSessionChanged((session) => {
        lastSession = sessionEvent(session);
        emit(lastSession);
      });
      handle.auth.getSession().then(
        (session) => {
          lastSession = sessionEvent(session);
          status = { type: "ready" };
          emit(status);
          emit(lastSession);
        },
        () => {
          status = { type: "ready" };          // attached, but no session yet: one will arrive
          emit(status);
        },
      );
    },
    (error) => {
      // The game plays on without Harmony's features.
      console.warn("Harmony is not available", error);
      status = { type: "unavailable" };
      emit(status);
    },
  );
}

window.starHopperServices = {
  // The engine usually starts listening after attaching has settled, so replay what it missed.
  listen(listener) {
    listeners.push(listener);
    if (status) {
      listener(JSON.stringify(status));
    }
    if (lastSession) {
      listener(JSON.stringify(lastSession));
    }
  },
  open(tab) {
    harmony?.open(tab || undefined);
  },
  close() {
    harmony?.close();
  },
  isOpen() {
    return harmony?.isOpen() ?? false;
  },
  // Guests have no friends list (sdk.md: check the session is an account first), so the bridge
  // answers a guest's request with friendsFailed instead of calling friends.list.
  requestFriends() {
    if (!harmony || lastSession?.kind !== "account") {
      const reason = !harmony ? "unavailable" : lastSession?.kind === "guest" ? "guest_not_allowed" : "not_signed_in";
      emit({ type: "friendsFailed", reason });
      return;
    }
    harmony.friends.list().then(
      (friends) => emit({
        type: "friends",
        friends: friends.map((f) => ({
          accountId: f.accountId,
          displayName: f.displayName,
          discriminator: f.discriminator ?? "",
          online: f.online,
          currentGame: f.currentGame ?? "",
          joinUrl: f.joinUrl?.startsWith("https://") ? f.joinUrl : "",
        })),
      }),
      (error) => emit({ type: "friendsFailed", reason: error?.code ?? "error" }),
    );
  },
  // Files: data crosses to the engine as base64. Call these from the player's click or key.
  saveFile(base64, suggestedName, mimeType, extension) {
    if (!harmony) {
      emit({ type: "fileSaved", outcome: "unavailable" });
      return;
    }
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    harmony.files.save({
      data: new Blob([bytes], { type: mimeType }),
      suggestedName,
      types: [{ accept: { [mimeType]: [extension] } }],
    }).then(
      (result) => emit({ type: "fileSaved", outcome: result.outcome }),
      (error) => emit({ type: "fileSaved", outcome: "failed", code: error?.code ?? "internal" }),
    );
  },
  openFile(mimeType, extension) {
    if (!harmony) {
      emit({ type: "fileOpened", outcome: "unavailable" });
      return;
    }
    harmony.files.open({ types: [{ accept: { [mimeType]: [extension] } }] }).then(
      (result) => {
        if (result.outcome !== "opened") {
          emit({ type: "fileOpened", outcome: result.outcome });
          return;
        }
        const bytes = new Uint8Array(result.data);
        if (bytes.length > 4 * 1024 * 1024) {
          emit({ type: "fileOpened", outcome: "tooBig" });
          return;
        }
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        emit({ type: "fileOpened", outcome: "opened", name: result.name, base64: btoa(binary) });
      },
      (error) => emit({ type: "fileOpened", outcome: "failed", code: error?.code ?? "internal" }),
    );
  },
};

// Attach as soon as the page is parsed, without waiting for the engine to load.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", attach);
} else {
  attach();
}
```

## Events

Every event is a JSON object with a `type`. The engine side, and the editor fake, use the same
shapes:

| type | Fields | When |
| --- | --- | --- |
| `ready` | | Attaching worked |
| `unavailable` | | Attaching failed; the game plays on without Harmony |
| `session` | `kind` (`signedOut`, `guest`, `account`), `accountId`, `displayName`, `discriminator`, `pictureUrl` | At start, and whenever the player signs in, signs out or a guest creates an account |
| `overlay` | `open` | The overlay opened or closed, however it happened |
| `friends` | `friends`: `accountId`, `displayName`, `discriminator`, `online`, `currentGame`, `joinUrl` | After `requestFriends`, for an account |
| `friendsFailed` | `reason`: sdk.md's codes `guest_not_allowed` and `not_signed_in`, or `unavailable` without Harmony | After `requestFriends` for a guest or signed-out player, or when it fails |
| `fileSaved` | `outcome` (`saved`, `downloaded`, `cancelled`, `failed`, `unavailable`); `code` when `failed` (sdk.md's codes, such as `no_user_activation`, `busy`, `file_too_large`) | After `saveFile` |
| `fileOpened` | `outcome` (`opened`, `cancelled`, `tooBig`, `failed`, `unavailable`), `name`, `base64`; `code` when `failed` | After `openFile` |

Names, game titles and file names are text written by players and creators: the engine shows them
with rich text off. `pictureUrl` and `joinUrl` are empty unless they start with `https://`.

## Bundling it

The engine's web build has no bundler, so bundle the file with the SDK once, in the project
folder (Node 18 or newer):

```
npm init -y
npm install @playharmony/sdk@latest esbuild
npx esbuild <path to star-hopper-services.js> --bundle --format=iife --target=es2017 --minify --outfile=<output path from the engine reference>
```

- Run the `esbuild` line again whenever the file changes.
- When a new SDK comes out, run `npm install @playharmony/sdk@latest`, then the `esbuild` line,
  then make a new web build. Install the latest version and keep it up to date, as sdk.md asks.
- Add `node_modules/` to `.gitignore`, and keep both it and the source file out of the engine's
  build.

## Keeping it in step with sdk.md

- Every Harmony call in the file must be one sdk.md documents. The SDK is in early access and
  new calls arrive often, so check sdk.md for new ones when you update.
- Sign-in, chat, friend requests and account actions are not in the file on purpose: in a hosted
  game the overlay handles them. The game opens the overlay instead (`open("friends")`).

## Bridging other JavaScript modules

Any JavaScript module can be bridged the same way: a small wrapper file imports it, exposes a few
functions on `window`, and sends events back as JSON strings. The worked example is a
peer-to-peer room module, `p2p_room.js` (from the harmony-p2p-multiplayer skill, or the game's
own copy), which needs PeerJS. Its protocol, security and sync rules stay the same in every
engine; only the calls cross the bridge.

```js
import { Peer } from "peerjs";
import { P2PRoom, cleanId, cleanName } from "./p2p_room.js";

const EVENTS = ["state", "hosting", "request", "joined", "data", "left", "denied", "rekeyed", "dropped", "error"];
const listeners = [];
let room = null;

function emit(event) {
  const json = JSON.stringify(event);
  for (const listener of listeners) {
    listener(json);
  }
}

window.starHopperRoom = {
  listen(listener) {
    listeners.push(listener);
  },
  // look: the local player's look as JSON. The name comes from the services bridge's session,
  // or a random handle; never an account id.
  create(version, lookJson) {
    room?.leave(true);
    room = new P2PRoom({ Peer, namespace: "starhopper-", version, look: JSON.parse(lookJson) });
    for (const type of EVENTS) {
      room.on(type, (payload) => {
        const event = { type, ...payload };
        if (payload.look) {
          // A peer's look is untrusted: clean it before the engine sees it.
          event.look = { name: cleanName(payload.look.name), tag: cleanId(payload.look.tag ?? "", 4) };
        }
        emit(event);
      });
    }
  },
  host() {
    room?.host();
  },
  join(code) {
    room?.join(code);
  },
  accept() {
    room?.accept();
  },
  deny() {
    room?.deny();
  },
  kick(id) {
    room?.kick(id || undefined);
  },
  send(text, id) {
    room?.send(text, id || null);
  },
  sendFast(text, id) {
    room?.sendFast(text, id || null);
  },
  leave() {
    room?.leave();
    room = null;
  },
};
```

- Bundle it like the services file, into its own output (`star-hopper-room.js`), with
  `npm install --save-exact peerjs` first.
- `data` events carry the peer's message as a string. It is untrusted: the engine parses and
  validates every field, and shows any text from it with rich text or BBCode off.
- The room's heartbeat runs on a JavaScript timer, so it survives a hidden tab, but the engine's
  own loop may not: keep the host's simulation running while a session is live (see the engine
  reference).
- The editor fake can't test networking. Test a bridged multiplayer game in its web build, with
  two browser windows (two browser profiles, or a normal and a private window), as the
  multiplayer skill's testing guide describes.
