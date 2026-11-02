#!/usr/bin/env bash
# Writes the Orb Dash example game (examples/orb-dash) into the empty eval folder.
# Regenerate with `npm run eval:fixtures` after changing the example.
set -e
mkdir -p src
cat > index.html <<'ORB_DASH_EOF'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Orb Dash</title>
  <style>
    html, body { margin: 0; height: 100%; background: #14102a; color: #f6f1ff; font-family: system-ui, sans-serif; }
    #game { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="game"></canvas>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
ORB_DASH_EOF
cat > src/game.js <<'ORB_DASH_EOF'
// Orb Dash: steer the ship with the arrow keys or WASD, collect orbs, avoid the red comets.
// A deliberately small example game for trying the harmony-skills on.

export const SHIP_SPEED = 320;      // pixels per second
export const ORB_COUNT = 5;
export const COMET_EVERY = 1.5;     // seconds between comets

export function createGame(width, height) {
  return {
    width,
    height,
    state: "title",                 // "title" | "playing" | "over"
    ship: { x: width / 2, y: height / 2, r: 14 },
    orbs: [],
    comets: [],
    score: 0,
    best: Number(localStorage.getItem("orb-dash.best") ?? 0),
    cometTimer: 0,
  };
}

export function start(game) {
  game.state = "playing";
  game.score = 0;
  game.ship.x = game.width / 2;
  game.ship.y = game.height / 2;
  game.orbs = [];
  game.comets = [];
  game.cometTimer = 0;
  for (let i = 0; i < ORB_COUNT; i++) {
    game.orbs.push(randomOrb(game));
  }
}

function randomOrb(game) {
  return { x: 40 + Math.random() * (game.width - 80), y: 40 + Math.random() * (game.height - 80), r: 8 };
}

function spawnComet(game) {
  const fromLeft = Math.random() < 0.5;
  return {
    x: fromLeft ? -20 : game.width + 20,
    y: Math.random() * game.height,
    vx: (fromLeft ? 1 : -1) * (180 + Math.random() * 160),
    r: 12,
  };
}

export function update(game, input, dt) {
  if (game.state !== "playing") {
    return;
  }
  const ship = game.ship;
  ship.x = Math.max(ship.r, Math.min(game.width - ship.r, ship.x + input.x * SHIP_SPEED * dt));
  ship.y = Math.max(ship.r, Math.min(game.height - ship.r, ship.y + input.y * SHIP_SPEED * dt));

  for (let i = 0; i < game.orbs.length; i++) {
    const orb = game.orbs[i];
    if (Math.hypot(orb.x - ship.x, orb.y - ship.y) < orb.r + ship.r) {
      game.score += 10;
      game.orbs[i] = randomOrb(game);
    }
  }

  game.cometTimer += dt;
  if (game.cometTimer >= COMET_EVERY) {
    game.cometTimer = 0;
    game.comets.push(spawnComet(game));
  }
  for (const comet of game.comets) {
    comet.x += comet.vx * dt;
    if (Math.hypot(comet.x - ship.x, comet.y - ship.y) < comet.r + ship.r) {
      game.state = "over";
      if (game.score > game.best) {
        game.best = game.score;
        localStorage.setItem("orb-dash.best", String(game.best));
      }
    }
  }
  game.comets = game.comets.filter((c) => c.x > -40 && c.x < game.width + 40);
}
ORB_DASH_EOF
cat > src/main.js <<'ORB_DASH_EOF'
import { createGame, start, update } from "./game.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const game = createGame(innerWidth, innerHeight);

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  game.width = canvas.width;
  game.height = canvas.height;
}
addEventListener("resize", resize);
resize();
const keys = new Set();

addEventListener("keydown", (e) => {
  keys.add(e.code);
  if ((e.code === "Enter" || e.code === "Space") && game.state !== "playing") {
    start(game);
  }
});
addEventListener("keyup", (e) => keys.delete(e.code));

function input() {
  return {
    x: (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0),
    y: (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("KeyW") ? 1 : 0),
  };
}

function draw() {
  ctx.fillStyle = "#14102a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffcc33";
  for (const orb of game.orbs) {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ff4a4a";
  for (const comet of game.comets) {
    ctx.beginPath();
    ctx.arc(comet.x, comet.y, comet.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#4fc3ff";
  ctx.beginPath();
  ctx.arc(game.ship.x, game.ship.y, game.ship.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6f1ff";
  ctx.font = "20px system-ui";
  ctx.fillText("Score " + game.score + "   Best " + game.best, 16, 32);
  if (game.state !== "playing") {
    ctx.textAlign = "center";
    ctx.font = "40px system-ui";
    ctx.fillText(game.state === "title" ? "Orb Dash" : "Game over", canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = "20px system-ui";
    ctx.fillText("Press Enter to play", canvas.width / 2, canvas.height / 2 + 20);
    ctx.textAlign = "left";
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  update(game, input(), dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
ORB_DASH_EOF
