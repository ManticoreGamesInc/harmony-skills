---
name: harmony-audio
description: Add sound and music to a web game - a Web Audio engine with volume buses, sound effects with variation and voice limits, gapless and layered music, ducking, 2D and 3D sound, pausing for hidden tabs and the Harmony overlay, mixing, and licensed sources. Use when a game needs sound effects, music or an audio engine, or its sound is silent, clipping, delayed, stuttering or missing on iPhone.
license: MIT
compatibility: Web games in any browser engine, using the Web Audio API. Guidance only; no scripts.
---

# Sound and music for web games

Sound is half of how a game feels. This skill covers the audio engine, sound effects, music and
the mix. It is guidance: write the code into the game in its own style, or adapt it to the
engine's own audio system (Phaser, PixiJS Sound, Babylon.js and Three.js all wrap Web Audio).

## Build order

1. **Look at the game first.** Find the engine and whether it has its own audio system, whether
   the game is 2D or 3D, any sounds and music already in the project, the settings menu's volume
   controls, and how the game pauses. Then ask the questions below.
2. **The engine** ([references/engine.md](references/engine.md)): one `AudioContext`, unlocked
   on the first tap or key, a bus per category (music, effects, voice, interface) into a master
   with a limiter, sounds loaded and decoded ahead of use, and pausing for hidden tabs, the
   Harmony overlay and phone interruptions.
3. **Sound effects** ([references/sound-design.md](references/sound-design.md)): a cue for each
   game event, with variation, voice limits and cooldowns, then interface sounds. A 2D game pans
   by screen position; a 3D game uses positional sound.
4. **Music** ([references/music.md](references/music.md)): gapless loops, crossfades between
   tracks, and layers or stingers if the game wants music that reacts to play.
5. **The mix** ("Mix levels" in [references/sound-design.md](references/sound-design.md)):
   levels between categories, and ducking ([references/music.md](references/music.md)).
6. **Test** with the "Testing" list in [references/sound-design.md](references/sound-design.md).
   Phone speakers, headphones and an iPhone need the developer; say which checks you couldn't
   run.
7. **Report** to the developer: the cues added and the event each plays on, the music plan,
   where the volume levels live, every new file with its source and license in
   `audio/CREDITS.md`, and any choices made for them.

## Ask the developer first

Ask in one round, with a recommendation for each. Don't ask what the code already shows.

- **Where do sounds come from?** Their own files, a licensed library, or free sounds (each with
  its license recorded). Recommended: their own files first, then CC0 sounds. Never ship a sound
  without knowing its license.
- **What should music do?** One track per screen, crossfades between areas, or layers that
  build with the action. Recommended: one loop per screen with crossfades; layers only when the
  music has stems of the same length.
- **Sound with the iPhone on silent?** iPhones mute Web Audio when the ringer switch is on
  silent, unless the game opts out ("Phones" in [references/engine.md](references/engine.md)).
  Recommended: leave it muted, since players who switch to silent expect silence.
- **Generators: "Do you have any of these set up? (default: none)"** Sound effect and voice
  generation (for example ElevenLabs, or a local text-to-speech model) and music generation (for
  example Suno, Udio, Stable Audio, or a local model such as MusicGen). Ask; never scan for
  tools. With any, follow [references/generators.md](references/generators.md); without, the
  default path is complete.

If the developer says "you decide", use the recommendations and list them in the report as
choices they can change.

## Rules

- **One `AudioContext`** for the whole game. Resume it in the first `pointerup`, `touchend` or `keydown`
  handler; browsers start it suspended until the player acts.
- **Everything through a bus.** Music, effects, voice and interface each have a gain node into a
  master, so the settings menu's volume sliders and ducking work on whole categories.
- **A limiter on the master** so many sounds at once never clip.
- **Load before use.** Decode effects at load; a sound decoded on first play arrives late.
  Stream long music instead of decoding it whole.
- **Limit voices.** Cap how many copies of one sound play at once, and how soon it can repeat.
  Fifty overlapping coin sounds are noise.
- **Vary repeats.** Small random pitch and volume changes, or two to four variants, so repeated
  sounds don't grate.
- **Pause with the game.** The pause menu, and in a game that uses the Harmony SDK the Harmony
  overlay (`harmony.on("open")` and `harmony.on("close")`): pause effects, and pause or duck the
  music. Without the SDK, the game pauses on the window's `blur` event, which fires when the
  overlay opens. In online play the game
  doesn't pause, but its sound can still be ducked. A hidden tab mutes the game when the
  player's "mute in background" setting is on, which is the default.
- **Every important sound has a visual cue** too, for players with the sound off or who can't
  hear it.
- **Credit and license.** Keep a credits file listing every sound and track with its source and
  license, and show attributions where licenses ask for them.

## Reference files

| File | Read when |
| --- | --- |
| [references/engine.md](references/engine.md) | The AudioContext, unlocking, buses and the limiter, loading and decoding, formats, playing with voice limits, pausing and resuming, phones |
| [references/music.md](references/music.md) | Gapless loops, crossfades, layered music, stingers on the beat, ducking |
| [references/generators.md](references/generators.md) | Only when the developer has a sound, voice or music generator: ground rules (no paid calls without a yes, no API keys, commercial terms, recording sources) and tips |
| [references/sound-design.md](references/sound-design.md) | Cues for game events, variation, interface sounds, 2D panning and 3D positional sound, mix levels, sourcing and licenses, testing |
