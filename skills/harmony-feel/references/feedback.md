# Feedback

Effects that make actions feel like they happened. The examples are TypeScript and engine-neutral;
apply the results to the engine's camera, objects and UI.

## Contents
- A feedback plan per action
- Hit-stop
- Screen shake
- Camera kick and zoom
- Squash and stretch
- Flashes
- Particles
- Knockback and reactions
- Tweening and easing
- Interface feedback
- Vibration
- Accessibility settings

## A feedback plan per action

List the game's actions and give each its layers, scaled by how often it happens and how much it
matters:

| Action | Motion | Visual | Sound | Big-moment extras |
| --- | --- | --- | --- | --- |
| Jump | stretch on takeoff, squash on landing | dust puff on landing | short whoosh, soft land | none |
| Hit an enemy | enemy knockback | white flash, sparks | punchy hit | 40 to 80 ms hit-stop, small shake |
| Kill an enemy | enemy pops | burst of particles in its color | bigger hit, pop | 80 to 120 ms hit-stop, shake |
| Take damage | player knockback | red edge flash, blink | hurt sound | shake, vibration |
| Collect | pickup flies to the counter | sparkle | rising chime (pitch up in a streak) | counter pop |
| Win | slow motion for a moment | confetti | stinger | camera zoom |

Frequent actions (jump, collect) stay small and quick; rare ones get the extras.

## Hit-stop

A few frames of frozen time on impact make a hit feel heavy:

```ts
let hitStopUntil = 0;

export function hitStop(ms: number): void {
  hitStopUntil = Math.max(hitStopUntil, performance.now() + ms);
}

// In the game loop, before updating the world:
const frozen = performance.now() < hitStopUntil;
const dt = frozen ? 0 : realDt * timeScale;
```

- 30 to 60 ms for normal hits, 80 to 150 ms for kills and big blows. Longer feels like lag.
- Freeze the world, but keep rendering, input buffering and screen shake running.
- Stack carefully: many hits at once shouldn't freeze for a second; take the max, not the sum.

## Screen shake

Shake from a "trauma" value that events add to and that decays over time, so shakes combine
smoothly:

```ts
let trauma = 0;                       // 0 to 1

export function addTrauma(amount: number): void {
  trauma = Math.min(1, trauma + amount);
}

export function shakeOffset(time: number, dt: number, settingScale: number) {
  trauma = Math.max(0, trauma - dt * 1.5);              // fades in about 0.7 s
  const strength = trauma * trauma * settingScale;      // squared: small trauma barely moves
  const noise = (seed: number) => Math.sin(time * 37.3 + seed) * Math.sin(time * 23.9 + seed * 2.1);
  return {
    x: noise(1) * 12 * strength,                        // pixels
    y: noise(2) * 12 * strength,
    angle: noise(3) * 0.03 * strength,                  // radians
  };
}
```

- Add 0.2 for a small hit, 0.4 for a big one, 0.7 or more for an explosion.
- Apply the offset to the camera only, not the world or the UI.
- Shake toward the direction of the impact when there is one.
- `settingScale` is the player's screen shake setting (0 to 1), and 0 with reduced motion on.

## Camera kick and zoom

- **Kick:** nudge the camera a few pixels opposite a shot's direction, and let it spring back over
  a tenth of a second.
- **Zoom:** a slight zoom in on big moments (a kill, a goal), eased back; never during precise play.
- **Look-ahead:** lead the camera slightly in the direction of movement, so the player sees what's
  coming.

## Squash and stretch

Scale a sprite or model along its motion, keeping its volume about the same:

```ts
// amount > 0 stretches tall (takeoff), < 0 squashes flat (landing).
function squash(amount: number) {
  return { x: 1 - amount * 0.5, y: 1 + amount };
}
// On landing: squash(-0.3), then spring back to (1, 1) over about 150 ms.
```

- Stretch on takeoff and fast movement, squash on landing and impacts.
- Scale from the object's base (its feet), not its center, so it doesn't sink into the floor.
- Small values (0.1 to 0.3); spring back quickly.

## Flashes

- A white flash on the thing that was hit, for one to three frames (50 ms), tells the player the
  hit landed.
- A red or dark edge vignette when the player takes damage.
- Full-screen flashes are rare, short, dimmer than pure white, and off when the player turns
  flashing down. Never more than three flashes a second.

## Particles

- Bursts on impacts, kills, pickups, landings and footsteps; short lives (0.2 to 0.8 s), fast
  starts that slow down, a little gravity.
- Colors from the game's palette and the thing that caused them (an enemy bursts in its own color).
- Pool them, and cap how many exist at once, so a big fight doesn't drop frames.
- They must never hide the player or the next threat; keep them behind important things.

## Knockback and reactions

- Hit enemies move away from the hit a little, with a short stun, so every hit visibly lands.
- The player gets a small knockback and a moment of invulnerability (blinking) when hurt.
- Objects in the world react when touched: grass bends, crates wobble, coins bounce.

## Tweening and easing

Motion with easing feels designed; linear motion feels mechanical.

```ts
export const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  outElastic: (t: number) => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

export function tween(from: number, to: number, t: number, curve = ease.outCubic): number {
  return from + (to - from) * curve(Math.min(1, Math.max(0, t)));
}
```

- Ease out for things arriving and settling; ease in for things leaving; overshoot (`outBack`)
  for things that pop into place; elastic sparingly, for playful UI.
- Anticipation before big actions (a short wind-up before a heavy attack), follow-through after.
- Keep UI tweens short: 150 to 300 ms.

## Interface feedback

- Buttons scale down slightly when pressed and spring back.
- Numbers count up to their new value quickly, with a small pop (scale 1.2 back to 1) on big gains.
- Rewards arrive with ceremony: one at a time, each with a sound, skippable with any input.
- Meters drain with a lighter "lost" section that catches up after a moment.

## Vibration

- Controllers: `gamepad.vibrationActuator?.playEffect("dual-rumble", { duration: 120,
  strongMagnitude: 0.6, weakMagnitude: 0.3 })` where supported, for hits taken and big impacts.
- Phones: `navigator.vibrate(20)` works on Android browsers; iPhones don't support it.
- Short and rare; offer a setting to turn it off.

## Accessibility settings

- Screen shake strength from the player's setting; none with reduced motion.
- Reduced motion also cuts zooms, big camera moves, parallax and bouncy UI, keeping fades.
- Flashes limited, and full-screen ones off when the player turns flashing down.
- Every important event still has a clear, calm cue (an icon, a color with a shape, a sound) when
  the effects are turned down.
