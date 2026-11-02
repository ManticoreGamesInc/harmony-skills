# Optional generators for sound and music

The default path needs no extra tools: the developer's own sounds, or sounds from a library with a
clear license. If the developer has a sound, voice or music generator set up, it can fill gaps.
Read this only when they said yes to the tools question.

## Ground rules

- **Ask, don't detect.** Use only tools the developer says they have. Never scan their machine for
  tools.
- **No paid calls without a yes.** Before calling a service that costs money or credits, say what
  you'll generate and how many tries, and wait for the developer's yes.
- **No API keys.** Never ask for, read, write or pass along a key. The tool reads its own config
  or environment; if it isn't set up, the developer sets it up.
- **Commercial use.** Check the tool's terms allow using its output in a commercial game. If they
  don't, or it isn't clear, say so and use the default path.
- **Record the source.** For every generated file, record the tool, the prompt or brief, the date
  and the terms, next to the asset licenses already tracked.
- **Fall back.** If the tool fails, isn't there, or the result isn't good enough after two or
  three tries, use the default path. It is complete on its own.
- **A starting point.** The developer checks every generated file. The skill's size, format and
  quality rules still apply to it.

## Sound effects and voices

For example ElevenLabs (sound effects and voices), or a local text-to-speech model for voice
lines.

- Describe each cue by what happens and how it should feel ("short wooden click, soft, for a
  menu move"), its length, and that it should start instantly with no silence.
- Generate two to four variants for frequent sounds, as the variation rules ask.
- Voices: a fixed voice per character, the line's emotion, and the exact text. Check every word.
- Then treat each file like any other sound: trim silence, normalize, convert to Opus, set its
  level in the mix.

## Music

For example Suno, Udio, Stable Audio, or a local model such as MusicGen.

- Describe the mood, tempo (BPM), key if it matters, instruments, and length, and ask for an
  instrumental unless the game needs lyrics.
- Ask for a loop, or cut one: find the loop points on bar lines and check the seam
  (`music.md`, gapless loops).
- For layered music, generate the full track first and check whether the tool can give stems;
  if not, use a single track with crossfades instead.
- Bring every track to a similar loudness before setting levels.

## Recording it

Add every generated file to `audio/CREDITS.md`: the tool, the prompt, the date, and the terms that
allow commercial use. Some music services grant commercial use only on paid plans; check which
plan made the file.
