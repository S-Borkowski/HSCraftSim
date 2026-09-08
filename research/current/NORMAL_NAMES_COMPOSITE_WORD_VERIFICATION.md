# Normal item names and combined word generation

Game executable SHA-256:
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.
This follows `QUALITY_WORD_MATCHING_VERIFICATION.md`.

## Normal names

`native_normal_names.py` runs the original normal item generation and both
`ReturnPrefixName` (`14582b270`) and `ReturnSuffixName` (`145c842c0`). The native
code selects the naming affixes and assembles the prefix/suffix strings.
Fixture-owned string concatenation and English localization are the runner
services; the game and its saves are never launched or modified.

All 1,369 available English names match the current game's
`translationsItem.csv` exactly (SHA-256
`15c4de147b0cd6a0aae40c553bb604c195d132e4ae64fd31bf34e8011bf7d203`).
The native name table also contains 25 `_small` prefix keys absent from the
game's English translation. None is reachable from the captured equipment
pools, so they are recorded as unused and no replacement text is invented.

1,640 complete native name fixtures cover equipment families, tiers, ordinary
and special drop qualities, stars, corruption and imported forced sockets.
`tests/test_normal_names.mjs` checks both complete name parts and assembled
item names, plus repeated Toolkit names, immutable history and reload.

The model now preserves the separate Superior adjective and the native sticky
prefix/suffix choices. For example, seed 1 / quality 200 on Short Sword is
`Accursed Short Sword of Arcanum`; quality 1000 also retains its `Quantum`
adjective. Catalog base identities stay stable while crafted instance names
change with their rolls.

## Combined word generation

`native_full_word_pipeline.py` continues original `CreateItemNew` through
normal generation, Crystal application, `GetRuneword` and `LoadRunewords`,
stopping before item pricing. All 100 captured word repositories and current
Rune required levels are fixture-owned. Socket payloads are decoded structs;
this does not certify the native serialized-payload parser.

The combined check found a missing visible rule: a completed equipment
Runeword must require at least the highest required level of its base and
active socketed Runes. The simulator now derives that requirement from current
native Rune definitions, including the matcher's separate Crystal count rule.

The native GetRuneword call follows the Crystal stage. Its count adjustment
is separate from the socket stat; the earlier source comment saying it ran
before Crystal application has been corrected.

`tests/current_full_word_pipeline_native.json` contains 786 completed native
chains covering all 93 equipment words and 131 compatible equipment/handedness
selections. Six states per selection cover ordinary/absent word seeds,
Crystal affixes, stars, corruption, full socket counts and the matcher's
Crystal count adjustment. 665 cases form a word; 121 reject the sequence.
All 11,171 combined visible property values, word identities and required
levels match the simulator in `tests/test_full_word_pipeline.mjs`.

The capture's repository adapter initially excluded word ID 100 from its
upper bound. That attempt stopped without publishing its incomplete results.
The adapter was corrected to cover IDs 1–100, ID 100 was checked separately,
and the complete capture was rerun with per-case checkpoints. Only this
successful rerun supplies the final fixture file.

## Application checks

- The full `npm run verify` suite passed after all source changes, including
  both new native suites. Log: `tests/_output/verify-normal-names-full-words.log`.
- Browser: ten actual Toolkit crafts on one Mythic Short Sword produced ten
  individual names/snapshots. Reload preserved them; selecting craft 1 after
  craft 10 still compared its original Owl/Magic names and original stats.
- Browser: a prepared six-socket Ogre Maul formed Breath of the Damned. Its
  hover tooltip displayed the native level 69 requirement. Moving the mouse
  two pixels outside the item's bounds dismissed the tooltip.
- Document and viewport both measured 1258 × 622. No visible broken images or
  application console errors. Long names wrapped within their existing panels.
  Screenshots: `tests/_output/normal-names-mythic.png`,
  `normal-names-history.png`, and `runeword-required-level.png`.
- Five Python desktop/CPR checks passed. An isolated real Python/WebView2 run
  loaded 301 recipes and retained all 22 existing history records. Original
  profile bytes remained unchanged, SHA-256
  `2fc338af6028a31abb86ae5fb2c8240e42c58d84a7dcde3a7068ad0fa04f1733`.
  Report: `tests/_output/native-craft-j60nfklk/desktop.json`.
- The static root/subfolder test passed all 2,097 item stat builds and 100,000
  worker trials. Website revision `39888808e5ad63cc` contains 1,688 files,
  8,713,149 bytes. Main data is 520,743 compressed bytes, 92% smaller than its
  source JSON. Research captures and executables are excluded from the build.

## Boundaries

Follow-up: `SOCKET_LEVEL_AND_AUGMENT_AUDIT.md` fixes socket-content required
levels outside completed RuneWords, records the newer build/verification,
and narrows the augment investigation to its observed player-ability context.

These checks cover item generation and equipment word composition, not all
combat calculations. Player-dependent effects/allocated subtalents, Angelic
augmentation integration, the source of the socket-craft restriction flag
`info[50]`, the vault quest distribution and the serialized socket parser
remain independent verification boundaries. No simulator EXE or release
archive is compiled by this work.
