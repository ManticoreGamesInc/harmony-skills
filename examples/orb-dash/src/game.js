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
