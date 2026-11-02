# The settings screen

How the screen looks and behaves. Build it with the game's own UI technology, fonts, colors and
sounds, so it reads as part of the game.

## Contents
- Layout
- The control for each kind of setting
- Keyboard and controller
- Touch and phones
- Opening and closing
- Previews and confirmations

## Layout

- Tabs across the top (or down the side on wide screens): Graphics, Audio, Controls,
  Accessibility, General. Only the ones the game has.
- One setting per row: the label on the start side, the control on the end side, the current
  value visible without opening anything.
- A help line at the bottom, or under the focused row, saying what the focused setting does.
- "Reset tab" and "Back" along the bottom.
- The game stays visible behind a dimmed panel where it helps: quality, shake and colors show
  their effect live.
- Labels and help text come from the game's language files when it's translated; leave room
  for longer translations.

## The control for each kind of setting

| Kind | Control |
| --- | --- |
| On or off | a toggle switch with the state in words ("On", "Off"), not only color |
| A few choices (quality, frame cap, color mode) | a segmented control or left and right arrows with the value between them; not a dropdown, which is awkward on controllers |
| A range (volumes, sensitivity, text size) | a slider with the number shown, keyboard and controller steps of 5% |
| An action binding | a button per binding showing the key or button glyph; activating it waits for the new input |
| Something that happens once (reset, export) | a button, with a confirmation when it can't be undone |

Every control works with a mouse, a keyboard, a controller and touch, and shows a clear focus
ring.

## Keyboard and controller

- Up and down move between rows; left and right change the value of the focused row (or move
  between tabs when the tab bar is focused).
- Enter or the controller's confirm button activates buttons and bindings.
- Esc or the controller's back button closes the screen and returns focus to the button that
  opened it. While waiting for a new binding, Esc cancels the rebind instead.
- The shoulder buttons (and Q and E, or Page Up and Page Down) switch tabs.
- Show the button prompts for the controller in use, and switch them when the player switches
  input.

## Touch and phones

- Touch targets at least 44 by 44 CSS pixels, with space between them.
- On a phone in portrait, tabs become a list that opens each group full screen, with Back at the
  top.
- Sliders take a drag anywhere on the track and show the value while dragging.
- Respect the phone's safe areas (`env(safe-area-inset-*)`) so nothing sits under a notch or a
  rounded corner.

## Opening and closing

- From the title screen, and from the pause menu during play.
- In single-player, the game stays paused while settings are open. In online play, it doesn't:
  the menu sits over a running game, as other players are still playing.
- Changes apply and save as they're made, so closing never asks "Save changes?".
- Remember the last tab for the session.

## Previews and confirmations

- **Volumes:** a sample sound on release; music keeps playing.
- **Graphics:** the game behind the menu redraws with the new setting.
- **Text size and colors:** the menu itself updates at once.
- **Touch controls:** shown over the game while adjusting.
- **Risky changes** (anything that could leave the game unusable, such as a render scale the
  device can't run): apply, then ask "Keep this setting?" with a 10-second countdown that
  reverts if nothing is pressed.
- **Reset:** "Reset all audio settings to their defaults?" with Reset and Cancel, Cancel
  focused.
