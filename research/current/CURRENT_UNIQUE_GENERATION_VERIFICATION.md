# Current Unique equipment generation verification

Captured September 7–8, 2026 from the supplied `HeroSiegeC6E.exe` copy, SHA256
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.
The supplied running game's main menu was previously observed as 7.0.9.0.
The captures execute original machine code in fixture-owned emulator memory;
they do not launch or modify the game, a character, or a save file.

## Implemented coverage

All **956 current Unique equipment definitions** now have a current native
base/generation/natural-socket model. This includes Angelic and Unholy items.
It does **not** mean all final item calculations or all Cube behavior are verified.

| Native evidence | Runtime comparison |
| --- | --- |
| 918 static Unique definitions, 6,426 cases | 54,504 numeric values, exact base draw order and natural socket results |
| 38 generated/special definitions, 266 cases | 2,742 numeric values, generated selections, exact draws and natural socket results |
| Six special element/gem rule sets, 188 cases | Exact special bonuses and draws, including repeated and unmatched gems |
| Six special items, 42 pipeline cases | Original base → modifiers/Crystal → special-stage values |
| High Roller, 84 cases | Threshold totals and bonuses across repository star inputs |
| Original talent population | 817 talent records and 78 constructor defaults |
| Original subskill eligibility calls | All 432 candidate IDs queried; 222 eligible |
| Face of Existence | 39 eligible abilities; seven generation cases in a no-allocated-subtalents context |

The generated models include independently rerolled skill-tree values, duplicate
generated stats added to base values, the late stat-419 eligibility loop, late
class-skill rolls, hidden socket draws, fixed natural counts, and the six-socket
Crystal cap. Star/corruption modifiers apply to the base portion of a combined
base/generated stat, not to its generated portion.

Special effects reseed from the item's `a` seed. Element effects select a whole
stat bundle and roll it in native order. Gem King's Garb and Gem King's Cleaver
apply their bonus for each matching gem; the other captured socket-dependent
items use the first matching gem. Tests also cover the actual base64-encoded
socket payload format and adding/removing gems through the simulator setup API.

## Capture boundaries and runner checks

`native_natural_sockets.py` and `native_dynamic_generation.py` stop at
`0x1406f2936`, following the original natural-socket assignment. The Face capture
uses the same boundary. They do not certify later Crystal, special, child-item
socket, or final tooltip stages.

`native_special_generation.py` executes original `GenerateItemSpecialStats`
at `0x140705cc0` with all five original parameters. The 188 cases use controlled
starting stats and socket contents. `native_special_pipeline.py` executes
`CreateItemInit` and `CreateItemNew` through `0x1406f5280`, immediately after
that special stage, for 42 unfilled-socket cases. Full native pipelines with
socketed child-item generation are not included in those 42 cases.

The harness preserves array RValue payloads and exposes backing array memory
to native inline indexing. Undefined-versus-undefined comparison was corrected
to the original runner's result of zero, with direct runner probes. After the
comparison correction, all 6,426 static fixtures were recaptured with **zero
differences**. A runner audit also reconfirmed 426 Runeword, 352 Codex modifier,
180 Codex socket and 3,000 Crystal cases.

Face of Existence calls the original talent query with a fixture-owned empty
player allocation map. Its 428 measured queries can be reused only for that
same allocation context. The UI explicitly describes this assumption.

## Remaining differences

- Normal equipment rarity/prefix/suffix selection is not ported. Current data
  includes 363 normal definitions and extracted affix tables, but previews
  retain their approximate-generation warning.
- Final displayed weapon damage/defense calculations and player-dependent
  effects, including Angelic augment tails, are not fully certified.
- Older saved Unique definitions with explicit `s` socket overrides still use
  a separately labeled legacy path. Full mutation-to-normalization evidence
  and the fate of stored gems when active socket count changes remain pending.
- Face of Existence with allocated player subtalents is outside this model.
- Initial Codex zone/entry/random-state generation and Essence Vault
  requirements remain outside current verification.
- Native stage fixtures are not an end-to-end live game craft oracle. They
  supply runner storage and controlled inputs; passing them does not certify
  unexecuted branches or every possible seed.

## Reproduction

Research captures require the retained original executable and Python research
dependencies. Run them with normal `python` (the native variable initializer
input uses Windows encoding):

```
python research/current/native_talent_map.py
python research/current/native_subskill_candidates.py
python research/current/native_natural_sockets.py
python research/current/native_dynamic_generation.py
python research/current/native_face_of_existence.py
python research/current/native_special_generation.py
python research/current/native_special_pipeline.py
python tools/build_natural_sockets.py
python tools/build_current_generated.py
python tools/build_special_generation.py
npm run verify
python -m unittest tests.test_desktop tests.test_cpr
python tests/_output/verify_native_craft_desktop.py
```

The Python desktop verification uses an isolated profile copy and compares
history plus the original profile bytes afterwards. None of these commands
compiles an EXE. Do not use desktop release tests or unittest discovery for
this verification: release tests can invoke packaging.

This report supersedes the earlier one-item natural-socket limitation in
`DAWN_BRINGER_VERIFICATION.md` and `COMPLETION_ADDITIONS.md`; their explicitly
unverified later-stage boundaries remain applicable where listed above.
