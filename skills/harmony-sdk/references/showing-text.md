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

Canvas and game engines: draw the text with the text call, such as `fillText` on a 2D canvas. A canvas never reads text as HTML.

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

## Unsafe: never do this with Harmony text

Each of these reads the text as HTML. A name or title such as `<img src=x onerror="…">` then runs as code inside the game.

- `element.innerHTML = …`, `element.outerHTML = …`
- `element.insertAdjacentHTML(…)`
- `document.write(…)`
- building HTML from strings, such as `` `<li>${friend.displayName}</li>` `` passed to any of the above or to a library that parses HTML
- jQuery `.html(…)`, `$(…)` with a string that holds the text, or `.append(string)`
- React `dangerouslySetInnerHTML`
- Vue `v-html`

## Reviewing a game

Search the game's code for these, and check where each value comes from:

- `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`
- `dangerouslySetInnerHTML`, `v-html`, `.html(`

If any of them can receive a value from `harmony.auth`, `harmony.friends` or `harmony.files`, change it to one of the safe forms above.
