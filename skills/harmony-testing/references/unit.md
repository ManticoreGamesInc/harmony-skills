# Unit tests

Fast tests for the game's rules and data, with no browser. The examples are TypeScript with
Vitest; Jest and `node:test` work the same way.

## Contents
- Seeded randomness
- What to test
- Fixed-step simulation and replays
- Saves and settings
- Fuzzing inputs

## Seeded randomness

Every random number in the game comes from one seeded generator, never `Math.random()`:

```ts
// mulberry32: small, fast, good enough for games.
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min: number, max: number): number => min + next() * (max - min),
    int: (min: number, max: number): number => Math.floor(min + next() * (max - min + 1)),
    pick: <T>(items: T[]): T => items[Math.floor(next() * items.length)],
  };
}
```

- The game makes one generator per run from a seed (the time, or a seed passed in by a test or a
  "daily challenge"), and passes it to everything that needs randomness.
- Purely visual randomness (particle spread) can use a second generator, so changing effects
  never changes gameplay.
- Log the seed when a run starts, in development builds.

## What to test

Test the rules, not the rendering:

- **Scoring and rewards:** points per action, combos, multipliers, caps.
- **Win and loss:** the conditions, including edge cases (last life on the last enemy, a tie,
  time running out on the same frame as the goal).
- **Generation:** a level generated from a seed is solvable, has an exit, stays in bounds; the
  same seed gives the same level.
- **Balance numbers:** tables have no duplicate ids, costs only go up, nothing is unreachable.
- **Bugs:** every bug fixed gets a test that failed before the fix.

```ts
import { describe, expect, it } from "vitest";
import { createRandom } from "../src/random";
import { generateLevel } from "../src/level";

describe("level generation", () => {
  it("is the same for the same seed", () => {
    expect(generateLevel(createRandom(42))).toEqual(generateLevel(createRandom(42)));
  });

  it("always has a path from start to exit", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const level = generateLevel(createRandom(seed));
      expect(hasPath(level, level.start, level.exit), "seed " + seed).toBe(true);
    }
  });
});
```

## Fixed-step simulation and replays

A game whose update runs at a fixed step (for example 60 times a second, independent of the
frame rate) can be tested by running its update with no rendering:

- Feed a list of inputs per step and check the state after N steps.
- **Replays:** record the seed and the input per step during play (development builds); a bug
  report then comes with a file that reproduces it exactly in a test.
- Run thousands of steps with a simple bot or random inputs and check invariants (health never
  below 0, score never decreases, the player never leaves the world).

## Saves and settings

Saves and settings come from storage players can edit, so test that reading them never breaks
the game:

- A default save round-trips: write it, read it back, get the same thing.
- Junk reads safely: `null`, a string, wrong types, unknown ids, huge and negative numbers.
- Every old version migrates: keep one sample save per version as a fixture and read each.
- A save newer than the build is never written over.

## Fuzzing inputs

Anything that comes from outside the game (an imported file, a peer's message, a URL
parameter) gets a test that throws random and hostile data at the parser: random bytes, deep
nesting, very long strings, wrong types. The parser returns a safe result or a clear refusal,
and never throws.
