# Unit tests

Fast tests for the game's rules and data, with no browser. The examples are TypeScript with
Vitest; Jest and `node:test` work the same way.

## Contents
- Seeded randomness
- What to test
- Fixed-step simulation and replays
- Saves and settings
- Fuzzing inputs
- Hostile names
- Harmony SDK code

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
- Junk reads safely: `null`, a string, wrong types, unknown ids, huge and negative numbers, a
  fractional or negative version.
- Keys can't pollute: a save or settings file with `__proto__` and `constructor` keys loads, and
  afterwards `({} as any).polluted` is still `undefined` and a fresh default is unchanged.
- Every old version migrates: keep one sample save per version as a fixture and read each.
- A save newer than the build is never written over.

```ts
it("ignores __proto__ in a save", () => {
  const text = '{"game":"star-hopper","version":1,"data":{"__proto__":{"polluted":1},"stats":{"__proto__":{"polluted":1}}}}';
  expect(parseSaveFile(JSON.parse(text))).not.toBeNull();
  expect(({} as any).polluted).toBeUndefined();
});
```

## Fuzzing inputs

Anything that comes from outside the game (an imported file, a peer's message, a URL
parameter) gets a test that throws random and hostile data at the parser: random bytes, deep
nesting, very long strings, wrong types, `__proto__` and `constructor` keys. The parser returns
a safe result or a clear refusal, and never throws.

## Hostile names

A game that shows names (its own players, peers, Harmony display names, friends' presence)
tests the code that cleans and shows them with names built to break things: markup, a bidi
override, zero-width characters, a line break and a very long name. In jsdom:

```ts
// @vitest-environment jsdom
import { expect, it } from "vitest";
import { showName } from "../src/ui/names";   // your own: cleans the name and sets it as text

const HOSTILE = ["<img src=x onerror=alert(1)>", "\u202Eevil", "a\u200Bb\nc", "W".repeat(500)];

it("shows hostile names as plain, capped text", () => {
  for (const name of HOSTILE) {
    const element = document.createElement("span");
    showName(element, name);
    expect(element.children.length).toBe(0);                          // no element was parsed
    expect(element.textContent).not.toMatch(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\n]/);
    expect(Array.from(element.textContent ?? "").length).toBeLessThanOrEqual(16);
  }
});
```

The browser version, with the name on a real screen, is in `browser.md` ("A hostile name").

## Harmony SDK code

Only for a game that uses the Harmony SDK (`@playharmony/sdk`); most don't, and need nothing
here. Test the game's Harmony code against the SDK's fake: the real SDK with a simulated backend
of bot friends and chat, and no sign-in. Don't write a mock or stub of the SDK.

`loadFakeGameServices` from `@playharmony/sdk/testing` downloads the fake into the test and
returns its `attach`. The test runs in a DOM emulation such as jsdom, needs a network
connection, and the download can take up to 30 seconds, so raise the hook's timeout. Import it
only from test files, never from game code.

```
npm install --save-dev jsdom
```

```ts
// @vitest-environment jsdom
// tests/harmony.test.ts
import { beforeAll, expect, test } from "vitest";
import { loadFakeGameServices } from "@playharmony/sdk/testing";

let attachFake: Awaited<ReturnType<typeof loadFakeGameServices>>;

// The fake downloads once for the file. Allow 90 seconds for it.
beforeAll(async () => {
  attachFake = await loadFakeGameServices();
}, 90_000);

test("the game attaches to Harmony", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const harmony = await attachFake({ gameId: "YOUR_GAME_ID", container });
  expect(harmony.isOpen()).toBe(false);
  harmony.detach();
});
```

- The `// @vitest-environment jsdom` comment, at the top of the file, runs this one file in jsdom, so the rule tests stay
  in Node. To run every test in jsdom instead, set `environment: "jsdom"` in the `test` block of
  the Vitest config.
- Write the game's Harmony code so it takes the handle from outside (the value `attach`
  resolves to in the game), then pass it the handle from `attachFake` in the test: for example,
  that the game pauses when the overlay opens, or keys a save on the session's `accountId`.
- Call `harmony.detach()` at the end of each test, so the next one starts clean.
- Use the Game ID the game passes to `attach`, or the placeholder `YOUR_GAME_ID` if it doesn't
  have one yet.
- The harmony-sdk skill lists every call the handle has and what each one returns.
