# Current socket verification

Source: clean supplied game SHA-256
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.

## Result

- 1,911 native socket-stage outputs across 273 normal equipment definitions
  match simulator capacities and counts for seven explicit socket seeds.
- 1,848 native Add Sockets eligibility decisions match the runtime validation
  helper. This exposed and fixed the previous acceptance of Satanic, Angelic,
  Runeword, Heroic and Unholy equipment.
- Integration checks cover dimmed incompatible recipes, useful rejection
  messages, unchanged ingredients on rejection, valid normal-item crafts,
  repeat-craft rejection, empty/remove/add cycles and preserved weapon identity.
- `npm run verify` passed all suites, syntax checks and the production web tests.
  Static revision: `af92b551eb7ce264`. Main compressed data: 520,743 bytes.
- `python -m unittest tests.test_desktop tests.test_cpr` passed five tests.
- Actual Python/WebView2 startup passed using an isolated copy of the user's
  profile: 301 recipes, viewport/page 1506 x 863, no broken visible images,
  native persistence bridge present. All eight frozen history records remained
  identical after save. Report: `_output/socket-gate-czg1eb3t/desktop.json`.

No game process was started, no original profile or save was changed, and no
EXE or release ZIP was built. Reopen the Python app to load the rebuilt web UI.

## Reproduce

```powershell
python research/current/native_equipment_socket_stage.py
python research/current/native_add_sockets_gate.py
node tests/test_current_equipment_sockets.mjs
npm run verify
python -m unittest tests.test_desktop tests.test_cpr
```

The capture scripts use the original native branch/arithmetic with controlled
runner storage. Fixture files and native research are excluded from the website.
Their boundaries do not cover natural sockets, every special-state/info50
producer, full normal affix generation or the entire crafting pipeline. Actual
in-game end-to-end comparison remains a separate verification step; it has not
been performed in this check.
