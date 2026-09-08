# Current-game additions — 2026-09-07

Source: clean supplied game SHA-256 `c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`. No game process, binary or save was changed.

## Runtime additions and evidence

| Area | Runtime | Evidence / validation |
|---|---|---|
| Dungeon Keys, Relic uniques, Rune selection, Infernal upgrade | `craft_rules.js`, `mechanics.js` | `GetDungeonKeys(false)`, `DoCraftResult` cases 4/17/18/20/30; 25 keys, 9 relic outputs, tier 1–20 |
| Equipment Runewords | `runewords.js`, `runeword_rules.js` | 100 definitions: 93 equipment, 7 Codex; 405 native `LoadRunewords` fixture comparisons; lexical stat field ordering |
| Codex modifiers | `codex_effects.js`, `codex_effect_rules.js` | 352 modifier and 180 socket-count native fixtures; 150 integrated Crystal/remove cases |
| Enhanced sockets | `socket_enhancement_rules.js`, `equipment_rules.js`, `socket_stats.js` | Current definition info15–20; 27 item definitions; native multiplier `floor(value * (1 + flag * .5))` |
| Character level | `level_stats.js` | Existing per-level coefficient is unchanged; display evaluates it at `simLevel` 1–100; persistence/tooltip/history tests |

Codex explicit `s=0` suppresses sockets. `n=1001..1006` selects a fixed count. Positive `s` reseeds and yields one plus five independent `<38` checks. Natural Infernal socket checks follow its modifier RNG chain; initial state before that chain is still a simulator convention. Crystal `q=2` adds a socket up to six except when explicit zero suppresses it.

Equipment Runeword recipes require a white base, exact item type/subtype/handedness, count and Rune sequence. The full-sequence shortcut consumes all required Runes as one action; individual insertions produce individual history records. `i` seeds word values, `s1..s6` preserve ordered Rune definitions. Existing base-item stat generation remains sourced from Item Editor; word fixture parity alone is not full item parity.

Native getters/constructor were additionally inspected. Base-info constructor defaults include level1, dimensions1×1, tier2, quality denominator10000 and info34=8. `GetBaseItemStat` returns undefined when absent; `GetBaseItemInfo` accepts a fallback (default −1). These observations have not yet been used to certify complete case captures.

## Unresolved work

`native_item_generation.py` can exercise simple current generation paths but has incomplete repository construction and no populated talent map. Its output is investigative and not a verified whole-item oracle. Normal-affix generation, Angelic augments, talent-dependent special tails, some equipment socket counts remain unresolved. Current Unique/Angelic/Unholy eligibility and tier weighting are now verified; see the additions below. Do not replace existing models with raw case captures or infer a missing value from catalog order.

The website contains compact generated data modules and selected assets, not native binaries, Ghidra projects or emulator dependencies. Web and Python load the same static engine/UI. EXE compilation remains explicitly deferred.


## Continued review after reopening

Current Controller list construction produced six native Unique lists. Case 16 chooses a tier uniformly before rejecting disallowed entries within that tier. Accepted pool sizes are 48, 61, 79, 152, 218 and 203; cases 14/15 use 31 Angelic and 17 Unholy SS entries. BaseItemInfo(40) craft restrictions and the equipment info41 construction guard are enforced. Universal weapons are outside the native weapon loop. Production uses a uniform draw from the accepted pool, which preserves result probabilities; rejected native RNG draws are not reproduced.

All 956 Unique equipment cases now include Axe, Spellblade and Universal. Metadata correction updated 178 catalog rows and three rarity labels. Equipment enhanced-socket definitions total 27. Analysis results preserve weapon subtype rather than merging weapon IDs from different subtypes.

The current base-stat stage uses lexical field order. 408 unchanged static definitions passed 1,224 native stage fixtures, comparing 8,358 visible stat values. Four key221 paths with extra draws remain deferred. Only base draw order is updated here; imported socket and special tails remain distinct. Fallback Item Editor differential coverage is retained independently.

Normal affix captures contain 771 prefixes and 623 suffixes. They are not yet shipped as a complete normal-item generation model. Whole-function LoadCommonItems decompilation timed out; bounded native stage captures continue without running the game.

## Current base value refresh

`capture_base_ranges.py` extends the bounded base-stage capture to changed values when the current and imported stat identities agree. Production now uses 610 definitions, including 161 with changed base values, from `base_stat_rules.js`. All 5,490 fixtures (three seeds, no modifiers / five stars / corruption) pass 37,791 visible value comparisons. Four extra-draw key221 paths and fourteen skill-dependent paths remain deferred, as does one definition containing a stat below key22. No socket20 values are replaced by this refresh. Generated, socket and special tails continue to use their separately identified models.

The star skill-exclusion gate examines the raw level definition: an array or a scalar greater than one consults the excluded-skill list. Fixed level zero/one bypasses it. The previous unconditional exemption was incorrect for, among others, `unique:2:0:65` (skill531, fixed level1). Expanded native scalar fixtures cover five starting levels and now total 5,091 comparisons.

Verification: `npm run verify` passed, including domain-root/subfolder loading, all 2,097 catalog rows and 100,000 worker trials. Static revision `c664e4528b5879d6`, 1,673 files / 8,313,637 bytes; compressed main data 520,743 bytes. Python unit tests and actual hidden WebView2 startup passed (301 recipes, 1,932 selectable items, no overflow or broken images). An isolated copy of the user's profile preserved all eight craft records without recalculating their snapshots. No EXE was compiled.

Socket follow-up: current `DoCraftResult` cases9/10 write `s` and preserve `sh`; the 480-byte `ReCreateItem` wrapper directly calls `CreateItemNew`. The latter also has `zz.sockets` handling at `0x1406f15e9..0x1406f1c56`. Whole-item probes on chest2 still lack verified constructor/normal-path handling and do not establish how the craft's socket override reaches the final count. Those probes are not runtime evidence. Continue at the caller/definition normalization boundary; do not infer current natural counts from raw stat20 alone.

## Socket verification follow-up

`native_equipment_socket_stage.py` now stops at the original `LoadCommonItems`
return. Across all 273 positive-capacity normal equipment cases and seven explicit
socket seeds, 1,911 native stat20 results match production: `s=0` gives zero;
positive `s` gives `1 + CPR(s).irandom(capacity-1)`. Current BaseItemInfo7 capacities
also match every case. This boundary excludes later Crystal, socket-content and
special processing. Missing `s` follows a different natural-generation path and
remains unverified; these results do not certify full normal affix generation.

`native_add_sockets_gate.py` executes the original `DoCraftResult` decision block
from `0x140807345` to `0x140808532`, with fixture-owned input fields and runner
storage. All 1,848 combinations of 14 item types, 11 rarities, info50, absent/zero/
positive `s` and zero/nonzero stat20 match `validateAddSocketsTarget`. Native
rejection conditions are rarity >=6, info50=true, positive `s`, positive stat20,
or a type outside 0/1/2/3/6/11. Native constants at `0x1506935f0`, `0x150693700`
and `0x150693770` are respectively info27, info50 and stat20. The original
comparison helper `0x140227fd0` was also run for rarities 0–10 against six.

This fixes a simulator bug that allowed Add Sockets on Unique/Angelic equipment.
Invalid recipes are dimmed and explain the rarity restriction; rejection leaves
items and ingredients untouched. Existing setup socket controls and frozen craft
history remain available. The below-Satanic native gate is broader than the old
recipe's English "white item" description; normal rarity/affix generation is
still incomplete at this stage of the audit. **Subsequent verification resolved
the info50 producer:** seven normal consumables set it; see
[SOCKET_RESTRICTION_PRODUCER_VERIFICATION.md](SOCKET_RESTRICTION_PRODUCER_VERIFICATION.md).
The simulator now derives `info.socketCraftBlocked` from those native definitions.
Ingredient matching, global modification
guards and craft RNG are not certified by the isolated gate fixtures.

Reproduce with `python research/current/native_equipment_socket_stage.py`,
`python research/current/native_add_sockets_gate.py` and
`node tests/test_current_equipment_sockets.mjs`. Neither capture launches the
game. Both JSON fixture files are excluded from the shipped website.

## Craft mutation verification and correction

`native_craft_cases.py` executes selected original `DoCraftResult` mutation
blocks from the 32-way table at `0x140870048`. The oracle supplies fixture-owned
runner data and controlled native `irandom` returns, then records field writes
and random bounds. It stops at the common continuation before creation and
regeneration. It is not an ingredient matcher or a whole-function game oracle.

All 3,119 native fixtures match `applyRecipe`, including the exact requested
random bounds and draw consumption. Coverage: every 0–99 Dice roll; every 0–99
Crystal roll over five item types and five rarities; every 0–99 star roll at
starting levels 0–4; four seed boundaries for reroll/Blessed Dice/Crystal removal/
Add Sockets; socket deletion and both cleanses. The fixture services supply
`zrm=99` and protected maximum seed `1e9`; this capture does not independently
derive those global constants. The RNG algorithm is still the simulator's
uniform source, not the game's native generator.

This **supersedes the earlier star-threshold interpretation**:

- Case31 rolls 0–7 corrupt and clear stars: **8%**.
- Rolls 8–29 reduce stars, floored at zero: **22%**.
- Rolls 30–99 add one star: **70%**.

Destiny Shard and Gypsy's Prophecy share that mutation branch. The former runtime
had success and corruption reversed; both the engine and displayed probabilities
are corrected. Case3 Satanic Dice draws a new item seed only on success (roll
below62); corruption writes `r=1` and preserves `a`. Case6 Satanic Crystal draws
its `ab` seed before the outcome roll. Production now preserves this order.
The native blocks also write back `sh` without changing its value; the simulator
preserves unrelated definition fields without including that redundant write.

Reproduce: `python research/current/native_craft_cases.py` and
`node tests/test_native_craft_cases.mjs`. The new transaction regression checks
Dice seed preservation, one-material consumption, stat changes from corruption
and immutable history through persistence. Full inventory matching, generation
after mutation, normal rarity/affix selection, natural sockets and special tails
remain outside the new native fixture boundary.

The complete web/Python/UI verification and manual game comparison handoff are
recorded in `../../tests/CRAFT_VERIFICATION_2026-09-07.md`. No EXE was compiled.

The subsequent [Dawn Bringer verification](DAWN_BRINGER_VERIFICATION.md) adds
681 current native base/socket cases and an in-game screenshot comparison for
that item's 4–5 natural sockets. It narrows the natural-socket uncertainty for
this one definition; the other exclusions above still apply.

## September 7–8: all current Unique base/generation/socket definitions

[Current Unique verification](CURRENT_UNIQUE_GENERATION_VERIFICATION.md)
supersedes the one-item natural-socket coverage above. The runtime now covers
all 956 current Unique definitions: 918 static and 38 generated/special models.
Six element/gem-dependent item effects, High Roller and Face of Existence's
empty-allocation ability pool are also implemented with bounded native evidence.
The report records 6,426 static cases, 266 generated cases, 188 isolated special
cases and 42 combined base/Crystal/special pipelines, with remaining exclusions.
Normal affix selection, final damage calculations, some socket transitions,
player-dependent effects and initial Codex generation are still incomplete.
No simulator EXE was compiled.
