# Translating

Drafting translations, review, and testing. Drafts can be written by an agent; they are marked
as drafts until a native speaker reviews them.

## Contents
- Before translating
- Drafting a language
- The glossary
- Marking drafts and reviews
- The pseudo-language test
- Checks to automate
- Release checklist

## Before translating

- Every player-facing string is in the source language file with a note (`strings.md`).
- The pseudo-language test passes: no hard-coded text, no clipped layouts.
- The glossary exists, and the developer has said what stays untranslated.

## Drafting a language

For each string:

- Read the note: where it shows, how much room, the tone, what each placeholder holds.
- Keep every `{placeholder}` exactly, in the place the language's grammar needs.
- Fill every plural category the language uses
  (`new Intl.PluralRules(code).resolvedOptions().pluralCategories`).
- Use the glossary's term for every game word, the same way every time.
- Match the game's tone: a playful game stays playful; an error message stays plain.
- Use the language's own conventions: quotation marks, the formal or informal "you" (pick one
  per language and note it in the glossary), punctuation spacing (French puts a space before
  `?`, `!` and `:`).
- Stay within the room the note gives; if a translation can't fit, say so in the review notes
  rather than cutting meaning.
- Never translate player content, the game's title, or names on the do-not-translate list.

Write the drafts in the language files with `"status": "draft"`, and list doubtful strings
for the reviewer.

## The glossary

`locales/glossary.json`: the game's terms, each with its translation per language and a note,
plus a list that stays untranslated.

```json
{
  "doNotTranslate": ["Star Hopper", "Harmony"],
  "terms": {
    "comet": { "note": "The enemy that crosses the screen.", "de": "Komet", "fr": "comète", "ja": "彗星" },
    "boost": { "note": "The speed power-up and the button that uses it.", "de": "Boost", "fr": "turbo", "ja": "ブースト" }
  },
  "address": { "de": "du (informal)", "fr": "tu (informal)", "es": "tú (informal)" }
}
```

## Marking drafts and reviews

- `"status": "draft"` in a language file's `_meta` until a native speaker has reviewed every
  string; then `"reviewed"`, with the date.
- Give the reviewer a sheet per language: key, source text, note, draft, and a screenshot where
  possible. They correct the draft in place.
- After a review, any string changed later in the source language goes back to draft in every
  language (keep a list of changed keys per release).
- Recommended: show only reviewed languages in the language setting. If the developer wants to
  ship drafts, label them in the setting, for example "Deutsch (beta)".

## The pseudo-language test

A fake language made from the source, which makes problems visible before any translation
exists: every string accented, about 40% longer, and bracketed so cut-off text is obvious.

```ts
const ACCENTS: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú", c: "ç", n: "ñ", A: "Å", E: "É", O: "Ö", U: "Ü" };

function pseudo(text: string): string {
  // Leave {placeholders} alone; accent everything else and pad it.
  const accented = text.replace(/\{\w+\}|./g, (part) => part.length > 1 ? part : ACCENTS[part] ?? part);
  const padding = "~".repeat(Math.ceil(text.length * 0.4));
  return "[" + accented + padding + "]";
}
```

Build `locales/pseudo.json` from the source file in development (plural entries too), and add
it to the language setting in development builds only. Then check every screen:

- Text without brackets or accents is still hard-coded.
- A missing closing bracket means the text is cut off.
- Overlapping or overflowing text needs a layout that grows or wraps.

If the game will ship a right-to-left language, test that too: switch the page's `dir` to `rtl`
with the pseudo-language and check that menus mirror and nothing is stuck to the left.

## Checks to automate

Add a unit test in the game's test runner that reads every language file and checks:

- every key in the source file exists in each language (or is reported as falling back);
- no language has keys the source file doesn't;
- each string has the same placeholders as the source;
- each plural string has every category its language uses;
- no string holds HTML tags (`<b>`, `<a href>`): markup is a placeholder the UI fills (`tNodes`
  in `strings.md`);
- no translation is more than about 1.5 times the source's length when its note gives a size,
  as a warning to check on screen.

## Release checklist

- [ ] No player-facing text in code; the pseudo-language test is clean on every screen.
- [ ] Every shipped language is reviewed, or labeled as a draft in the setting.
- [ ] Fonts cover every shipped language and the fallback covers player names; no boxes.
- [ ] Numbers, dates, times and lists use `Intl` in the chosen language.
- [ ] Right-to-left languages (if any) mirror the menus and keep the game world as it is.
- [ ] The language setting shows each language in its own name and applies without a reload.
- [ ] The HTML loading screen has no words, or picks its words by language.
- [ ] The Harmony listing is in the game's main language and names the other languages in the
      description.
