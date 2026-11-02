# Building in stages

From the approved brief to a packaged game, in stages. Each stage ends with the game playable and
checked. When a specialist skill for a stage is installed, use it; the notes here are the basics
for when it isn't. Skills are named by folder (`harmony-ui`); check which are installed before
the stage that needs one.

The game never depends on the Harmony SDK. Harmony adds its overlay (sign-in, friends, chat) to
every uploaded game with no code. When the brief's Harmony section says none, skip the SDK step
in stage 2, and build every system without it: saves per device, names typed in or generated,
Export and Import through a download and a file input, no buttons that open the overlay. When a
specialist skill asks whether the game uses the SDK, answer from the brief.

## Contents
- Stage 0: the project
- Stage 1: the core loop
- Stage 2: the game around it
- Stage 3: the systems
- Stage 4: content
- Stage 5: polish
- Stage 6: ready to ship
- Checks at every stage
- Talking to the developer

## Stage 0: the project

- **Plain web (default):** Vite with TypeScript, the vanilla TypeScript template; the game's own
  packages at their current versions. The project folder already holds `docs/design.md`, and
  `npm create vite@latest` refuses a folder that isn't empty, while its `--overwrite` option
  empties the folder and deletes the brief. So scaffold into a new temporary folder outside the
  project and move its files in, leaving `docs/design.md` as it is; or write the few Vite files
  by hand (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`).
  Never scaffold over the project folder.
- **A JavaScript engine:** add it to that project (Three.js, Phaser, Babylon.js, PixiJS), or use
  PlayCanvas's own editor.
- **Unity or Godot:** a new project in the engine; `harmony-engines` covers the web build and
  Harmony.
- Add `.gitignore` before anything else (dependencies, build output, caches, logs, per-user
  config).
- Relative paths for every asset (`base: "./"` in Vite) and no service worker, so the build works
  hosted.
- A seeded random number generator from the start, if the game uses randomness.
- Check the brief is still at `docs/design.md`, unchanged.

Done when: an empty page with the game's name builds and runs, and the console is clean.

## Stage 1: the core loop

The smallest thing that's the game: the player's verbs, one challenge, a way to win or lose, and
a restart. Placeholder art (shapes in the game's palette), no menus.

- Build only what the brief's "first playable" column lists.
- Get the feel right here: controls, timing windows, camera, the basic feedback for each action.
  This is the cheapest moment to change them.
- Play it, and ask the developer to play it, before going on: give them the command that runs it
  and the address to open. If it isn't fun for a minute, change the loop, not the polish.

Done when: a full round can be played start to finish, on every input the brief lists, and the
developer has tried it.

## Stage 2: the game around it

The screens and flow a player expects:

- Title, how to play, pause, results, settings. `harmony-ui` and `harmony-settings` cover these
  in depth; the basics: one style, every screen works with every input, Esc goes back.
- A loading screen in the page itself, before scripts load.
- The Harmony SDK, only if the brief's Harmony section lists SDK features; skip this step when it
  says none. Attach at start without waiting, and the game plays on without it (`harmony-sdk` has
  the details, from Harmony's SDK docs at https://playharmony.ai/developers/sdk.md). Ask for the
  Game ID now if the brief says "ask at the SDK step"; never invent one.

Done when: a player can open the game, learn it, play, pause, change settings and play again,
without anything unfinished in the way.

## Stage 3: the systems

What the brief asks for beyond the loop, one at a time, each playable before the next:

| System | Skill that covers it |
| --- | --- |
| Saves and progression | `harmony-progression` |
| Sound and music | `harmony-audio` |
| 3D models | `harmony-models` |
| Phones and controllers | `harmony-platforms` |
| Online multiplayer | `harmony-p2p-multiplayer` |
| Languages | `harmony-localization` |
| Tuning panel, cheats, metrics | `harmony-devtools` |
| Automated tests | `harmony-testing` |

Skip what the brief doesn't list. For online play, the brief's Multiplayer section already
answers the network questions `harmony-p2p-multiplayer` asks (signaling server, TURN relay,
leaving mid-match, joining in progress); use those answers rather than asking again. For phones
and controllers, test on the real devices the brief lists under "Tested on". Add the developer
tools early if the brief wants them: tuning
and cheats make every later stage faster. Keep them behind a development-only switch, so none of
them ships in the release build.

Done when: each system in the brief works in the game, not only in isolation.

## Stage 4: content

Levels, enemies, items, cards, songs: the brief's "full version" column.

- Data-driven: content in data files the game reads, not hard-coded in logic.
- Build a few, play them, adjust the tools and rules, then build the rest.
- Keep the difficulty curve in mind: early content teaches, later content tests.

Done when: the content in the brief's full version is in and playable.

## Stage 5: polish

- **Feel:** feedback on every action (sound, particles, a little screen shake), smooth transitions,
  no dead moments.
- **Look:** replace placeholders, one consistent style, readable at a glance.
- **Performance:** measure on the weakest device in the brief, and fix the biggest cost first
  (`harmony-performance`).
- **Accessibility:** the options in the brief, and nothing that relies on color or sound alone.
- **Bugs:** play every mode on every input; fix crashes and stuck states first.

Done when: the developer plays a full session and the list of problems is empty or agreed as
"later".

## Stage 6: ready to ship

- Store media: thumbnail, screenshots, preview movie, banner (`harmony-store-media`).
- A production build checked and packaged as a `.zip` with `index.html` at the top, plus a
  listing file for the upload form (`harmony-publish`).
- Hand the developer the package and listing paths. They upload it from My Creations.

Done when: the package and listing exist, the packaged build passes the checks below, and the
developer has the handover:

- the package, listing and store media paths;
- the command that runs the game locally;
- every difference from the brief, and the brief's "later" list;
- anything still assumed: `(assumed)` lines nobody confirmed, and, for a game that uses the SDK,
  the Game ID if it's still a placeholder.

## Checks at every stage

- It builds without errors or type errors.
- It runs in the browser with a clean console, with no Harmony SDK and no Game ID (or with the
  SDK unable to start, when the brief uses it).
- The stage's goal works, checked by playing it (and by the automated tests, once there are some).
- The brief still matches the game.

## Talking to the developer

- After each stage, say what's playable now, what's next, and anything that differs from the brief.
- Ask before changing an agreed decision, adding a dependency the brief didn't plan, or cutting
  something.
- Ask for a play test after stage 1 and after stage 5, at least.
- Never commit, push or upload unless asked.
