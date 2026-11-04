---
name: harmony-localization
description: Translate a web game into other languages - strings in language files with context notes, plurals and formats through Intl, a language setting, fonts for Chinese, Japanese, Korean, Arabic, Cyrillic and other scripts, right-to-left layout, room for longer text, wrapped canvas text, translation drafts for native review, and a pseudo-language test. Use when a game needs other languages, translation, i18n, right-to-left or CJK support, or its text overflows in another language.
license: MIT-0
compatibility: Web games in any browser engine. Guidance only; uses the browser's built-in Intl APIs and needs no packages.
---

# Localization for web games

Getting a game ready for other languages, then translating it. This skill is guidance: write the
code into the game, in its own style, and keep to the game's existing UI technology.

Do it in this order. Each step is useful on its own, and the early ones are the expensive ones
to do late.

1. **Look at the game first.** Find where its text lives (HTML, UI code, canvas text calls,
   `index.html`), its fonts, its settings menu and how it saves settings, and the language its
   text is written in (the source language). Then ask the questions below.
2. **Strings out of the code** ([references/strings.md](references/strings.md)): every
   player-facing string in a language file, with a key and a context note, read through one
   function. Plurals, numbers, dates and lists through `Intl`.
3. **Language choice** ("Choosing the language" in
   [references/strings.md](references/strings.md)): the browser's languages first, then a
   setting the player can change, saved and applied without a reload where possible.
4. **Text and layout** ([references/text-and-layout.md](references/text-and-layout.md)): fonts
   for every script the game ships, right-to-left layout, room for longer text, and canvas text
   that wraps and measures correctly.
5. **Pseudo-language test** ("The pseudo-language test" in
   [references/translating.md](references/translating.md)): a fake language that makes every
   string longer and accented, to find hard-coded text and layouts that break before any real
   translation exists.
6. **Translations** ([references/translating.md](references/translating.md)): drafted with
   context and a glossary, marked as drafts, reviewed by a native speaker before release.
7. **Report** to the developer: the languages added and the status of each (draft or
   reviewed), the doubtful strings for each reviewer, anything the pseudo-language test still
   shows, and any choices made for them. Go through the release checklist in
   [references/translating.md](references/translating.md) and say which items are still open.

## Ask the developer first

Ask in one round, with a recommendation for each. Don't ask what the code already shows.

- **Which languages?** A common first set for web games: English, Spanish, Portuguese
  (Brazil), French, German, Russian, Japanese, Korean, Simplified Chinese. Right-to-left
  (Arabic, Hebrew) only if the developer wants it, since it touches layout everywhere.
  Recommended: only the languages someone can review, since each one needs a native speaker.
- **Draft translations now?** Or only get the game ready (steps 1 to 5) and leave translation to
  translators. Recommended: draft them now, marked as drafts, so the layout is tested with real
  text.
- **Who reviews?** Drafts ship only after a native speaker checks them. Ask who that is for
  each language. Recommended: until a language is reviewed, ship the source language only, or
  label the draft in the language setting ("Deutsch (beta)").
- **What stays untranslated?** Recommended: the game's title, character and place names, and
  terms players search for. Draft the list from the game for the developer to confirm.

If the developer says "you decide", use the recommendations and list them in the report as
choices they can change.

## Rules

- **No player-facing text in code.** Menus, HUD, tooltips, tutorials, error messages, alt text
  and the HTML loading screen all come from the language files.
- **Whole sentences with placeholders.** Never build sentences by joining fragments
  (`"You have " + n + " lives"`); word order differs between languages. Use
  `"livesLeft": "You have {count} lives"` and plural rules.
- **A context note for every string**: where it shows, how much room it has, and what each
  placeholder holds. Translators can't see the game.
- **Never translate player content.** Names from Harmony (display names, game titles in a
  friend's presence, for a game that uses the Harmony SDK), chat and anything players type stay exactly as written, shown as text,
  never HTML. Wrap them so they don't flip the layout around them (`<bdi>` or `dir="auto"`;
  see [references/text-and-layout.md](references/text-and-layout.md)).
- **Filled strings are text.** A translated sentence with a player's name in it goes on screen
  with `textContent` or the engine's plain text object, never `innerHTML`. Markup in a string
  (a key icon, a bold word) is a placeholder the UI fills with an element it builds, and the
  names around it stay text nodes. Names are cleaned first: bidi and zero-width control
  characters and line breaks out, length capped.
- **Language codes from a list.** A language from settings, the browser or the address picks
  one of the game's own languages before it sets `lang` or `dir` or loads `locales/<code>.json`;
  anything else falls back to the source language. Plurals and formats come from `Intl`, never
  from code built out of a language file (`eval`, `new Function`).
- **Format with `Intl`.** Numbers, scores, times, dates, lists and plurals through
  `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.ListFormat` and `Intl.PluralRules`, in the
  chosen language.
- **Fall back, don't break.** A missing string falls back to the source language and is logged
  in development, never shown as a raw key or `undefined`.
- **Fonts for every script shipped.** No boxes (tofu) for any shipped language, including in
  player names, which can be in any script.
- **Drafts are marked.** Machine or agent translations are labeled as drafts in the language
  file until a native speaker reviews them.
- **The upload form has no language field.** Write the Harmony listing in the game's main
  language, and mention the other languages in the description.

## Reference files

| File | Read when |
| --- | --- |
| [references/strings.md](references/strings.md) | Language files, keys, context notes, the lookup function, placeholders, plurals, Intl formatting, picking and saving the language |
| [references/text-and-layout.md](references/text-and-layout.md) | Fonts and scripts, right-to-left layout, player names, text that grows, canvas text and wrapping, the HTML loading screen |
| [references/translating.md](references/translating.md) | Drafting translations, glossaries, marking drafts, review, the pseudo-language test, a release checklist |
