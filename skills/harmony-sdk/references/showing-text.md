# Showing text from Harmony

Treat any text the SDK gives your game as written by a player or a creator. Harmony passes it on exactly as written: plain text, never HTML.

That covers:

- `displayName` and `discriminator`, for the player and each friend
- a friend's `currentGame`, which a creator wrote freely and can hold `<`, `&` or anything else
- the `name` of a file the player opened

## Safe ways to show it

Plain DOM: set `textContent`, and build elements instead of HTML strings.

```ts
// friendList is your own element. Call this only for an account session: guests have no friends list.
const friends = await harmony.friends.list();
for (const friend of friends) {
  const line = document.createElement("li");
  line.textContent = friend.currentGame ? `${friend.displayName} is playing ${friend.currentGame}` : friend.displayName;
  line.title = friend.discriminator ? `${friend.displayName}#${friend.discriminator}` : friend.displayName;
  friendList.append(line);
}
```

Attributes: set them through the element.

```ts
badge.setAttribute("title", session.displayName);
```

Canvas and game engines: draw the text with the text call, such as `fillText` on a 2D canvas. A canvas never reads text as HTML. Some engine text objects do read markup, so pick the plain one: PixiJS `Text`, not `HTMLText`; Phaser `Text`, not a BBCode or rich-text plugin; Babylon GUI `TextBlock`; Three.js text drawn to a canvas texture, never an HTML overlay built from strings. Unity and Godot are covered in the `harmony-engines` skill.

```ts
context.fillText(session.displayName, 16, 32);
```

React: put the value in braces. React escapes it.

```tsx
<span title={friend.displayName}>{friend.displayName}</span>
```

Vue: use `{{ }}` or `v-text`, and bind attributes with `:title`.

```vue
<span :title="friend.displayName">{{ friend.displayName }}</span>
```

Svelte: use `{friend.displayName}`, never `{@html …}`. Lit: use `${…}` in an `html` template, never `unsafeHTML`.

`document.title`, a `Notification` and the text of `navigator.share` take plain text, so a name or title can go there as it is.

## Long or odd text

Text shown as text can't run, but it can still mislead or break a layout. A game title can be very long, hold a newline, or hold invisible characters: a right-to-left override (`U+202E`) flips the rest of a label, and zero-width characters hide inside a name. For one-line labels and toasts, clean the text first:

```ts
// Turns line breaks into spaces, drops control and invisible formatting characters, then caps
// the length by code point.
function forLabel(text: string, max = 64): string {
  const oneLine = text.replace(/[\t\n\r\u2028\u2029]+/g, " ").replace(/[\p{Cc}\p{Cf}]/gu, "");
  return Array.from(oneLine).slice(0, max).join("");
}

line.textContent = `${forLabel(friend.displayName)} is playing ${forLabel(friend.currentGame ?? "")}`;
```

Show the `discriminator` tag beside the name wherever players need telling apart.

## Never as a URL, a style or code

- Never put Harmony text in a URL, an `href` or `src`, a CSS value or `<style>` text, or a file path.
- Never run any text as code: no `eval`, `new Function`, `setTimeout` or `setInterval` with a string, and no `import()`, `<script>`, `Worker` or Blob URL built from it.
- A `message` listener of the game's own checks `event.origin` against the exact origins it expects and checks the message's shape before using any field.

## Unsafe: never do this with Harmony text

Each of these reads the text as HTML. A name or title such as `<img src=x onerror="…">` then runs as code inside the game.

- `element.innerHTML = …`, `element.outerHTML = …`
- `element.insertAdjacentHTML(…)`
- `document.write(…)`
- building HTML from strings, such as `` `<li>${friend.displayName}</li>` `` passed to any of the above or to a library that parses HTML
- jQuery `.html(…)`, `$(…)` with a string that holds the text, or `.append(string)`
- React `dangerouslySetInnerHTML`
- Vue `v-html`, Svelte `{@html …}`, Lit `unsafeHTML`
- `createContextualFragment`, an iframe's `srcdoc`, or `DOMParser` output added to the page

## Reviewing a game

Search the game's code for these, and check where each value comes from:

- `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`
- `dangerouslySetInnerHTML`, `v-html`, `{@html`, `unsafeHTML`, `.html(`, `srcdoc`, `createContextualFragment`
- `eval`, `new Function`, `HTMLText`, `cssText`, `addEventListener("message"`

If any of them can receive a value from `harmony.auth`, `harmony.friends` or `harmony.files`, change it to one of the safe forms above.
