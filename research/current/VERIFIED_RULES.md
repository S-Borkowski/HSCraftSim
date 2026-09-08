# Current native item modifiers — 2026-09-07

**Later additions:** [COMPLETION_ADDITIONS.md](COMPLETION_ADDITIONS.md) supersedes the Codex, Runeword, enhanced-socket and missing-recipe limitations below. The original modifier evidence remains valid.

The simulator now applies star bonuses, corruption penalties, Crystal extra
affixes and standard socket contributions to the same item stat list used by
hover, setup, inspector and the static/Python applications. This is a verified
subset of item generation, not a claim of full current-game parity.

## Source identity

The supplied game's clean `Hero_Siege.exe.aurie_backup` SHA-256 is
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.
The installed patched executable observed during this work was
`493dd828b28a20614a96c08a6b969de9464659d96715f51b463e8716f1a9d04b`.
The clean binary was copied into this research directory for read-only analysis.
No game process was launched, game binary modified or save accessed.

These are different from the older `2034…` craft research and `438b…` Item
Editor stat profiles. `currentBuildVerified` remains false in the imported model.

## Native evidence and reproduction

Preferred image base: `0x140000000`. `routines.json`, the decompiles and the Python
extractors in this directory record the source for each rule.

| Function | Address | Evidence |
|---|---|---|
| GetStatUpgrades | `0x14395B740` | 181 stat rules, seven tier multipliers, additive/percentage mode |
| CreateItemCheckGenerationCases | `0x140702240` | Definition-stat corruption, stars, exceptions and rounding |
| LoadRandomSatanicStat | `0x14429A250` | 75 entries across four pools, bounds and charm scaling |
| CreateItemNew | `0x1406EE020` | Crystal reseeding and final socket stat merge |
| DefineItemNormalSocketable | `0x140BC8AB0` | All 144 switch cases captured, 185 scalar stat assignments |
| DefineItemUniqueChests | `0x140E2F050` | Two Angelic chestplate definitions compared with imported profiles |

`native_upgrade_oracle.py`, `native_modifier_oracle.py` and
`native_crystal_oracle.py` execute the original x86-64 routines in Unicorn.
Only runner object/array access, static initialization and controlled RNG inputs
are replaced. The original game branches and arithmetic execute as machine code.
They generated 1,274 table comparisons, 5,091 modifier comparisons and 3,000
Crystal comparisons in `tests/current_*_native.json`.

`native_socket_definitions.py` executes each normal socketable case and captures
its original SetBaseItemStat arguments. Runtime rules are emitted as compact
ES modules; the binary, decompiles, emulator and Python dependencies are excluded
from the website. The two Angelic chestplates (`b=2`, `b=33`) have identical
base-stat definitions in the current binary and imported profiles. This does
not verify their later special/augment/socket-count processing.

## Implemented ordering and rules

- Corruption leaves **25%** of eligible definition values, rounded down; it is
  not a 25% reduction. The 45 exempt stat keys remain unchanged. Corrupted items
  skip star processing even if an imported definition still contains `p>0`.
- Stars use the stat-specific native table, including flat additions and
  percentages. `zpm1` is 0.01. Tiers D/C/B/A use 2/1.75/1.5/1.25; S/SS/SSS use 1.
  Originally integral stats are rounded down. Fractional stats keep fractions.
  Disabled linked skills are preserved when the base level definition is an
  array or a scalar above one. Fixed level zero/one bypasses that skill gate.
  Non-numeric/upgrade-exempt fields are preserved.
- Base definition modifiers precede later generated/special overwrites. The
  imported dynamic stat model still supplies those later outputs.
- A Crystal `q=1` reseeds CPR from `ab` (native fallback 666), then draws group,
  subtype, selector and value. It adds to an existing numeric stat if present.
  Normal charm rarity 1/2 scales the combined value by 0.33/0.66 and rounds up.
  Unique charms do not use those reductions. Pool 5 belongs to Codex handling,
  **not Angelic augments**, and its caller-specific activation is not yet modeled.
- Normal socketables now use the current scalar definitions. Socket contents
  are added after the parent modifiers/Crystal. Each numeric contribution is
  floored individually; metadata/arrays are excluded. Known mapped unique jewels
  continue to use the imported roll model. Unknown payloads produce an explicit
  unresolved warning and are preserved rather than fabricated.

## Validation

`npm run verify` passes the existing craft, session, fragment, random Orb and
Item Editor tests plus the native comparisons and socket integration tests.
The latter cover insertion/removal, multiple Angelic Gems, all star levels used
in the fixture, corruption, Crystal interaction, persistence and malformed
payloads. `python -m unittest tests.test_desktop tests.test_cpr` passes five tests.

The built web package passes domain-root/subfolder URLs, compressed/fallback
data loading, all 2,089 catalog record outputs, mutation-safe caching and 100,000
worker trials. Its main data payload is 520,245 bytes compressed (92.1% reduction).

Browser verification at 1280×720 confirmed St. Jupe's Defense 329 → 368 at three
stars, 82 when corrupted, a seeded Crystal affix of 17% Crushing Blow, and
All Skills 5 → 6 → 5 when inserting/removing Angelic Gem. The page has no document
overflow, the setup dialog fits and visible images load. Native-script comparison
does not substitute for full end-to-end comparison against every game item.

## Later verification

The follow-up in [COMPLETION_ADDITIONS.md](COMPLETION_ADDITIONS.md) supersedes
the earlier progress list below. It records the current loot/base-stat refresh
and 1,911 explicit normal-equipment socket results plus 1,848 native Add Sockets
eligibility decisions. Natural socket generation, full normal affixes and special
tails remain outside those verified boundaries.

The subsequent 3,119 original craft mutation fixtures correct the earlier star
threshold reading: 70% up, 22% down, 8% corruption. Dice corruption preserves the
original item seed; Crystal draws its seed before its outcome. See the same
follow-up for native addresses, fixture services and excluded boundaries.

## Earlier remaining-work list (see follow-up above)

- Angelic augment selection/effects and item-level-dependent special generation.
- Refresh all base profiles, generated/special tails and natural socket chains
  against this exact binary. The two verified chest definitions are a subset.
- Derive enhanced socket flags and item-specific `itemBaseSocketStatStruct`
  overrides. The current standard socket merge assumes the normal multiplier 1;
  special equipment amplification is not yet derived from definitions.
- Replace legacy independent `s` overrides and Add Sockets transformations with
  the exact current crafting/seed changes. Current natural capacity is not
  established merely by the base definition's `stat20` value.
- Current craft thresholds/loot weights, Codex upgrading and the two other
  disabled missing-result recipes need further native mapping.

No EXE or release ZIP was compiled or modified. The existing EXE hash remains
`24ebfef522cb5b5d9dbca5ea82f5455722e271f9fb3fb775e2bc2b2e39f6ae74`.
