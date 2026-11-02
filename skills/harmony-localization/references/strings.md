# Strings

Language files, the lookup function, plurals and formatting, and choosing the language. The
examples are TypeScript; write them in the game's own language, style and file layout.

## Contents
- Language files
- Keys and context notes
- The lookup function
- Plurals
- Numbers, times, dates and lists
- Sorting
- Choosing the language
- Finding hard-coded text

## Language files

One JSON file per language, fetched by a relative address (`./locales/en.json`), so they load
from wherever the build is served. The source language file holds the text and a note for each
string; the other files hold only the text.

```json
{
  "_meta": { "language": "en", "status": "source" },
  "menu.play": { "text": "Play", "note": "Main menu button. About 10 characters of room." },
  "menu.settings": { "text": "Settings", "note": "Main menu button." },
  "hud.livesLeft": {
    "text": { "one": "{count} life left", "other": "{count} lives left" },
    "note": "Top left of the HUD during play. {count} is a whole number from 0 to 9."
  },
  "results.bestScore": { "text": "Best: {score}", "note": "Results screen. {score} is the player's best score, formatted as a number." }
}
```

```json
{
  "_meta": { "language": "de", "status": "draft" },
  "menu.play": "Spielen",
  "menu.settings": "Einstellungen",
  "hud.livesLeft": { "one": "Noch {count} Leben", "other": "Noch {count} Leben" },
  "results.bestScore": "Bestwert: {score}"
}
```

- `status` is `source`, `draft` (not yet reviewed by a native speaker) or `reviewed`.
- Plural strings hold one entry per plural category the language uses (see Plurals).
- Load the source language as well as the chosen one, as the fallback.

## Keys and context notes

- Keys say where and what: `menu.play`, `hud.livesLeft`, `error.connectionLost`. Never the
  English text as the key; it changes, and the same words can need different translations in
  different places ("Play" the verb on a button, "Play" a noun in a stats screen).
- One key per use, even when two English strings match today.
- The note says where the string shows, how much room it has, the tone, and what each
  placeholder holds. Add a screenshot path when the game has one.
- Never reuse a key for a different meaning; add a new one and delete the old.

## The lookup function

```ts
type PluralText = Partial<Record<Intl.LDMLPluralRule, string>>;
type Entry = string | PluralText | { text: string | PluralText; note?: string };

let language = "en";
let strings: Record<string, Entry> = {};
let fallback: Record<string, Entry> = {};
let numbers = new Intl.NumberFormat(language);
let plurals = new Intl.PluralRules(language);

function textOf(entry: Entry): string | PluralText {
  return typeof entry === "object" && "text" in entry ? entry.text : entry;
}

/** The string for key, with {name} placeholders filled. Numbers are formatted for the language. */
export function t(key: string, values: Record<string, string | number> = {}): string {
  const entry = strings[key] ?? fallback[key];
  if (entry === undefined) {
    console.warn("Missing string: " + key);
    return "";
  }
  let text = textOf(entry);
  if (typeof text !== "string") {
    const count = Number(values.count ?? 0);
    text = text[plurals.select(count)] ?? text.other ?? "";
  }
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    const value = values[name];
    if (value === undefined) {
      return match;
    }
    return typeof value === "number" ? numbers.format(value) : value;
  });
}

export async function setLanguage(next: string, source = "en"): Promise<void> {
  const load = async (code: string) => (await fetch("./locales/" + code + ".json")).json();
  fallback = await load(source);
  strings = next === source ? fallback : await load(next);
  language = next;
  numbers = new Intl.NumberFormat(next);
  plurals = new Intl.PluralRules(next);
  document.documentElement.lang = next;
  document.documentElement.dir = isRightToLeft(next) ? "rtl" : "ltr";
}
```

- Every screen reads its text through `t()` when it's drawn, so a language change only needs a
  redraw, not a reload.
- Placeholder values that come from players (names) are passed in as they are, and the result
  is shown with `textContent` or the engine's text call, never as HTML.
- Strings that need markup (a bold word, a key icon) use placeholders for it, such as
  `"Press {key} to jump"`, and the UI builds the element for `{key}`, rather than HTML inside
  the string.

## Plurals

Languages have different plural categories. English has `one` and `other`; Russian has
`one`, `few`, `many` and `other`; Arabic has six; Japanese, Korean and Chinese only use
`other`. `Intl.PluralRules` picks the category:

```ts
new Intl.PluralRules("ru").select(3);        // "few"
new Intl.PluralRules("ru").resolvedOptions().pluralCategories;  // the categories a file needs
```

- Every plural string in a language file has every category that language uses.
- Use plurals for counts players see: lives, coins, players in a room, seconds left.
- `0` isn't special in most languages. If the design wants "No lives left", use a separate key.

## Numbers, times, dates and lists

Format with the chosen language, never by hand:

```ts
new Intl.NumberFormat(language).format(1234567);                 // "1,234,567", "1.234.567", "1 234 567"
new Intl.NumberFormat(language, { style: "percent" }).format(0.42);
new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(date);
new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(-1, "day");   // "yesterday"
new Intl.ListFormat(language, { type: "conjunction" }).format(names);           // "A, B and C"
```

- A race time or countdown: build `m:ss` from numbers formatted with
  `new Intl.NumberFormat(language, { minimumIntegerDigits: 2 })`.
- Create formatters once per language change, not every frame.
- Scores in the HUD that update every frame: format only when the value changes.

## Sorting

Sort names and items players see with `new Intl.Collator(language).compare`, not `<` or
`localeCompare` without a language. Sorting depends on the language (accents, `ä` in Swedish
versus German).

## Choosing the language

1. A language the player picked in settings, saved in `localStorage`.
2. Otherwise the first of `navigator.languages` the game supports.
3. Otherwise the source language.

```ts
const SUPPORTED = ["en", "es", "pt-BR", "fr", "de", "ru", "ja", "ko", "zh-Hans"];

function pickLanguage(saved: string | null): string {
  const wanted = saved ? [saved, ...navigator.languages] : [...navigator.languages];
  for (const tag of wanted) {
    let want: Intl.Locale;
    try {
      want = new Intl.Locale(tag).maximize();
    } catch {
      continue;                                  // not a valid language tag
    }
    // Same language and script ("zh-CN" matches "zh-Hans"); a region match wins when there is one.
    const sameScript = SUPPORTED.filter((code) => {
      const have = new Intl.Locale(code).maximize();
      return have.language === want.language && have.script === want.script;
    });
    const sameRegion = sameScript.find((code) => new Intl.Locale(code).maximize().region === want.region);
    if (sameRegion || sameScript[0]) {
      return sameRegion ?? sameScript[0];
    }
  }
  return "en";
}
```

- The language setting lists each language in its own name ("Deutsch", "日本語"), never
  translated and never as a flag. `new Intl.DisplayNames([code], { type: "language" }).of(code)`
  gives the name.
- Keep the setting device-wide unless the game already keeps settings per player.
- Apply a change at once: reload the strings, redraw every screen, recreate formatters, and
  switch fonts and direction.

## Finding hard-coded text

Before translating, find text still in the code:

- Search the source for string literals in UI code (`textContent =`, `innerText`, `fillText(`,
  the engine's text objects, `title=`, `alt=`, `placeholder=`, `aria-label=`) and in
  `index.html`.
- Run the pseudo-language test in [translating.md](translating.md): anything not accented and
  bracketed on screen is still hard-coded.
- Images with words in them (logos aside) need a version per language, or the words moved out
  of the image.
