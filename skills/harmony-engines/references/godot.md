# Godot

A Web export for Harmony, and the bridge from GDScript: Harmony's loader script and the shared
JavaScript file (`bridge-js.md`) loaded through the export's Head Include, and one autoload that
uses `JavaScriptBridge` in web builds and a local fake in the editor and debug builds. Names are
from Godot 4.3 and newer; check Godot's docs if a setting has moved.

## Contents
- Export settings
- Loading the JavaScript
- The autoload
- The editor fake
- Using it in the game
- Bridging other JavaScript modules

## Export settings

- **Renderer:** the web export runs on the Compatibility renderer (WebGL 2). Set it in Project
  Settings > Rendering > Renderer early, and build the look on it.
- **Thread Support:** off. A hosted game can't count on cross-origin isolation, so ship
  single-threaded; Godot 4.0 to 4.2 can only export threaded web builds, so use 4.3 or newer.
- **Progressive Web App:** off. It registers a service worker, which hosted games can't use.
- **VRAM Texture Compression:** For Desktop covers desktop browsers and For Mobile covers phones.
  Turn on both to cover every device, at the cost of a bigger download.
- **C#:** check Godot's docs for whether your version can export C# projects to the web.
- **The page:** export to `index.html` in an empty folder; Canvas Resize Policy Adaptive; Focus
  Canvas on Start on.
- **Size:** exclude unused assets and editor-only folders with the preset's filters; Ogg Vorbis
  audio, mono for effects; textures no bigger than they appear.
- **Input:** don't bind Shift+Tab, which opens the Harmony overlay by default. Mouse capture
  needs a click and is released by the overlay; capture again on the player's next click, or
  when the overlay closes if the game has the bridge.
- **Audio:** browsers start audio after the player's first input; start the title music from
  that input.
- **Saves:** `user://` is stored in the browser for web builds. Without the bridge, keep one save
  for the device; with it, key save files on `accountId`.
- **Package:** export, copy the bridge file in if the game has one (below), serve the folder's parent and open the
  export's subfolder to test, then zip what's inside the export folder.

## Loading the JavaScript

Save the bridge file as `web_bridge/star-hopper-services.js`, with `CONTAINER_ID = "canvas"`.
There is nothing to install or bundle.

- Web export preset > **Head Include**, which Godot puts in the page's `<head>`, ahead of the
  engine's own scripts:

  ```html
  <script src="https://cdn.playharmony.ai/v1/loader.js"></script>
  <script src="star-hopper-services.js"></script>
  ```

- After each export, copy `web_bridge/star-hopper-services.js` next to `index.html` in the export
  folder. A small script that exports and copies keeps this from being forgotten.
- Exclude `web_bridge/*` from the export with the preset's filters.
- The loader serves the current SDK, so the game stays on the latest version without a new
  export.
- In the window a player signs in through, the page only finishes sign-in. The bridge doesn't
  attach there, but Godot's own page still starts the engine. To skip that, export with a Custom
  HTML Shell (a copy of Godot's default one) and wrap its `engine.startGame(...)` call in
  `if (!window.__MANTICORE_AUTH_RETURN__) { ... }`.

## The autoload

`star_hopper_services.gd`, added under Project Settings > Autoload as `StarHopperServices`. It
picks the implementation: `JavaScriptBridge` in web builds, the fake in the editor and debug
builds, and nothing in release builds on other platforms.

```gdscript
extends Node

signal ready_for_play
signal unavailable
signal session_changed(session: Dictionary)
signal overlay_changed(is_open: bool)
signal friends_received(friends: Array)
signal friends_failed(reason: String)
signal file_saved(outcome: String)
signal file_opened(outcome: String, file_name: String, data: PackedByteArray)

const FAKE_SETTINGS_PATH := "res://fake_services/fake_services_settings.tres"

var session: Dictionary = {}

var _web: JavaScriptObject
var _web_callback: JavaScriptObject  # keep a reference, or the callback is freed
var _fake: FakeGameServices


func _ready() -> void:
	if OS.has_feature("web"):
		_web = JavaScriptBridge.get_interface("starHopperServices")
		if _web == null:
			push_warning("The services bridge isn't on the page; check the Head Include.")
			_handle({"type": "unavailable"})
			return
		_web_callback = JavaScriptBridge.create_callback(_on_web_event)
		_web.listen(_web_callback)
	elif OS.is_debug_build():
		var settings: FakeServicesSettings = load(FAKE_SETTINGS_PATH) if ResourceLoader.exists(FAKE_SETTINGS_PATH) else FakeServicesSettings.new()
		_fake = FakeGameServices.new(settings, _handle)
		add_child(_fake)
	else:
		_handle({"type": "unavailable"})


func _on_web_event(args: Array) -> void:
	var event: Variant = JSON.parse_string(str(args[0]))
	if typeof(event) == TYPE_DICTIONARY:
		_handle(event)


func _handle(event: Dictionary) -> void:
	match event.get("type", ""):
		"ready":
			ready_for_play.emit()
		"unavailable":
			unavailable.emit()
		"session":
			session = event
			session_changed.emit(event)
		"overlay":
			overlay_changed.emit(bool(event.get("open", false)))
		"friends":
			friends_received.emit(event.get("friends", []))
		"friendsFailed":
			friends_failed.emit(str(event.get("reason", "error")))
		"fileSaved":
			file_saved.emit(str(event.get("outcome", "failed")))
		"fileOpened":
			var data := Marshalls.base64_to_raw(str(event.get("base64", ""))) if event.has("base64") else PackedByteArray()
			file_opened.emit(str(event.get("outcome", "failed")), str(event.get("name", "")), data)


func open_overlay() -> void:
	if _web:
		_web.open()
	elif _fake:
		_fake.open_overlay()


func close_overlay() -> void:
	if _web:
		_web.close()
	elif _fake:
		_fake.close_overlay()


func is_overlay_open() -> bool:
	if _web:
		return bool(_web.isOpen())
	return _fake != null and _fake.is_open


# Call from the player's click or key press: sign-in may open a window.
func sign_in() -> void:
	if _web:
		_web.signIn()
	elif _fake:
		_fake.sign_in()


func request_friends() -> void:
	if _web:
		_web.requestFriends()
	elif _fake:
		_fake.request_friends()
	else:
		_handle({"type": "friendsFailed", "reason": "unavailable"})


func save_file(data: PackedByteArray, suggested_name: String, mime_type: String, extension: String) -> void:
	if _web:
		_web.saveFile(Marshalls.raw_to_base64(data), suggested_name, mime_type, extension)
	elif _fake:
		_fake.save_file(data, suggested_name)
	else:
		_handle({"type": "fileSaved", "outcome": "unavailable"})


func open_file(mime_type: String, extension: String) -> void:
	if _web:
		_web.openFile(mime_type, extension)
	elif _fake:
		_fake.open_file(extension)
	else:
		_handle({"type": "fileOpened", "outcome": "unavailable"})
```

Follow the project's own naming and code style when writing it in; the structure is what matters.

Files and sign-in: browsers show file dialogs and sign-in windows only during the player's click
or key, and Godot handles input a frame later. Call `save_file`, `open_file` and `sign_in` straight
from the button's `pressed` handler, test them in Chrome, Firefox and Safari, and handle
`downloaded` and `cancelled`. If a browser blocks the sign-in window, the player can still sign in
from the overlay.

## The editor fake

A local stand-in for Harmony, so the game's Harmony features can be played and tested in the
editor and in debug builds. It is not Harmony and its data is made up; it never runs in a web
build or a release build.

`fake_services/fake_services_settings.gd`:

```gdscript
class_name FakeServicesSettings
extends Resource
## Local fake for testing. Not Harmony data.

@export_enum("signedOut", "guest", "account") var session_kind: String = "account"
@export var display_name: String = "TestPlayer"
@export var discriminator: String = "T3ST"
@export var attach_fails: bool = false
@export var attach_delay_seconds: float = 0.5
@export var overlay_key: Key = KEY_F10
@export var next_session_key: Key = KEY_F9
@export var friends: Array[Dictionary] = [
	{"accountId": "fake-friend-1", "displayName": "Mina", "discriminator": "4F2A", "online": true, "currentGame": "Star Hopper", "currentGameId": "YOUR_GAME_ID"},
	{"accountId": "fake-friend-2", "displayName": "[b]Rex[/b]", "discriminator": "9KQ1", "online": false, "currentGame": "", "currentGameId": ""},
]
```

The second friend's name is deliberately BBCode, so a label with BBCode on shows the problem.
Show names, game titles, file names and anything a peer sent in a plain `Label`, which never
parses BBCode. Where a `RichTextLabel` is needed, keep `bbcode_enabled` off for that text, or
escape it before adding it. Set
the first friend's `currentGameId` to the game's own Game ID, so the fake has a friend in this
game.
Save one as `res://fake_services/fake_services_settings.tres` and edit it in the Inspector.

`fake_services/fake_game_services.gd`:

```gdscript
class_name FakeGameServices
extends Node
## Local stand-in for Harmony in the editor and debug builds. Not Harmony data.

const KINDS: Array[String] = ["signedOut", "guest", "account"]

var is_open := false

var _settings: FakeServicesSettings
var _emit: Callable
var _attached := false


func _init(settings: FakeServicesSettings, emit: Callable) -> void:
	_settings = settings
	_emit = emit


func _ready() -> void:
	print("Using the local fake for Harmony services (not Harmony data).")
	await get_tree().create_timer(_settings.attach_delay_seconds).timeout  # attach is asynchronous
	_attached = true
	if _settings.attach_fails:
		_emit.call({"type": "unavailable"})
		return
	_emit.call({"type": "ready"})
	_emit_session()


func _unhandled_key_input(event: InputEvent) -> void:
	if not _attached or _settings.attach_fails or not event.is_pressed() or event.is_echo():
		return
	var key := (event as InputEventKey).keycode
	if key == _settings.overlay_key:
		if is_open:
			close_overlay()
		else:
			open_overlay()
	elif key == _settings.next_session_key:
		_settings.session_kind = KINDS[(KINDS.find(_settings.session_kind) + 1) % KINDS.size()]
		_emit_session()


func _emit_session() -> void:
	var kind := _settings.session_kind
	if kind == "signedOut":
		_emit.call({"type": "session", "kind": "signedOut"})
		return
	_emit.call({
		"type": "session",
		"kind": kind,
		"accountId": "fake-" + kind,
		"displayName": _settings.display_name,
		"discriminator": _settings.discriminator,
	})


func open_overlay() -> void:
	if not is_open:
		is_open = true
		_emit.call({"type": "overlay", "open": true})


func close_overlay() -> void:
	if is_open:
		is_open = false
		_emit.call({"type": "overlay", "open": false})


# The fake signs straight in as an account, and sends the session as the bridge does.
func sign_in() -> void:
	if not _attached or _settings.attach_fails:
		return
	_settings.session_kind = "account"
	_emit_session()


func request_friends() -> void:
	if not _attached or _settings.attach_fails:
		_emit.call({"type": "friendsFailed", "reason": "unavailable"})
	elif _settings.session_kind == "guest":
		_emit.call({"type": "friendsFailed", "reason": "guest_not_allowed"})  # guests have no friends list
	elif _settings.session_kind == "signedOut":
		_emit.call({"type": "friendsFailed", "reason": "not_signed_in"})
	else:
		_emit.call({"type": "friends", "friends": _settings.friends})


func save_file(data: PackedByteArray, suggested_name: String) -> void:
	DirAccess.make_dir_recursive_absolute("user://fake_files")
	var file := FileAccess.open("user://fake_files/" + suggested_name.get_file(), FileAccess.WRITE)
	if file == null:
		_emit.call({"type": "fileSaved", "outcome": "failed"})
		return
	file.store_buffer(data)
	_emit.call({"type": "fileSaved", "outcome": "saved"})


func open_file(extension: String) -> void:
	var names := DirAccess.get_files_at("user://fake_files") if DirAccess.dir_exists_absolute("user://fake_files") else PackedStringArray()
	for file_name in names:
		if file_name.ends_with(extension):
			var data := FileAccess.get_file_as_bytes("user://fake_files/" + file_name)
			_emit.call({"type": "fileOpened", "outcome": "opened", "name": file_name, "base64": Marshalls.raw_to_base64(data)})
			return
	_emit.call({"type": "fileOpened", "outcome": "cancelled"})
```

- Press F10 to open and close the "overlay", F9 to cycle signed out, guest and account; tick
  Attach Fails in the settings to test the game without Harmony. The game's own sign-in button
  signs the fake in as an account.
- Fake files live in `user://fake_files/` (Project > Open User Data Folder). Save a file there to
  test opening one.
- A web build is still needed to test the real SDK: export, copy the bridge in, serve from a
  subfolder, and play it. To try the bridge there against Harmony's fake (bot friends, no
  sign-in), swap the loader tag in the exported `index.html` for
  `https://cdn.playharmony.ai/v1/fake-loader.js`, and swap `loader.js` back, or export again,
  before packaging.

## Using it in the game

```gdscript
func _ready() -> void:
	StarHopperServices.overlay_changed.connect(_on_overlay_changed)
	StarHopperServices.session_changed.connect(_on_session_changed)


func _on_overlay_changed(is_open: bool) -> void:
	if is_open and not in_online_match:
		pause_menu.show()          # your own; it pauses, and the player resumes from it


func _on_session_changed(new_session: Dictionary) -> void:
	# A plain Label: names are text, never BBCode.
	name_label.text = "Not signed in" if new_session.kind == "signedOut" else new_session.displayName
	load_save_for("device" if new_session.kind == "signedOut" else new_session.accountId)  # your own
```

- Show the `discriminator` beside the name where players need telling apart; key saves on
  `accountId`.
- Request friends only for `account` sessions; for a guest, offer a button that calls
  `StarHopperServices.open_overlay()`.
- For a sign-in button of the game's own, call `StarHopperServices.sign_in()` from its `pressed`
  signal; a `session_changed` signal follows when sign-in ends. Without one, players sign in from
  the overlay.
- `currentGame` is display text; never compare it to decide anything. To tell whether a friend is
  in this game, compare `currentGameId` with the Game ID (`GAME_ID` in the JavaScript file); empty
  means unknown, never a different game.
- A file from `file_opened` is whatever the player picked: parse it, check every field's type
  and range, and show its name in a plain `Label`.
- Data reaches JavaScript only through `get_interface` calls and callbacks, as above. Never
  build code for `JavaScriptBridge.eval` from any value, even one you think is safe: a name or
  file name with a quote in it becomes code there. Never run untrusted text through
  `Expression.parse` and `execute`, `str_to_var`, or `bytes_to_var_with_objects`, which can build
  objects or call methods from the text.

## Bridging other JavaScript modules

The same pattern wraps any JavaScript module; `bridge-js.md` has the wrapper for the
peer-to-peer room (`window.starHopperRoom`). It imports PeerJS, so it needs bundling, unlike the
services file: keep its source in `web_bridge/star-hopper-room.js`, bundle it as `bridge-js.md`
shows to `web_bridge/dist/star-hopper-room.js`, add `<script src="star-hopper-room.js"></script>`
to the Head Include after the other two, copy the bundled file into the export folder with the
services file, and exclude `node_modules/*` from the export too. Talk to it from an autoload:

```gdscript
extends Node

signal room_event(event: Dictionary)  # { type, id, text, code, look, reason, ... }

var _room: JavaScriptObject
var _room_callback: JavaScriptObject  # keep a reference


func _ready() -> void:
	if OS.has_feature("web"):
		_room = JavaScriptBridge.get_interface("starHopperRoom")
	if _room:
		_room_callback = JavaScriptBridge.create_callback(_on_room_event)
		_room.listen(_room_callback)


func _on_room_event(args: Array) -> void:
	var event: Variant = JSON.parse_string(str(args[0]))
	if typeof(event) == TYPE_DICTIONARY:
		room_event.emit(event)


func is_available() -> bool:
	return _room != null


func create(version: String, look: Dictionary) -> void:
	if _room:
		_room.create(version, JSON.stringify(look))


func host() -> void:
	if _room:
		_room.host()


func join(code: String) -> void:
	if _room:
		_room.join(code)


func accept() -> void:
	if _room:
		_room.accept()


func deny() -> void:
	if _room:
		_room.deny()


func kick(peer_id: String) -> void:
	if _room:
		_room.kick(peer_id)


func send(text: String, peer_id: String = "") -> void:
	if _room:
		_room.send(text, peer_id)


func send_fast(text: String, peer_id: String = "") -> void:
	if _room:
		_room.sendFast(text, peer_id)


func leave() -> void:
	if _room:
		_room.leave()
```

- Build the look from the services autoload's session (`displayName` and `discriminator`), or a
  random handle for signed-out players; never send `accountId`.
- Parse each `data` event's `text` as the protocol says, validate every field, and show any text
  from it in a plain `Label`. Parse JSON with `JSON.parse_string`, check that the result is a
  `Dictionary` and that each field has the type you expect (`typeof`), read only the keys you
  know, check numbers with `is_finite` and clamp them, and allow-list strings. Never merge the
  parsed `Dictionary` into game state.
- Browsers stop the engine's loop in a hidden tab; the room's heartbeat keeps running in
  JavaScript, but the host's simulation pauses, so keep sessions short-lived in hidden tabs or
  warn the host.
- Networking only exists in the web build: test it there with two browser windows. In the editor,
  `is_available()` is false; hide the online menu or show "Online play needs the web build".
