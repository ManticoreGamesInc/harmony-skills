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

type Values = Record<string, string | number>;

// The raw text for key, with the plural form picked; placeholders still in it.
function lookup(key: string, values: Values): string {
  const entry = Object.hasOwn(strings, key) ? strings[key] : Object.hasOwn(fallback, key) ? fallback[key] : undefined;
  if (entry === undefined) {
    console.warn("Missing string: " + key);
    return "";
  }
  const text = textOf(entry);
  if (typeof text === "string") {
    return text;
  }
  const count = Number(values.count ?? 0);
  return text[plurals.select(count)] ?? text.other ?? "";
}

function fill(text: string, values: Values): string {
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    if (!Object.hasOwn(values, name)) {
      return match;
    }
    const value = values[name];
    return typeof value === "number" ? numbers.format(value) : value;
  });
}

/** The string for key, with {name} placeholders filled. Numbers are formatted for the language. */
export function t(key: string, values: Values = {}): string {
  return fill(lookup(key, values), values);
}

/**
 * Like t(), but as nodes for a string with an element in it ("Press {key} to jump"): each
 * placeholder named in elements becomes that element, and everything else, player names
 * included, becomes text nodes.
 */
export function tNodes(key: string, elements: Record<string, Node>, values: Values = {}): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const piece of lookup(key, values).split(/(\{\w+\})/)) {
    const name = piece.slice(1, -1);
    if (/^\{\w+\}$/.test(piece) && Object.hasOwn(elements, name)) {
      fragment.append(elements[name]);
    } else if (piece) {
      fragment.append(fill(piece, values));   // a string appended to a node is a text node
    }
  }
  return fragment;
}

export async function setLanguage(next: string, source = "en"): Promise<void> {
  if (!SUPPORTED.includes(next)) {
    next = source;                           // only the game's own files: never "../" or a URL
  }
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
  is shown with `textContent` or the engine's plain text object (rich text off), never as HTML.
  Never put the result of `t()` into `innerHTML`, even when the string itself is the game's own.
- Strings that need markup (a bold word, a key icon) use placeholders for it, such as
  `"Press {key} to jump"`, and the UI builds the element for `{key}` and passes it to `tNodes`,
  rather than HTML inside the string. Player names and other values still go in as text nodes.

```ts
const key = document.createElement("kbd");
key.textContent = "Space";
hint.replaceChildren(tNodes("hint.jump", { key }));
```

- Plurals come from `Intl.PluralRules` and the plural forms in the file. Never build a plural
  rule, a formatter or a template as code from a language file (`eval`, `new Function`).
- `SUPPORTED` (in "Choosing the language") is the only list `setLanguage` loads from, with
  `"pseudo"` added in development builds. A language from the query string, storage or the
  browser goes through `pickLanguage` first; a file address is never taken from outside.

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

The result is always one of `SUPPORTED`, so a saved value that was edited (`../../x`, a URL)
never reaches the file address.

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
