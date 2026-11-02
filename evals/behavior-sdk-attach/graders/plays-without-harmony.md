---
type: llm
---

PASS if the game starts without waiting for attachGameServices, and keeps playing when attaching fails (the failure is caught). FAIL if the game waits for Harmony before starting, or a failed attach would break it.
