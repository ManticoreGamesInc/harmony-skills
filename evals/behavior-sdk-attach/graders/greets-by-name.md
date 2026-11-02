---
type: llm
---

PASS if the title screen shows the signed-in player's Harmony display name, read from the session (`auth.getSession()` or `auth.onSessionChanged`) and only for an account or guest session, shown as text (`textContent` or a canvas text call, never `innerHTML`), with a fallback when the player isn't signed in or Harmony isn't available. FAIL if the name never reaches the title screen, is inserted as HTML, or the greeting breaks when there is no session.
