# Socket level accumulation and augment scope

Current analysis executable SHA-256:
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.

## Fixed: required level outside completed RuneWords

The catalog omits `lvl` for normal socketable rows. The old tooltip tried to
read that field, so a gem or incomplete Rune sequence did not raise its base
item's displayed level. History also retained only the base level.

The socketable extraction now preserves native info field 1 for all 144
definitions. `makeItem` raises equipment requirements using the active socket
contents after word formation. Inactive saved slots do not count. Replacing
or clearing contents rebuilds the level, and History captures that result.
The base level remains separately available for checking intermediate stages.

`native_socket_level.py` executes original CreateItemNew instructions from
`0x1406f6522` to `0x1406f65ed`, including the native maximum operation. Parent
level and child info storage are fixture-owned. All 576 comparisons (144
socketable definitions at four parent levels) pass. This boundary does not
certify recursive child generation or deserialization.

`tests/test_socket_levels.mjs` also covers actual Rune insertion/Empty Sockets
transactions, gem replacement, tooltip values, immutable History and session
round trips. The earlier full word fixtures end before the socket stage;
their required-level assertion now explicitly checks that intermediate stage.

## Additional static findings

- `GetSocketKeyDecoded.named.c` maps socket indices 1–6 to `s1`–`s6`, returning
  undefined outside that range.
- `GetItemSocketDataStructDecoded.named.c` serializes through
  `json_ordered_by_key`, then Base64. This is the encoding direction; it does
  not close the independent decoding/parser boundary.
- `LoadAngelicAugment` enumerates ability IDs 2000–2062. Direct call candidates
  verified as call instructions are in Angelic Realm Ability creation
  (`0x14a3cf107`) and Journal Augments (`0x14a96f6f9`). The former decompiles to
  a player-facing augment grid/search/ability UI. `ReturnSubAugment` has a
  direct call in `TalentUseClass` (`0x146a3daa8`). These findings support a
  player ability context, not a missing ordinary Cube affix generator.
  Indirect/inlined calls are outside `find_direct_calls.py`'s search, so this
  is not proof that no equipment interaction exists elsewhere.
- No info field 50 setter was found in the captured equipment definitions.
  The Add Sockets gate still preserves its independently verified restriction
  check. Its producer remains unidentified; no guessed producer was added.

## Final verification

- Full `npm run verify` passes: `tests/_output/verify-socket-levels.log`.
- Static root/subfolder loading, all 2,097 item stat builds and 100,000 worker
  trials pass. Final web revision `c9ae349d845c42f7`: 1,689 files, 8,715,387
  bytes. Main data remains 92% smaller when compressed.
- Five Python desktop/CPR checks pass. A fresh isolated Python/WebView2 test
  passes and preserves all 22 existing History entries. Original profile
  bytes remain unchanged, SHA-256
  `2fc338af6028a31abb86ae5fb2c8240e42c58d84a7dcde3a7068ad0fa04f1733`.
  Report: `tests/_output/native-craft-07i9k9r5/desktop.json`.
- Browser controls: opened Short Sword, inserted Zed (required level 69),
  replaced it with Pristine Topaz (level 38), added it to the Cube and reloaded.
  The hover tooltip still displayed level 38. Screenshots inspected:
  `tests/_output/socket-zed-level-69.png`, `socket-level-reloaded.png`.
- Browser viewport and document both 1258 × 622; no broken/pending images
  intersecting the viewport, and no application JavaScript errors. An initial
  QA request used `/ui/` against the static root and returned 404; two leftover
  QA listeners were replaced with one fresh static server on port 17929 before
  the successful browser run. Offscreen lazy images were excluded from the
  loaded-image assertion.
- No simulator EXE or release archive was built; game files/saves were untouched.

The combined new native fixture comparisons in this work total 8,828 across
word matching, special normal qualities, generated names, full word property
chains and socket levels. These are explicit code boundaries, not a claim
that every player-dependent effect or full combat calculation is certified.
