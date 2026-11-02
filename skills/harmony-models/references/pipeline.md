# The web pipeline

Every model, whether built in Blender, downloaded or generated, goes through the same steps before
it's in the game. The commands use `gltf-transform` (`npm install --save-dev @gltf-transform/cli`),
which reads and writes glTF and GLB.

## Contents
- Format
- Scale, orientation and pivot
- Budgets
- Inspecting a model
- Simplifying
- Compressing
- Materials and textures
- Animation
- Loading in each engine

## Format

- Ship `.glb` (binary glTF: one file with its textures) or `.gltf` with its files.
- Convert other formats (FBX, OBJ) to glTF first, in Blender if the developer has it, or with a
  converter they trust.

## Scale, orientation and pivot

glTF uses meters, Y up, and a model's front facing +Z. Fix these once, in the file, not with a
transform in the game:

- **Scale:** a door about 2 m high, a character about 1.7 m, a crate about 1 m. Libraries and
  generators often export at random scales.
- **Orientation:** standing upright, front toward +Z. Generated models often face the wrong way.
- **Pivot:** at the bottom center for things that stand, at the hinge for doors, at the center for
  things that spin.
- **Transforms applied:** the root node has no leftover scale or rotation.

## Budgets

Suggested limits for phones; desktops can take more, but phones set the limit for a game that
runs on both.

| Model | Triangles | Textures |
| --- | --- | --- |
| Hero (player character, main vehicle) | 10k to 30k | one 1024 to 2048 set |
| Character or enemy seen up close | 5k to 15k | one 1024 set |
| Prop | 500 to 5k | 512, or a shared atlas |
| Pickup or small item | under 500 | a shared atlas |
| Whole scene in view | under about 300k | as few materials as possible |

Fewer materials and meshes matter as much as triangles: each is a draw call.

## Inspecting a model

```
npx gltf-transform inspect model.glb
```

It lists meshes, triangles, materials, textures with their sizes, and animations. Check it against
the budget before and after optimizing.

## Simplifying

Generated and scanned models are usually far over budget, with messy topology.

```
npx gltf-transform simplify model.glb model-simple.glb --ratio 0.25 --error 0.001
```

- Lower the ratio until it's within budget, then look at it in the game at its real size. Stop
  when the silhouette starts to break.
- For heroes and anything that deforms (characters), simplify in Blender with care or retopologize
  by hand; automatic simplification can tear animated meshes.
- Remove hidden geometry (insides, bottoms nobody sees).

## Compressing

```
npx gltf-transform optimize model.glb model-web.glb --compress meshopt --texture-compress webp
```

- `optimize` also removes unused data, merges what it can, and welds vertices.
- `--compress meshopt` decodes fast; `draco` is often smaller. Both need the decoder registered in
  the loader.
- `--texture-compress ktx2` stays compressed on the GPU, which saves memory on phones; it needs the
  KTX-Software tools installed. `webp` saves download size only.
- Resize textures to how big the model appears: `npx gltf-transform resize model.glb out.glb
  --width 1024 --height 1024`.

## Materials and textures

- Metallic-roughness PBR materials, or unlit (`KHR_materials_unlit`) for flat-shaded stylized
  games.
- As few materials per model as possible; share materials and atlases across props.
- Normal maps add detail cheaply; skip them on small props.
- Check the model in the game's own lighting with an environment map: models that look fine in a
  viewer can look black or flat in the game.

## Animation

- Keep only the clips the game uses; each one costs download and memory.
- Name clips plainly (`idle`, `run`, `jump`) and check they loop cleanly.
- Generated models usually come without a rig; rig and animate them in Blender, or pick a library
  character that is already rigged.

## Loading in each engine

**Three.js:**

```ts
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const ktx2 = new KTX2Loader().setTranscoderPath("./basis/").detectSupport(renderer);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
const gltf = await loader.loadAsync("./models/crate.glb");
scene.add(gltf.scene);
```

Copy the Basis transcoder files (from `three/examples/jsm/libs/basis/`) into the build, at the
relative path given. For Draco, add `DRACOLoader` with its decoder files the same way.

**Babylon.js:** with `@babylonjs/loaders` imported, `await ImportMeshAsync("./models/crate.glb",
scene)` (older versions: `SceneLoader.ImportMeshAsync`). KTX2, Draco and meshopt are supported;
check the decoder setup in the Babylon docs for your version.

**PlayCanvas:** import the GLB in the editor, or load it at run time with
`app.assets.loadFromUrl("./models/crate.glb", "container", callback)` and
`asset.resource.instantiateRenderEntity()`. Check which mesh compressions your version supports.

**Unity:** Unity doesn't import glTF out of the box: add a glTF importer package (such as glTFast
or UnityGLTF), or convert the model to FBX in Blender. Budgets and scale still apply.

**Godot:** imports glTF and GLB natively, and it's the preferred 3D format. Check the import
settings (scale, root type, physics) in the Import dock.

2D engines such as Phaser don't load 3D models; render them to sprites instead if a 2D game wants
3D-looking art.

Unload models between levels (dispose geometries, materials and textures) so phones don't run out
of memory.
