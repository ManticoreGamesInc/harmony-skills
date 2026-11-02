# Procedural models

Models made by rules and random numbers instead of by hand: terrain, rocks, trees, buildings,
dungeons, crowds of props. No extra tools needed, and one generator makes endless variety. The
examples use Three.js; the ideas carry to any engine.

## Contents
- When procedural fits
- Seeds
- Terrain
- Rocks and organic shapes
- Trees and plants
- Buildings and modular kits
- Levels from tiles
- Keeping it fast
- Keeping it consistent

## When procedural fits

- Many similar things that shouldn't look identical: rocks, trees, asteroids, crates, houses.
- Large spaces: terrain, cities, dungeons, space fields.
- Games with generated levels, where models must match the layout.

It's a poor fit for characters and hero objects players look at closely; use a library model or
a tool for those.

## Seeds

Drive every generator from a seeded random number generator, never `Math.random()`, so the same
seed makes the same model. Then models can be regenerated instead of stored, bugs reproduce, and a
level can be shared by its seed.

```ts
function createRandom(seed: number) {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

## Terrain

Displace a grid with layered noise (fractal noise: several octaves, each at double the frequency
and half the strength):

```ts
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";   // a small, MIT-licensed noise package

function terrain(size: number, segments: number, seed: number): THREE.BufferGeometry {
  const noise = createNoise2D(createRandom(seed));
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments).rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / size;
    const z = position.getZ(i) / size;
    let height = 0;
    let amplitude = 1;
    let frequency = 2;
    for (let octave = 0; octave < 5; octave++) {
      height += noise(x * frequency, z * frequency) * amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    position.setY(i, height * size * 0.1);
  }
  geometry.computeVertexNormals();
  return geometry;
}
```

- Color by height and slope (sand, grass, rock, snow) with vertex colors.
- Keep the segment count within budget; split big terrains into chunks that load and unload.
- Use the same height function for gameplay (walking, placing objects), not the mesh.

## Rocks and organic shapes

Start from a low-detail sphere and push its vertices with noise:

- `IcosahedronGeometry(1, 2)`, each vertex moved along its normal by noise at its position, then
  scaled unevenly (squashed or stretched) per rock.
- Flat shading for faceted low-poly rocks; smooth for pebbles.
- Make 5 to 10 variants from seeds at load, then instance them with random rotation, scale and a
  small color shift.

## Trees and plants

- **Simple:** a tapered cylinder trunk plus one to three noise-pushed icosahedrons for the crown,
  merged into one geometry per material.
- **Branching:** recursive rules (an L-system or a simple recursive function): each branch splits
  into two or three shorter, thinner branches at random angles, down to a set depth, with leaf
  clusters at the tips.
- Generate a handful of species and variants, then instance them across the world.

## Buildings and modular kits

Build from a small kit of pieces that snap on a grid (wall, window wall, door, corner, roof,
floor), whether the pieces are code-built, from a library, or modeled:

- A building is a footprint (a set of grid cells) and a height; each outer edge gets a wall piece,
  each floor repeats, the top gets a roof.
- Rules add character: doors on the street side, windows in a rhythm, a random balcony, varied
  heights per block.
- Instance each piece type across the whole city: a city of thousands of pieces is a few dozen
  draw calls.

## Levels from tiles

For dungeons and arenas, generate the layout (rooms and corridors, cellular automata caves, or
wave function collapse over a tile set), then place one kit piece per tile. Keep the layout data
separate from the meshes, so gameplay and navigation use the layout directly.

## Keeping it fast

- Generate at load or during a loading screen, or spread it over several frames; never in the
  middle of play.
- Cache generated geometry by seed; reuse it for every instance.
- Merge and instance as with any model, and check the scene against the triangle and draw-call
  budget.
- For huge worlds, generate chunks around the player and drop distant ones.

## Keeping it consistent

- Clamp every random choice to a range that still fits the style: random proportions within
  limits, colors from the palette.
- Look at many seeds, not one: generate a grid of 20 to 50 variants and remove the rules that make
  ugly ones.
- Mix procedural models with hand-made or library hero pieces, lit the same way.
