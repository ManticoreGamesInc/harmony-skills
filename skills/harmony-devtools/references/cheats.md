# Cheats for testing

Shortcuts that take the developer straight to the part of the game they want to test: the last
level, the boss with one hit point, a full inventory, a rare event. They are the developer's
testing tools, never a feature for players. They exist only in development builds, the
production build leaves them out, and a check proves it before the game is published.

## Contents
- What to include
- One registry
- Ways to trigger them
- Starting from a setup
- Keeping them out of the shipped game
- Cheats and saves
- Cheats and online play
- Sharing them with tests

## What to include

Pick the ones that save the most time for this game:

| Kind | Examples |
| --- | --- |
| Survival | god mode, infinite lives, one-hit kills, no damage from a given source |
| Resources | give coins, items, ammo, XP; max level; unlock everything; refill meters |
| Progress | win or lose the round, skip to any level, wave or checkpoint, finish a quest step |
| Spawning | spawn an enemy, boss, pickup or vehicle at the cursor or in front of the player |
| Movement | fly or noclip, teleport to the cursor or a named point, speed multiplier |
| Events | trigger a rare event, force the next random outcome, set the timer |
| Save | reset the save, load a prepared save, set a stat to a value |

## One registry

Every cheat is registered in one place, so the panel, the keys, the console and tests all use the
same list:

```ts
// src/dev/cheats.ts, imported only behind the dev switch

// A marker the release check looks for. It runs when the module loads, so a minifier keeps it
// whenever this file is in a build.
console.info("__DEV_CHEATS__ loaded");

interface Cheat {
  id: string;                     // "god", "giveCoins", "skipLevel"
  label: string;
  run: (game: Game, arg?: string) => void;
  key?: string;                   // optional shortcut, used while the dev panel is open
}

export const cheats: Cheat[] = [
  { id: "god", label: "God mode", run: (game) => { game.player.invulnerable = !game.player.invulnerable; } },
  { id: "giveCoins", label: "Give 1000 coins", run: (game, arg) => game.wallet.add(Number(arg ?? 1000)) },
  { id: "skipLevel", label: "Skip level", run: (game) => game.completeLevel(), key: "KeyN" },
  { id: "spawnBoss", label: "Spawn boss at cursor", run: (game) => game.spawn("boss", game.cursorWorld()) },
];

export function runCheat(game: Game, id: string, arg?: string): void {
  const cheat = cheats.find((c) => c.id === id);
  if (!cheat) {
    console.warn("No cheat " + id);
    return;
  }
  cheat.run(game, arg);
  game.usedCheats = true;
  console.info("Cheat: " + cheat.label + (arg ? " (" + arg + ")" : ""));
}
```

- Cheats call the game's own functions (`completeLevel`, `wallet.add`), so they test the real
  code paths, not shortcuts around them.
- Show a small "CHEATS ON" badge whenever one has been used, so a screenshot or a bug report
  can't pass for normal play.

## Ways to trigger them

- **The dev panel:** a button per cheat, in a Cheats folder (`tuning.md`).
- **Keys:** shortcuts that work only while the dev panel is open, so they never fire by accident
  during normal play testing.
- **A console:** `window.cheat = (id, arg) => runCheat(game, id, arg)` in dev builds, for
  `cheat("giveCoins", "5000")` from the browser console.
- **URL parameters:** `?cheats=god,giveCoins:5000&level=7` applied at start, so a link sets up a
  test.

## Starting from a setup

Many tests need a setup, not one cheat: "level 7, the double jump unlocked, 3 lives, 500 coins".
Make these named setups, applied at start from the panel or the URL (`?setup=late-game`):

```ts
const setups: Record<string, string[]> = {
  "late-game": ["skipTo:7", "unlock:doubleJump", "lives:3", "giveCoins:500"],
  "boss-fight": ["skipTo:boss", "god"],
};
```

Keep them in the dev folder with the cheats, and add one whenever a bug needed a long setup to
reproduce.

## Keeping them out of the shipped game

- **Behind the dev switch:** import the registry only from the dev entry point
  (`if (import.meta.env.DEV) { await import("./dev/cheats") }`), so a production build drops the
  code. Never ship cheats behind a secret key or a hidden URL parameter: players find them.
- **No cheat logic in game code:** the game exposes normal functions; only the dev folder decides to
  call them as cheats. A flag like `if (godMode)` inside the damage code is fine only if `godMode`
  is set by dev code and is always `false` otherwise.
- **Check every release build:** the registry logs a marker string (`"__DEV_CHEATS__"`) when it
  loads; fail the build or the release check if any file in the production build contains it.

  ```
  grep -rl "__DEV_CHEATS__" dist/ && echo "Cheats found in the build" && exit 1
  ```

- **Don't read cheat URL parameters in production:** the code that parses `?cheats=` lives behind
  the dev switch too.

## Cheats and saves

- Saves made with cheats are marked (`usedCheats: true`), so a developer knows not to trust them.
- Use a separate save key in dev builds when testing with cheats (`game.save.dev`), so a cheat run
  doesn't overwrite a real test save.
- Prepared saves for testing (a late-game save, a save with every unlock) live in the dev folder,
  loaded by a cheat, never bundled into the shipped game.

## Cheats and online play

While testing in a dev build, the developer can use cheats in online sessions; testing
multiplayer without them is slow. Players never can, because a published game has no cheats.

- **Change the match only where its state lives.** In a host-authoritative game, cheats that
  change shared state (score, round, timer, level) run on the host, and the change reaches
  guests the way any other update does. With a game server, the cheat calls a dev-only route on
  the server's dev build. A guest's panel shows these cheats disabled, with "host only". A
  secret one player owns (a word they set, their hand) lives on that player's machine, so
  cheats that change it run there.
- **Local tools work on any player.** Debug overlays and metrics change nothing shared, so any
  player can use them. Showing hidden information on your own screen (the answer, the other
  player's hand) works the same way, but only when that information is on your machine. When
  another player owns the secret and keeps it on their machine until a reveal (the hidden
  information pattern in harmony-p2p-multiplayer's turn-based guide), a reveal cheat runs on
  the owner's game or not at all. Show the other players where it is ("on the other player's
  game") instead of a reveal that can't work.
- **Messages from peers never trigger cheats.** A guest who wants one runs it in the host's
  window. A release build has no cheat code to trigger anyway.
- **Show it.** While a cheat has been used in a session, show a small "DEV CHEATS" tag to every
  player in it, so a test result isn't mistaken for a clean one.
- Play the multiplayer features through once without cheats before release.

## Sharing them with tests

The test hooks used by automated tests (`window.__test`) can call the same registry
(`start(seed)`, `runCheat("skipLevel")`), so a browser test reaches the boss the same way the
developer does by hand. Keep the hooks behind the same dev or test switch.
