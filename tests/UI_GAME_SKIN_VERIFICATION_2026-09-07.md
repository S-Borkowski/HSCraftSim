# Game-style workshop verification

Reference: the user's in-game Crafting screenshot, September 7, 2026.

The workshop now uses original Hero Siege background, grid, nine-slice panel and recipe frames, Hud Button art, Fontin typefaces and item sprites. Desktop recipes form a searchable four-column book below the Cube. Recipe details scroll independently; Craft remains visible. New profiles use 9 × 6; saved profiles keep their chosen grid. Item inspection opens the existing editor in a dialog at every desktop width.

Original sprites were exported read-only from the supplied game installation with `tools/extract_workshop_skin.py`. The source manifest records 18 additional UI sprites; the web build includes only referenced UI assets. No game files were modified.

Validation:

- `npm run verify`: mechanics, Item Editor differential, current native modifiers, socket totals, per-action history, Codex, syntax and deployed web tests passed.
- `python -m unittest tests.test_desktop tests.test_cpr`: five tests passed. No EXE/release build tests were run.
- Browser at 1280 × 720: selected 9 × 6, added a recipe's ingredients, crafted a Random Unique Item into the Cube (Zeus' Circlet), opened the new history record and the equipment inspector, and navigated to Codex crafting. These operations used the isolated preview origin, not the user's desktop profile.
- Actual WebView2 layout diagnostics at 1506 × 863, 900 × 600, 390 × 844 and 360 × 640: page dimensions equal viewport dimensions; Cube, recipe book and Craft remain inside the viewport; no broken visible images. Narrow widths use two recipe columns. These diagnostics verify bounds, not full mobile interaction coverage.
- Python renderer self-test with a copy of the user's session: 171 recipes, 1,924 catalog items, native storage bridge ready, seven existing history records and Codex of Experience preserved, no startup notice or broken visible images.
- Closed the prior Python window through its normal close/save flow, backed up the latest session in `tests/_output/skin-profile-backup`, and reopened `HSCraftSim.py`. The running window responds and serves the final revision `ee31c12ca717dcce`; seven user history records remain saved.

Final static package: 1,653 files, 8,070,377 bytes, including 1,601 item images. Packed runtime data is 520,245 bytes (92.1% smaller than its JSON source). Static assets and item images are cached; recipe images load lazily. This is a visual update, not a claim of complete game-mechanic parity. No EXE was compiled.
