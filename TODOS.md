# TODOS

## P1 — Blocks Launch

### Store listing assets

**What:** Create required promotional images, screenshots, and icon assets for Chrome Web Store and Edge Add-ons store submissions.
**Why:** Both stores require: promo images (1280x800, 440x280 for featured), 2+ screenshots, 128x128 icon, store description. Missing these blocks submission.
**Pros:** Required to publish. Good assets → higher install conversion rate.
**Cons:** Design work, not code. Takes time.
**Context:** Chrome Web Store charges $5 one-time fee. Edge Add-ons is free. Both have review queues (~1-3 days). Assets needed before first submission.
**Effort:** M (human: ~4 hours / CC: ~20 min for asset generation)
**Depends on:** Extension code complete

## Completed

### Mac/Linux platform detection

**What:** Detect non-Windows platforms at runtime and show "IE mode is only available on Windows" instead of a confusing error.
**Completed:** v1.0.0 — `isWindowsPlatform()` implemented in popup.js; `no-windows` state with dedicated UI now activates correctly.
