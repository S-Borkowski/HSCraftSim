# Item workspace and craft journal verification

Verified through the built website at `127.0.0.1:17880`, separately from the user's source session on port 17870.

- One click on equipment opens stats and starting controls together. Changing stars updates the preview immediately and enables Undo.
- Rune, Gem and Jewel tabs expose icon cards with name search. Perfect Ruby was dragged into socket 2 of St. Jupe's Plate of Command. The socket label, filled count and fire stats updated; the existing Angelic Gem remained in socket 1.
- Twelve consecutive Blessed Dice crafts succeeded through the actual UI. The latest ten crafts were available as before/after choices. Comparing craft 5 against craft 14 showed different saved values; the changed-only filter displayed seven changed stats.
- Changing the live item from three stars to zero left the comparison table byte-for-byte unchanged. Moving the item to inventory and reloading retained the ten versions.
- Blessed Dice's equipment picker retained its recipe scope after the Angelic shortcut. Armor displayed Tayrel's Chestplate and St. Jupe's Plate of Command at SS. Explicit S tier displayed no compatible items. Marking a new target corrupted disabled Add to Cube with a reason; cleansing the starting configuration enabled it.
- Layout inspected at the default 1280 × 720, desktop 1920 × 1080 and mobile 390 × 844. Mobile document dimensions matched the viewport, with no page overflow. Large content scrolls within its panel. The item editor used one dialog at mobile width.
- JavaScript suites, syntax checks, production web tests and the five selected Python desktop/CPR tests passed. New tests cover detached history values, twelve real craft transactions, per-item retention across serialization, old selected journal entries, percentage/text differences and 11,236 valid recipe/item combinations.

No EXE was compiled. Existing executable SHA-256 remained `24ebfef522cb5b5d9dbca5ea82f5455722e271f9fb3fb775e2bc2b2e39f6ae74`.

## Socket eligibility and hover follow-up

- Add Sockets now displays its exact rejection reason before ingredients and history, marks an invalid equipment row as Not eligible, and repeats the reason in the craft dock. Invalid equipment is explained even when materials are missing.
- Browser check: Tayrel's Chestplate with one socket was rejected despite complete materials. The direct Blacksmith's Mallet link selected the removal recipe; after that craft, Add Sockets became available. A new roll created two sockets, then the next attempt correctly showed the zero-socket requirement. Browser console had no warnings or errors.
- Moving the pointer off an ingredient row into the previously visible tooltip area closed the tooltip. The tooltip no longer captures pointer events or keeps itself open; focus, scroll and window blur also dismiss it.
- A transaction regression verifies that a blocked repeat consumes nothing, Empty Sockets preserves the slots, and deleting slots allows another Add Sockets roll. All JavaScript, syntax and production build checks passed.
- Python WebView2 self-test used a separate copy of the four-craft desktop session: 146 recipes loaded, all four records remained, images loaded and document dimensions equaled the 1506 × 863 viewport. Report: `tests/_output/socket-hover-desktop/renderer-report.json`. No EXE was compiled.

Historical entries created before stat snapshots were introduced cannot recover their original calculated values. They are labeled unavailable; new crafts capture them. These checks verify the simulator's behavior, not complete parity with every native game mechanic.
