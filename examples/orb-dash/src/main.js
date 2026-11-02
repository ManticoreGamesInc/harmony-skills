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
