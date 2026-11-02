# Optional generators for UI

The default path needs no extra tools: the UI is designed with the developer and built in code
from theme tokens. If the developer has an image generator set up, it can help with the look.
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

## What a generator may make here

| Use | How |
| --- | --- |
| Style directions | Concept mockups of the title screen and HUD for each direction, over a real frame of the game, to pick from |
| Backgrounds | Menu and title backgrounds painted from the game's world, with no text |
| Icons and frames | Ornaments, panel frames, badges and item icons in the chosen style |

The interface itself is still built in code: text, buttons, layout and every control come from
the theme tokens, so it stays sharp, accessible, translatable and usable with every input. Never
ship a generated picture of a menu as the menu.

## Image tools

Any tool that outputs a PNG works, for example OpenAI's image models through Codex or the API,
Google's Gemini image models, or a local ComfyUI or Stable Diffusion setup.

- Attach a real frame of the game and describe its palette and mood.
- Ask for no text in backgrounds and frames; generated lettering is usually wrong, and real text
  must be translatable.
- For icons, ask for a flat key color background and key it out, then check each icon at its real
  size: small icons need simple shapes.
- Turn chosen colors from mockups into theme tokens, and check them for contrast and color
  blindness like any other colors.

## Recording it

List every generated image in the game's credits or asset list: the tool, the prompt, the date
and the terms that allow commercial use.
