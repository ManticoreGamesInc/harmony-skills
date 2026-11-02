# Multiplayer UI

## Contents
- Match the project first
- Screens and what each needs
- Text that tested well
- Small details that mattered

## Match the project first

Multiplayer adds a handful of screens to a game that already has a look. They should read as
part of that game, not as a bolted-on network panel. Before building any of them, survey the
project:

1. **UI technology.** Use whatever the game already uses: a DOM/HTML overlay,
   React/Vue/Svelte, the engine's own UI objects, a canvas UI library. Don't add a
   second UI framework for the lobby.
2. **Style source.** Find the stylesheet, theme, or style constants (CSS variables, a
   theme module, a colors file) and reuse its colors, fonts, sizes, spacing, borders and
   button classes. Add new classes next to the existing ones, in the same naming pattern.
3. **Existing building blocks.** Look for the game's confirm dialog, popup/modal, toast or
   banner, list row, toggle, text field, and copy the closest one rather than designing new
   ones. The consent notice should look like the game's other confirmations; the join request
   like its other important prompts.
4. **Conventions around actions.** If the game shows key or button hints next to actions,
   multiplayer actions get them too (Accept / Deny, Ready, Copy code). If it plays a click
   sound, routes audio through a mixer, supports gamepad navigation, closes popups on Esc or a
   back button, or localizes strings, follow the same paths.
5. **Settings storage.** Store "consent shown", last name, and "hide my IP" in the same place
   the game keeps its other settings.
6. **Code conventions.** Write the screens and the game's network code in the project's style
   (naming case, file layout, event pattern, project rules files like `AGENTS.md` or `CLAUDE.md`).
   The room module itself stays a vendored copy of `scripts/p2p_room.js`, unchanged, so its
   tests still run against it.

Read two or three existing screens before writing a new one, and name which one each new
screen is modeled on. If the project has no UI yet, keep the screens plain and put every color
and size in one place so they can be themed later.

## Screens and what each needs

**Room panel** (in the lobby, main menu, wherever players gather)
- A name field, saved with the game's settings, that starts as a random handle
  (`RustySprocket42`). In a game that already uses the Harmony SDK, start it with the player's
  Harmony name instead (`harmony.md`).
- Host and Join buttons; Join opens a code field that takes Ctrl+V. A Paste button only where
  the page can read the clipboard (not in a game hosted on Harmony), focusing the field when the
  read fails.
- While hosting: the code, hidden until SHOW, grouped `XXXX-XXXX-XXXX`, with Copy and New
  Code. The friend's name tag and a Kick button once someone is in.
- Status line driven by the room state ("Opening a room...", "Waiting for your friend to
  join...", "Waiting for the host to let you in...", errors in plain words).
- The IP footnote, always visible.
- Leave button.

**Consent notice** (first host, first join). Game's confirm-dialog style, Continue / Cancel.

**Join request** (host). Centered, over everything, can't be missed or closed by accident:
"<Name> wants to join. Only let in people you trust." Accept / Deny. If it closes on Esc,
Esc means Deny.

**Ready-up** (guest). The main play button becomes READY once the host has picked; shows the
host's pick next to it. A short countdown banner both players see. A lone host gets "Play
solo". When a button is disabled because of the room, the button says why.

**In-game**
- Partner row on the HUD: name, health bar, down state.
- Name tag over the partner's avatar (`NAME [LV n]`); keep it under menus and overlays.
- Partner marker on the minimap; distinct when down.
- Revive ring on the ground and a progress meter.
- Shared objectives say who you're waiting for ("WAITING FOR <name>"), sized to fit the
  longest name the game allows (16 characters by default, 20 for Harmony names).
- Messages for partner events ("<name> is down", "<name> left").
- An Invite button on the HUD, if players can open a room mid-run. It opens the same room
  panel, which has to reopen from the HUD after it's closed, and behaves per room state (no
  room: host; hosting: show the code; in a room as guest: hidden).

**Phones (375 px wide).** The HUD gains a teammate indicator and an Invite button in co-op,
which can crowd the rest of the HUD. Check the co-op HUD at 375 px and drop or fold
the least important controls on phones.

**Platform invites** (on platforms whose friends list or chat can send invites from the game;
Harmony's can't, see `harmony.md`). If the platform's chat doesn't make links clickable, send only the code, not a URL. Reset any "Sent" state on
the friend rows whenever the code changes, or the host thinks a friend already has the new
code.

## Text that tested well

| Where | Text |
|---|---|
| Host consent | Hosting shares your IP address with anyone who tries to join with your code, even if you turn them away. Only give your code to people you trust. |
| Join consent | Joining shares your IP address with the host. Only join rooms from people you trust. |
| Room footnote (host) | Anyone who connects can see your IP address. Only share codes with people you trust. |
| Room footnote (guest) | The host can see your IP address. |
| Join request | <Name> wants to join. Only let in people you trust. |
| After a kick | New code ready. The old one no longer works. |
| Bad code | No room with that code. Check it with your friend. |
| Join timed out | Couldn't connect. The code may be out of date, or this network blocks direct connections. |
| Hide my IP, no relay | Can't reach the relay server, so your IP can't be hidden right now. Try again, or turn off Hide my IP. |

## Small details that mattered

- Peer names go into labels with markup off (`textContent`, or a plain text object in the engine).
- A world-space name tag drawn with a separate camera or overlay can render above menus;
  hide it whenever a full-screen menu or a screenshot capture is up.
- Any popup that frees the cursor must hand it back correctly when it closes (and after the
  window loses and regains focus), or players lose the cursor in the lobby.
- Disabled text and key hints still need readable contrast.
- Don't make banners full width by default; place them near the control they relate to
  (the countdown sits above the play button).
