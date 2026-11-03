# The bridge's JavaScript file

Every engine's bridge starts with the same JavaScript file: it waits for Harmony's loader,
attaches as the page loads, and exposes a few functions on `window` that the engine calls. Events
go back to the engine as JSON strings, so every engine can read them. The engine reference
(`unity.md`, `godot.md`) shows how its side calls these functions and where the file goes.

## Contents
- The file
- Events
- Loading it
- Keeping it in step with sdk.md
- Bridging other JavaScript modules

## The file

Name it after the game (`star-hopper-services.js`), set the container id for the engine, and ask
the developer for the Game ID; never invent one. It is a plain script with no imports: Harmony's
loader script provides the SDK as the `PlayHarmony` global, so nothing needs bundling.

```js
(function () {
  const GAME_ID = "YOUR_GAME_ID";
  const GAME_NAME = "Star Hopper";
  // The element the game draws in: Unity's Default template has "unity-container", its Minimal
  // template only "unity-canvas"; Godot uses "canvas". Falls back to the first canvas on the page.
  const CONTAINER_ID = "unity-container";
  const LOAD_TIMEOUT_MS = 15000;   // how long to wait for Harmony's loader before playing on without it

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

  // Names, game titles and file names are written by players and creators, and the engine shows
  // them as plain text. Drop control and invisible formatting characters (newlines,
  // bidirectional overrides, zero-width), and cap the length so a long title can't break a label.
  function displayText(value, max = 64) {
    const text = typeof value === "string" ? value : "";
    const oneLine = text.replace(/[\t\n\r\u2028\u2029]+/g, " ").replace(/[\p{Cc}\p{Cf}]/gu, "");
    return Array.from(oneLine).slice(0, max).join("");
  }

  // Only the fields the game needs.
  function sessionEvent(session) {
    if (session.kind !== "account" && session.kind !== "guest") {
      return { type: "session", kind: "signedOut" };
    }
    return {
      type: "session",
      kind: session.kind,
      accountId: session.accountId,
      displayName: displayText(session.displayName),
      discriminator: displayText(session.discriminator),
    };
  }

  function setSession(session) {
    lastSession = sessionEvent(session);
    emit(lastSession);
  }

  function unavailable(error) {
    // The game plays on without Harmony's features.
    console.warn("Harmony is not available", error);
    status = { type: "unavailable" };
    emit(status);
  }

  // Resolves with the PlayHarmony global once Harmony's loader has added it, or null after the timeout.
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

  function attach() {
    const container = document.getElementById(CONTAINER_ID) ?? document.querySelector("canvas");
    whenHarmonyLoads(LOAD_TIMEOUT_MS).then((harmonySdk) => {
      if (!harmonySdk) {
        unavailable("Harmony's loader didn't load");
        return;
      }
      let handle = null;
      try {
        // From the script tag, attach returns the handle itself, not a promise.
        handle = harmonySdk.attach({ gameId: GAME_ID, container, gameInfo: { name: GAME_NAME } });
      } catch (error) {
        unavailable(error);
        return;
      }
      harmony = handle;
      handle.on("open", () => emit({ type: "overlay", open: true }));
      handle.on("close", () => emit({ type: "overlay", open: false }));
      handle.auth.onSessionChanged(setSession);
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
    });
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
    open() {
      harmony?.open();
    },
    close() {
      harmony?.close();
    },
    isOpen() {
      return harmony?.isOpen() ?? false;
    },
    // Call from the player's click or key press: sign-in may open a window. A session event
    // follows when sign-in ends, even when nothing changed.
    signIn() {
      harmony?.auth.signIn().then(setSession, (error) => console.warn("Sign-in didn't finish", error));
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
            displayName: displayText(f.displayName),
            discriminator: displayText(f.discriminator),
            online: f.online,
            currentGame: displayText(f.currentGame),
            currentGameId: f.currentGameId ?? "",   // empty means unknown, never a different game
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
          emit({ type: "fileOpened", outcome: "opened", name: displayText(result.name), base64: btoa(binary) });
        },
        (error) => emit({ type: "fileOpened", outcome: "failed", code: error?.code ?? "internal" }),
      );
    },
  };

  // A sign-in window returning to this page only finishes sign-in: don't attach in it.
  if (window.__MANTICORE_AUTH_RETURN__) {
    return;
  }
  // Attach as soon as the page is parsed, without waiting for the engine to load.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach);
  } else {
    attach();
  }
})();
```

## Events

Every event is a JSON object with a `type`. The engine side, and the editor fake, use the same
shapes:

| type | Fields | When |
| --- | --- | --- |
| `ready` | | Attaching worked |
| `unavailable` | | Harmony's loader didn't load in time, or attaching failed; the game plays on without Harmony |
| `session` | `kind` (`signedOut`, `guest`, `account`), `accountId`, `displayName`, `discriminator` | At start, whenever the player signs in, signs out or a guest creates an account, and when `signIn` ends |
| `overlay` | `open` | The overlay opened or closed, however it happened |
| `friends` | `friends`: `accountId`, `displayName`, `discriminator`, `online`, `currentGame`, `currentGameId` | After `requestFriends`, for an account |
| `friendsFailed` | `reason`: sdk.md's codes `guest_not_allowed` and `not_signed_in`, or `unavailable` without Harmony | After `requestFriends` for a guest or signed-out player, or when it fails |
| `fileSaved` | `outcome` (`saved`, `downloaded`, `cancelled`, `failed`, `unavailable`); `code` when `failed` (sdk.md's codes, such as `no_user_activation`, `busy`, `file_too_large`) | After `saveFile` |
| `fileOpened` | `outcome` (`opened`, `cancelled`, `tooBig`, `failed`, `unavailable`), `name`, `base64`; `code` when `failed` | After `openFile` |

Names, game titles and file names are text written by players and creators. The file cleans them
for display (no control or invisible characters, at most 64 characters), and the engine still
shows them with rich text off. `currentGame` is for showing only; to tell whether a friend is in this game,
compare `currentGameId` with the Game ID. An empty `currentGameId` means Harmony doesn't know the
friend's game, never that it is a different one.

## Loading it

A Unity or Godot web build has no JavaScript build step, so the page loads Harmony the way sdk.md
describes for a game without one: a script tag for Harmony's loader, then the bridge file.
First in the page's `<head>`:

```html
<script src="https://cdn.playharmony.ai/v1/loader.js"></script>
<script src="star-hopper-services.js"></script>
```

- Copy the loader tag exactly: its URL is permanent. Keep it a plain script, first in `<head>`,
  with no `async`, `defer`, `type="module"` or `integrity`.
- `PlayHarmony.attach` returns the handle itself, not a promise: never `await` it. The engine
  starts without waiting for Harmony, and the bridge plays on without it after the timeout.
- The engine reference says where these tags go (Unity's WebGL template, Godot's Head Include)
  and how the file reaches the build folder.
- The loader serves the current SDK, so the game stays on the latest version without a rebuild.
  There is no npm install and no bundling for the services file.
- To test a local web build against the SDK, load `https://cdn.playharmony.ai/v1/fake-loader.js`
  in place of `loader.js` in the served build's page. The bridge attaches to Harmony's fake: the
  real SDK with bot friends and chat, no sign-in, and `fake` shown in the overlay. Swap
  `loader.js` back before packaging; the uploaded page always loads `loader.js`.
- In the window a player signs in through, the page only finishes sign-in: the bridge doesn't
  attach there, and the engine reference shows how to keep the engine from starting there too.

## Keeping it in step with sdk.md

- Every Harmony call in the file must be one sdk.md documents. The SDK is in preview: new calls
  arrive often, and an update may still change or remove one, so check the file against sdk.md
  when it changes.
- `signIn` is in the file for a game that has its own sign-in button; the game calls it only from
  the player's click or key press.
- Chat, friend requests and account actions are not in the file on purpose: in a hosted game the
  overlay handles them. The game opens the overlay instead (`open()`).
- Data crosses the bridge only as arguments to these functions and as JSON event strings. Never
  build JavaScript source from game or player data and run it (`eval`, `new Function`, a string
  passed to `setTimeout`, a `<script>` element or `import()` with a URL from data, Godot's
  `JavaScriptBridge.eval`, Unity's `Application.ExternalEval`), and never open a URL from data.

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
        // type last, so no field of the payload can replace it. The error event has a type of
        // its own, which the engine gets as errorType.
        const event = { ...payload, type };
        if (type === "error") {
          event.errorType = payload.type;
        }
        if (type === "request" || type === "joined") {
          // A peer's look is untrusted, and may not even be an object: clean it before the
          // engine sees it. Harmony names are up to 20 characters.
          const look = payload.look !== null && typeof payload.look === "object" ? payload.look : {};
          event.look = { name: cleanName(look.name, 20), tag: cleanId(look.tag, 4) };
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

- Unlike the services file, this one imports modules, so bundle it once in the project folder
  (Node 18 or newer), to the output path from the engine reference:

  ```
  npm init -y
  npm install --save-exact peerjs
  npm install esbuild
  npx esbuild <path to star-hopper-room.js> --bundle --format=iife --target=es2017 --minify --outfile=<output path from the engine reference>
  ```

  Run the `esbuild` line again whenever the file changes. Add `node_modules/` to `.gitignore`,
  and keep both it and the source file out of the engine's build.
- `data` events carry the peer's message as a string. It is untrusted: the engine parses and
  validates every field, and shows any text from it with rich text or BBCode off.
- `request` and `joined` carry only the look's cleaned `name` and `tag`. `error` events carry
  the room's error type as `errorType`, since `type` is the event's own name.
- The room's heartbeat runs on a JavaScript timer, so it survives a hidden tab, but the engine's
  own loop may not: keep the host's simulation running while a session is live (see the engine
  reference).
- The editor fake can't test networking. Test a bridged multiplayer game in its web build, with
  two browser windows (two browser profiles, or a normal and a private window), as the
  multiplayer skill's testing guide describes.
