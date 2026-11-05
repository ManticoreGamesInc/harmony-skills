# Saves

One save for the device, or one per player with the Harmony SDK, read safely, versioned, and
portable through Export and Import. The examples are TypeScript; write them in the game's own
language and style.

Most games have no Harmony SDK and no Game ID. For them, every save belongs to the `"device"`
owner, and the parts marked "with the SDK" don't apply. In a game with the SDK, the examples
call the Harmony handle `harmony`: the value `attach` resolves to, or `null` without
Harmony. Names such as `startGame`, `showToast` or `confirmDialog` stand for the game's own code.

## Contents
- What a save holds
- Whose save: owners and keys
- Loading when the game starts
- Following sign-in changes (with the SDK)
- Adopting device progress once (with the SDK)
- Reading a save safely
- Versions and migrations
- Writing, and when storage fails
- Export and Import

## What a save holds

One object per player with everything that is theirs: progression, unlocked and equipped
cosmetics, career stats, and per-player settings if the game has them. Device settings (volume,
graphics) can stay in a separate, device-wide key.

```ts
interface Save {
  stats: Record<string, number>;      // career stats: rounds, wins, best score...
  progress: Progress;                 // XP, level, currency, owned, equipped, upgrades (progression.md)
}
```

On disk, wrap it with the save version, so a later build knows how to read it:

```ts
interface SaveFile {
  game: string;      // your game's id, so Import can refuse another game's file
  version: number;   // SAVE_VERSION when it was written
  data: unknown;     // the Save, checked on every read
}
```

## Whose save: owners and keys

Without the SDK the owner is always `"device"`, and `ownerOf` isn't needed.

```ts
const SAVE_PREFIX = "star-hopper";   // your game's own name for its saves (not Harmony's Game ID)
const SAVE_VERSION = 1;

// With the SDK: "player:<accountId>" for a Harmony guest or account, "device" otherwise.
function ownerOf(session: PlayerSession | null): string {
  if (session && (session.kind === "account" || session.kind === "guest")) {
    return "player:" + session.accountId;
  }
  return "device";
}

function saveKey(owner: string): string {
  return SAVE_PREFIX + ".save." + owner;
}
```

- With the SDK, key on `accountId`, never on `displayName`: names aren't unique and players can
  change them.
- A guest who creates an account keeps the same `accountId`, so the save carries over by itself.
- Treat any session kind other than `"account"` and `"guest"` as signed out.
- Prefix keys with the game's id. On Harmony the storage belongs to the game alone, but on a
  developer's own machine several games share `localhost`.

## Loading when the game starts

Without the SDK, load the device save before the game starts. Nothing waits on Harmony:

```ts
// owner, save, heldResults and useOwner are as in the next block; heldResults stays empty.
// No SDK: the device save, loaded at once.
useOwner("device");
startGame();
```

With the SDK, start the game without waiting for Harmony (sdk.md explains attaching), but don't
show a player's progress until you know whose it is. Until then the menus show no rank, and any
round that ends is held and paid out once the save is known.

```ts
let owner: string | null = null;     // null until Harmony answers or fails
let save: Save | null = null;
const heldResults: RoundResult[] = [];

function useOwner(next: string): void {
  if (next === owner) {
    return;
  }
  owner = next;
  save = loadFor(next);
  for (const result of heldResults.splice(0)) {
    grantReward(save, result);       // progression.md
  }
  writeSave(next, save);
  showProgress(save);
}

attach()
  .then(async (handle) => {
    harmony = handle;
    useOwner(ownerOf(await handle.auth.getSession()));
    handle.auth.onSessionChanged((session) => useOwner(ownerOf(session)));
  })
  .catch(() => useOwner("device"));

startGame();
```

A game with no build step loads Harmony with a script tag, and `PlayHarmony.attach` there
returns a promise of the handle. Use `PlayHarmony.attach().then(...)` (sdk.md shows how), run the same steps on the resolved handle, and use `"device"` if it fails.

When the round ends and `save` is still `null`, push the result onto `heldResults` and show the
results screen without the totals. Without the SDK, `save` is set before the first round, so
nothing is ever held.

## Following sign-in changes (with the SDK)

`onSessionChanged` fires when the player signs in, signs out, or a guest creates an account.
`useOwner` above handles all three: same owner (guest to account), nothing changes; new owner,
load the new save (the old one is already written after each change) and redraw everything that
shows progress (menu badge, locker, equipped cosmetics in the world).

Switch at a safe moment. If a round is running, note its owner when it starts
(`roundOwner = owner`), finish it, pay it into that owner's save, then switch. Only rounds that
end before any save is known go into `heldResults`.

## Adopting device progress once (with the SDK)

Without the SDK there is only the device save, and `loadFor("device")` below just reads it.

Progress made signed out is saved under `"device"`. The first time a player signs in on that
device with no save of their own, their account takes the device progress, and the device save
starts fresh, so a second account on the same device can't take it again.

```ts
let saveLocked = false;              // true while the stored save is newer than this build

function loadFor(next: string): Save {
  const own = readSave(next);
  saveLocked = own === "newer";
  if (own === "newer") {
    showReloadNotice();              // see Versions and migrations
    return defaultSave();            // play on, but never write over the newer save
  }
  if (own || next === "device") {
    return own ?? defaultSave();
  }
  const device = readSave("device");
  if (device && device !== "newer" && hasProgress(device)) {
    if (writeSave(next, device)) {
      removeSave("device");          // only after the account's copy is written
    }
    return device;
  }
  return defaultSave();
}
```

- Never merge two saves. An account that already has a save keeps it; the device save stays for
  signed-out play.
- `hasProgress` means anything worth keeping (a round played, a cosmetic owned), so an untouched
  default save isn't adopted.
- Tell the player once: "Your progress on this device is now saved to your account."

## Reading a save safely

Every read goes through one function that never throws and never returns bad data:

```ts
class NewerSaveError extends Error {}

// A save, null for none, or "newer" when a later build wrote it.
function readSave(forOwner: string): Save | null | "newer" {
  let text: string | null = null;
  try {
    text = localStorage.getItem(saveKey(forOwner));
  } catch {
    return null;                     // storage blocked
  }
  if (!text) {
    return null;
  }
  let parsed: Save | null = null;
  try {
    parsed = parseSaveFile(JSON.parse(text));
  } catch (error) {
    if (error instanceof NewerSaveError) {
      return "newer";
    }
  }
  if (!parsed) {
    keepBroken(forOwner, text);      // set it aside before a fresh save replaces it
  }
  return parsed;
}

function parseSaveFile(raw: unknown): Save | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const file = raw as Partial<SaveFile>;
  // A whole number from 0 up, so it can only pick a real step in MIGRATIONS.
  if (file.game !== SAVE_PREFIX || typeof file.version !== "number" || !Number.isInteger(file.version) || file.version < 0) {
    return null;
  }
  if (file.version > SAVE_VERSION) {
    throw new NewerSaveError();      // see Versions and migrations
  }
  return parseSave(migrate(file.version, file.data));
}
```

`parseSave` builds a default save and copies in each field only when it is valid:

- numbers: finite, clamped to the range the game allows, floored where they count things;
- ids (owned cosmetics, equipped items, upgrade tiers): kept only when the game knows them;
- strings: trimmed to a length cap, and shown only as text;
- keys: the game's own lists (stat names, slots, upgrade ids) decide which keys are read, never
  the keys in the file, and nothing from the file is merged in with `Object.assign`, spread or a
  deep merge, so a `__proto__` or `constructor` key does nothing;
- anything missing or wrong: the default.

```ts
const STAT_KEYS = ["rounds", "wins", "bestScore"];      // the game's own career stats

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function count(value: unknown, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : fallback;
}

function parseSave(raw: unknown): Save | null {
  if (!isRecord(raw)) {
    return null;
  }
  const save = defaultSave();                           // starters owned and equipped
  const stats: Record<string, unknown> = isRecord(raw.stats) ? raw.stats : {};
  for (const key of STAT_KEYS) {                        // the game's keys, never the file's
    save.stats[key] = count(stats[key], 1e9, 0);
  }
  const p: Record<string, unknown> = isRecord(raw.progress) ? raw.progress : {};
  const out = save.progress;
  out.level = Math.max(1, count(p.level, MAX_LEVEL, 1));
  out.xp = count(p.xp, xpForLevel(out.level), 0);
  out.currency = count(p.currency, 1e9, 0);
  const owned: unknown[] = Array.isArray(p.owned) ? p.owned.slice(0, 1000) : [];
  for (const id of owned) {
    if (typeof id === "string" && COSMETICS.some((item) => item.id === id) && !out.owned.includes(id)) {
      out.owned.push(id);
    }
  }
  const equipped: Record<string, unknown> = isRecord(p.equipped) ? p.equipped : {};
  for (const slot of SLOTS) {
    const id = equipped[slot];
    if (typeof id === "string" && out.owned.includes(id) && cosmetic(id, slot).id === id) {
      out.equipped[slot] = id;
    }
  }
  const tiers: Record<string, unknown> = isRecord(p.upgrades) ? p.upgrades : {};
  for (const upgrade of UPGRADES) {
    out.upgrades[upgrade.id] = count(tiers[upgrade.id], MAX_TIER, 0);
  }
  return save;
}
```

A broken field costs that field, never the whole save. A save that won't parse at all is copied
to a `.broken` key by `keepBroken` before anything writes over it, so a bug fix can still
recover it.

## Versions and migrations

Bump `SAVE_VERSION` whenever the shape changes, and add one migration per step:

```ts
// MIGRATIONS[n] turns version n data into version n + 1.
const MIGRATIONS: Array<(data: any) => any> = [
  (data) => data,                                            // 0 -> 1: placeholder
  // 1 -> 2, renaming coins to currency: name each field, never spread the old object.
  // (data) => {
  //   const p = data?.progress;
  //   return { stats: data?.stats, progress: { xp: p?.xp, level: p?.level, currency: p?.coins,
  //     owned: p?.owned, equipped: p?.equipped, upgrades: p?.upgrades } };
  // },
];

function migrate(from: number, data: unknown): unknown {
  let out = data;
  for (let v = from; v < SAVE_VERSION; v++) {
    out = MIGRATIONS[v](out);
  }
  return out;
}
```

- Migrations only reshape; `parseSave` still checks the result.
- The steps live in an array indexed by the version number, which `parseSaveFile` has checked is
  a whole number from 0 up to `SAVE_VERSION`. Never pick a step, a reviver or a handler by a
  string from the file on a plain object (`handlers[file.type]`), where `__proto__` or
  `constructor` would select something; use a `Map` or a fixed list.
- **A newer save than the build:** a player with an old tab open, after an update in another
  tab, would write an old-format save over the new one. When `version > SAVE_VERSION`,
  `loadFor` sets `saveLocked`, `writeSave` refuses to write, and `showReloadNotice` says "This
  game was updated. Reload the page to keep your progress."

## Writing, and when storage fails

```ts
function writeSave(forOwner: string, data: Save): boolean {
  if (saveLocked) {
    return false;
  }
  const file: SaveFile = { game: SAVE_PREFIX, version: SAVE_VERSION, data };
  try {
    localStorage.setItem(saveKey(forOwner), JSON.stringify(file));
    return true;
  } catch {
    return false;                    // blocked or full: keep playing, warn once
  }
}
```

- Save after each round, purchase, equip and unlock, not every frame.
- Storage can be blocked or full. The game keeps running on the save in memory and says once,
  without blocking play: "Progress can't be saved in this browser right now."
- `localStorage` is fine up to a few hundred kilobytes. For bigger saves (levels players build,
  replays), use `IndexedDB` with the same keys, versions and checks.
- Two tabs of the same game share storage. Listen for the `storage` event on the save's key and
  reload the save when another tab writes it, or the last tab to save wins.

## Export and Import

Saves stay in one browser on one device. Export and Import let players back up their progress
or move it. Call both from a click or key handler.

### Without the SDK

Export as a download, and import from a file the player picks with `<input type="file">`. Both
work in a game hosted on Harmony. Native `showSaveFilePicker`/`showOpenFilePicker` can provide
basic Open/edit/Save without SDK attachment only when compatibility is installed before game
scripts and the host negotiates support; the 1.1.22 artifact release does not establish that
every hosted build has been migrated. Keep the download/file-input path where that support is
unavailable (see the `harmony-publish` skill and published SDK guidance). Native facade handles
are temporary, not IndexedDB save data or worker-transferable objects, and do not support
directories or native branding. The evidenced native profile is Windows Chromium 153.0.8010.12,
not broader browsers or native Escape-key dismissal. Native Save selection can clear an existing
file before returning its handle; abort does not restore those bytes. Its admission and handles
are separate from the SDK's `harmony.files` service and file IDs. A game can also leave Export
and Import out, and say on its settings or stats screen that saves stay in this browser on this device.

```ts
exportButton.addEventListener("click", () => {
  exportAsDownload();
});

function exportAsDownload(): void {
  if (!owner || !save) {
    return;
  }
  const file: SaveFile = { game: SAVE_PREFIX, version: SAVE_VERSION, data: save };
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = SAVE_PREFIX + "-save.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Your save is in your downloads.");
}

const importInput = document.createElement("input");
importInput.type = "file";
importInput.accept = ".json,application/json";
importInput.addEventListener("change", async () => {
  const picked = importInput.files?.[0];
  importInput.value = "";            // so picking the same file again still fires "change"
  if (!picked || !owner) {
    return;
  }
  if (picked.size > 512 * 1024) {
    showToast("That file is too big to be a save.");
    return;
  }
  let text = "";
  try {
    text = await picked.text();
  } catch {
    showToast("The file couldn't be opened.");
    return;
  }
  await importSaveText(text);
});

importButton.addEventListener("click", () => {
  importInput.click();
});

// Shared by both ways of importing.
async function importSaveText(text: string): Promise<void> {
  if (!owner) {
    return;
  }
  let imported: Save | null = null;
  try {
    imported = parseSaveFile(JSON.parse(text));
  } catch (error) {
    if (error instanceof NewerSaveError) {
      showToast("This save is from a newer version of the game. Reload the page first.");
      return;
    }
  }
  if (!imported) {
    showToast("That file isn't a save for this game.");
    return;
  }
  if (await confirmDialog("Replace your progress with this save?")) {
    save = imported;
    writeSave(owner, save);
    showProgress(save);
  }
}
```

### With the SDK

A game that already has the SDK can use `harmony.files.save` and `harmony.files.open`, which
show real Save and Open dialogs for the game. When `harmony` is `null` (local development, the
game on its own site, or Harmony failing to start), fall back to the download and the file
input above. These handlers replace the two button handlers above; keep `exportAsDownload`,
`importInput` and `importSaveText`.

```ts
exportButton.addEventListener("click", async () => {
  if (!harmony) {
    exportAsDownload();
    return;
  }
  if (!owner || !save) {
    return;
  }
  const file: SaveFile = { game: SAVE_PREFIX, version: SAVE_VERSION, data: save };
  try {
    const result = await harmony.files.save({
      data: new Blob([JSON.stringify(file)], { type: "application/json" }),
      suggestedName: SAVE_PREFIX + "-save.json",
      types: [{ description: "Save", accept: { "application/json": [".json"] } }],
    });
    if (result.outcome === "downloaded") {
      showToast("Your save is in your downloads.");
    }
  } catch (error) {
    // A rejection carries a code (sdk.md lists them); the game keeps running either way.
    showToast((error as { code?: string }).code === "no_user_activation" ? "Click Export again." : "The save couldn't be exported.");
  }
});

importButton.addEventListener("click", async () => {
  if (!harmony) {
    importInput.click();
    return;
  }
  if (!owner) {
    return;
  }
  let result;
  try {
    result = await harmony.files.open({
      types: [{ description: "Save", accept: { "application/json": [".json"] } }],
    });
  } catch (error) {
    showToast((error as { code?: string }).code === "file_too_large" ? "That file is too big to be a save." : "The file couldn't be opened.");
    return;
  }
  if (result.outcome !== "opened") {
    return;
  }
  if (result.data.byteLength > 512 * 1024) {
    showToast("That file is too big to be a save.");
    return;
  }
  await importSaveText(new TextDecoder().decode(result.data));
});
```

- An imported file is as untrusted as any save: size cap, then the same `parseSaveFile`.
- Always confirm before replacing progress, and show the file's name as text if you show it
  (`textContent`, control characters stripped, length capped).
- With the SDK, handle `"cancelled"` by doing nothing, and `"downloaded"` (Firefox and Safari
  have no save dialog) with a short note.
