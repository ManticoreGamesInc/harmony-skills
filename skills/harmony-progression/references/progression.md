# Progression

XP, levels, currency, cosmetics, upgrades and round rewards, kept in the player's save
(`saves.md`). The examples are TypeScript with placeholder content; write them in the game's
own language and style, and replace every placeholder with the game's own slots, items and
numbers.

## Contents
- Light or full
- The catalog
- The player's progress
- Unlocks and purchases
- Upgrades
- Round rewards
- Balancing
- Tests to write

## Light or full

| Level | What the player gets |
| --- | --- |
| light | Career stats, and cosmetics unlocked by stat milestones ("Win 10 rounds"). No XP or currency anywhere. |
| full | Everything in light, plus XP, levels, currency, cosmetics bought or unlocked by level, and small capped upgrades. |

Light suits short or arcade games; full suits games players return to for weeks.

## The catalog

One file holds everything a player can earn. Ids are saved, and sent to other players online,
so never rename or reuse one: retire it and add a new id.

```ts
type Slot = "body" | "trail" | "burst";            // the game's own slots
const SLOTS: Slot[] = ["body", "trail", "burst"];

interface Unlock {
  level?: number;                                   // free at this level (full)
  cost?: number;                                    // bought with currency (full)
  stat?: { key: string; at: number };               // free when a career stat reaches a value
}

interface Cosmetic {
  id: string;
  slot: Slot;
  name: string;
  blurb: string;
  unlock: Unlock;                                   // {} for a starter item
  colors: [string, string];                         // or whatever the game draws from
  style: number;
}

const COSMETICS: Cosmetic[] = [
  { id: "bd_basic", slot: "body", name: "Standard", blurb: "Clean and bright.", unlock: {}, colors: ["#38e8ff", "#e8fbff"], style: 0 },
  { id: "bd_ember", slot: "body", name: "Ember", blurb: "Warm glow, hot core.", unlock: { stat: { key: "rounds", at: 5 } }, colors: ["#ff8a3d", "#ffe2c4"], style: 1 },
  { id: "bd_prism", slot: "body", name: "Prism", blurb: "Every color, all the time.", unlock: { level: 10 }, colors: ["#ffffff", "#ffffff"], style: 2 },
  { id: "bd_gold", slot: "body", name: "Gold", blurb: "For people who win a lot.", unlock: { cost: 600 }, colors: ["#ffc23d", "#fff2c4"], style: 3 },
  // ...at least one starter per slot
];

const DEFAULT_EQUIPPED: Record<Slot, string> = { body: "bd_basic", trail: "tr_soft", burst: "bu_ring" };

// A cosmetic by id, or the slot's default when the id is unknown or belongs to another slot.
function cosmetic(id: string, slot: Slot): Cosmetic {
  return COSMETICS.find((item) => item.id === id && item.slot === slot)
    ?? COSMETICS.find((item) => item.id === DEFAULT_EQUIPPED[slot])!;
}
```

- Every slot has at least one starter (an item with an empty `unlock`), and the defaults are
  starters.
- Cosmetics change looks only. The game reads `equipped[slot]` through `cosmetic()` and draws it.

## The player's progress

```ts
interface Progress {
  xp: number;                        // toward the next level
  level: number;
  currency: number;
  owned: string[];                   // cosmetic ids
  equipped: Record<Slot, string>;
  upgrades: Record<string, number>;  // upgrade id -> tier
}

const MAX_LEVEL = 40;

function xpForLevel(level: number): number {
  return 90 + (level - 1) * 35;     // XP from this level to the next
}
```

`parseSave` (`saves.md`) builds this field by field: `level` clamped to 1..`MAX_LEVEL`, `xp`
and `currency` clamped and floored, `owned` kept only for known ids (starters always added),
`equipped` kept only when owned and in the right slot, upgrade tiers clamped to 0..`MAX_TIER`
for known upgrade ids.

## Unlocks and purchases

```ts
type UnlockState = "owned" | "free" | "buy" | "locked";

function unlockState(p: Progress, item: Cosmetic, stats: Record<string, number>, full: boolean): UnlockState {
  if (p.owned.includes(item.id)) {
    return "owned";
  }
  const u = item.unlock;
  if (u.stat && (stats[u.stat.key] ?? 0) < u.stat.at) {
    return "locked";
  }
  if (u.level && (!full || p.level < u.level)) {
    return "locked";
  }
  if (u.cost) {
    return full ? "buy" : "locked";
  }
  return "free";
}
```

- Free unlocks (level and stat milestones) are claimed automatically when a round pays out, and
  listed on the results screen.
- A purchase checks the state again and the currency, takes the cost and adds the id, then
  saves. Never trust the button's last-drawn state.
- Equip only what is owned.

## Upgrades

Full progression only. Each upgrade nudges one tunable by a few percent per tier, gated by
level and paid with currency.

```ts
interface Upgrade {
  id: string;
  name: string;
  blurb: string;
  perTier: number;                   // 0.02 = +2% per tier
  levels: number[];                  // level needed for each tier
  costs: number[];                   // cost of each tier
}

const MAX_TIER = 3;
const MAX_UPGRADE_EFFECT = 0.06;     // hard cap, so skill always beats upgrades

const UPGRADES: Upgrade[] = [
  { id: "speed", name: "Quick feet", blurb: "Move a little faster.", perTier: 0.02, levels: [3, 8, 15], costs: [200, 450, 900] },
];

function upgradeMult(id: string, tier: number): number {
  const up = UPGRADES.find((u) => u.id === id);
  if (!up) {
    return 1;
  }
  const t = Math.max(0, Math.min(MAX_TIER, Math.floor(tier)));
  return 1 + Math.min(up.perTier * t, MAX_UPGRADE_EFFECT);
}
```

Multiply the matching tunable by `upgradeMult` where the game uses it
(`speed * upgradeMult("speed", tiers.speed)`). Online, the host decides whether upgrades are on
for a match, and each side uses the tiers the other player sent, clamped the same way.

## Round rewards

A round reports what happened; the reward is built from line items so the results screen can
show each one.

```ts
interface RoundResult {
  mode: string;                      // key into MODE_MULT
  won: boolean;
  abandoned: boolean;                // quit before the end
  counts: Record<string, number>;    // keys of REWARD_RULES, e.g. { orbs: 14, bestCombo: 6 }
}

const XP_PLAYED = 40;
const XP_WON = 60;
const CURRENCY_PER_XP = 0.45;
const REWARD_RULES: Record<string, { label: string; xp: number; cap?: number }> = {
  orbs: { label: "Orbs", xp: 3, cap: 120 },
  bestCombo: { label: "Best combo", xp: 4, cap: 20 },
};
const MODE_MULT: Record<string, number> = { solo: 1, easy: 0.75, hard: 1.35, online: 1.2 };

function computeReward(r: RoundResult) {
  const lines = [{ label: "Round played", xp: XP_PLAYED }];
  for (const [key, rule] of Object.entries(REWARD_RULES)) {
    const n = Math.max(0, Math.floor(r.counts[key] ?? 0));
    if (n > 0) {
      lines.push({ label: rule.label + " x" + n, xp: Math.min(n, rule.cap ?? n) * rule.xp });
    }
  }
  if (r.won && !r.abandoned) {
    lines.push({ label: "Victory", xp: XP_WON });
  }
  const raw = lines.reduce((sum, line) => sum + line.xp, 0);
  const xp = Math.round(raw * (MODE_MULT[r.mode] ?? 1) * (r.abandoned ? 0.25 : 1));
  return { xp, currency: Math.round(xp * CURRENCY_PER_XP), lines };
}
```

Granting a reward (full): add currency and XP, then level up while `xp >= xpForLevel(level)`,
carrying the leftover XP, with a currency bonus per level gained (`40 + level * 5`). At
`MAX_LEVEL`, cap the XP. Then claim every free unlock, note which upgrades just became
available, save, and return what the results screen shows: lines, totals, levels gained, new
level, level bonus, unlocked items and newly available upgrades. Light progression skips the XP
and currency and only claims stat milestones.

- Record career stats first, then grant the reward, so a stat milestone reached this round
  unlocks now.
- A quit pays a quarter and never counts as a win or a loss.
- Cap each counted event (`cap`), so one farmed number can't dominate.

## Balancing

- A typical early round is about a third of a level.
- The first purchasable cosmetic is in reach after 3 to 5 rounds.
- Something unlocks every few rounds early on, then every session or two.
- Keep the numbers in the catalog, not in a debug panel players can reach, and check them with
  the tests below.

## Tests to write

Unit tests pay for themselves here, since a broken save or payout is hard to see in play:

- Every cosmetic and upgrade id is unique; every slot has a starter; defaults are starters.
- No upgrade's top tier exceeds `MAX_UPGRADE_EFFECT`; tier levels and costs only go up.
- A default save starts with the starters owned and equipped.
- Junk parses safely: `null`, a string, wrong types, unknown ids, huge and negative numbers,
  equipped items not owned or in the wrong slot.
- Every old save version migrates and parses (keep one sample save per version as a fixture).
- A save newer than the build is never written over.
- Rewards: line items, mode multiplier, caps, a quit pays a quarter and no victory.
- Levels: leftover XP carries over, `MAX_LEVEL` caps, level bonus paid once per level.
- Stat milestones unlock from career stats; purchases need the level and the currency.
- Adopt once (with the SDK): an account with no save takes the device progress and clears it; an account with
  a save keeps its own; a second account doesn't adopt.
