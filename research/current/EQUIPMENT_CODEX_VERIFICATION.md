# Normal equipment and full Codex generation — 2026-09-08

This update follows JEWELRY_AFFIX_VERIFICATION.md. It implements the remaining
308 ordinary equipment bases, retaining the 55 verified jewelry bases, and
replaces the simulated initial Codex draw order with the current native chain.
It does not certify the entire game simulation.

Source executable SHA-256:
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.
All native execution used fixture-owned Unicorn memory and local research
copies. No live game, character or save file was modified. No simulator EXE or
release ZIP was compiled.

## Normal affixes

All 363 standard normal bases now generate their current rarity, level,
affix identities and values, superior bonuses, stars, corruption and sockets.
This covers weapons, armor, helmets, boots, gloves, shields, belts, rings and
amulets. The runtime table contains all 771 prefix and 623 suffix definitions.
Localized generated prefix/suffix names and forced/special generation modes
(`n` other than absent/1, or `zz`) remain outside this verified path.

Evidence and repeatable extraction:

- `capture_equipment_pools.py`: 600 controlled native paths across six equipment
  types, five tiers, five element selectors and four pool gates.
- `capture_weapon_pools.py`: 500 controlled native paths covering five weapon
  archetype/bonus combinations, five tiers, five elements and four gates.
- `native_normal_affixes.py --types 0,1,2,3,4,6,8 --seeds 2`: 1,848 complete
  generations across all 308 newly supported bases.
- `capture_equipment_modifiers.py`: 880 complete generations across each
  type/subtype/tier shape, superior paths, five stars and corruption.
- `capture_complex_affixes.py`: 462 multi-property/proc/superior cases, including
  existing values and native class/talent selection tables.
- `capture_empty_affix_pools.py`: nine complete generations with exhausted
  prefix/suffix pools; both documented DS-list out-of-range values checked.
- `export_normal_affix_rules.py`: produces `engine/normal_affix_rules.js` and
  the main test fixtures. Do not run the older jewelry-only exporter over it.

The shared pool/selection loop consumes optional draws even where their values
are discarded, builds ordered pools, removes chosen candidates and draws the
next side after the final affix. Weapon archetypes depend on subtype/handedness.
Eligible weapons also consume the native enhanced-damage bonus branch before
building their affix pools. This intrinsic bonus has different modifier timing
from ordinary rolled affixes.

Base properties receive their definition modifiers before affix generation.
Superior properties replay from their original PRNG boundary with the upgraded
range. Multi-property affixes reuse the primary property's upgrade rule in the
native routine, including the resulting integer rounding. Existing values and
the new bounds are modified separately. Class skill/proc selectors and their
otherwise hidden zero-width draws are retained.

### Exhausted pools

Seed stress testing found War Sword seeds 618, 1031 and 2368 could exhaust one
side of the pool. The game still draws with upper bound -1; it does not select
from the other side. The JS engine previously attempted an undefined rule.
It now skips the absent affix while preserving this draw and the next-side draw.

The investigative harness incorrectly used Python negative list indexing.
Its DS-list services now return undefined outside bounds and ignore invalid
deletions. GameMaker documents out-of-range lookup values as possibly undefined
or zero: [ds_list_find_value reference](https://manual.gamemaker.io/monthly/en/GameMaker_Language/GML_Reference/Data_Structures/DS_Lists/ds_list_find_value.htm).
The new capture executes both possibilities. Zero enters Return*Stats(0);
undefined either passes to the prefix default case or is skipped by the suffix
caller. All nine cases produce identical properties and random draws. The
fixtures retain the undefined trace, including the no-op prefix call.

`tests/test_equipment_affixes.mjs` checks 2,737 complete generations, 12,728
properties, 530 superior cases and 462 complex-affix cases against native
results. It also performs ten Toolkit operations on each of a weapon, armor
and shield and verifies immutable before/after history and serialization.
The existing jewelry suite adds 1,980 complete generations and 3,962 isolated
range/modifier cases.

A separate runtime stress run generated 2,000 seeds for each of all 363 bases:
726,000 generations, including 166 exhausted-pool cases, with no missing rules
or non-finite properties. This is a robustness check, not 726,000 native parity
fixtures. Report: `tests/_output/equipment-seed-stress.json`.

## Full Codex initial state

`capture_full_codex.py` executes the original CreateItemNew chain for 170 cases:
both Codex bases, natural and explicit socket seeds, fixed counts, Crystal,
corruption, Essence selectors and tiers. `tests/test_full_codex.mjs` checks the
complete initial draws, zone, entries, pack size, buff/debuff values and sockets.

Initial draws are entry count, variant, one hidden draw and a 45-zone selector,
followed by the Infernal effect path and socket rolls. All 45 ordered room
identities were checked against the supplied data.win ROOM chunk. The harness
uses lossless low-32-bit room-index handles instead of passing the native
64-bit asset reference through a JavaScript-style floating-point value. This
changes only the representation of the selected room, not pool order or RNG.

Eternity naturally rolls up to four sockets; Infernal up to six. Fixed native
overrides remain separate, and a Crystal can increase the resulting capacity.
Explicit socket seed zero remains zero. Initial entries and pack size include
the native corruption reduction. Existing saved zone/entry/socket scenarios
are preserved. New native scenarios recalculate from the item definition when
the seed changes. User-configured zones remain labeled starting scenarios.

The older isolated LoadConsumables fixtures are explicitly tested in isolated
mode; they are not evidence for the full constructor's natural socket capacity
or initial RNG state. Production uses the complete chain.

## UI, Python and web verification

- `npm run verify` passed all mechanics, history, source fixtures, syntax,
  root/subfolder static serving, compressed/fallback data, all 2,097 item stat
  generations, mutation-safe caches and 100,000 worker trials.
- `python -m unittest tests.test_desktop tests.test_cpr`: five tests passed.
- Real HSCraftSim.py/WebView2 startup passed on an isolated profile copy:
  `tests/_output/native-craft-5qjma_18/desktop.json`. All 22 original history
  records were preserved; the live profile stayed byte-identical.
- Original profile SHA-256:
  `2fc338af6028a31abb86ae5fb2c8240e42c58d84a7dcde3a7068ad0fa04f1733`.
- Browser Toolkit operations on a five-star War Sword produced two separate
  records. History showed attack 48→57, physical damage 26→removed, sockets
  1→0 and strength absent→11 for the second operation, with selectable older
  versions after reload.
- Browser page merge created Eternity Codex in the Cube with Corrupted Cave,
  12 entries, pack size 2 and two empty sockets, labeled Game seed roll.
- Hover closed after moving off the item. At 1258×622 and 430×844, document
  dimensions fit the viewport, with no broken visible images or page errors.
- The supplied Fontin Bold and SmallCaps fonts have an empty `ffi` ligature
  glyph. Font-face feature settings now disable those ligatures so names such
  as Re-roll Affixes remain visible without modifying game font files.

Screenshots: `tests/_output/equipment-font-fixed.png`, `codex-native.png`,
`equipment-mobile.png`, plus the earlier Toolkit and history captures.
Final static revision: `93ca8d38f8dd03d1`; 1,685 files / 8,681,589 bytes.
Main data remains 520,743 compressed bytes (92% reduction). Research code and
fixtures are excluded from the publishable website.

## Research boundary at the end of the earlier equipment pass

The following is the earlier checkpoint. Item tooltip arithmetic and Orb-word
bonus rolls have since been implemented and verified in
[ITEM_DISPLAY_ORB_VERIFICATION.md](ITEM_DISPLAY_ORB_VERIFICATION.md).

Previously unverified: final attack/defense tooltip calculations, player-dependent effects,
Angelic augments, special forced normal modes/names, some socket-content
transitions, exact Orb-word bonus rolls and quest-dependent Essence Vault output.
The current Face of Existence context assumes no allocated subtalents.

Bounded damage research produced `LoadWeaponDamage.named.c`,
`StatMinDamage.named.c`, `StatMaxDamage.named.c`, `GetItemStatString.named.c`
and `ItemAttack.named.c`. LoadWeaponDamage is a player combat pipeline and
must not be substituted for an isolated item's tooltip formula.

The item attack/APS block is inside GetItemTooltipString at
`0x143e9c587..0x143e9fdc6`. It reads stats 22/28/31/68, item rarity 27, definition
field w and a surrounding context value at stack offset 0xb558. Its intermediate
attack comparison is at 0x143e9dcf6, APS at 0x143e9f561. Full rendering/context
semantics still need independent native fixtures. GetItemStatString follows at
0x143f49470. No speculative final damage formula was added to the engine.
The first `TooltipDamage.c` fragment starts inside a socketable-name branch and
does not certify attack damage; use the separately bounded ItemAttack fragment.

Large weapon decompilations exceeded their timeout; successful small prelude
blocks and direct native pool captures supplied the implemented weapon rules.
No decompiler remains running.
