# Screens

The screens a game needs, how they stack, and how focus and "back" move between them. The
examples are TypeScript for an HTML overlay; the same structure works in an engine's UI.

## Contents
- The screen stack
- Focus and back
- Controller and touch navigation
- Title
- Pause
- Results
- How to play
- Credits
- Modals
- Toasts
- Names and other text from outside
- Transitions

## The screen stack

One stack holds the open screens; the top one has input. Every screen opens and closes through
it, so focus, Esc and pausing are handled in one place.

```ts
interface Screen {
  root: HTMLElement;
  pausesGame: boolean;
  onBack?: () => boolean;           // return true when the screen handled Back itself
  returnFocus?: Element | null;
}

const stack: Screen[] = [];

export function openScreen(screen: Screen): void {
  screen.returnFocus = document.activeElement;
  const below = stack[stack.length - 1];
  if (below) {
    below.root.inert = true;        // nothing underneath can be clicked or focused
  }
  stack.push(screen);
  screen.root.hidden = false;
  (screen.root.querySelector("[autofocus], button, [tabindex='0']") as HTMLElement | null)?.focus();
  updatePause();
}

export function closeScreen(): void {
  const screen = stack.pop();
  if (!screen) {
    return;
  }
  screen.root.hidden = true;
  const below = stack[stack.length - 1];
  if (below) {
    below.root.inert = false;
  }
  (screen.returnFocus as HTMLElement | null)?.focus();
  updatePause();
}

export function back(): void {
  const top = stack[stack.length - 1];
  if (top && !top.onBack?.()) {
    closeScreen();
  }
}

function updatePause(): void {
  game.setPaused(stack.some((s) => s.pausesGame));   // game is your own
}
```

- The title screen sits at the bottom of the stack and can't be closed by Back.
- During play, Back with nothing open opens the pause menu.
- In online play, screens never pause the shared game; set `pausesGame` from the game mode.

## Focus and back

- **Esc and the controller's back button** call `back()`. A screen with unsaved choices (a
  rebind in progress, a name being typed) handles Back itself first.
- **Focus moves into** a screen when it opens (its main action, such as Resume or Play again)
  and **returns** to what opened it when it closes.
- **Focus stays inside** the top screen: `inert` on everything underneath.
- **Visible focus:** a themed focus ring on `:focus-visible`, clear on every background. Mouse
  hover moves focus too, so mouse and keyboard never show two different "selected" items.

## Controller and touch navigation

- D-pad and left stick move focus to the nearest focusable element in that direction (compare
  the elements' rectangles), with a short repeat delay when held.
- A (or the bottom face button) confirms; B (or the right face button) is Back; Start opens or
  closes the pause menu; the shoulder buttons switch tabs.
- Show button prompts for the input in use ("A Select   B Back"), and switch them the moment
  the player switches input.
- Touch targets at least 44 by 44 CSS pixels; no hover-only information; Back on screen for
  touch players who have no Esc.

## Title

- The game's name or logo, large, over a scene from the game (the game running behind, or key
  art), not a plain color.
- **Play** first and focused. **Continue** above it when there's a save to continue. Then How to
  play, Settings, Credits. No Quit button: a browser game has nothing to quit to.
- The build's version in small text in a corner.
- One input starts the game; no "Press any key" screen unless the game needs the input to unlock
  audio, and then make it part of the title, not a separate screen.

## Pause

- The game frozen and dimmed behind a panel (in single player).
- **Resume** first and focused, then Restart, How to play, Settings, Quit to title.
- Restart and Quit to title ask first when progress would be lost.
- Show what helps: the current objective, the controls.
- With the Harmony SDK, opening the Harmony overlay pauses the game too; when the overlay
  closes, the pause menu is waiting, and the player resumes. Without the SDK the game isn't told
  when the overlay opens, but the window gets a `blur` event when it does: pause on `blur` (also
  covering a switch to another tab or app) and never resume on `focus`; the player resumes.

## Results

- The outcome first and big: "Victory", "Level complete", "Game over".
- The score or time, the best so far, and "New best!" when it is.
- Rewards line by line when the game has progression, then totals and unlocks.
- **Play again** focused, then Next level (when there is one) and Menu.
- Animate the numbers in, briefly; any input skips the animation.

## How to play

- The goal in one sentence.
- The controls for the input in use (keyboard, controller or touch), with pictures of the keys
  or buttons, not only words.
- Three to five short tips with pictures or short clips.
- Reachable from the title and the pause menu; shown once automatically before the first game
  if the controls aren't obvious.

## Credits

- Everyone who made the game, then third-party assets with their authors and licenses, as their
  licenses require (fonts, sounds, music, models, libraries).
- Scrolls with the stick, wheel or drag; Back always works.

## Modals

- For decisions only: "Quit to title? Progress in this level will be lost."
- Buttons are verbs ("Quit", "Keep playing"), never "OK" and "Cancel" alone.
- The safe choice is focused; Esc and Back choose it.
- One modal at a time, over a dimmed screen; never a modal on top of a modal.

## Toasts

- Short notices that need no answer: "Achievement unlocked", "Settings saved", "Friend joined".
- At the top or bottom center, away from important HUD information and the Harmony badge corner.
- Three at most at once, each gone after 3 to 4 seconds, never taking focus or input.

```ts
const toastLayer = document.getElementById("toasts") as HTMLElement;   // aria-live="polite" in the HTML

export function showToast(message: string): void {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;          // text, never HTML: toasts often hold a player's name
  toastLayer.append(toast);
  while (toastLayer.children.length > 3) {
    toastLayer.firstElementChild?.remove();
  }
  setTimeout(() => toast.remove(), 3500);
}
```

## Names and other text from outside

Player names, a friend's presence ("Mika is playing Star Hopper", where the title is whatever
its creator wrote), file names and anything other players send can hold markup, bidi control
characters or a thousand letters. On every screen (results, lobby, scoreboards, toasts,
modals, tooltips):

- Set it as text: `textContent`, or `title` and `aria-label` through the element's property or
  `setAttribute`. Never `innerHTML`, `insertAdjacentHTML` or HTML built with template strings or
  `+`, even for the game's own strings, so a screen stays safe when a name is passed in later.
- In engine UI, use the plain text object with rich text off: PixiJS `Text` (not `HTMLText`),
  Phaser `Text` (no BBCode plugin), Babylon GUI `TextBlock`, TextMeshPro with Rich Text off,
  Godot `Label` (or `RichTextLabel` with BBCode off).
- Clean names before showing them: keep letters, marks, digits, spaces and `.`, `_`, `-`, which
  drops bidi overrides, zero-width characters and line breaks, and cap the length by code point
  (`Array.from(name).slice(0, 16)`). Give long names an ellipsis and `dir="auto"`.
- Sentences with a name come from the language string with the name filled in, then set as
  text ("Mika joined").

## Transitions

- 150 to 250 ms fades or slides between screens; never make players wait on an animation to
  click.
- With reduced motion on (the system setting or the game's), cut to a simple fade or none.
- A sound on open, close, move and confirm, quieter than gameplay sounds.
