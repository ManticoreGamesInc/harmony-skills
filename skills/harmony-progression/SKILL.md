---
name: harmony-progression
description: Add saves and progression to a web game - versioned saves that survive junk and updates, kept per device (or per Harmony player when the game uses the SDK), and XP, levels, currency, cosmetics, small capped upgrades, round rewards and a locker screen. Use when a game needs saved progress, XP, levels, unlocks, cosmetics, a shop, currency or upgrades, or its saves get lost, mixed up or broken by an update.
license: MIT
compatibility: Web games in any engine. The Harmony parts need @playharmony/sdk; without it the game keeps one save per device.
---

# Saves and progression for web games

This skill is guidance: it has no code to copy. Write the code into the game, in the game's own
language, style and file layout, from the rules and examples here.

Two parts, built in this order:

1. **Saves** ([references/saves.md](references/saves.md)): one save for the device (or one per
   player, with the Harmony SDK), checked on load, versioned, with Export and Import. Every game that keeps progress needs this part.
2. **Progression** ([references/progression.md](references/progression.md)): XP, levels,
   currency, cosmetics, upgrades and round rewards, stored in that save. Add it only when the
   game wants it.

Then the screens: the results payout and the locker ([references/screens.md](references/screens.md)).
Last, check and hand over (below).

## Harmony and saves

Harmony hosts web games but stores no game data. A game keeps its own saves in `localStorage`
or `IndexedDB`, which belong to that game alone and stay in that browser on that device.

Most games keep one save for the device, under the `"device"` owner, with no Harmony SDK and no
Game ID. That save loads as the game starts, and nothing waits on Harmony. Build this first; it
is the whole save system for a game without the SDK.

Only when the game already has the Harmony SDK (`@playharmony/sdk`), or the developer chose it
for another feature, does the save follow the player: the SDK says who is playing, so each
player on a device gets their own save, and the device save is used until it answers or when it
fails. Don't add the SDK only for per-player saves without asking the developer; see the
`harmony-sdk` skill for when a game needs it. The SDK's docs for agents are at
https://playharmony.ai/developers/sdk.md. Read them before calling the SDK and use only the
calls they list; where they differ from this skill, follow them. With the SDK, this skill uses
`harmony.auth.getSession`, `harmony.auth.onSessionChanged`, `harmony.files.save` and
`harmony.files.open`.

## Ask the developer first

First read the game's code and its design brief (`docs/design.md`) if it has one: they often
answer these already. Then ask in one round, only what's left, with a recommendation for each:

- **How much progression?** None (saves only), light (career stats and cosmetics unlocked by
  stat milestones), or full (light plus XP, levels, currency, purchases and capped upgrades).
  Recommended: light for short or arcade games, full for games players return to for weeks.
- **What do cosmetics change?** The slots (body, trail, hat, car paint...) and what the game
  draws for each. Recommended: two or three slots the game already draws, such as the player's
  body and a trail. Skip this question for no progression.
- **What earns rewards?** The events a round counts (orbs, kills, combos, laps) and whether a
  win pays extra. Recommended: the events the game already counts or scores, and a bonus for a
  win. Skip this question for no progression.
- **Export and Import?** Recommended on Harmony, since saves don't leave the browser otherwise.
  With the SDK they use Harmony's Save and Open dialogs; without it, a download and a file
  picked with `<input type="file">`, which both work in a game hosted on Harmony.

If the developer says "you decide", take the recommendations and list them as assumptions when
you hand over.

## Rules

- **Never trust a save.** Players can edit `localStorage`, old versions leave old formats, and
  imported files can be anything. Parse every field: drop unknown ids, clamp numbers, fall back
  to defaults. A bad save never crashes the game or wipes good data.
- **Pick fields, never merge.** Build a fresh default save and copy in only the fields the game
  knows, one by one. Never `Object.assign`, spread or deep-merge a parsed save over the
  defaults or into game state, and never use its keys to index objects, so a `__proto__` or
  `constructor` key in a file can't reach anything.
- **Text from saves and players is text.** Player names, imported file names and any string
  from a save are shown with `textContent` or the engine's plain text object (rich text off),
  never HTML. Names are cleaned (bidi and zero-width characters and line breaks out) and capped.
- **One save for the device, without the SDK.** Load it at once; never wait on Harmony.
- **With the SDK, one save per player.** Key saves on `accountId` from the session, never on the
  display name. A guest who creates an account keeps the same `accountId`, so their save
  carries over.
- **With the SDK, switch saves with the session.** Listen with `harmony.auth.onSessionChanged`
  and load the right save when a player signs in, signs out or changes account.
- **With the SDK, device progress is adopted once.** Progress made signed out moves into the
  first player (guest or account) that signs in on that device with no save of its own, then the
  device save starts fresh. Never merge two saves.
- **Ids are forever.** Cosmetic, upgrade and stat ids are saved, and sent to other players
  online. Never rename or reuse one; retire it and add a new id.
- **Cosmetics change looks only.** Upgrades change play by a few percent at most (6% is a good
  cap), so a new player can still beat a maxed one.
- **Quitting pays a little.** A quit round pays a quarter of its reward, never zero, and never
  counts as a win or a loss.
- **Show why.** The results screen lists every reward line, so players see what earned what.
- **Saves aren't proof.** A save can say anything, so never use one for anything other players
  rely on (leaderboards, trading, rewards in someone else's game). Online, the host decides
  whether upgrades count in a match.
- **Write tests.** Unique ids, upgrade caps, tier order, parsing junk and old saves, reward
  math, milestone unlocks, purchase limits and the adopt-once rule are all cheap to unit test.
  [references/progression.md](references/progression.md) lists the checks.

## Check and hand over

- The unit tests pass.
- Play a round, reload the page: the progress is still there.
- With Export and Import: import a file that isn't a save, and a save with junk fields. The first
  is refused, the second loads with the junk dropped, and the game keeps running.
- The game starts without waiting for Harmony. With the SDK, a round that ends before the save
  is known is paid out once it is (`saves.md`).
- Tell the developer the progression level built, whether saves are per device or per player,
  the save key prefix, the slots and reward events, and the assumptions taken. With the SDK, add
  what to test on Harmony with a guest and an account.

## Reference files

| File | Read when |
| --- | --- |
| [references/saves.md](references/saves.md) | Building the save store: keys, loading with or without the SDK, session changes, adopt once, versions and migrations, storage failures, Export and Import |
| [references/progression.md](references/progression.md) | Adding XP, levels, currency, cosmetics, upgrades and rewards, balancing them, and the tests |
| [references/screens.md](references/screens.md) | Building the results payout and the locker screen |
