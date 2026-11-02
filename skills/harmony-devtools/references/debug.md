# Debug overlays and time controls

Seeing what the game sees, and controlling time, so a bug that happens in one frame can be caught
and looked at. All of it lives behind the dev switch from `tuning.md`.

## Contents
- Overlays
- Time controls
- Jumping to a situation
- The state inspector
- Logging

## Overlays

Toggle each one from the dev panel, and draw it on top of the game:

- **Colliders and hit boxes:** wireframes for physics shapes, attack and hurt boxes, triggers;
  a different color for each kind.
- **Paths and AI:** navigation paths, targets, sight cones, current state names over enemies.
- **Vectors:** velocity and facing arrows on moving objects.
- **Grid and bounds:** the level grid, camera bounds, spawn points, kill zones.
- **Labels:** an id and the state over each object, small enough not to hide the game.

How to draw them:

- **Three.js:** `Box3Helper`, `ArrowHelper`, `AxesHelper`, `SkeletonHelper`, and
  `LineSegments` for custom shapes; or the physics library's own debug renderer (Rapier, cannon-es
  and Ammo-based engines have one).
- **Babylon.js:** the Inspector (`scene.debugLayer.show()`) and `showBoundingBox` on meshes.
- **Phaser:** Arcade and Matter physics have a `debug: true` setting that draws bodies.
- **Canvas 2D:** a second pass after the game's draw, with `strokeRect`, `arc` and lines.

Build overlay geometry once and update it, rather than creating new objects every frame, or the
overlay itself causes stutter.

## Time controls

```ts
// The game's update takes a time scale; the dev tools change it.
const time = { scale: 1, paused: false, stepFrames: 0 };

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!time.paused || time.stepFrames > 0) {
    update(dt * time.scale);
    if (time.stepFrames > 0) {
      time.stepFrames--;
    }
  }
  render();
}
```

- **Pause and resume** (P while the dev panel is open, or a button), with the camera still free to
  look around if the game allows.
- **Step one frame** (period key): set `stepFrames = 1` while paused.
- **Slow motion and fast forward:** 0.1x, 0.25x, 0.5x, 1x, 2x, 4x.
- With a fixed-step update, scale the accumulator's input, so physics stays stable at any speed.
- Animations, particles and audio should follow the same time scale, or slow motion looks wrong.

## Jumping to a situation

- **Level and checkpoint select:** go straight to any level, room or wave.
- **Seed:** show the current seed, and start a run with a given one, to replay a bug.
- **URL parameters** in dev builds (`?level=4&seed=1234&god=1`), so a link reproduces a setup.
- **Snapshots:** save the game state to memory (or a file) and load it back, to retry the same
  moment many times.

## The state inspector

A small panel that shows live values from the game: the player's position, velocity and state,
the current wave, the active quest, counters, flags. Readable at a glance, updated a few times a
second rather than every frame. For deeper digging, expose the game object on
`window.game` in dev builds, so the browser console can read and change anything.

## Logging

- One logger with categories (`physics`, `ai`, `net`, `audio`) that the dev panel can turn on and
  off, instead of `console.log` scattered and forgotten.
- A ring buffer of the last few hundred events, shown in the panel and copied with one button
  into a bug report, with the seed and build version.
- No logging in hot loops in the shipped build; the dev switch removes it with everything else.
