# The interview

Questions for every part of a game, in the order they're usually best asked, with ways to dig
deeper and to push back. Skip an area only when it doesn't apply (no multiplayer, no story), and
say so in one line. Adapt the wording to the game; never read the list out as a form.

## Contents
- Before the first question
- Round structure
- 1. The idea and the hook
- 2. The player and the platform
- 3. The first minute
- 4. The core loop
- 5. Controls and feel
- 6. Rules, challenge and failure
- 7. Content and scope
- 8. Progression and saves
- 9. Look
- 10. Sound
- 11. Screens and UI
- 12. Multiplayer
- 13. Harmony features
- 14. Accessibility and languages
- 15. Performance and devices
- 16. Tech
- 17. Store page and release
- Digging deeper
- Pushing back
- When to stop

## Before the first question

Read everything the developer already gave: the prompt, attached sketches, a reference game, an
existing project folder. Don't ask what they've already said; confirm it in one line instead. In
an existing project, look for the engine, the inputs, the screens and the art already there:
those become confirmations, not questions.

Then say how this will go: "I'll ask about the game area by area, a few questions at a time, each
with my recommendation. Say 'you decide' for any you don't care about, or 'just build it' to stop
and use my recommendations."

## Round structure

For each area:

1. Ask three or four questions about it, each with options and a recommendation with a reason.
   Two small areas (Sound and Screens, say) can share a round. If the agent's multiple-choice
   tool takes fewer questions per call, or fewer options per question, split the round across
   calls rather than dropping questions or options.
2. Read the answers. For each vague, contradictory or surprising answer, ask a follow-up before
   moving on (see Digging deeper and Pushing back).
3. Play the area back in a few lines: "So: you're a lighthouse keeper keeping ships off rocks;
   one round is a night of about 4 minutes; you lose when three ships sink." Ask if that's right
   in the message that carries the next area's questions. The playback and any push-back go in
   the message text before the questions, not inside the question tool.
4. Add anything still open to the open list, show the list at the end of the message, and move to
   the next area.

Recommendations come from what's been decided so far: a five-minute arcade game gets different
defaults from a cozy farming game. Open questions get a recommendation too: propose a concrete
answer built from the idea ("Recommended: the hook is steering ships with the lighthouse beam
itself"), never "it's up to you".

## 1. The idea and the hook

- In one sentence, what does the player do? (Not the setting: the verb.)
- What's the hook: the one thing that makes someone say "oh, that's neat"? Is it a mechanic, a
  theme, a twist on a known genre, a feeling?
- What games is it like, and what exactly is taken from each? What's different from all of them?
- What feeling should a player have while playing? After a good round? After losing?
- Who is the main character or the player's role, if any? Is there a story, or only a setting?
- Is there a title yet? A working title is fine.
- How much time is there to make it: an afternoon, a week, a month? Ask this early: it sets the
  scope of every later recommendation.

## 2. The player and the platform

- Who is it for: everyone, kids, puzzle fans, players who know the genre well?
- How long is one session: one minute, five, twenty, an evening? How often do players come back?
- Where is it played: desktop browser, phone, tablet, all of them? Which matters most?
- Portrait, landscape, or both, on phones?
- Is it for Harmony, or somewhere else as well?

## 3. The first minute

- What does the player see when the game opens? What's the first thing they do?
- How do they learn to play: a tutorial level, hints, trying it, a how-to-play screen?
- When is the first "aha" or the first reward, in seconds from start?
- What does the screen look like during play? Describe it as if it were a screenshot.

## 4. The core loop

- What does the player do, second to second? (Move, aim, match, place, jump, choose.)
- What does that add up to, minute to minute? (Clear a wave, finish a level, win a hand.)
- And session to session? (Unlock, improve, reach a new area, beat a score.)
- What decisions does the player make, and what makes one choice better than another?
- What makes a skilled player better than a new one?
- What makes each round different from the last: randomness, levels, opponents, choices?

## 5. Controls and feel

- The exact controls on each input: keyboard, mouse, touch, controller. Which button does what?
- Should it feel snappy and precise, floaty, heavy, chaotic, calm?
- Any timing windows that matter (coyote time, jump buffering, combo timing)?
- Camera: fixed, following, top-down, side view, first or third person? Does it zoom or shake?
- What feedback does each action give: sound, particles, screen shake, a number popping up?

## 6. Rules, challenge and failure

- How does the player win a round? How do they lose?
- What's the score, if any, and what earns points?
- How does difficulty rise: within a round, across levels, chosen by the player?
- What happens on failure: restart the level, lose progress, a checkpoint, a continue?
- Are there difficulty settings or assists?
- What are the enemies, obstacles or opponents, and how does each behave? How many kinds?
- Any special rules that only appear later (new mechanics, bosses, modifiers)?

## 7. Content and scope

- How much content: how many levels, enemies, items, cards, characters, songs?
- Is content hand-made, procedurally generated, or both?
- What's the smallest version that's still the game (the first playable)? What's the full
  version? What's a "maybe later"?
- Does the full version fit the time from area 1? If not, push back now, before later areas add
  more.
- What's the one feature to cut first if time runs out?

## 8. Progression and saves

- Does anything carry over between sessions: unlocks, levels, currency, cosmetics, high scores,
  story progress?
- Do upgrades change play, or only looks? How much may they change it?
- Is there a daily challenge, a streak, achievements, a leaderboard?
- What must be saved, and should players be able to back up or move their save? (Export and
  Import: through Harmony's file dialogs with the SDK, or a download and a file input without
  it.)
- Whose is each save? Recommended: progress belongs to the player, settings (volume, graphics,
  controls) to the device. Without the Harmony SDK, the game can't tell players apart, so
  progress is per device too, one save per browser. With the SDK, progress is kept per Harmony
  player on each device. Harmony has no cloud saves either way.

## 9. Look

- 2D or 3D? Pixel art, flat vector, low-poly, stylized, realistic?
- A reference image, game or artist for the look?
- The palette or mood: bright, dark, pastel, neon, earthy?
- Where does art come from: made in code, procedural, asset packs the developer owns, free
  libraries, the developer's own art, or a generator they have?
- How do the player, enemies and pickups read at a glance: shape, color, motion?

## 10. Sound

- Music: none, one track, a track per area, music that reacts to play?
- The key sounds: which actions must have a sound?
- Where do sounds and music come from: the developer's own, a library, free sounds, a generator
  they have?
- Which sounds tell the player something they need (a warning, a timing cue, an enemy behind
  them)? What shows the same thing on screen, for players with the sound off?

## 11. Screens and UI

- Which screens: title, how to play, settings, pause, results, level select, shop, credits?
- What's on the HUD during play? What's the single most important number?
- What style should the menus have, in a few words or a reference?
- Anything special: a map, an inventory, dialogue boxes, a shop?

## 12. Multiplayer

- Single player, local multiplayer on one device, online, or several? (These answers set the
  Players boxes on Harmony's upload form.)
- Online: co-op or versus? How many players? Real-time or turn-based?
- How do players find each other: a room code shared with friends? (Harmony has no invites or
  rooms; see area 13.)
- Is online play needed for the first version, or later?

For online play, also settle the network choices `harmony-p2p-multiplayer` asks about, so the
build doesn't stop to ask them:

- **How many players per room?** Recommended: 2, unless the design needs more. Rooms of 3 or 4
  relay through the host.
- **Which signaling server** (the server that connects players before the match)? The free
  public PeerJS server, or one the developer runs. Recommended: the public server for testing
  and small releases; their own for a real launch.
- **A TURN relay, and a "hide my IP" option?** Recommended: not at first, unless they already
  have a TURN server or will pay for one. Without TURN, some networks can't connect, and there is
  no "hide my IP" option.
- **What happens when a player leaves mid-match?** Recommended: for real-time games, the
  multiplayer skill's drop-out rules; for turn-based games, the match is abandoned, not
  forfeited.
- **Can players join a match in progress?** Recommended: only from the lobby, which is simpler;
  allow it for drop-in games such as a shared jigsaw.

## 13. Harmony features

Harmony adds its overlay (sign-in, friends and chat) to every uploaded game with no code. Most
games need nothing more. Recommended: no Harmony SDK, unless the design needs one of the
features below.

What the Harmony SDK adds:

- The player's Harmony name and 4-character tag, instead of a name the player types in.
- The player's friends list in the game, with who's online and what they're playing.
- A button in the game that opens the overlay, on its friends, chat or inbox tab.
- Knowing when the overlay opens and closes, so the game can pause while it's open.
- Real Save and Open dialogs, for files players keep or share (levels, drawings, exported saves).

What Harmony can't do, with or without the SDK, so recommendations stay inside it:

- No game invites, friend requests or chat messages sent by the game, and no rooms or
  matchmaking. The most a game can do for inviting is copy a room code and, with the SDK, open
  the overlay's chat, where the player pastes the code to a friend.
- No game servers and no relaying of game traffic. Online play brings its own (area 12).
- No cloud saves. Saves stay in the browser on each device (area 8).

Ask:

- Does the game need any of the SDK's features? Recommended: none, unless the design calls for
  one; say which and why.
- Only for a standalone real game using the SDK: does the developer have its Game ID from My Creations? It can wait until the build reaches the SDK. Hosted games and the fake attach without options.

## 14. Accessibility and languages

- Which accessibility options matter for this game: text size, color-blind safety, reduced
  motion, subtitles, remappable controls, assists?
- Does anything rely on color, sound, fast reactions or precise timing alone? What's the
  alternative?
- Which languages, at launch and later?

## 15. Performance and devices

- The weakest device it should run well on: an old laptop, a mid-range phone?
- Frame rate target: 60, or 30 for slower games?
- How big may the download be before the title screen?
- Which real devices can the developer test on: a phone (which one), a tablet, a game controller?
  Record them in the brief. `harmony-platforms` checks on them, and the Harmony listing asks
  where the game was played start to finish. Recommended: mark Mobile supported only after play
  on a phone or in the browser's device mode, and Game controller only after play with a real
  controller.

## 16. Tech

- Plain web (Vite and TypeScript by default), a JavaScript engine (Three.js, Phaser, Babylon,
  PixiJS, PlayCanvas), or Unity or Godot?
- Any library or tool the developer prefers or wants to avoid?
- Is there existing code or art to start from? (Check the project folder first; ask only about
  what isn't there.)
- Do they want automated tests and developer tools (tuning panel, cheats, metrics) from the start?

## 17. Store page and release

None of this changes the build until stage 6. If the developer wants to start sooner, record the
recommendations as assumptions and ask again then.

- The title, a one-line pitch, and the kinds of tags that fit.
- What should the thumbnail and screenshots show?
- Which platforms will be marked as supported? Only those the game will be played on, start to
  finish, on the devices from area 15.

## Digging deeper

When an answer is vague, ask for the concrete version:

| They say | Ask |
| --- | --- |
| "It should be fun" | Fun how: tense, relaxing, clever, chaotic? What's the most fun moment, exactly? |
| "Like Game X" | Which part of Game X: the controls, the loop, the look, the progression? What would you change? |
| "Some enemies" | How many kinds? What does each one do that the others don't? |
| "Polished" | Which three things should feel best: the controls, the hits, the menus, the sound? |
| "Simple controls" | Which keys or touches, exactly? One button? Two? |
| "Procedural levels" | What changes between runs, and what stays the same? How do you keep them fair? |
| "Progression" | What does a player unlock in the first ten minutes? After an hour? |
| "Multiplayer" | Online or same device? How many? Together or against each other? |
| "Retro style" | Which era and machine? Resolution, palette, sound chip? |
| "Hard but fair" | How many tries should a first win take? What tells the player why they lost? |
| "Satisfying" or "juicy" | Which three actions should feel best? What should each one show and sound like? |

Ask "what happens next?" and "and then?" until the answer is a sequence of events. Ask "can you
show me an example?" for anything visual.

## Pushing back

Say plainly, with a way out:

- **Scope:** "Forty levels, online play and a story in a week won't fit. The core loop and eight
  levels will. Which matters most?"
- **Contradictions:** "You want short sessions but also a long campaign. Should a campaign
  chapter fit in one session?"
- **Mechanics that fight:** "Precise platforming and touch controls pull against each other. Do
  phones matter more, or precision?"
- **Missing reasons to come back:** "Nothing carries over between sessions. Is that on purpose?"
- **Unclear fun:** "I can't yet picture what makes a round exciting. What's the best moment in a
  round?"
- **Risky choices:** "Fully generated levels are hard to make fair. Start with hand-made ones and
  add generation later?"
- **Beyond Harmony:** "Harmony can't send game invites. The game can copy the room code, and
  with the SDK open the overlay's chat for the player to paste it. Is that enough?"
- **Assets with no source:** "Forty hand-drawn characters and no artist. Placeholders for now, or a
  smaller cast?"

Never argue twice: if the developer keeps their choice after hearing the concern, record it and
move on.

## When to stop

The interview is done when:

- every area that applies has been played back and confirmed,
- the open list is empty, or the developer said to use the recommendations for what's left,
- the first playable version is clear enough to describe as a sequence of what the player sees
  and does in the first two minutes.

Then write the brief.
