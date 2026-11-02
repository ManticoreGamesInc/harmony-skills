# Optional generators for store media

The default path makes every store image with no extra tools: captures from the running game, and
a title logo built in code. If the developer has an image generator set up, it can upgrade the
title logo and the banner art. Read this only when they said yes to the tools question.

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

## What a generator may make here

| Piece | With a generator | Never |
| --- | --- | --- |
| Title logo | An upgraded logo, with the code-built lockup as the reference image so the spelling and layout carry over (`title-logo.md`, section 3) | Letters that differ from the game's title |
| Banner background art | Painted key art from the game's own frames, characters and palette, with no text, logos or UI, subject in the center or right | A scene, character or feature the game doesn't have |
| Banner mobile portrait | The same painted art in 9:16, with no text, logos or UI, subject in the upper half | Text, the title logo, or anything the background art may not have |
| Thumbnail | Only the title on it; the picture stays a real frame from the game | A generated scene in place of the game |
| Screenshots and preview movie | Nothing: they must show the real game | Anything generated |

Store pages show players what they'll play: generated art must not promise more than the game has.

## Image tools

Any tool that outputs a PNG or JPEG works, for example:

- OpenAI's image models, through Codex or the API;
- Google's Gemini image models;
- a local ComfyUI or Stable Diffusion setup;
- any other tool the developer uses.

Tips:

- Attach a real frame or the code-built lockup as the reference image; describe the game's
  palette, art style and mood from its own frames.
- Most generators can't make true transparency: ask for a flat key color the art doesn't use
  (#ff00ff, or #00ff00 for art with pinks), then key it out with the skill's script.
- Ask for at least the final size (3840x2160 for the banner background, 1440x2560 for the
  mobile portrait, 1024x1024 for the logo), or upscale with the tool, never by stretching.
- Check every letter of a generated logo, and the banner and portrait for stray text or
  watermarks.
- Record the tool, brief, date and terms in `thumbnail.json` and `banner/banner.json`, next to
  the other sources.
