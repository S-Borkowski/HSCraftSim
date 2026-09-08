# Vault, player context and socket restriction verification

Verified on September 8, 2026. No game/save was modified. No simulator EXE or
release archive was built.

## Source identity

Analysis image SHA-256:
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.
Installed `Hero_Siege.exe` SHA-256:
`a886ffcff3c51e0295ff695863c297a27b840333b21563083a1663dc54262e00`.
All eight original PE sections are byte-identical at the same addresses.
The installed file has a different entry point and an additional `.aurie`
loader section. `installed-source-parity.json` records the full comparison;
`tools/verify_native_source.py` repeats it. This certifies the original code
under analysis, not the behavior of any runtime plugins.

## Fixed: Vault selection

`native_vault_craft.py` executes original DoCraftResult case 23 at
`0x14085980f`, stopping at its repository lookup. Random, title and quest
storage are controlled fixture inputs. The native branch decisions execute
unchanged. Each successful threshold makes a NEW `irandom(99)` draw:
50, 40, 30, 20, 10. Passing all five invokes `choose(0,1)` for tiers 5 or 6.
The old simulator reused one draw and could produce only tiers 0–4.

| Vault | Exact probability |
|---|---:|
| Superior | 50% |
| Rare | 30% |
| Mythic | 14% |
| Satanic | 4.8% |
| Heroic | 1.08% |
| Angelic | 0.06% |
| Unholy | 0.06% |

3,060 native fixtures cover every value 0–99 at every threshold, both rare
choices, three quest states and two title states. Quest 1282 progress and
title 2 are updated when appropriate; neither gates the selection.

Seven native definition cases additionally verify tier and grid dimensions.
The game localizes every title as "Essence Vault"; the UI retains that item
title and distinguishes Vaults using their tier, color and outcome labels.
The probability display preserves 0.06% instead of rounding it to 0%.
This boundary verifies creation identity, not subsequent kill-objective
generation, Vault opening/rewards, quest persistence or gameplay progression.

## Verified: Face of Existence skill selection

CreateItemNew queries GetTalentInfo(skill,17,local player), then requires tag
12 (`0x150692220`). `native_player_tags.py` runs original GetTalentInfo and
GetSubTalentInfo for 428 candidates and all 16 masks of augments 11–14:
6,848 queries. Effective ReturnSubTalentLevel results are controlled at 0/1;
the native query tests whether those levels are positive. It does not use
their magnitude in this tag selection.

More than 100 skills change other tags, confirming that the active context
is exercised. Tag-12 membership remains exactly the same 39 candidates for
every mask. The simulator's skill pool therefore matches these contexts;
the obsolete "no allocated subtalents" warning was removed. This does not
certify calculation of a character's effective talent levels, combat damage,
buffs or every other player-dependent effect.

## Fixed and bounded: socket restriction

`native_socket_restriction.py` executes original GetItemInfo
(`0x143e50130`) against controlled field storage, followed by the original
Add Sockets gate (`0x140807345..0x140808532`). Forty fixtures cover missing
and undefined fields, Boolean/numeric values and explicit defaults.

Missing info50 resolves to -1. Only `true` / numeric 1 blocks crafting;
-1 and 2 do not. The simulator now checks equality rather than general
truthiness. Rarity, socket-count and equipment-type guards still apply.
The existing 1,848 native eligibility cases also pass.

**Resolved in the subsequent audit:** `DefineItemNormalConsumable` sets info50
for seven normal consumables. All 27 definitions and 81 native
creation/getter/gate chains are now captured and integrated. See
[the producer verification](SOCKET_RESTRICTION_PRODUCER_VERIFICATION.md) for
the item list, evidence and regression checks. Codex IDs 18 and 23 have no
such flag. The equipment captures had been searching the wrong item family.

## Integration checks

- `npm run verify` passes, including all prior regression suites, all 2,097
  item stat builds, static root/subfolder loading and worker checks.
  Log: `tests/_output/vault-player-verification.log`.
- New regression suites: `test_vault_craft.mjs`, `test_player_context.mjs`.
- Five Python desktop/persistence/CPR tests pass.
- Actual Python/WebView2 source launcher passes with an isolated profile:
  301 recipes, working storage bridge, no missing images/startup notice,
  document and viewport both 1506 × 863. Report:
  `tests/_output/vault-desktop-report.json`.
- Browser: recipe selection → add ingredients → craft → distinct History
  record → probability page → 100,000 worker trials. Seven outcome labels
  and exact theoretical percentages render. No console/runtime errors or
  broken visible images; page and viewport both 1258 × 622.
- Browser trial seed 2294449531: observed rates in tier order were 50.03%,
  29.98%, 13.99%, 4.78%, 1.08%, 0.07%, 0.06%. Statistical agreement supplements
  the deterministic branch fixtures; it does not replace them.
- Web revision `7471c852a6d91564`: 1,691 files, 8,716,772 bytes. Main bundled
  data remains 92% smaller when compressed.
- Original desktop session still has 22 History entries and SHA-256
  `2fc338af6028a31abb86ae5fb2c8240e42c58d84a7dcde3a7068ad0fa04f1733`.

These checks verify the stated native boundaries and fix two actual simulator
differences. They are not a blanket claim of 100% parity with all gameplay.
