---
name: harmony-feel
description: Make a web game feel good to play - responsive controls (input buffering, coyote time, acceleration curves) and layered feedback on every action (hit-stop, screen shake, squash and stretch, flashes, particles, tweened UI, vibration), within the player's reduced-motion and flashing settings. Use when a game feels flat, floaty, stiff or laggy, or needs juice, impact, screen shake, hit pause or particles.
license: MIT-0
compatibility: Web games in any browser engine. Guidance only; no scripts.
---

# Game feel

The difference between a game that works and a game that feels good is mostly in the first tenth
of a second after each input: the controls answer at once, and every action answers back. This
skill covers both. It is guidance: write the code into the game, in its own engine and style.

## Order of work

1. **Look at the game first.** Find the input code, the game loop and its time scale (how it
   pauses), the camera, any sounds, the settings menu (screen shake, reduced motion, flashing)
   and any tuning panel or config file. List the player's actions and the game's big moments.
   Then ask the questions below.
2. **Controls** ([references/controls.md](references/controls.md)): no input lag, buffered
   inputs, forgiving timing windows, and movement curves that feel deliberate. Effects can't save
   controls that feel wrong.
3. **Feedback for the core actions** ([references/feedback.md](references/feedback.md)): write
   the feedback plan first ("A feedback plan per action"), then give the player's most frequent
   verbs (jump, hit, shoot, collect) layered feedback: motion, a flash or particles, a sound, and
   for big moments hit-stop and shake.
4. **The world answers:** enemies react to hits, pickups pop, the environment moves when touched.
5. **The interface answers:** buttons press, numbers count and pop, rewards arrive with ceremony.
6. **Check** that the game builds and runs with a clean console, that pausing freezes every
   effect, and that with screen shake at 0, reduced motion on and flashing off, every important
   event still has a clear cue.
7. **Hand over for tuning.** Feel is tuned by playing, so the developer does it: they change one
   value at a time while playing, ideally from a tuning panel, and compare with and without.
   Report what each action now does, and where its numbers live.

## Ask the developer first

Ask in one round, with a recommendation for each. Don't ask what the code already shows.

- **What should it feel like?** Snappy and arcade (fast starts and stops, short hit-stop, lots
  of small effects), weighty (slower acceleration, longer hit-stop, bigger shake on big hits), or
  calm (soft easing, little or no shake). Recommended: the one that fits the genre, named with a
  one-line reason.
- **The big moments:** the two or three rare events that get the strongest feedback, such as a
  boss kill, a level clear or a win. Recommended: a list drafted from the game, for the developer
  to confirm.
- **Vibration?** Ask only when the game supports controllers or phones. Recommended: yes, short
  and rare, with a setting to turn it off.

If the developer says "you decide", use the recommendations and list them in the report as
choices they can change.

## Rules

- **Instant response.** The action starts on the frame the input arrives; animation and effects
  follow, never delay the action itself.
- **Layer it.** A strong moment combines several small effects (a 60 ms hit-stop, a little shake, a
  white flash, particles, a sound) rather than one big one.
- **Scale with importance.** Frequent actions get small, quick feedback; rare, big moments get the
  most. If everything shakes, nothing does.
- **Readable first.** Effects never hide the player, the threat or the information needed to act.
  Particles fade fast; shake is short.
- **Respect the player's settings.** Screen shake has its own slider; reduced motion (the
  system's setting or the game's) cuts shake, zooms and big movement; flashes stay under three a
  second and full-screen flashes can be turned off.
- **One clock.** Effects run on the game's time scale, so pausing and slow motion affect them too;
  hit-stop is part of that clock.
- **Tune with numbers in one place,** so effect strengths can be adjusted while playing.

## Reference files

| File | Read when |
| --- | --- |
| [references/controls.md](references/controls.md) | Input latency, buffering, coyote time, acceleration and friction, jump arcs, aim assist, camera |
| [references/feedback.md](references/feedback.md) | Hit-stop, screen shake, camera kick, squash and stretch, flashes, particles, knockback, tweening and easing, UI feedback, vibration, a feedback plan per action |
