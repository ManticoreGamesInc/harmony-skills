# The default path: models in code and asset libraries

No extra tools needed. The examples use Three.js; Babylon.js and PlayCanvas have the same
building blocks.

## Contents
- When code-built models are right
- Building blocks
- Making them look finished
- Asset libraries
- The game's own asset library
- Mixing sources

## When code-built models are right

- Stylized and low-poly games, where clean shapes and good color carry the look.
- Props, pickups, projectiles, obstacles, platforms, simple vehicles and buildings.
- Blockouts while the game is being designed; swap them for richer models later.

Characters with faces, organic creatures and detailed environments usually need a library model
or a tool.

## Building blocks

```ts
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// A crate: a rounded box, so edges catch the light instead of looking like a placeholder cube.
const crate = new RoundedBoxGeometry(1, 1, 1, 2, 0.06);

// A coin: a lathe of a profile, beveled at the rim.
const profile = [new THREE.Vector2(0, -0.05), new THREE.Vector2(0.45, -0.05), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.45, 0.05), new THREE.Vector2(0, 0.05)];
const coin = new THREE.LatheGeometry(profile, 32);
coin.rotateX(Math.PI / 2);

// A logo-shaped platform: a 2D shape extruded with a bevel.
const shape = new THREE.Shape();
shape.moveTo(0, 0).lineTo(2, 0).lineTo(2, 1).lineTo(1, 1.5).lineTo(0, 1).closePath();
const platform = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });

// A tree: parts merged into one geometry per material, so it's one draw call.
const trunk = new THREE.CylinderGeometry(0.1, 0.15, 1, 8).translate(0, 0.5, 0);
const crown = new THREE.IcosahedronGeometry(0.6, 1).translate(0, 1.4, 0);
```

- **Instancing:** `InstancedMesh` for many copies (trees, coins, rocks), with per-instance
  transforms and colors.
- **Merging:** `mergeGeometries` for static parts that share a material.
- **Variation:** scale, rotate and tint instances a little, so a forest isn't one tree repeated.
- Build each model once at load and reuse it; never rebuild geometry per frame.

## Making them look finished

Plain primitives read as placeholders. A few touches fix that:

- **Bevels** on every hard edge (rounded boxes, beveled extrusions): edges catch highlights.
- **A palette** of a few colors per material set, from the game's style, not default grays.
- **Vertex colors or a small gradient texture** for two-tone shading (darker bottoms, lighter
  tops) without extra lights.
- **Flat or smooth shading on purpose:** flat for faceted low-poly, smooth for soft shapes;
  don't mix by accident.
- **Lighting:** one key light, a soft fill or hemisphere light, and an environment map; even
  simple models look solid with good light.
- **Silhouette first:** recognizable from the shape alone at gameplay distance.

## Asset libraries

Models someone has already made, ready to use. Ask the developer whether they own any packs
(bought from an asset store, or from earlier projects); those come first, since they're already
paid for and often already match their style. Otherwise, free CC0 packs that need no attribution
(a credit is still kind):

- **Kenney** (kenney.nl): large, consistent low-poly packs: city, nature, space, furniture,
  vehicles, characters.
- **Quaternius** (quaternius.com): stylized low-poly packs, including rigged and animated
  characters.
- **Poly Haven** (polyhaven.com): realistic models, textures and HDRI environment maps.

Other sources (asset stores, Sketchfab and similar) use many licenses: CC BY needs attribution,
CC BY-NC forbids commercial use, and some store licenses forbid redistribution in an open
project. Check each model's license before using it.

For every library model:

- Prefer glTF or GLB downloads; convert others in the pipeline.
- Record it in `models/CREDITS.md`: name, source URL, author, license, and what was changed.
- Run it through the web pipeline: scale, orientation, budget, compression.

## The game's own asset library

Once a game has more than a handful of models, keep them in one place with a catalog, so the agent
and the developer reuse instead of re-making:

- One folder (`models/`) with every web-ready `.glb`, named by what it is (`crate_wood.glb`,
  `tree_pine_02.glb`).
- `models/CREDITS.md` as the catalog: each model's name, what it is, its size in meters, its
  triangle count, its source and license.
- Kit pieces (walls, floors, roofs, tiles) on the same grid size, so they snap together and feed
  procedural layouts (see `procedural.md`).
- Check the library before making a new model; extend a kit before starting a new one.

## Mixing sources

Models from different packs, code and tools can look like different games. To keep one look:

- Pick one main pack and fill gaps from others that share its style.
- Re-color everything to the game's palette (swap material colors, or remap the pack's palette
  texture).
- Match the level of detail and edge style: don't put a smooth realistic model in a faceted
  low-poly scene.
- Light everything with the same lights and environment map.
