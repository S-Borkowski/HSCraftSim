# Resolved: source of the special Add Sockets restriction

Verified September 8, 2026 against the supplied game's original compiled code.
Analysis SHA-256: `c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.
All eight original sections match the installed executable; see
`installed-source-parity.json`. The extra loader and runtime plugins are not
covered by this code comparison. No game/save was modified or simulator EXE built.

## What sets the flag

`DefineItemNormalConsumable` explicitly sets base-info field 50 to numeric 1
for seven of its 27 definitions. The other twenty do not set that field.
The 1,319 captured equipment definitions did not contain the setter because
this producer belongs to the consumable family.

| Normal consumable base ID (type 11) | Item |
|---|---|
| 12 | Edible PAS Logo |
| 14 | Soul of Hatred |
| 15 | Essence Elixir |
| 16 | Essence Elixir (TEST) |
| 17 | Experience Elixir (TEST) |
| 24 | Soul of Infernal Hatred |
| 25 | Tarot Deck |

These IDs are scoped to **normal consumables**, not weapons/armor with the
same base numbers. Eternity Codex (18) and Infernal Codex (23) have no such
flag. Absence of this flag alone does not guarantee recipe eligibility:
rarity, type, existing sockets, corruption and other guards remain in force.

## Native evidence chain

1. `native_consumable_restrictions.py` executes all 27 original definition
   cases, recording their base-info writes. Room names are opaque fixture
   identities used only in Codex room metadata. Shared constructor/prefix
   and localization are outside this capture; no restriction branch is replaced.
2. `native_consumable_socket_chain.py` passes those writes into original
   `CreateItemNew`, from `0x1406ee020` through the base-info copy loop, ending
   at `0x1406ef138` before base stats. Repository lookup and runner storage
   are fixture-owned. String/localization fields are excluded. Field 50 is
   copied by the original code, with presence and value checked explicitly.
3. Original `GetItemInfo` at `0x143e50130` reads that resulting instance.
   Present 1 returns 1; absent returns -1.
4. Original Add Sockets gate at `0x140807345..0x140808532` makes the decision
   with neutral rarity 1, type 11, no socket seed and zero current sockets.
   Seven items fail; twenty pass this isolated gate. This is not a claim
   that every ordinary potion has a usable socket capacity.

There are 81 native chains: all 27 definitions at seeds 1, 123456 and
999999937. All preserve the base flag exactly. The earlier 40 getter/default
fixtures and 1,848 independent gate fixtures cover its equality semantics
and interaction with the other native gate inputs.

## Simulator change

`tools/build_socket_restrictions.py` checks complete metadata and chain
captures before generating `engine/socket_restriction_rules.js`.
`makeItem` derives `info.socketCraftBlocked` from this table for catalog
items, crafted outputs and restored sessions. A rejected consumable now
explains: "This consumable cannot receive sockets."

`tests/test_socket_restrictions.mjs` compares all 81 native results, verifies
session round trips, rejected transactions without material loss, dimmed
recipe state, all catalog families against accidental ID collisions, all
three recipes producing restricted consumables, and successful Add Sockets
crafts on both Codex types. It is included in `npm test` / `npm run verify`.

## Reproduce without launching the game or building an EXE

```text
python research/current/native_consumable_restrictions.py
python research/current/native_consumable_socket_chain.py
python tools/build_socket_restrictions.py
node tests/test_socket_restrictions.mjs
npm run verify
```

This resolves the previously unmapped base-metadata producer for the current
catalog and its Add Sockets targets. It does not assert complete parity for
unrelated gameplay or arbitrary runtime plugin changes.

## Completed integration checks

- `npm run verify`: PASS, including the complete regression suite, all 2,097
  item stat builds, static root/subfolder assets, compressed/fallback loading
  and 100,000 worker trials. Log: `tests/_output/socket-restrictions-verification.log`.
- `python -m unittest tests.test_desktop tests.test_cpr`: five tests PASS.
- Web revision `ae82deff8e439d6c`: 1,692 files, 8,717,348 bytes.
- Browser on the existing source server: catalog search -> add Soul of Hatred
  -> select Add Sockets. The recipe is dimmed, Craft is disabled, and both
  the recipe panel and Cube explain the restriction. No runtime/console
  errors or broken visible images. Screenshot:
  `tests/_output/socket-restriction-rejected.png`. The isolated browser was closed.
- An older preview server on port 17918 returned the HTML but closed asset
  connections; it was not counted as a successful browser check. The source
  server passed; the generated website was checked by `test_web_build.mjs`.
- Original desktop profile SHA-256 remains
  `2fc338af6028a31abb86ae5fb2c8240e42c58d84a7dcde3a7068ad0fa04f1733`.
  Its 22 History records were not changed.
