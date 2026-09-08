# The Dawn Bringer: Dice and natural sockets

Verified on 2026-09-07 against the supplied game binary. No EXE was built and
no game process or save was modified.

## In-game observation

The user's two screenshots are retained in
`../observations/dawn-bringer-2026-09-07/`, with a transcription in
`observation.json`. They show the same SS Angelic weapon changing from five
filled sockets to four after Dice, while both tooltips give a natural range
of 4–5. Additive Lightning Damage changes from 2560 to 2048 and Lightning Skill
Damage from 100 to 80.

Those differences match one current Pristine Topaz: 512 and 20 respectively.
The gem identity is an inference; the screenshots label the contents only as
Gem. They do not establish whether the fifth stored gem is permanently lost.
The later Dice mentioned by the user does not invalidate this earlier pair.
Its resulting screenshot has not been supplied.

## Native boundary and implementation

`native_dawn_sockets.py` executes the original item definition, CreateItemInit,
and CreateItemNew up to the first SetItemStat(20), whose return address is
`0x1406f2936`. Runner storage and CPR services are controlled by the oracle.
The supplied clean binary SHA256 is
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.

For `unique:3:3:18`, the eight ranged base stats roll in lexical key order:
101, 126, 173, 196, 22, 250, 28, 51. Four empty generated slots then consume
eight draws with bounds 2, 4, repeated four times. The natural socket result
is 4 plus the next CPR.irandom(1). Crystal state q=2 adds one socket afterwards.
This is a separate reviewed rule in `engine/natural_socket_rules.js`, adding
one definition to the existing 610 verified static base definitions.

The 681 fixtures cover 32 seeds, seven star/corruption states, and three
Crystal states (672 cases), plus nine investigations of explicit s values.
All captured base values, socket counts and 17 random draws match the runtime.
At this native boundary the natural range is independent of s; the simulator
retains its separate earlier explicit-s override behavior because the complete
craft-to-normalization path has not been certified. Unknown custom zz socket
definitions remain unresolved.

The starting-item editor offers natural counts 4 and 5. Selecting a count
finds an item seed for that count and explains that this rerolls item stats.
Existing explicit overrides are identified separately. Recipe catalog presets
use the natural minimum when they need a socketed starting item.

Dice changes the item seed and can change active socket count in either
direction. Active sockets determine gem totals; the simulator preserves stored
payload fields through Dice, consistent with the separately verified native
mutation block. The fate of an inactive fifth gem through the game's complete
item lifecycle is not certified by these screenshots or this bounded capture.

History now compares each saved snapshot's socket count, including the change
when Changed stats only is selected. Blessed Dice's English description also
explains that natural socket counts and their bonuses can change.

## Validation

- `node tests/test_dawn_sockets.mjs`: all 681 native cases; actual simulation
  transactions through 5 → 4 → 5; active Topaz bonuses; immutable snapshots;
  socket deltas; serialization; starting setup limits and legacy overrides.
- `node tests/test_history_catalog.mjs`: all eight suites, including all
  23,973 accepted recipe/item combinations after the preset adjustment.
- `npm run verify`: full JavaScript, syntax and production package checks
  passed during implementation. After the final setup/preset changes,
  the affected tests and `npm run test:web` passed again.
- Actual browser controls on the built site: imported an isolated fixture,
  applied Blessed Dice once, hovered the item before and after, opened History,
  and checked Changed stats only. Observed 5 → 4 sockets, 2560 → 2048 lightning
  damage and 100 → 80 lightning skill damage. All three differences appear in
  History. No browser page errors were reported. Screenshots are
  `../../tests/_output/dawn-before.png`, `dawn-after.png`, and `dawn-history.png`.
- Actual Python/WebView2 startup passed using an isolated profile copy. All
  eight existing history records survived unchanged; the original profile
  stayed byte-identical. Report:
  `../../tests/_output/native-craft-kuslqqls/desktop.json`.

Production revision: `b4887a44a23722ce`, 1,674 files and 8,318,404 bytes. The main
data payload remains 520,743 compressed bytes (92% reduction).

The screenshots have no item seeds, so their other random stat values are not
exact-state parity fixtures. The game's final Attack Damage range is also a
derived display, while the simulator currently exposes the base damage value.
This work does not certify that formula, later special/talent stages, complete
Crystal affix generation, socket deletion normalization, or all other items'
natural sockets.

Reproduce the capture with `python research/current/native_dawn_sockets.py`.
The fixtures and research files are excluded from the shipped website.
