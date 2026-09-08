# Current item display and Orb-word verification

Build: `c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.
The supplied executable is read and emulated. No game process or save is changed.
No simulator executable is compiled.

## Item tooltip totals

`native_display_values.py` executes the original `GetItemTooltipString` numeric
blocks, stopping before formatting:

| Value | Start | Captured comparison |
| --- | --- | --- |
| Attack Damage | `0x143e9c587` | `0x143e9dcf6` |
| Attacks per second | `0x143e9e556` | `0x143e9f561` |
| Defense | `0x143e9fdc6` | `0x143ea1c2a` |

`capture_display_values.py` writes 1,674 native cases to
`tests/current_display_native.json`: identification/rarity gates, level 1/50/100,
integer/fractional bases, positive/zero/negative modifiers and per-level terms.
`test_item_display.mjs` compares all outputs without changing the raw stats.

The enhanced branches require `w` or rarity below 6. `IsIdentified.named.c`
(`0x143e6e180..0x143e6e4d0`) independently identifies w as the Unique item's
identified flag. Catalog equipment now defaults to identified; explicit w=0
is preserved. Corruption remains r.

For selected character level L and raw post-generation/post-socket stats:

- Weapon attack 22: when 22>0 and (28>0 or 31>0),
  `ceil(22 + 22 * ((28 + 31*L)*0.01))`.
- Weapon speed 23: when 23>0 and 68>0, `23 * (1 + 68*0.01)`.
- Defense 154: when 154>0 and 29>0, let `d=154+156*L`, then
  `ceil(d + d*((29+30*L)*0.01))`. The native 29>0 gate is intentional:
  per-level defense terms alone do not change the captured display value.

Numbers refer to stat keys. The engine retains `.value`; only `.displayValue`
changes after stars, corruption, Crystal, Runewords, special and socket bonuses.
Inspector, starting-item preview and hover all read these totals. Calculated
totals in previews are actual values for the selected seed, not falsely labeled
raw base ranges. History captures each new total and never recalculates old
snapshots. Ten sequential Dice rolls are covered by the integration test.

`TooltipContext.named.c` selects a level from protected player/global data.
Its final native helper `0x14b51a710` is a minimum (25/100→25, 150/100→100,
100/50→50, 0/100→0). Fixtures provide the selected level explicitly. The UI's
existing valid character-level range is 1–100. Live player data is not read.

`ItemGetStat.named.c` confirms GetItemStat is a raw-property getter.
`ItemAttackFormat.named.c` packages base and modified values. That array is
not an attack minimum/maximum pair: `GetItemStatString.named.c` displays its
second value. No invented 70% minimum or player combat DPS formula is added.

## Codex Orb words

`capture_orb_words.py` executes native `LoadRunewords`
(`0x1442aa0f0..0x1442ad8ab`) with the seven extracted Codex definitions.
966 fixtures cover missing/zero seeds, seeds 1–64 and large values, with and
without existing Orb stats. The original stage preserves those existing stats.

The stage seeds CPR from **i**, with a missing-field default of **0**, rather
than a. Four words draw once within their range; three have fixed bonuses.
The Codex engine now uses that independent seed and removes the outdated
warning about an unverified bonus roll.

`capture_socket_word_seed.py` executes original `InventorySocketItem`
`0x143daf284..0x143daf37a` after its protected maximum is decoded. Eight
controlled irandom results, including 0 and the maximum, confirm the write
`i=max(1,irandom(1e9))`. The rest of the definition is preserved. This is the
seed-write block, not a claim of emulating the live inventory/network action.

Every individual Orb insertion now renews i. The complete-word shortcut draws
once per Orb so it has the same final seed and result as the corresponding
individual insertions with the same random stream. a, zone and entries are
preserved. Tests cover both Codex bases, all seven word values, saved sessions,
frozen snapshots and varied bonuses across repeated constructions.

## Boundaries

These additions certify item tooltip arithmetic and selected-word bonus stages.
They do not certify player combat minimum/maximum damage, full native word
detection, network synchronization, character-dependent Angelic augments,
allocated subtalents, forced normal modes/names or quest-dependent outputs.
Existing exact-order/count matching and individual-insertion tests still apply.

## Validation results

- `npm run verify` passed the complete mechanics/differential tests, syntax
  checks and static build verification. The web tests compare all 2,097 item
  stats, compressed/fallback data loading, root/subfolder assets, cache
  immutability and 100,000 analysis-worker trials.
- `python -m unittest tests.test_desktop tests.test_cpr`: five tests passed.
- Real `HSCraftSim.py` / WebView2 self-test passed with an isolated copy of the
  user's profile. All 22 old history records were preserved. The original file
  stayed byte-identical, SHA-256
  `2fc338af6028a31abb86ae5fb2c8240e42c58d84a7dcde3a7068ad0fa04f1733`.
  Report: `tests/_output/native-craft-gjy4cu5k/desktop.json`.
- Browser verification ran the publishable build on its own local port/profile.
  Starting-item preview showed Dawn Bringer attack 318. A real Blessed Dice
  action stored attack 318→334 and sockets 5→4 in History. A complete Codex of
  Experience action produced a 31% word bonus, three filled sockets, The
  Cathedral and 14 entries. Both operation records survived page reload.
- No browser errors or broken visible images; the 1258×622 browser document
  and the 1506×863 desktop document fit their respective viewports.
- The first complete test run caught a missing explicit RNG in the Empty
  Sockets catalog preset. That caller now supplies its deterministic setup
  seed and is covered by the existing catalog test plus a seed assertion.

Screenshots: `tests/_output/item-display-start.png`, `item-display-dawn.png`,
`item-display-history.png`, and `orb-word-current.png`. Full test log:
`tests/_output/verify-item-display-orb.log`.

Publishable revision `d1b87c1124031ca9`: 1,686 files, 8,684,040 bytes. Main data
is still 520,743 compressed bytes (92% reduction). Research scripts and native
fixtures are excluded from the website. No EXE or release archive was built.
