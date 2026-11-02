# The design brief

A short brief, `docs/design.md`, written from the interview and approved by the developer before
any code. It's the source of truth for the build: when a decision changes, the brief changes first.

## Rules

- **Short.** Short lines and lists. Detail that doesn't change the build stays out. A small game
  needs only part of the template; see "A small game" below.
- **Decisions, not options.** Every line says what the game does. Choices the developer left to
  the agent are marked `(assumed)`, so they're easy to find and change.
- **Concrete.** Numbers where they matter: session length, number of levels, enemy kinds, the
  frame rate target, the download size.
- **Scope in three tiers:** first playable, full version, later. Anything not listed isn't being
  built.
- **The developer approves it.** Show it, ask for changes, update it, and start building only
  after a clear yes. After a round of changes, show only the sections that changed.

## A small game

For a small game (a few screens, one mode, a short round), keep the brief short:

| Sections | For a small game |
| --- | --- |
| Title and hook, Player and platform, The first two minutes, Core loop, Controls, Rules | In full: they define the game |
| Content and scope | The table, with only the rows the game has |
| Progression and saves, Look and sound, Screens, Harmony, Accessibility and languages, Targets, Tech, Store page | One line each |
| Multiplayer | Left out for a single-player game |
| Open questions | Left out when none are left |

## Template

```markdown
# <Title> (working title)

<One sentence: what the player does, and the hook.>

## Player and platform
- For: <who>. Session: <length>. Comes back for: <reason>.
- Plays on: <desktop / phone / tablet>, <orientation>. Hosted on Harmony: <yes / no>.
- Tested on: <the real devices the developer has: PC, phone model, tablet, controller>.

## The first two minutes
1. <What the player sees when the game opens.>
2. <The first thing they do, and how they learn it.>
3. <The first reward or "aha", at about <n> seconds.>
4. <What a round looks like, start to finish.>

## Core loop
- Second to second: <verbs>.
- Round: <what a round is, how it ends, how long>.
- Between rounds: <what carries over>.
- Skill shows in: <what a good player does better>.
- Variety from: <levels / randomness / opponents / choices>.

## Controls
| Action | Keyboard and mouse | Touch | Controller |
| --- | --- | --- | --- |
| <Move> | <WASD / arrows> | <left half drag> | <left stick> |

Feel: <snappy / floaty / heavy>, <timing windows>. Camera: <view, follow, shake>.

## Rules
- Win: <condition>. Lose: <condition>. Score: <what earns points>.
- Difficulty: <how it rises>. Failure: <restart / checkpoint>.
- Enemies or obstacles: <kind: behavior>, one line each.

## Content and scope
| | First playable | Full version | Later |
| --- | --- | --- | --- |
| Levels | <1> | <12> | <endless mode> |
| Enemies | <2 kinds> | <6 kinds> | <bosses> |
| Features | <core loop, restart> | <menus, progression, audio> | <online> |

Cut first if time runs out: <feature>.

## Progression and saves
- <What carries over, how it's earned, what upgrades may change.>
- Progress: <what's saved, or nothing>, per <device (no SDK) / Harmony player (SDK)>. Export
  and Import: <yes / no>.
- Settings: per device (the default). <Any personal ones kept per player: key bindings,
  subtitles.>

## Look and sound
- Look: <2D / 3D>, <style>, palette <colors or mood>, art from <source>.
- Readability: <how the player, enemies and pickups stand out>.
- Music: <plan>. Key sounds: <list>. Sound from <source>. Playable with sound off: yes.

## Screens
- <Title, how to play, settings, pause, results, ...>.
- HUD: <items, in priority order>.
- Menu style: <a few words>.

## Multiplayer
- <Local / online: co-op or versus, players per room, real-time or turns, room codes>.
- Online only: signaling server <public PeerJS server / their own>. TURN relay and "hide my IP":
  <none / their own TURN>.
- Online only: a player leaves mid-match: <what happens>. Joining in progress: <lobby only /
  allowed>.

## Harmony
- SDK: <None: Harmony adds its overlay at upload / the features used: player name, friends,
  overlay button, pause on overlay, file dialogs>.
- Game ID: <not needed (no SDK) / known / ask at the SDK step>.

## Accessibility and languages
- <Options>. Nothing relies on color or sound alone.
- Languages: <launch> (later: <list>).

## Targets
- Runs at <60> fps on <weakest device>. Under <n> MB before the title screen.

## Tech
- <Vite + TypeScript / engine>, <libraries>. Tests: <yes / no>. Dev tools: <yes / no>.

## Store page
- Pitch: <one line>. Tag kinds: <genre, mood or art style>. Platforms: <PC, Mobile, ...>, each
  played start to finish on a device under "Tested on".
- Players: <Single player, Local multiplayer, Online multiplayer, Co-op: every one that applies>.

## Open questions
- <None, or each one with the assumption used until it's answered.>
```

## After approval

- Commit the brief only if the developer asks; otherwise leave it in the project.
- Build from it in the stages in `build.md`, and keep it current: when the game changes, the
  brief changes in the same step.
