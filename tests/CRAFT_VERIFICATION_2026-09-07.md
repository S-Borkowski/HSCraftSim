# Craft verification — September 7, 2026

No EXE or release ZIP was compiled. The web build is `f27aeb1a774a8f93`.
The original desktop profile remained byte-identical. Native comparison uses
clean supplied binary SHA256
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.

## Fixes found during verification

1. Destiny Shard / Gypsy's Prophecy had success and corruption reversed.
   Original case31 gives **70% star increase, 22% decrease, 8% corruption**.
2. Satanic Dice corruption preserves the existing item seed. The simulator
   incorrectly rerolled it even when corrupting the item.
3. Satanic Crystal draws its affix seed before its outcome roll. The runtime
   previously requested those random draws in the reverse order.
4. The analysis trial selector reset to 10,000 while running 100,000 trials.
   It now retains the selected count through rendering and completion. The
   probability source label distinguishes current thresholds from legacy dust
   conversion research and is omitted for recipes without a threshold table.

## Automated and independent evidence

`npm run verify` passed the full JavaScript suite, syntax checks, static build
and production package tests. The additional Dice history regression and final
UI selector fix subsequently passed their targeted checks and rebuilt package
verification. `python -m unittest tests.test_desktop tests.test_cpr` passed all
five tests. EXE-building tests were not run.

- New: 3,119 original native mutation fixtures, comparing edits and every random
  request's bound/order. All 0–99 Dice, Crystal and star outcomes are covered.
- Existing current native evidence includes 5,490 base stages / 37,791 visible
  values; 5,091 star/corruption modifiers; 3,000 Crystal values; 1,911 explicit
  normal socket outcomes; 1,848 Add Sockets gates; 352 Codex modifier cases;
  180 Codex socket cases and 405 Runeword fixtures.
- 23,973 accepted recipe/item combinations pass the same rules as crafting.
  All 93 equipment Runewords and ordered individual Rune insertions are tested.
- Production checks cover domain-root and subfolder hosting, compressed and
  fallback loading, all 2,097 catalog rows, cache invalidation and worker results.

The bounded native fixtures control runner services and input state. They do
not prove the game's entire ingredient-to-generated-item flow. See
`../research/current/COMPLETION_ADDITIONS.md` for native addresses and exclusions.

## Actual browser interactions

Used the built website at `http://127.0.0.1:17894/` in a separate agent-browser
session, through visible controls rather than invoking hidden app functions.

- Applied Blessed Dice ten times individually to Harlequinn's Crest. Ten
  journal entries and ten Recent crafts cards appeared, numbered 10 through 1.
- Reloaded the page; all ten entries and their distinct before/after seeds
  remained. Selected craft10, then compared `#1 Before` with `#10 After` and
  enabled Changed stats only. Saved values appeared, including Defense 86→90.
- Hover displayed the rolled equipment stats. Moving to the adjacent empty
  area, about two pixels outside the item boundary, hid the tooltip. Moving
  onto the neighboring material correctly switches to its tooltip instead.
- Ready recipe appeared first. Compatible recipes had opacity 1; unrelated
  recipes had opacity 0.3 and remained inspectable.
- Probabilities showed 70/22/8. A 100,000-trial run yielded 69.91/21.98/8.10%.
  The selection remained 100,000, and serialized Cube/session data was unchanged.
- Created Codex of Experience using the starting-Codex and Add ingredients
  controls. Brute, Magister and Swiftness were consumed once each in order.
  The result appeared in the Cube and as history entry 11. The starting seed,
  zone and entry count were preserved. The resulting filled Codex rejected a
  repeated word craft.
- No browser page errors were reported. Small-screen panels scroll internally;
  Recent crafts requires scrolling inside the recipe panel at 1260×622.

Screenshots: `_output/native-craft-start.png`,
`_output/native-craft-history-compare.png`.

## Performance and Python

The final 100,000-trial browser observation took 419 ms including automation
overhead, with 33 animation frames, maximum frame interval 13.5 ms and no observed
main-thread long tasks. This is one local warm run, not a remote-host loading
benchmark or a guarantee for every device. The report is
`_output/native-craft-browser-performance.json`.

The static package contains 1,673 files / 8,314,441 bytes and 1,609 item images.
Main data is 520,743 bytes compressed versus 6,533,348 raw (92% reduction).

`python tests/_output/verify_native_craft_desktop.py` starts actual WebView2
from `HSCraftSim.py`, using an isolated copy of the desktop profile. It verifies
all 301 recipes, 1,932 selectable items, the storage bridge, successful loading,
no visible broken images and equal page/viewport dimensions 1506×863. All eight
original history snapshots survive unchanged. The original profile SHA256 is
`73c72eacef0ade31b7c42c32a18a681f5ed0a82ed098a2d0b36836bf60832751`.

## Real-game handoff and remaining uncertainty

The running game was observed at its version 7.0.9.0 main menu. No character was
loaded and no materials were consumed. The user offered to perform in-game
samples; end-to-end in-game craft comparisons are therefore pending.

Start with one Angelic item and one Blessed Dice: capture the entire tooltip
before and after, material name/count and outcome. Include both item seeds or
the corresponding Item Editor item definitions where possible. Screenshots
alone can verify visible changes and rules; differing random seeds cannot be
used as evidence of an incorrect stat roll.

Then sample a star change, Crystal effect/removal, and a zero-socket eligible
normal item through Add Sockets → rejected repeat → delete → Add Sockets.
For socket bonuses, record the inserted Rune/Gem and equipment type. Keep each
operation separate so its before/after values can be attributed correctly.

Full normal rarity/affix generation, natural equipment sockets, Angelic/special
and talent-dependent tails, initial Codex zone/entry RNG and Essence Vault
requirements still need native or exact-state game evidence. None is marked
fully verified by these tests.

## Follow-up: The Dawn Bringer game screenshots

The user subsequently supplied a Dice before/after pair showing five sockets
becoming four, with the corresponding lightning bonuses falling by 512 and 20.
This led to a current native rule for this item's 4–5 natural socket range and
a visible socket delta in History. All 681 new native fixtures, the actual
browser craft, and isolated Python startup passed. Exact random stat parity
and the fate of an inactive fifth gem remain outside the evidence.

See [DAWN_BRINGER_VERIFICATION.md](../research/current/DAWN_BRINGER_VERIFICATION.md)
for the capture boundary, retained screenshots, current production revision
and follow-up test results. No EXE was compiled.

## September 8: current Unique generation expansion

See [the native generation report](../research/current/CURRENT_UNIQUE_GENERATION_VERIFICATION.md)
for all 956 Unique definitions and exact stage boundaries. The complete
`npm run verify` passed after the generation changes; its log is
`_output/verify-current-unique-final.log`. This includes 57,246 current numeric
base/generated comparisons, 188 special-effect cases, 42 combined special
pipelines and all existing crafting/history/Codex/Runeword tests.

The final UI adjustment puts item setup tabs in their own row, preventing
scrolled socket controls from being covered by the tabs. Syntax checks and
`npm run test:web` passed afterwards. Final delivery revision is recorded in
`dist/build-report.json`; the website contains 1,680 files and 1,609 item images.
Main data remains 520,743 compressed bytes, a 92% reduction from raw JSON.

Actual browser checks at 1258×622:

- Added Gem King's Garb through the catalog and its natural six-socket setup.
- Inserted two Pristine Topaz gems. Ordinary lightning additions were 1,024
  and 40; the special bonuses were 30, 6, 2 and 30. Removing one gem halved
  each contribution, without rerolling the base armor.
- Selected the second socket after scrolling the controls; the fixed tab row
  no longer covered its click target.
- Crafted Blessed Dice three times on the same Garb using visible ingredient
  and Craft controls. Three separate records and six before/after comparison
  choices appeared. The last roll changed base values 417→383 and 292→281;
  gem bonuses and fixed six sockets were retained.
- No browser errors were reported. Evidence: `_output/unique-blessed-history.png`,
  `_output/unique-gem-king-two-pristine.png`, `_output/unique-browser-crafts.json`.

The five Python desktop/CPR unit tests passed. The final isolated Python
WebView2 test is `_output/native-craft-icqlf07a/desktop.json`: all 301 recipes and
1,932 selectable entries loaded, no broken images, no freeze, page and viewport
both 1506×863. All 22 existing history records survived, and original profile
bytes were unchanged (SHA256
`2fc338af6028a31abb86ae5fb2c8240e42c58d84a7dcde3a7068ad0fa04f1733`).
These checks do not close the remaining native/game parity gaps listed in the
generation report. No EXE or release ZIP was produced.
