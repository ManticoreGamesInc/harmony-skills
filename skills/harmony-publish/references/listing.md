# The listing

The last step of publishing: write every field of the My Creations upload form into one file,
in the form's order, so the developer fills in the form by copying from it. Write it to
`release/<game>-<version>-listing.md`, next to the package.

Draft every field from what the project shows (its code, README, design notes, the game's own
title screen and how-to-play), then go through the draft with the developer. The title, the
description, the platforms and the Players boxes are their call; never submit or upload anything.

## Contents
- The form, field by field
- Supported platforms
- Players
- A new version of a game that's already up
- The listing file

## The form, field by field

A new game's form asks for these, in this order:

| # | Field | Rules |
| --- | --- | --- |
| 1 | Title | Required. 3 to 80 characters, counted as code points, with at least one visible character. |
| 2 | Description | Optional. Up to 2,000 characters. |
| 3 | Tags | Picked in the form from Harmony's tag lists. |
| 4 | Supported platforms | PC, Mobile, Game controller and VR, each Supported, Unknown or Not supported. Once Mobile is Supported, the form also asks for Portrait and Landscape. |
| 5 | Players | Required. Checkboxes: Single player, Local multiplayer, Online multiplayer, Co-op. Tick at least one; with none, the form says "Choose at least one." A new game starts with Single player ticked. |
| 6 | Your game file | Required. One `.html` file or a `.zip`. |
| 7 | Thumbnail | A 16:9 picture. |
| 8 | Preview movie | If the form shows it. |
| 9 | Screenshots | If the form shows it. |
| 10 | Banner image | Optional: background art and a title logo, plus an optional Mobile portrait image. |
| 11 | Features: Chat | One checkbox, on by default: players can chat with each other in the game's overlay. |
| 12 | Release notes | Optional. Up to 2,000 characters. |

The form has no fields for age rating, content warnings or languages, so don't write any.
Upload limits (the game file's size and file count) are shown on the form, so don't
state them. The media slots' sizes and formats are fixed rules on the form, and the store media
step follows them; where the form shows something different, the form wins.

After the game is created, its page in My Creations shows its Game ID. Only a game that uses
the Harmony SDK needs it, in its `attach` call (`PlayHarmony.attach` in a game that loads the
SDK with a script tag). A game without the SDK needs no Game ID, before or after uploading.

### Title

- The game's name as players should see it, matching its title screen.
- Count code points, not bytes: `[...title].length` in JavaScript, `len(title)` in Python.
- No version numbers, "demo", or engine names, unless they are really part of the name.

### Description

Write it for a player deciding whether to click, not for a developer:

1. One or two sentences: what you do in the game and what makes it fun.
2. A short list of what's in it: modes, number of levels, online play, unlockables.
3. How to play: the controls for each platform the game supports, in a line each.
4. Anything a player needs to know: "Best with a controller", "Saves in this browser only".

Keep it well under 2,000 characters; most good descriptions are 400 to 900. Say only what the
game really has. Plain text: no HTML, and don't rely on Markdown rendering.

### Tags

Harmony supplies the tag lists, their groups and how many tags each group allows, and they can
change. So don't name exact tags. Write down what kinds of tags fit, such as the genre
(puzzle, racing, shooter), the mood or art style, and the session length, and have the developer
pick the closest ones in the form. How many people play goes in Players, not in tags.

### Media

Point at the files the store media step made, when the game has them (a `store-media/` folder,
for example): `thumbnail.png`, `preview.mp4`, `screens/1.png` onward in order, and the banner's
`banner/background.webp` and `banner/logo.png`, and the banner's Mobile portrait,
`banner/portrait.webp`, if the store media step made one. Missing ones are listed as missing,
not invented. Word the preview movie and screenshots as "if the form shows it".

The banner's Mobile portrait image is optional. On phones it is shown instead of the background
art: 9:16, 1440x2560 preferred and at least 1080x1920, WebP, JPEG or PNG up to 10 MB, with no
text, titles or logos, and the main subject in the upper half. The
`harmony-store-media` skill makes it as `banner/portrait.webp`; point at that file, or list it
as missing.

### Chat

Chat is on by default. Leave it on unless the developer has a reason to turn it off, and say what
it does: players can chat with each other in the game's overlay.

## Supported platforms

Set each row from evidence in the project, then confirm with the developer. "Supported" means it
was played and works there from start to finish; when in doubt, "Unknown".

| Platform | Look for | Supported when |
| --- | --- | --- |
| PC | keyboard and mouse handlers (`keydown`, `pointerdown`, `click`) | the whole game, menus included, works with keyboard and mouse |
| Mobile | touch or pointer controls (`touchstart`, `pointerdown` with on-screen buttons or gestures), a viewport `<meta>`, layouts that fit a phone | it was played on a phone or in the browser's device mode at phone size, menus included, with no keyboard needed |
| Game controller | `navigator.getGamepads`, `gamepadconnected` | menus and play both work with a controller |
| VR | `navigator.xr`, `requestSession("immersive-vr")` | the game has a VR mode that was tried in a headset |

- **Mobile orientations.** Once Mobile is Supported, the form asks for Portrait and Landscape.
  Tick only the orientations the game was played in at phone size, menus included. A game that
  only fits one way gets only that one.
- "Not supported" when the game clearly can't be played that way (keyboard-only typing games on
  Mobile, no controller code at all).
- "Unknown" when the code is there but nobody has tried it.
- Don't mark a platform Supported to reach more players. A player who can't play bounces.

## Players

Tick every box that applies, from what the game has, then confirm with the developer. The form
needs at least one.

| Box | Tick when |
| --- | --- |
| Single player | one person can play it alone. Tick it unless the game has no solo mode. |
| Local multiplayer | several people play on the same device: a shared keyboard, split screen, several controllers, taking turns. |
| Online multiplayer | people play over the network, such as rooms made with `harmony-p2p-multiplayer`. |
| Co-op | players play together rather than against each other, locally or online. |

A versus-only game gets Local or Online multiplayer without Co-op. A game with a co-op mode and a
versus mode gets Co-op as well.

## A new version of a game that's already up

The form for a new version asks for:

1. Your game file: the new `.html` or `.zip`.
2. Release notes: optional, up to 2,000 characters. What changed, for players: new things
   first, then fixes. Leave out internal changes.
3. Edit details: the fields above, which stay as they are unless edited. List only what should
   change.
4. Going live: a choice between "Make live" and "Minor update". Tell the developer to choose it
   in the form.

## The listing file

```markdown
# <Game title> <version>: listing for My Creations

Fill in the form in this order. Copy each value across.

## 1. Title
<title>  (<n> characters)

## 2. Description
<description>

(<n> of 2,000 characters)

## 3. Tags
Pick in the form. Kinds that fit: <genre>, <mood or art style>, <session length>.

## 4. Supported platforms
- PC: <Supported | Unknown | Not supported>. <evidence>
- Mobile: <...>. <evidence>. Orientations: <Portrait, Landscape, or both>
- Game controller: <...>. <evidence>
- VR: <...>. <evidence>

## 5. Players (at least one)
- Single player: <ticked | not ticked>. <evidence>
- Local multiplayer: <...>. <evidence>
- Online multiplayer: <...>. <evidence>
- Co-op: <...>. <evidence>

## 6. Your game file
release/<game>-<version>.zip  (<files> files, <MB> MB unpacked; compare with the limits shown in the form)

## 7 to 10. Media
- Thumbnail: <path or "missing">
- Preview movie (if the form shows it): <path or "missing">
- Screenshots (if the form shows it): <paths, in order, or "missing">
- Banner (optional): <background path>, <logo path>, or "missing"
- Banner, Mobile portrait (optional): <path or "missing">

## 11. Features
- Chat: <on | off>

## 12. Release notes (optional)
<notes, or "none">

## After uploading
- Play the game on Harmony once before sharing it.
- Only if the game uses the Harmony SDK: the game's page in My Creations shows its Game ID. If
  the code still has the placeholder `YOUR_GAME_ID`, put the ID in, rebuild, and upload it as a
  new version.
```

For a new version, write the file with sections 1 to 4 of "A new version" instead, and list
only the details that change.
