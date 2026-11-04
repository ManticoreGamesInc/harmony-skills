# Harmony skills

Agent skills for making web games and publishing them on Harmony, Manticore's home for web games. Add them to your AI coding agent, then ask for what you want, such as "show the player's friends in my game". The agent loads a skill when your request needs it.

Each skill is a folder with a `SKILL.md` file of instructions, plus reference files and scripts where it needs them. The agent reads only a skill's short description until a request matches it, so you can install all of them without filling the agent's context. Most skills start by asking you a few questions about what to build.

Every skill follows the [Agent Skills specification](https://agentskills.io/specification), so it works in any agent that supports skills, not only Claude.

The Harmony SDK docs are at [playharmony.ai/developers/sdk](https://playharmony.ai/developers/sdk), and the published skills are listed at [playharmony.ai/developers/skills](https://playharmony.ai/developers/skills).

## Skills

Listed in the order a game usually needs them, from first setup to release.

| Skill | What it does |
| --- | --- |
| [harmony-make](skills/harmony-make/SKILL.md) | Makes a whole web game from an idea: a thorough interview that questions you area by area until every part of the game is decided, a short design brief you approve, then the game built in playable stages and packaged for upload. |
| [harmony-sdk](skills/harmony-sdk/SKILL.md) | Adds the Harmony SDK to a web game that needs Harmony features in the game itself: the player's name, friends, the overlay and file dialogs, and showing text from Harmony safely. Most games don't need it: Harmony adds its overlay to every game you upload. |
| [harmony-engines](skills/harmony-engines/SKILL.md) | Gets a Unity or Godot game onto Harmony: a lean, single-threaded web build, packaged for upload, and a bridge written into the game's own project so C# or GDScript can use the player's name, friends, the overlay and files, with a local editor fake for testing without a web build. |
| [harmony-ui](skills/harmony-ui/SKILL.md) | Designs and builds the menus, HUD and screens: a visual direction as theme tokens, title, pause, results and how-to-play screens, modals and toasts, focus and back routing for keyboard, controller and touch, and a HUD that reads at a glance, keeps clear of the Harmony badge and fits phones. |
| [harmony-progression](skills/harmony-progression/SKILL.md) | Adds saves and progression: saves that survive junk and updates, kept per device or per Harmony player when the game uses the SDK, Export and Import, and XP, levels, currency, cosmetics, capped upgrades, round rewards and a locker screen. |
| [harmony-settings](skills/harmony-settings/SKILL.md) | Adds a settings menu: graphics quality, volumes on an audio bus, key and controller remapping, sensitivity and touch controls, accessibility (text size, color-blind modes, reduced motion, subtitles), language and save backup, stored safely, applied at once, and usable with keyboard, controller and touch. |
| [harmony-audio](skills/harmony-audio/SKILL.md) | Adds sound and music: a Web Audio engine with volume buses and a limiter, sound effects with variation and voice limits, gapless loops, crossfades, layered music and ducking, 2D and 3D positional sound, pausing for the overlay and phone interruptions, mixing, and sourcing sounds with the right licenses. |
| [harmony-models](skills/harmony-models/SKILL.md) | Gets 3D models into a web game: built in code or from free CC0 libraries by default, or with Blender or a text- or image-to-3D service if you have one, then made web-ready as glTF with the right scale, a polygon budget for phones, and compressed meshes and textures. |
| [harmony-feel](skills/harmony-feel/SKILL.md) | Makes a game feel good to play: responsive controls (input buffering, coyote time, acceleration and jump curves) and layered feedback on every action (hit-stop, screen shake, squash and stretch, flashes, particles, tweened UI, vibration), within the player's motion and flashing settings. |
| [harmony-platforms](skills/harmony-platforms/SKILL.md) | Makes a web game playable on phones, tablets and game controllers: touch controls, phone layouts and orientation, controller support with menus and button prompts, and the Harmony overlay from a controller. Ends with what to mark under Supported platforms when uploading to Harmony. |
| [harmony-p2p-multiplayer](skills/harmony-p2p-multiplayer/SKILL.md) | Adds online play for 2 to 4 players with no game server: one player hosts a room with a secure code, friends join it, and the game talks browser to browser over WebRTC. Covers privacy consent, validating what peers send, real-time, turn-based, hidden-information and shared-object games, and inviting friends by room code. |
| [harmony-localization](skills/harmony-localization/SKILL.md) | Translates a web game: strings in language files with context notes, plurals and formats through Intl, a language setting, fonts for every script, right-to-left layout, room for longer text, canvas text wrapping, translation drafts marked for native review, and a pseudo-language test. |
| [harmony-performance](skills/harmony-performance/SKILL.md) | Makes a web game load fast and run smoothly: measuring first, a smaller download with the right texture, audio, model and font formats, a real loading screen, shader warm-up, and a steady frame rate on low-end laptops and phones with quality presets and a WebGL fallback for WebGPU. |
| [harmony-devtools](skills/harmony-devtools/SKILL.md) | Adds developer tools inside the game, kept out of the shipped build: a live tuning panel saved back to the config file, cheat buttons, debug overlays, pause, frame stepping and slow motion, and performance metrics (frame times, CPU and GPU time, draw calls, triangles, memory). |
| [harmony-testing](skills/harmony-testing/SKILL.md) | Adds automated tests: seeded randomness, unit tests for rules, saves and settings, test hooks, a Playwright smoke test of the production build served from a subfolder with no console errors, two-player and phone-size runs, and screenshot comparisons. |
| [harmony-store-media](skills/harmony-store-media/SKILL.md) | Makes the media for a game's Harmony page from the running game: a titled thumbnail and a square one, a title logo in the game's own font, store screenshots, a 6-second preview movie, the featured banner and an optional mobile portrait, each sized to Harmony's upload rules. Works with canvas, WebGL and HTML games in any engine. |
| [harmony-publish](skills/harmony-publish/SKILL.md) | Gets a web game ready to upload to Harmony: relative addresses for every engine and bundler, no service workers or browser file pickers, a script that checks the build or zip and names each problem by file and line, a `.zip` with `index.html` at the top or one `.html` file, and a listing file with every field of the upload form. You upload it yourself from My Creations. |

## Install

### Claude Code

Add this repository as a plugin marketplace, then install the plugin:

```
claude plugin marketplace add ManticoreGamesInc/harmony-skills
claude plugin install harmony@harmony-skills
```

Inside a Claude Code session, use `/plugin marketplace add` and `/plugin install` instead. Update with `claude plugin update harmony@harmony-skills`.

### claude.ai

Zip a skill's folder, such as `skills/harmony-sdk`, and upload it under Customize > Skills.

### Other agents

Copy a skill's folder from `skills/` into your agent's skills folder. Check your agent's documentation for where that is.

## Harmony terms

The MIT-0 (MIT No Attribution) license covers the files in this repository, including skill instructions, examples and scripts. You may use, modify and redistribute them commercially, including in games hosted outside Harmony, without attribution. Third-party materials retain their own licenses. It doesn't cover the Harmony SDK or the Harmony service, which have their own terms.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
