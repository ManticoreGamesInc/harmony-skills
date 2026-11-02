# Unity

A WebGL (Web) build for Harmony, and the bridge from C#: the shared JavaScript file
(`bridge-js.md`) bundled into a `.jspre`, a `.jslib`, and one C# component with a web
implementation, an editor fake, and a do-nothing fallback. Menu names are from Unity 2022.3 and
Unity 6; check the current Unity manual if a setting has moved.

## Contents
- Export settings
- Bundling the JavaScript
- The .jslib
- The C# component
- The web implementation
- The editor fake
- Using it in the game
- Bridging other JavaScript modules

## Export settings

- **WebGL Template** (Player Settings > Resolution and Presentation): Default or Minimal. Never
  PWA: it registers a service worker, which hosted games can't use. A custom template based on
  Default or Minimal is fine if it keeps paths relative and adds no service worker.
- **Threads:** leave WebGL multithreading (native C/C++ multithreading) off. A hosted game can't
  count on cross-origin isolation, so ship single-threaded.
- **Compression** (Publishing Settings): Brotli is smallest and Gzip decompresses faster; both
  need the server to send the matching `Content-Encoding`, or the loader to decompress them
  itself (Decompression Fallback). Check the uploaded build loads; if it fails with a
  decompression or `Content-Encoding` error, turn on Decompression Fallback or switch compression
  off.
- **Name Files As Hashes:** on, so returning players reuse cached files.
- **Size:** Managed Stripping Level Medium or High (add a `link.xml` for anything reflection
  needs), IL2CPP Code Generation optimized for size, Enable Exceptions set to Explicitly Thrown
  Exceptions Only, unused packages removed, textures compressed and capped, audio in Vorbis.
- **Memory:** a small initial size that grows, and a maximum the game really needs; unload
  between levels.
- **Graphics:** WebGL 2 (keep it as the fallback if WebGPU is offered). Cap phones at
  `Application.targetFrameRate = 60`.
- **Input:** don't bind Shift+Tab, which opens the Harmony overlay by default. Set
  `WebGLInput.captureAllKeyboardInput = false` while an HTML text field is in use. Pointer lock
  needs a click and is released by the overlay; lock again on the player's next click, or when
  the overlay closes if the game has the bridge.
- **Background:** `Application.runInBackground` off in single player, on during online sessions.
- **Saves:** `PlayerPrefs` are stored in the browser for web builds. Without the bridge, keep one
  save for the device; with it, key them on `accountId`. Call `PlayerPrefs.Save()` after changes.
- **Package:** build to an empty folder, serve its parent and open the build's subfolder to test,
  then zip what's inside it (`index.html`, `Build/`, `TemplateData/`).

## Bundling the JavaScript

Keep the source in a folder Unity ignores (`WebBridge~/star-hopper-services.js`, with
`CONTAINER_ID = "unity-container"`, or `"unity-canvas"` with the Minimal template), and bundle it into a `.jspre`, which Unity puts into the
build's loader so it runs while Unity is still downloading:

```
npx esbuild WebBridge~/star-hopper-services.js --bundle --format=iife --target=es2017 --minify --outfile=Assets/Plugins/WebGL/StarHopperServices.jspre
```

## The .jslib

`Assets/Plugins/WebGL/StarHopperServices.jslib`:

```js
mergeInto(LibraryManager.library, {
  StarHopperServices_Listen: function (callback) {
    window.starHopperServices.listen(function (json) {
      var size = lengthBytesUTF8(json) + 1;
      var buffer = _malloc(size);
      stringToUTF8(json, buffer, size);
      {{{ makeDynCall('vi', 'callback') }}}(buffer);
      _free(buffer);
    });
  },
  StarHopperServices_Open: function (tab) {
    window.starHopperServices.open(UTF8ToString(tab));
  },
  StarHopperServices_Close: function () {
    window.starHopperServices.close();
  },
  StarHopperServices_IsOpen: function () {
    return window.starHopperServices.isOpen() ? 1 : 0;
  },
  StarHopperServices_RequestFriends: function () {
    window.starHopperServices.requestFriends();
  },
  StarHopperServices_SaveFile: function (base64, name, mimeType, extension) {
    window.starHopperServices.saveFile(UTF8ToString(base64), UTF8ToString(name), UTF8ToString(mimeType), UTF8ToString(extension));
  },
  StarHopperServices_OpenFile: function (mimeType, extension) {
    window.starHopperServices.openFile(UTF8ToString(mimeType), UTF8ToString(extension));
  },
});
```

`makeDynCall` needs Unity 2021.2 or newer.

## The C# component

One component the game talks to. It picks the implementation: the real bridge in web builds,
the fake in the Editor and development builds, and nothing elsewhere, so the fake never reaches a
release build.

```csharp
using System;
using System.Collections.Generic;
using UnityEngine;

[Serializable]
public class ServicesEvent {
    public string type;
    public bool open;
    public string kind;
    public string accountId;
    public string displayName;
    public string discriminator;
    public string pictureUrl;
    public string reason;
    public string code;
    public string outcome;
    public string name;
    public string base64;
    public FriendInfo[] friends;
}

[Serializable]
public class FriendInfo {
    public string accountId;
    public string displayName;
    public string discriminator;
    public bool online;
    public string currentGame;
    public string joinUrl;
}

public interface IGameServices {
    void Start(Action<string> onEvent);
    void Tick();
    void Open(string tab);
    void Close();
    bool IsOpen();
    void RequestFriends();
    void SaveFile(byte[] data, string suggestedName, string mimeType, string extension);
    void OpenFile(string mimeType, string extension);
}

// One in the first scene; it survives scene loads.
public class StarHopperServices : MonoBehaviour {

    [Tooltip("Editor and development builds only: the local fake's settings.")]
    [SerializeField] private FakeServicesSettings fakeSettings;

    public static event Action Ready;
    public static event Action Unavailable;
    public static event Action<ServicesEvent> SessionChanged;
    public static event Action<bool> OverlayChanged;
    public static event Action<FriendInfo[]> FriendsReceived;
    public static event Action<string> FriendsFailed;
    public static event Action<string> FileSaved;
    public static event Action<string, string, byte[]> FileOpened;   // outcome, name, data
    public static ServicesEvent Session { get; private set; }

    private static IGameServices backend;
    private static readonly Queue<string> Inbox = new Queue<string>();

    private void Awake() {
        DontDestroyOnLoad(gameObject);
#if UNITY_WEBGL && !UNITY_EDITOR
        backend = new WebGameServices();
#elif UNITY_EDITOR || DEVELOPMENT_BUILD
        backend = new FakeGameServices(fakeSettings);
#else
        backend = new NoGameServices();
#endif
        backend.Start((json) => Inbox.Enqueue(json));
    }

    private void Update() {
        backend.Tick();
        while (Inbox.Count > 0) {
            Dispatch(JsonUtility.FromJson<ServicesEvent>(Inbox.Dequeue()));
        }
    }

    private static void Dispatch(ServicesEvent e) {
        if (e == null) {
            return;
        }
        switch (e.type) {
            case "ready": Ready?.Invoke(); break;
            case "unavailable": Unavailable?.Invoke(); break;
            case "session": Session = e; SessionChanged?.Invoke(e); break;
            case "overlay": OverlayChanged?.Invoke(e.open); break;
            case "friends": FriendsReceived?.Invoke(e.friends ?? new FriendInfo[0]); break;
            case "friendsFailed": FriendsFailed?.Invoke(e.reason); break;
            case "fileSaved": FileSaved?.Invoke(e.outcome); break;
            case "fileOpened":
                byte[] data = string.IsNullOrEmpty(e.base64) ? null : Convert.FromBase64String(e.base64);
                FileOpened?.Invoke(e.outcome, e.name, data);
                break;
        }
    }

    public static void Open(string tab = "") { backend?.Open(tab); }
    public static void Close() { backend?.Close(); }
    public static bool IsOpen() { return backend != null && backend.IsOpen(); }
    public static void RequestFriends() { backend?.RequestFriends(); }
    public static void SaveFile(byte[] data, string suggestedName, string mimeType, string extension) { backend?.SaveFile(data, suggestedName, mimeType, extension); }
    public static void OpenFile(string mimeType, string extension) { backend?.OpenFile(mimeType, extension); }

}

// Release builds on other platforms: Harmony isn't there.
public class NoGameServices : IGameServices {

    private Action<string> emit;

    public void Start(Action<string> onEvent) { emit = onEvent; emit("{\"type\":\"unavailable\"}"); }
    public void Tick() {}
    public void Open(string tab) {}
    public void Close() {}
    public bool IsOpen() { return false; }
    public void RequestFriends() { emit("{\"type\":\"friendsFailed\",\"reason\":\"unavailable\"}"); }
    public void SaveFile(byte[] data, string suggestedName, string mimeType, string extension) { emit("{\"type\":\"fileSaved\",\"outcome\":\"unavailable\"}"); }
    public void OpenFile(string mimeType, string extension) { emit("{\"type\":\"fileOpened\",\"outcome\":\"unavailable\"}"); }

}
```

Follow the project's own naming and code style when writing it in; the structure is what matters.

## The web implementation

```csharp
#if UNITY_WEBGL && !UNITY_EDITOR
using System;
using System.Runtime.InteropServices;
using AOT;

public class WebGameServices : IGameServices {

    [DllImport("__Internal")] private static extern void StarHopperServices_Listen(Action<string> callback);
    [DllImport("__Internal")] private static extern void StarHopperServices_Open(string tab);
    [DllImport("__Internal")] private static extern void StarHopperServices_Close();
    [DllImport("__Internal")] private static extern int StarHopperServices_IsOpen();
    [DllImport("__Internal")] private static extern void StarHopperServices_RequestFriends();
    [DllImport("__Internal")] private static extern void StarHopperServices_SaveFile(string base64, string name, string mimeType, string extension);
    [DllImport("__Internal")] private static extern void StarHopperServices_OpenFile(string mimeType, string extension);

    private static Action<string> emit;

    public void Start(Action<string> onEvent) {
        emit = onEvent;
        StarHopperServices_Listen(OnEvent);
    }

    [MonoPInvokeCallback(typeof(Action<string>))]
    private static void OnEvent(string json) { emit?.Invoke(json); }

    public void Tick() {}
    public void Open(string tab) { StarHopperServices_Open(tab ?? ""); }
    public void Close() { StarHopperServices_Close(); }
    public bool IsOpen() { return StarHopperServices_IsOpen() == 1; }
    public void RequestFriends() { StarHopperServices_RequestFriends(); }
    public void SaveFile(byte[] data, string suggestedName, string mimeType, string extension) {
        StarHopperServices_SaveFile(Convert.ToBase64String(data), suggestedName, mimeType, extension);
    }
    public void OpenFile(string mimeType, string extension) { StarHopperServices_OpenFile(mimeType, extension); }

}
#endif
```

Files: browsers show file dialogs only during the player's click or key, and Unity handles input
a frame later. Test the dialogs in Chrome, Firefox and Safari, and handle `downloaded` and
`cancelled`.

## The editor fake

A local stand-in for Harmony, so the game's Harmony features can be played and tested in the
Editor and in development builds. It is not Harmony and its data is made up; it never runs in a
web build or a release build.

```csharp
using System;
using UnityEngine;

public enum FakeSessionKind { SignedOut, Guest, Account }

[CreateAssetMenu(menuName = "Star Hopper/Fake Services Settings")]
public class FakeServicesSettings : ScriptableObject {
    [Header("Local fake for testing. Not Harmony data.")]
    public FakeSessionKind session = FakeSessionKind.Account;
    public string displayName = "TestPlayer";
    public string discriminator = "T3ST";
    public bool attachFails = false;
    public float attachDelaySeconds = 0.5f;
    public KeyCode overlayKey = KeyCode.F10;
    public KeyCode nextSessionKey = KeyCode.F9;
    public FriendInfo[] friends = {
        new FriendInfo { accountId = "fake-friend-1", displayName = "Mina", discriminator = "4F2A", online = true, currentGame = "Star Hopper", joinUrl = "" },
        new FriendInfo { accountId = "fake-friend-2", displayName = "<b>Rex</b>", discriminator = "9KQ1", online = false, currentGame = "", joinUrl = "" },
    };
}
```

The second friend's name is deliberately markup, so a label with rich text on shows the problem.

```csharp
#if UNITY_EDITOR || DEVELOPMENT_BUILD
using System;
using System.IO;
using UnityEngine;

public class FakeGameServices : IGameServices {

    private readonly FakeServicesSettings settings;
    private Action<string> emit;
    private float attachAt;
    private bool attached;
    private bool open;
    private FakeSessionKind session;        // the fake's current session; F9 changes only this
    private FakeSessionKind assetSession;   // the asset's value, to notice Inspector changes

    public FakeGameServices(FakeServicesSettings settings) {
        this.settings = settings != null ? settings : ScriptableObject.CreateInstance<FakeServicesSettings>();
    }

    public void Start(Action<string> onEvent) {
        emit = onEvent;
        attachAt = Time.realtimeSinceStartup + settings.attachDelaySeconds;   // attach is asynchronous
        session = assetSession = settings.session;
        Debug.Log("Using the local fake for Harmony services (not Harmony data).");
    }

    public void Tick() {
        if (!attached && Time.realtimeSinceStartup >= attachAt) {
            attached = true;
            if (settings.attachFails) {
                emit("{\"type\":\"unavailable\"}");
                return;
            }
            emit("{\"type\":\"ready\"}");
            EmitSession();
        }
        if (!attached || settings.attachFails) {
            return;
        }
        if (Input.GetKeyDown(settings.overlayKey)) {
            open = !open;
            emit(JsonUtility.ToJson(new ServicesEvent { type = "overlay", open = open }));
        }
        if (Input.GetKeyDown(settings.nextSessionKey)) {
            session = (FakeSessionKind)(((int)session + 1) % 3);   // never written back to the asset
            EmitSession();
        }
        if (settings.session != assetSession) {
            session = assetSession = settings.session;            // changed in the Inspector
            EmitSession();
        }
    }

    private void EmitSession() {
        ServicesEvent e = new ServicesEvent { type = "session", kind = "signedOut" };
        if (session != FakeSessionKind.SignedOut) {
            e.kind = session == FakeSessionKind.Guest ? "guest" : "account";
            e.accountId = "fake-" + e.kind;    // a guest who becomes an account keeps its id on Harmony
            e.displayName = settings.displayName;
            e.discriminator = settings.discriminator;
            e.pictureUrl = "";
        }
        emit(JsonUtility.ToJson(e));
    }

    public void Open(string tab) {
        if (!open) {
            open = true;
            emit(JsonUtility.ToJson(new ServicesEvent { type = "overlay", open = true }));
        }
    }

    public void Close() {
        if (open) {
            open = false;
            emit(JsonUtility.ToJson(new ServicesEvent { type = "overlay", open = false }));
        }
    }

    public bool IsOpen() { return open; }

    public void RequestFriends() {
        if (!attached || settings.attachFails) {
            emit("{\"type\":\"friendsFailed\",\"reason\":\"unavailable\"}");
        } else if (session == FakeSessionKind.Guest) {
            emit("{\"type\":\"friendsFailed\",\"reason\":\"guest_not_allowed\"}");   // guests have no friends list
        } else if (session == FakeSessionKind.SignedOut) {
            emit("{\"type\":\"friendsFailed\",\"reason\":\"not_signed_in\"}");
        } else {
            emit(JsonUtility.ToJson(new ServicesEvent { type = "friends", friends = settings.friends }));
        }
    }

    public void SaveFile(byte[] data, string suggestedName, string mimeType, string extension) {
#if UNITY_EDITOR
        string path = UnityEditor.EditorUtility.SaveFilePanel("Save (local fake)", "", suggestedName, extension.TrimStart('.'));
#else
        string path = Path.Combine(FakeFolder(), Path.GetFileName(suggestedName));   // never outside the folder
#endif
        if (string.IsNullOrEmpty(path)) {
            emit("{\"type\":\"fileSaved\",\"outcome\":\"cancelled\"}");
            return;
        }
        File.WriteAllBytes(path, data);
        emit("{\"type\":\"fileSaved\",\"outcome\":\"saved\"}");
    }

    public void OpenFile(string mimeType, string extension) {
#if UNITY_EDITOR
        string path = UnityEditor.EditorUtility.OpenFilePanel("Open (local fake)", "", extension.TrimStart('.'));
#else
        string[] files = Directory.GetFiles(FakeFolder(), "*" + extension);
        string path = files.Length > 0 ? files[files.Length - 1] : "";
#endif
        if (string.IsNullOrEmpty(path)) {
            emit("{\"type\":\"fileOpened\",\"outcome\":\"cancelled\"}");
            return;
        }
        ServicesEvent e = new ServicesEvent {
            type = "fileOpened", outcome = "opened", name = Path.GetFileName(path),
            base64 = Convert.ToBase64String(File.ReadAllBytes(path)),
        };
        emit(JsonUtility.ToJson(e));
    }

    private static string FakeFolder() {
        string folder = Path.Combine(Application.persistentDataPath, "fake-files");
        Directory.CreateDirectory(folder);
        return folder;
    }

}
#endif
```

- Create the settings asset (Assets > Create > Star Hopper > Fake Services Settings) and assign it
  on the component. Change the session in the Inspector while playing, or press F9 to cycle
  signed out, guest and account; press F10 to open and close the "overlay"; tick Attach Fails to
  test the game without Harmony.
- The fake uses the old Input Manager for its keys; with the Input System package only, read the
  keys with `Keyboard.current` instead.
- A web build is still needed to test the real SDK: build, serve from a subfolder, and play it.

## Using it in the game

```csharp
private void OnEnable() {
    StarHopperServices.OverlayChanged += OnOverlay;
    StarHopperServices.SessionChanged += OnSession;
}

private void OnDisable() {
    StarHopperServices.OverlayChanged -= OnOverlay;
    StarHopperServices.SessionChanged -= OnSession;
}

private void OnOverlay(bool open) {
    if (open && !inOnlineMatch) {
        pauseMenu.Show();            // your own; the player resumes from it
    }
}

private void OnSession(ServicesEvent session) {
    nameLabel.richText = false;      // names are text, never markup
    nameLabel.text = session.kind == "signedOut" ? "Not signed in" : session.displayName;
    LoadSaveFor(session.kind == "signedOut" ? "device" : session.accountId);   // your own
}
```

- Show the `discriminator` beside the name where players need telling apart; key saves on
  `accountId`.
- Request friends only for `account` sessions; for a guest, offer a button that calls
  `StarHopperServices.Open("friends")`.
- `currentGame` is display text; never compare it to decide anything.

## Bridging other JavaScript modules

The same pattern wraps any JavaScript module; `bridge-js.md` has the wrapper for the
peer-to-peer room (`window.starHopperRoom`). Bundle it to
`Assets/Plugins/WebGL/StarHopperRoom.jspre`, then add a `.jslib` and a C# class:

```js
mergeInto(LibraryManager.library, {
  StarHopperRoom_Listen: function (callback) {
    window.starHopperRoom.listen(function (json) {
      var size = lengthBytesUTF8(json) + 1;
      var buffer = _malloc(size);
      stringToUTF8(json, buffer, size);
      {{{ makeDynCall('vi', 'callback') }}}(buffer);
      _free(buffer);
    });
  },
  StarHopperRoom_Create: function (version, look) { window.starHopperRoom.create(UTF8ToString(version), UTF8ToString(look)); },
  StarHopperRoom_Host: function () { window.starHopperRoom.host(); },
  StarHopperRoom_Join: function (code) { window.starHopperRoom.join(UTF8ToString(code)); },
  StarHopperRoom_Accept: function () { window.starHopperRoom.accept(); },
  StarHopperRoom_Deny: function () { window.starHopperRoom.deny(); },
  StarHopperRoom_Kick: function (id) { window.starHopperRoom.kick(UTF8ToString(id)); },
  StarHopperRoom_Send: function (text, id) { window.starHopperRoom.send(UTF8ToString(text), UTF8ToString(id)); },
  StarHopperRoom_SendFast: function (text, id) { window.starHopperRoom.sendFast(UTF8ToString(text), UTF8ToString(id)); },
  StarHopperRoom_Leave: function () { window.starHopperRoom.leave(); },
});
```

```csharp
using System;
using System.Collections.Generic;
#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
using AOT;
#endif

// The same calls everywhere, so game code compiles in the Editor and on every platform;
// only web builds have a room behind them.
public static class StarHopperRoom {

#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")] private static extern void StarHopperRoom_Listen(Action<string> callback);
    [DllImport("__Internal")] private static extern void StarHopperRoom_Create(string version, string look);
    [DllImport("__Internal")] private static extern void StarHopperRoom_Host();
    [DllImport("__Internal")] private static extern void StarHopperRoom_Join(string code);
    [DllImport("__Internal")] private static extern void StarHopperRoom_Accept();
    [DllImport("__Internal")] private static extern void StarHopperRoom_Deny();
    [DllImport("__Internal")] private static extern void StarHopperRoom_Kick(string id);
    [DllImport("__Internal")] private static extern void StarHopperRoom_Send(string text, string id);
    [DllImport("__Internal")] private static extern void StarHopperRoom_SendFast(string text, string id);
    [DllImport("__Internal")] private static extern void StarHopperRoom_Leave();

    public static bool IsAvailable { get { return true; } }
#else
    private static void StarHopperRoom_Listen(Action<string> callback) {}
    private static void StarHopperRoom_Create(string version, string look) {}
    private static void StarHopperRoom_Host() {}
    private static void StarHopperRoom_Join(string code) {}
    private static void StarHopperRoom_Accept() {}
    private static void StarHopperRoom_Deny() {}
    private static void StarHopperRoom_Kick(string id) {}
    private static void StarHopperRoom_Send(string text, string id) {}
    private static void StarHopperRoom_SendFast(string text, string id) {}
    private static void StarHopperRoom_Leave() {}

    public static bool IsAvailable { get { return false; } }   // hide online play here
#endif

    // Room events as JSON ({ type, id, text, code, look, reason, ... }), read in the game's Update.
    public static readonly Queue<string> Inbox = new Queue<string>();

    private static bool listening;

    public static void Create(string version, string lookJson) {
        if (!listening) {
            listening = true;
            StarHopperRoom_Listen(OnEvent);
        }
        StarHopperRoom_Create(version, lookJson);
    }

    public static void Host() { StarHopperRoom_Host(); }
    public static void Join(string code) { StarHopperRoom_Join(code); }
    public static void Accept() { StarHopperRoom_Accept(); }
    public static void Deny() { StarHopperRoom_Deny(); }
    public static void Kick(string id) { StarHopperRoom_Kick(id ?? ""); }
    public static void Send(string text, string id = "") { StarHopperRoom_Send(text, id ?? ""); }
    public static void SendFast(string text, string id = "") { StarHopperRoom_SendFast(text, id ?? ""); }
    public static void Leave() { StarHopperRoom_Leave(); }

#if UNITY_WEBGL && !UNITY_EDITOR
    [MonoPInvokeCallback(typeof(Action<string>))]
#endif
    private static void OnEvent(string json) { Inbox.Enqueue(json); }

}
```

- Build the look from the services bridge's session (`displayName` and `discriminator`), or a
  random handle for signed-out players; never send `accountId`.
- Parse each `data` event's `text` as the protocol says, validate every field, and show any text
  from it with `richText = false`.
- Set `Application.runInBackground = true` while in a room, so the host's simulation keeps
  running in a hidden tab; set it back after.
- Networking only exists in the web build: test it there with two browser windows. In the Editor,
  `StarHopperRoom.IsAvailable` is false: hide the online menu or show "Online play needs the web
  build".
