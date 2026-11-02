---
type: llm
---

PASS if saved settings are read defensively: broken JSON, missing or out-of-range values fall back to defaults (for example try/catch around JSON.parse and clamping numbers). FAIL if stored values are used as-is.
