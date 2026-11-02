# Orb Dash

A deliberately small canvas game for trying the harmony-skills on: steer with the arrow keys or
WASD, collect the yellow orbs, avoid the red comets. Enter starts and restarts.

It has no build step and no dependencies. Serve the folder with any static server and open it:

```
npx serve .
```

It is plain on purpose: no menus, no settings, no sound, no saves beyond a best score, random
numbers from `Math.random`, and numbers hard-coded in `src/game.js`. The eval cases in `evals/`
ask agents to improve it with each skill.
