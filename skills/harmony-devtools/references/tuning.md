# The tuning panel

A panel inside the running game for changing its numbers live, with buttons for shortcuts, and a
save that writes the values back to the game's config file. The examples use Vite and lil-gui
(MIT); Tweakpane (MIT) or the game's own UI work the same way.

## Contents
- The dev switch
- Where the numbers live
- The panel
- Cheats and shortcuts
- Saving back to the file
- Presets and reset

## The dev switch

One place decides whether dev tools exist:

```ts
// src/dev/index.ts
export async function startDevTools(game: Game): Promise<void> {
  if (!import.meta.env.DEV) {
    return;
  }
  const { createTuningPanel } = await import("./tuning-panel");
  const { createMetricsOverlay } = await import("./metrics");
  createTuningPanel(game);
  createMetricsOverlay(game);
}
```

- `import.meta.env.DEV` is replaced with `false` in a production build, and the dynamic imports
  behind it are dropped, so no dev code or panel library ships.
- With another bundler, use its equivalent (`process.env.NODE_ENV !== "production"` with
  webpack's define, for example).
- Check a production build once: search its files for the panel's title text; it must not be
  there.

## Where the numbers live

Every number worth tuning lives in one config file the game imports, not scattered in code:

```json
{
  "player": { "speed": 8.5, "jumpHeight": 2.2, "coyoteTime": 0.1 },
  "enemies": { "spawnEvery": 2.5, "maxAlive": 12 },
  "camera": { "followLag": 0.12, "shake": 0.6 }
}
```

```ts
import tuning from "./tuning.json";
// The game reads tuning.player.speed every frame, so a change applies at once.
```

- Read values when they're used, not copied into locals at load, so changes apply live.
- Group them by system; name them in the game's own terms.

## The panel

```ts
// src/dev/tuning-panel.ts
import GUI from "lil-gui";
import tuning from "../tuning.json";

export function createTuningPanel(game: Game): void {
  const gui = new GUI({ title: "Dev (F1)" });
  gui.close();

  const player = gui.addFolder("Player");
  player.add(tuning.player, "speed", 1, 20, 0.1);
  player.add(tuning.player, "jumpHeight", 0.5, 6, 0.05);
  player.add(tuning.player, "coyoteTime", 0, 0.3, 0.01);

  const enemies = gui.addFolder("Enemies");
  enemies.add(tuning.enemies, "spawnEvery", 0.2, 10, 0.1);
  enemies.add(tuning.enemies, "maxAlive", 0, 50, 1);

  gui.add({ save: () => saveTuning() }, "save").name("Save to tuning.json");

  let visible = true;
  window.addEventListener("keydown", (event) => {
    if (event.code === "F1") {
      event.preventDefault();
      visible = !visible;
      gui.show(visible);
    }
  });
}
```

- Give every slider a range and step that fit its value, such as a few times the current value
  at most. A range that's too wide makes small changes impossible.
- Remember which folders were open (lil-gui's `save()` and `load()`, kept in `localStorage`).
- While a text field in the panel has focus, the game shouldn't react to keys.

## Cheats and shortcuts

Buttons that save minutes of playing to reach a situation. Register them in one place and keep
them out of the shipped build as `cheats.md` describes; the panel shows a button for each:

- Win or lose the round, skip to the next level, restart the level.
- Give coins, items or XP; unlock everything; reset the save (with a confirmation).
- God mode, infinite ammo, no cooldowns.
- Spawn an enemy, a boss or a pickup at the cursor.
- Fill or empty a meter (health, combo, timer).

They call the game's own functions, so they test the real code paths, and they exist only behind
the dev switch.

## Saving back to the file

While the game runs on the local dev server, the panel can write the values back to
`tuning.json`, so tuned numbers become the game's defaults. A small Vite plugin does it, only on
the dev server:

```ts
// vite.config.ts
import { defineConfig, type Plugin } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Same keys and value types as the current file, nothing added or removed.
function sameShape(next: unknown, current: unknown): boolean {
  if (typeof current !== "object" || current === null) {
    return typeof next === typeof current && (typeof next !== "number" || Number.isFinite(next));
  }
  if (typeof next !== "object" || next === null || Array.isArray(next) !== Array.isArray(current)) {
    return false;
  }
  const a = Object.keys(next as object).sort();
  const b = Object.keys(current as object).sort();
  return a.length === b.length && a.every((key, i) => key === b[i] && sameShape((next as any)[key], (current as any)[key]));
}

function tuningWriter(): Plugin {
  return {
    name: "tuning-writer",
    apply: "serve",                               // the dev server only, never the build
    configureServer(server) {
      const file = join(server.config.root, "src", "tuning.json");
      server.middlewares.use("/__dev/tuning", (request, response) => {
        // Only the game's own page may save: any other site open in the browser could otherwise
        // send a request to localhost and overwrite the file.
        const host = request.headers.host ?? "";
        const fromOwnPage = request.headers.origin === "http://" + host || request.headers.origin === "https://" + host;
        if (request.method !== "POST" || !fromOwnPage || request.headers["content-type"] !== "application/json") {
          response.statusCode = 403;
          response.end();
          return;
        }
        let body = "";
        request.on("data", (chunk) => {
          body += chunk;
          if (body.length > 1_000_000) {
            request.destroy();
          }
        });
        request.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (!sameShape(data, JSON.parse(readFileSync(file, "utf8")))) {
              throw new Error("shape changed");
            }
            writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
            response.end("saved");
          } catch {
            response.statusCode = 400;
            response.end("not a valid tuning file");
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [tuningWriter()],
  server: { watch: { ignored: ["**/src/tuning.json"] } },   // don't reload the game on save
});
```

```ts
async function saveTuning(): Promise<void> {
  const response = await fetch("/__dev/tuning", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tuning),
  });
  showDevToast(response.ok ? "Saved tuning.json" : "Save failed");   // your own
}
```

- The writer only accepts JSON from the game's own page (its `Origin` matches the dev server), in
  the same shape as the current file, and writes only that one file. A web page on another site
  can't send a JSON request to it without the browser asking the server first, which it refuses.
- The dev server listens on `localhost` by default. Don't expose it on the network (`--host`)
  while the writer is on.
- The file only changes in the project; commit it like any other source change.
- Without a dev server (a static build on a phone), offer "Copy JSON" instead, and paste it into
  the file.

## Presets and reset

- **Reset** each folder to the values in the file, so experiments are easy to undo.
- **Presets** for comparing feels ("floaty", "snappy"): save named copies of the config and switch
  between them while playing.
- Show which values differ from the file, so it's clear what saving would change.
