# Normal generation state and socket lifecycle

Verified on 2026-09-08 against the supplied executable, SHA-256
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.
Captures run the original x86-64 routines in isolated Unicorn memory with
fixture-owned repository/runner objects. They do not launch or edit the game,
read live player state, or consume player materials.

## Implemented

- All **363 normal equipment definitions**, types 0–8: base stat ranges and
  native tier, default-quality rarity, required level and natural/explicit
  socket counts. The prelude preserves definition RNG order, the white/superior
  branches and nested affix-count decisions. It is not the full affix model.
- Re-roll Affixes / Tinkerer's Toolkit now changes the derived rarity, level
  and natural sockets with the item seed. An explicit socket seed stays fixed.
  Catalog filters, tooltip color, setup and new history snapshots show the
  rolled rarity. Later crafts cannot rewrite an earlier history snapshot.
- Normal generation does not gain a socket from `q=2`. The setup no longer
  offers that impossible Crystal result on these definitions. Imported raw
  fields are preserved, but do not create an extra active slot.
- All **956 Unique equipment definitions** ignore the old normal-equipment
  `s` field when deriving their natural slots. Current rules take precedence
  without destroying the original saved definition or historical snapshots.
- Blacksmith's Mallet requires rarity below Satanic and a positive socket
  count. The catalog and Cube use the same rule. Rejected crafts consume no
  materials. Empty Sockets clears stones while retaining natural Unique slots.
- Recipe candidate filtering rejects unrelated item types before generating
  or searching socket rolls. Native normal tiers also replace the earlier
  catalog tier fallback, correcting star scaling on affected low-tier bases.

## Evidence and validation

| Capture | Cases | Compared boundary |
| --- | ---: | --- |
| `normal-state-probe.json` | 720 | Rarity, required level, sockets and every prelude RNG draw |
| `current_normal_state_native.json` | 5,082 | 363 definitions × 14 states; rarity, level, sockets and 7,644 base values |
| `current_unique_socket_overrides_native.json` | 2,868 | 956 definitions × missing/zero/nonzero legacy `s`; counts and native trace equivalence |
| `current_mallet_gate_native.json` | 88 | Native Mallet eligibility across rarities 0–10 and socket counts 0–7 |

The 14 normal states include different natural rolls, superior branches,
five stars, corruption and Crystal/explicit-socket combinations. Fixtures do
not contain fabricated affix totals. Base values are captured on entry to
LoadCommonItems, after definition modifiers and before random affix application.
Final normal rarity, level and sockets are captured at the current natural
socket boundary in CreateItemNew.

Reproduce captures with plain Python (the research variable initializer file
uses the Windows encoding):

```powershell
python research/current/build_normal_state_rules.py
python research/current/native_normal_state.py
python research/current/native_unique_socket_overrides.py
python research/current/native_mallet_gate.py
node tests/test_normal_state.mjs
node tests/test_socket_lifecycle.mjs
```

`npm run verify` passed, including 23,363 valid recipe/item combinations,
all existing native fixtures, root/subfolder web assets, compressed/fallback
loading and 100,000 worker trials. The five selected Python desktop/CPR tests
passed. No desktop EXE or release ZIP was built.

Actual browser verification: War Sword at seed 57 appeared as Mythic, tier S,
level requirement 67, with three natural sockets. Adding it to the Cube and
using one Toolkit produced its own history record: the earlier Mythic/three
socket snapshot remained intact alongside the resulting Normal/zero socket
item. Hover showed the same values and closed when the pointer left the item.
Screenshots are in `tests/_output/normal-parity-war-sword.png` and
`tests/_output/normal-parity-history.png`.

The Python entry point was checked in its actual WebView2 renderer using an
isolated copy of the user's profile. All 301 recipes and 1,932 selectable items
loaded, no visible images were broken, the desktop bridge saved successfully,
all 22 existing history records were preserved, and the original profile's
bytes were unchanged. Report: `tests/_output/native-craft-kuoel8b_/desktop.json`.

## Still incomplete

**Normal random affix values and generated names are not implemented by this
state model.** Isolated prefix/suffix tables (771/623 entries) are research
material; the complete pool selection and application sequence still needs
porting and independent comparison. Runtime tooltips explicitly state that
affix values are not yet included, and snapshots retain the unresolved flag.

The new normal model covers absent/default `n=1` quality and ordinary repository
definitions, not special drop-quality codes or custom `zz` definitions. Those
continue through the existing unverified fallback. It does not certify final
weapon damage/defense, player-dependent effects, Angelic augments, Face of
Existence with allocated subtalents, inactive socket payload fate, or initial
Codex zone/entry/RNG generation. These limits must not be presented as 100%
game parity.

Final static build: `fcf6f349c73a8879`, 1,683 files, 8,620,742 bytes, 1,609 item images; runtime data 520,743 bytes compressed (92% reduction). Final browser reload at 430×844 had a 430×844 document, no startup notice, no broken visible images and no reported browser errors. Guide text now reflects the current normal/socket coverage; the startup recovery button also uses the dark, readable button palette.
