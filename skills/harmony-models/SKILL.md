---
name: harmony-models
description: Get 3D models into a web game - built in code or procedurally, from CC0 libraries such as Kenney, Quaternius and Poly Haven, or with Blender or a text- or image-to-3D service only if the developer has one, then made web-ready as glTF/GLB with the right scale, a phone polygon budget and compressed meshes and textures. Use when a 3D web game needs models, props, characters or environments, replaces placeholder boxes, or has models that are too heavy, sideways, dark or slow to load.
license: MIT
compatibility: 3D web games in any engine. Default path needs no extra tools; optional tools are only used when the developer has them. Guidance only; no scripts.
---

# 3D models for web games

Models for a 3D web game, from wherever they come, made ready for the web. The default path needs
no extra tools and is complete on its own. It is guidance: write the code and steps into the
game's own project.

## Where models come from

With no extra tools, three ways are always available; offer them, and combine them freely:

1. **Built in code** ([references/default.md](references/default.md)): primitives with bevels,
   extrusions and lathes, merged and instanced, colored from the game's palette. Right for
   stylized and low-poly games, props, pickups and blockouts.
2. **Procedural** ([references/procedural.md](references/procedural.md)): models made by rules
   and seeds, such as terrain, rocks, trees, buildings from modular kits, and levels from tiles.
   Right for variety and large spaces.
3. **An asset library** ([references/default.md](references/default.md)): packs the developer
   already owns, free CC0 packs such as Kenney, Quaternius and Poly Haven, and the game's own
   growing library of approved models, each with its source and license recorded.

And, only if the developer has them:

4. **Tools the developer has** (optional, [references/generators.md](references/generators.md)):
   Blender by script, or a text- or image-to-3D service. Only when the developer says they have
   one.

Whatever made a model, it goes through the same web pipeline
([references/pipeline.md](references/pipeline.md)) before it's in the game.

## Order of work

1. **Look at the game first.** Find the engine, the models already in it (placeholder boxes,
   packs, a `models/` folder and its `models/CREDITS.md`), the game's palette and art style, and
   any design doc that lists what the game needs. Then ask the questions below.
2. **Make each model** the way the developer chose: in code, procedurally, from a library, or
   with a tool they have. Reuse or extend a model already in `models/` before making a new one.
3. **Make it web-ready** with [references/pipeline.md](references/pipeline.md): scale,
   orientation, pivot, budget, compression.
4. **Check it in the game**, under the game's own lights, at its real size, next to the models
   around it. Then the developer reviews it.
5. **Report** to the developer: each model with its source, triangle count and file size, any
   model over budget, what is still a placeholder, and any choices made for them. Every model is
   in `models/CREDITS.md`.

## Ask the developer first

Ask in one round, with a recommendation for each. Don't ask what the code already shows.

- **The style:** low-poly flat colors, stylized textured, or realistic. One style for the whole
  game; mixed sources must look like one set. Recommended: the style the game already has; for
  a new game, low-poly flat colors, which code, procedural rules and free packs all cover.
- **What's needed:** draft the list from the game (placeholders, the design doc), with each
  model's role (hero, prop, environment, pickup), how big it is on screen, and a suggested way
  to make it: code for simple props, procedural for variety and large spaces, a library for
  characters and detailed pieces. Ask the developer to confirm or change the list.
- **Packs they own:** asset packs already bought or made for earlier projects, which come
  first. Recommended: none, unless they name some.
- **Tools: "Do you have any of these set up? (default: none)"** Blender (driven by script, or
  through a Blender MCP server if the agent has one); a text- or image-to-3D service, for example
  Tripo, Meshy, Rodin (Hyper3D) or Luma; or a local 3D generation model. Ask; never scan the
  machine for tools. Without any, the default path is complete.

If the developer says "you decide", use the recommendations and list them in the report as
choices they can change.

## Rules

- **One style.** Same palette, same level of detail, same edge treatment (bevels or none), same
  texel density across every model in a scene.
- **glTF in the end.** Every model ships as `.glb` (or glTF), at real-world scale in meters, Y up,
  facing +Z, with its pivot where it stands or rotates. Unity is the exception: see "Loading in
  each engine" in [references/pipeline.md](references/pipeline.md).
- **A budget per model** for the target devices, checked before it goes in (see
  [references/pipeline.md](references/pipeline.md)); phones set the limit.
- **Compressed.** Meshes with meshopt or Draco, textures as KTX2 or WebP, sized to how big the
  model appears.
- **Sources recorded.** Every model in `models/CREDITS.md`: where it came from, its author, its
  license (or the tool, prompt and terms for a generated one), and what was changed.
- **The developer reviews** every model from a library or a tool: the look, the scale, the
  topology and the license. Show each one in the game, for example with a screenshot.
- **Optional tools follow the ground rules** in [references/generators.md](references/generators.md):
  a yes before any paid call, no API keys, commercial terms checked, and a fall back to the
  default path.

## Reference files

| File | Read when |
| --- | --- |
| [references/default.md](references/default.md) | Building models in code; asset libraries (owned packs, free CC0 packs, the game's own library) |
| [references/procedural.md](references/procedural.md) | Models from rules and seeds: terrain, rocks, trees, modular buildings, tile levels |
| [references/pipeline.md](references/pipeline.md) | Making any model web-ready: glTF, scale and orientation, budgets, compression, materials, loading in each engine |
| [references/generators.md](references/generators.md) | Only when the developer has Blender, a 3D generation service or a local model: ground rules and tips |
