# Screens

Progression shows up in four places: the results screen, the locker, the menus, and the stats
screen. Build them with the game's own UI technology, styles, fonts and sounds, as if they were
always part of it.

## Contents
- Results payout
- The locker
- Menus and stats
- Text and safety

## Results payout

After each round, show what the player earned and why:

- One row per reward line: "Orbs x14 ... +42 XP".
- Totals: "+180 XP", "+81 Sparks" (the game's currency name).
- "Level up! Level 6" when levels were gained, with the level bonus.
- "Unlocked: Ember, Comet" for free unlocks, and "New upgrade available: Quick feet".
- An XP bar that fills from the old value to the new one, wrapping on each level up.

A quit shows a short toast with the reduced payout instead of the full results screen. While
the save isn't known yet (with the SDK, before Harmony has answered), show the round's lines without totals and
pay out when the save loads (`saves.md`).

## The locker

The screen where players see, unlock and equip cosmetics, and buy upgrades. Name it for the
game's world: Garage, Wardrobe, Armory, Hangar, Sticker book.

Design it from the game's world rather than as a generic grid: a car on a turntable with parts
in a side rail, a wardrobe rack, an armory wall. Whatever the layout, keep these:

- One tab or section per slot, with a line saying what the slot changes, and an owned/total
  count.
- Every item visible with its name, its state and its one action, without hovering:
  - owned: Equip, or marked Equipped;
  - free: Claim;
  - buyable: the price and Buy, disabled with "Need 120 more" when short;
  - locked: what unlocks it and the progress toward it ("Win 10 rounds: 3/10", "Level 10").
- The equipped item clearly marked in each slot.
- A big preview of the selected item, drawn by the game, where the game can draw one.
- Level, XP bar and currency in view (full progression).
- Upgrades (full progression): name, blurb, current tier as pips, the next tier's level and
  cost, and the effect as a percentage.
- Items on a solid surface, never floating straight on a bright scene.
- Keyboard, gamepad and touch all work; Back and Esc return to the menu; it fits a phone in
  portrait (about 375 px wide) as well as a desktop.

Unlock progress uses the stats screen's labels ("Battles fought 3/5"), never raw stat keys.

## Menus and stats

- Main menu (full progression): a small level badge and the currency near the title or the
  player's name, and a button into the locker.
- Stats screen: Level and currency rows at the top (full), then the career stats.
- With the SDK, signed in on Harmony: show the player's name from the session with the progress,
  so players sharing a device can see whose save is loaded. Without the SDK there is one save for
  the device and no name to show.
- Settings: Export save and Import save buttons (`saves.md`; a download and a file picker
  without the SDK, Harmony's dialogs with it), with a line saying saves stay in this browser on
  this device otherwise.

## Text and safety

- Show the player's name, and the name of any file they import, as text: `textContent` or the
  engine's plain text object with rich text off, never `innerHTML` or HTML built from strings.
- Clean names first: keep letters, marks, digits, spaces and `.`, `_`, `-` (which drops bidi
  overrides, zero-width characters and line breaks), and cap the length by code point. Before
  showing a file name, strip those control characters and line breaks and cap its length too.
- Item names and blurbs come from the game's own catalog, but render them the same way, since
  catalogs end up translated or community-made.
