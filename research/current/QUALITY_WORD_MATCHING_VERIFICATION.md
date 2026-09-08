# Special normal drops and word matching — 2026-09-08

Follow-up: `NORMAL_NAMES_COMPOSITE_WORD_VERIFICATION.md` completes the normal
name checks and adds 786 combined native Crystal/word generation cases. Its
website revision supersedes the revision recorded in this earlier report.

Build under analysis: `HeroSiegeC6E.exe`, SHA-256
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.
Only the isolated native emulator and Ghidra analysis database were used.
The installed game, saves, and original executable were not edited.

## Normal drop quality

`LoadCommonItems` now handles the native `n` and `zz.dropQuality` branches,
including the default/clamped mode, quality multipliers, Magic/Rare and Mythic
drops, guaranteed superior rolls, special socket modes, and `zz.sockets`.
Forced socket counts take precedence over the separate `s` socket seed.
Special drops omit the 671-series prefix before its tier draw; skipping only
the selected result would shift every subsequent affix roll.

`capture_forced_normal.py` executes current native generation for 20 input
modes over 120 equipment/type/tier profiles. All 2,400 cases match rarity,
required level, socket count, the complete prelude random stream and 11,999
generated property values. `test_forced_normal.mjs` also verifies ten Toolkit
transactions, quality retention, immutable snapshots, save/reload and editing
an imported scenario without mutating the original definition. An additional
108 native probes checked socket override combinations and special branches.

The starting-item UI exposes Natural roll, Magic or Rare, Mythic, and Superior
base choices. These are explicitly starting scenarios, not additional game
recipes. Existing item definitions and their explicit socket seeds remain
intact unless the corresponding starting control is changed.

## Equipment and Codex word matching

`native_word_matching.py` executes the entire current `GetRuneword`
(`1438a8f70..1438ab743`) against all 100 captured word definitions. Repository
objects and decoded socket payloads are fixture-owned; the native search,
weapon/type/handedness checks, rarity gate, count checks and sequence comparison
execute unchanged.

3,496 native cases include all words, reversed/missing/incorrect runes, wrong
families, weapon subtypes, handedness, corruption, rarity and Crystal states.
`test_word_matching.mjs` compares 3,363 equipment cases and 63 Codex cases.
The other 70 are synthetic non-white Codices, which the app does not generate;
they are retained as native evidence, not counted as app parity checks.

Fixes:

- Word recognition and equipment recipe validation require native white rarity
  1, rather than merely membership in the normal equipment catalog.
- Catalog recipe presets find an actual white seed when the requested starting
  roll is colored. The starting adjustment is labeled.
- Recognition receives the pre-word socket count and applies GetRuneword's
  own Crystal adjustment, including its six-socket ceiling and Codex exception.
  This does not grant ordinary normal equipment a new Crystal socket outcome.
- The complete RuneWord shortcut now renews `i` once per inserted Rune,
  matching the individual insertion stream. All 93 equipment sequences are
  compared against their individual insertion equivalents.
- Obsolete Codex/normal-drop approximation labels were removed. The unresolved
  vault quest distribution remains labeled.

## End-to-end checks

- `npm run verify` passed. After help/verification-text changes, the workshop,
  word-matching and forced-normal tests plus `npm run test:web` passed again.
- All 2,097 item stat builds and 100,000 worker trials remain covered by web
  verification. No research fixtures or executables enter the static build.
- Five Python desktop/CPR tests passed. A real WebView2 self-test used an
  isolated copy of the user's profile and preserved all 22 history records.
  Original profile SHA-256 stayed
  `2fc338af6028a31abb86ae5fb2c8240e42c58d84a7dcde3a7068ad0fa04f1733`.
  Report: `tests/_output/native-craft-mpatua_j/desktop.json`.
- Browser UI: Great Helm's Mythic starting choice updates its rarity color,
  required level and properties. Superior changes its defense to 64 and its
  socket count to 2 for the tested seed. Ten actual Toolkit crafts on the same
  Mythic item created ten individual records, all retained after reload.
- Browser document fits 1258 × 622; desktop fits 1506 × 863. No broken visible
  images or application console errors. Screenshots are in `tests/_output/`:
  `quality-mythic.png`, `quality-ten-crafts.png` and `quality-words-start.png`.
- The initial QA HTTP server used a Windows PTY and failed requests. It was
  stopped; an ordinary HTTP process serving the absolute `dist` path passed.

Final website revision: `d96b698691e7394c`; 1,686 files / 8,686,622 bytes.
Main data: 520,743 compressed bytes, 92% smaller than source JSON.
No simulator EXE or release archive was compiled.

## Remaining verification boundaries

This does not certify every game mechanic. Generated prefix/suffix item names,
player-dependent effects/allocated subtalents, combat damage outside the item
tooltip, Angelic augmentation integration, the producer of the socket-crafting
restriction flag `info[50]`, vault quest distribution, and full composite
socket-content/Crystal/word transitions still need independent verification.
The matching fixtures cover decoded socket payloads; they do not certify the
native serialized-payload parser. Earlier display/Codex results remain in
`ITEM_DISPLAY_ORB_VERIFICATION.md`.
