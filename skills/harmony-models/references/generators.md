# Optional tools for 3D models

The default path (models in code and free libraries) needs no extra tools. If the developer has
Blender, a text- or image-to-3D service, or a local 3D model set up, those can make richer models.
Read this only when they said yes to the tools question.

## Ground rules

- **Ask, don't detect.** Use only tools the developer says they have. Never scan their machine for
  tools.
- **No paid calls without a yes.** Before calling a service that costs money or credits, say what
  you'll generate and how many tries, and wait for the developer's yes.
- **No API keys.** Never ask for, read, write or pass along a key. The tool reads its own config or
  environment; if it isn't set up, the developer sets it up.
- **Commercial use.** Check the tool's terms, and the plan the developer is on, allow using its
  output in a commercial game. Some free plans require attribution or forbid commercial use. If
  it isn't clear, say so and use the default path.
- **Record the source.** For every generated model, record the tool, the prompt or input image, the
  date and the terms in `models/CREDITS.md`.
- **Fall back.** If the tool fails, isn't there, or the result isn't good enough after two or three
  tries, use the default path.
- **The developer reviews** every generated model: the look, the scale, the topology, and the
  license. Then it goes through the web pipeline like any other model.

## Blender

Blender is free and scriptable, and it's the best place to fix any model: scale, orientation,
pivots, simplifying, materials, rigging and export.

- **By script:** write a Python script and run it headless,
  `blender --background --python make_crate.py`. Keep the script in the project, so the model can
  be rebuilt and changed later.
- **Through an MCP server:** if the agent has a Blender MCP server connected, use it to build and
  inspect models in the running Blender, and still save the script.
- **Export** with the glTF exporter:

  ```python
  import os
  import bpy
  # An absolute path next to the script: "//" paths need a saved .blend file.
  out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crate.glb")
  bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True, export_yup=True)
  ```

  `export_apply` applies modifiers; `export_yup` converts Blender's Z-up to glTF's Y-up.
- Apply scale and rotation before export (Object > Apply > All Transforms), and set the origin
  where the model stands.
- Use Bevel and Weighted Normal modifiers for clean hard-surface edges, and Decimate to reach the
  budget.

## Text- and image-to-3D services

For example Tripo, Meshy, Rodin (Hyper3D) or Luma.

- **Image to 3D** gives more control than text: give a clean concept image of the object on a
  plain background, from the front or three-quarters view.
- **Text to 3D:** describe the object, its style ("stylized low-poly, flat colors" or "realistic
  PBR"), and that it's a single object with no ground or background.
- Ask for GLB output, with PBR textures and, where offered, a low-poly or "game-ready" option.
- Results are usually too dense, with baked lighting in the textures and messy topology: simplify
  to the budget, check the textures for baked shadows, fix scale and orientation, and check the
  silhouette from every side.
- Characters come unrigged unless the service offers rigging; rig them in Blender before
  animating.
- Generate several candidates and pick one, rather than spending many tries on one prompt.

## Local models

Some developers run open 3D generation models locally (for example TripoSR, Hunyuan3D or TRELLIS,
often through ComfyUI). Each model has its own license, and some restrict commercial use or where
they may be used: check it before using the output. Treat the output like a service's: simplify,
fix, review.

## After any tool

Run every generated model through the web pipeline: scale and orientation, budget, simplifying,
compression, then a look in the game under its own lights, next to the models around it.
