# Rooms in a game hosted on Harmony

Harmony hosts web games and adds its overlay (sign-in, friends, chat) to each one. It doesn't
run game servers, match players or relay game traffic, so a Harmony game that wants online play
brings its own, and the P2P rooms in this skill are one way to do that. Everything else in this
skill applies unchanged. This file covers what is different on Harmony.

**A game doesn't need the Harmony SDK (`@playharmony/sdk`) or a Game ID for any of this.**
Harmony adds its overlay to every uploaded game with no code, and many games never install the
SDK. Without it, players type a name and invite friends by copying the room code, and
everything in this skill works. When the game already uses the SDK, it can add two extras: the
player's Harmony name as the starting name, and an Invite button that opens the overlay's chat.
Don't install the SDK only for these. Every SDK call below sits behind a check that the game
has the SDK, so the game runs the same without it.

The SDK's docs for agents are at https://playharmony.ai/developers/sdk.md; read them before
calling the SDK, and use only the calls they list. The SDK is in early access, so where this
file and those docs differ, follow the docs.

## Contents
- What Harmony does and doesn't do for multiplayer
- Player names
- Inviting friends
- The overlay and pausing
- The game's frame
- Before release

## What Harmony does and doesn't do for multiplayer

- **No invite or room API.** The game can't send chat messages, invites or friend requests,
  with or without the SDK. The overlay handles those. Players share the room code themselves.
- **Friends are read only, and only with the SDK.** With an account session,
  `harmony.friends.list()` gives the
  player's friends with `online` and `currentGame`. That is enough for a hint ("3 friends
  online") on the room panel. It isn't a way to find or join a room.
- **`currentGame` is display text.** Creators write game titles freely. Never compare it to
  decide whether a friend is in your game, and show it as text, never HTML.
- **Signaling and TURN are yours.** The free public PeerJS server is fine for testing. For a
  launch, run your own (`self_hosting.md`).

## Player names

Players type their name in a field on the room panel, saved with the game's settings. It
starts as a random handle (`RustySprocket42`), so a player who never touches it still has a
name. That is all a game without the SDK needs.

In a game that already uses the SDK, start the field with the player's Harmony name instead.
The player can still change it:

```js
// harmony is the handle from attachGameServices in a game that uses the SDK; null otherwise.
async function startingName() {
	const saved = loadSettings().roomName;   // what the player typed last time, if anything
	if (saved) {
		return { name: saved, tag: "" };
	}
	if (harmony) {
		const session = await harmony.auth.getSession();
		if (session.kind === "account" || session.kind === "guest") {
			return { name: session.displayName, tag: session.discriminator ?? "" };
		}
	}
	return { name: randomHandle(), tag: "" };   // randomHandle is your own, as in RustySprocket42
}
```

- **Send only the name and the tag.** Never put `accountId`, tokens or `pictureUrl` in the
  look or any other message. Every peer, and anyone who tries the code, sees what you send.
- **A name from a peer proves nothing.** Over P2P, any client can claim any name, including a
  Harmony player's. Clean it with `cleanName(name, 20)` (Harmony names are up to 20
  characters) and the tag with `cleanId(tag, 4)`, like any other peer input, and never show it as a verified Harmony identity.
- **Show the tag.** Two players can share a name. Show the 4-character Harmony tag beside it
  when there is one, or a short tag of your own otherwise (see "Validating peer input" in
  `security.md`), wherever players pick someone (join request, kick, partner row).
- **Follow sign-in changes (SDK only).** Listen with `harmony.auth.onSessionChanged` and send
  an updated look while in a room, so a guest who creates an account mid-session shows the new
  name. Leave a name the player typed alone.

## Inviting friends

The game can't send invites, so inviting is sharing the code, and Copy does that in every
game:

- **Copy** puts the code on the clipboard. Say what to do next: "Code copied. Send it to a
  friend." If the copy fails, select the code on screen so the player can copy it themselves.
  Players paste it into Harmony's chat, or anywhere else they talk.
- **Invite friends (SDK only).** In a game that already uses the SDK, this button copies the
  code and opens the overlay's chat: `harmony.open("chat")`. Say what to do next: "Code
  copied. Paste it to a friend in chat." Without the SDK, leave the button out; Copy does the
  job.
- Send the bare code, never a URL. Chat may not make links clickable, and a code reads
  cleanly when typed.

## The overlay and pausing

The overlay sits over every game on Harmony, with or without the SDK. A game without the SDK
isn't told when it opens (the window only gets a `blur` event), which is fine in a room: the
world keeps running anyway, and the overlay takes the player's input while it is open.

A game that uses the SDK hears it open and close (`harmony.on("open")` and
`harmony.on("close")`) and normally pauses. In a room, don't: a pause on one machine desyncs
the others.

- **Solo, with the SDK:** pause on open, resume on close, as usual.
- **In a room:** keep the shared world running and keep sending heartbeats and state. Stop the
  local player's input (the overlay takes input anyway). With the SDK, also show the partner a
  short notice ("<name> is in the Harmony menu"). The guest's own avatar stands still; it
  doesn't vanish.
- **Host in the overlay:** the host's simulation keeps ticking. The overlay sits over the game
  in the same tab, so the tab isn't hidden and the render loop keeps running.

## The game's frame

A Harmony game runs in a frame on its own address, inside Harmony's page.

- **Pasting a code.** Reading the clipboard doesn't work in a hosted game, so there is no Paste
  button: players paste into the code field with Ctrl+V, Cmd+V or a long press. Writing to the
  clipboard (a Copy button) works. Clean pasted text as usual.
- **Where settings live.** Keep the "consent shown" flag and the typed name in `localStorage`
  or `IndexedDB` with the game's other settings. In a game that uses the SDK, key them on the
  player's `accountId` when there is one, so players sharing a device each see the consent
  notice.
- **Bundle PeerJS** with the game's build rather than loading it from a CDN.

## Before release

- Test with two players on the uploaded build on Harmony, not only on your own server: host
  in one browser, join from another on a different network. Harmony's docs don't say whether
  the frame limits WebSocket or WebRTC connections, so confirm signaling, the direct
  connection and TURN all work there.
- If the game uses the SDK, also play a session without it (on a local server, where it
  isn't attached), to check the typed name and Copy still work.
- Bump the room version with every build you upload. A player with an old tab open then gets
  the "different versions" deny instead of a broken session; make that message say to reload
  the page.
