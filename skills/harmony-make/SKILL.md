---
name: harmony-make
description: Make a whole web game from an idea - a thorough interview in rounds that settles every part of the game and pushes back on vague answers and oversized scope, a short design brief the developer approves, then the game built in playable stages and packaged for upload to Harmony. Use when someone wants to make, build, start or prototype a new game ("make me a game where...", "a game like X but Y") or turn a game idea into a plan.
license: MIT
compatibility: New web games in JavaScript or TypeScript (Vite by default), or an engine the developer picks. Guidance only; no scripts.
---

# Make a game

From an idea to a game someone can play. The interview is the most important part: a game built
on vague answers comes out vague. This skill asks a lot, on purpose, before building anything.

## The three phases

1. **Interview** ([references/interview.md](references/interview.md)): question the developer in
   rounds, area by area, until nothing that changes the build is left undecided. Recommend an
   answer for every question; push back on vague answers, contradictions and scope that won't fit.
2. **Brief** ([references/brief.md](references/brief.md)): write `docs/design.md`, a short brief
   that holds every decision, and get the developer's approval before building.
3. **Build** ([references/build.md](references/build.md)): the game in stages, each one playable
   and checked before the next: the core loop first, then the game around it, then polish, then
   packaging.

## How to interview

- **Rounds, not a form.** Ask three or four related questions at a time, about one area, then
  the next area. Two small areas can share a round. Use the agent's multiple-choice question tool
  when it has one; otherwise numbered questions with lettered options. If the tool takes fewer
  questions or options than the round needs, split the round across calls.
- **Don't ask what you can find.** Read the prompt, attachments and any existing project first,
  and confirm in one line what they already answer instead of asking about it.
- **A recommendation for every question,** marked as such, with a one-line reason. The developer
  can take it, pick another option, or answer in their own words.
- **Dig until it's concrete.** "Fun", "polished", "like Hollow Knight", "some enemies" aren't
  answers yet. Ask what exactly, how many, what happens, what it feels like, with an example.
- **Push back.** Name contradictions ("a five-minute game with a 40-level campaign"), scope that
  won't fit, and ideas that fight each other, and offer a way to resolve each.
- **Play it back.** After each area, summarize what was decided in a few lines and ask if it's
  right. Put the playback and any push-back in the message, before the next area's questions, so
  confirming costs no extra round.
- **"You decide" is an answer,** not a skip: record the recommended choice as an assumption the
  developer can change later.
- **Keep an open list.** Track questions that are still open; the interview ends only when the
  list is empty or the developer explicitly says to go with the recommendations.
- **The developer can stop at any time.** If they say "just build it", confirm the open list will
  be filled with the recommendations, write the brief, and show it. The brief still needs their
  approval before any code.

## Rules for the build

- **Nothing is built before the brief is approved.**
- **No Harmony SDK unless the brief needs it.** Every game runs with no SDK and no Game ID.
  Harmony adds its overlay (sign-in, friends, chat) to every uploaded game with no code, so the
  SDK is only for the few features that need it (interview area 13).
- **Core loop first:** the smallest version that's fun to play for a minute, with placeholder
  art, before menus, progression or polish.
- **Playable at every stage,** and checked: it builds, it runs, the console is clean, and the
  stage's goal works.
- **Data from outside the game's code is shown as text and never run.** Names (typed, from
  Harmony or from other players), titles, chat, room codes, saves and loaded files go on screen
  through `textContent`, canvas `fillText` or the engine's plain-text label with rich text off,
  never `innerHTML` or markup built from them. Parse saves, imported files and peer messages and
  check each field's type, length and allowed values before using it; dispatch peer messages by
  an allow-list of known types. No `eval`, `new Function` or `setTimeout` with a string, ever.
  `harmony-ui`, `harmony-sdk`, `harmony-progression` and `harmony-p2p-multiplayer` have the details.
- **The brief is the source of truth.** A change of plan updates the brief first.
- **Ask before big changes** to what was agreed, and before adding dependencies the brief didn't
  plan for.
- **Use the specialist skills when they're installed** (UI, settings, audio, models, progression,
  multiplayer, phones and controllers, performance, testing, store media, publish, and the Harmony
  SDK when the brief uses it);
  `build.md` says where each fits, and gives the basics for when they aren't.
- **Never commit, push or upload** unless the developer asks.
- **Finish with a handover:** where the package and listing are, how to run the game locally,
  what differs from the brief, and the "later" list (`build.md`, stage 6).

## Reference files

| File | Read when |
| --- | --- |
| [references/interview.md](references/interview.md) | Before the first question, and throughout phase 1: the areas in order, the question bank, digging deeper, pushing back, when to stop |
| [references/brief.md](references/brief.md) | When the interview is done: the brief's rules and template, and what to do after approval |
| [references/build.md](references/build.md) | After the brief is approved, and at the start of each stage: what to build, which skill helps, the checks, the handover |
