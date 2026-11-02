---
type: llm
---

PASS if the game starts without waiting for Harmony's attach (`attach` from @playharmony/sdk, or `PlayHarmony.attach` from the script tag), and keeps playing when attaching fails or Harmony doesn't load (the failure is caught, and the game copes with no handle). FAIL if the game waits for Harmony before starting, or a failed attach would break it.
