# Controls that feel right

Effects can't fix controls that feel wrong. These are the techniques that make movement and
actions feel responsive and fair. The examples are TypeScript and engine-neutral; the numbers are
starting points to tune by playing.

## Contents
- No input lag
- Input buffering
- Coyote time
- Acceleration, deceleration and turning
- Jumps that feel good
- Corner correction and forgiveness
- Aim assist
- The camera
- Starting values

## No input lag

- **Act on the frame the input arrives.** Read input at the start of the update and start the
  action in the same frame; never wait for an animation to reach a "start" frame.
- **Animations follow the action,** not the other way round: a jump leaves the ground at once,
  and its wind-up is a squash that happens while already rising.
- **Keep frames short:** a stutter is input lag the player feels. Measure with the game's
  metrics or the browser's performance panel.
- **Don't smooth the player's own input** with averaging; smooth the camera instead.

## Input buffering

Remember a press for a short time, so an input slightly too early still works:

```ts
const BUFFER = 0.12;           // seconds
let jumpPressedAt = -Infinity;

function onJumpPressed(now: number): void {
  jumpPressedAt = now;
}

function update(now: number): void {
  if (now - jumpPressedAt <= BUFFER && canJump()) {
    jump();
    jumpPressedAt = -Infinity;  // used up
  }
}
```

Use it for jumps before landing, attacks during another attack's recovery, and turn-based
inputs during an animation.

## Coyote time

Let the player still jump for a moment after walking off a ledge:

```ts
const COYOTE = 0.1;            // seconds
let lastGroundedAt = -Infinity;

// Every update:
if (onGround) {
  lastGroundedAt = now;
}
const canJump = (): boolean => now - lastGroundedAt <= COYOTE;
```

Players never notice it; they notice when it's missing, as "I pressed jump and fell".

## Acceleration, deceleration and turning

- Reach top speed in a short time (0.05 to 0.2 s), stop even faster, and turn around faster
  than that. Slow stops feel slippery.
- Less control in the air than on the ground, but not none: players expect to steer a jump.
- Ice and other slippery surfaces are the exception, used on purpose.

```ts
function moveToward(current: number, target: number, maxDelta: number): number {
  return Math.abs(target - current) <= maxDelta ? target : current + Math.sign(target - current) * maxDelta;
}

const target = input.x * MAX_SPEED;
const turning = input.x !== 0 && velocity.x !== 0 && Math.sign(input.x) !== Math.sign(velocity.x);
const rate = turning ? TURN : input.x !== 0 ? ACCEL : DECEL;
velocity.x = moveToward(velocity.x, target, rate * (onGround ? 1 : AIR_CONTROL) * dt);
```

## Jumps that feel good

- **Variable height:** releasing the button early cuts the jump short (multiply upward velocity
  by about 0.5 on release).
- **Faster falling:** gravity about 1.5 to 2 times stronger on the way down than on the way up;
  floaty falls feel weak.
- **Apex hang:** a little less gravity near the top of the jump, so the player has time to aim
  the landing.
- **Terminal velocity:** cap the fall speed, so long falls stay readable.
- Design the jump from height and time: the peak height in tiles and the time to reach it, then
  derive gravity and jump speed (`gravity = 2 * height / timeToPeak²`,
  `jumpSpeed = gravity * timeToPeak`).

## Corner correction and forgiveness

- **Corner correction:** when a jump clips a ledge's corner by a few pixels, nudge the player
  past it instead of stopping them.
- **Generous hit boxes for the player's attacks, small ones for enemy attacks on the player:**
  players forgive near misses in their favor and blame the game for the others.
- **Ledge grab or step-up** for small edges, where it fits the game.
- **Short invulnerability after taking a hit,** so one mistake doesn't chain into several.

## Aim assist

For controllers and touch, where aiming is harder than with a mouse:

- **Magnetism:** bend the aim slightly toward the nearest target within a small angle.
- **Friction:** slow the aim's turning speed while over a target.
- **Bigger target areas** for hit checks than the visible target, a little.
- Keep it subtle and adjustable, and off with a mouse.

## The camera

- Follow the player with smoothing (lerp toward a target each frame, rate scaled by `dt`), with a
  small dead zone so tiny movements don't move the camera.
- Look ahead in the direction of movement, and toward where the player aims.
- Never smooth so much that the player leaves the screen, or so little that it jitters.
- Snap, don't smooth, when the scene changes (respawn, new room).

## Starting values

Tune from these by playing; every game needs its own.

| Value | Start at |
| --- | --- |
| Input buffer | 0.1 to 0.15 s |
| Coyote time | 0.08 to 0.12 s |
| Time to top speed | 0.1 s |
| Time to stop | 0.06 s |
| Air control | 0.6 to 0.8 of ground control |
| Fall gravity | 1.6 to 2 times rise gravity |
| Jump cut on release | 0.5 times upward speed |
| Hit-stop on a normal hit | 40 to 60 ms |
| Invulnerability after a hit | 0.6 to 1 s |
