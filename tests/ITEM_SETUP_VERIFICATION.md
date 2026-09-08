> Superseded in part by [current native verification](../research/current/VERIFIED_RULES.md): stars, corruption, Crystal and standard socket totals are now calculated. The earlier findings below are retained as a dated record.

# Item setup — source/web update, 2026-09-07

No Windows executable or release archive was built for this update. The existing
release files remain the previous version. Rebuild the EXE only after the user
explicitly requests it.

## Implemented and checked

- Real rarity filters and search by name, rarity and equipment type. The supplied
  catalog contains 37 Angelic records, including Tayrel's Chestplate and
  St. Jupe's Plate of Command. `Angelic` + `Armor` returns both. Unnamed placeholder
  records are retained internally but excluded from the player catalog and
  socket selector (1,924 named selectable records).
- Equipment opens a setup dialog before adding. Existing Cube/inventory items
  expose Configure item. Stars & corruption and Sockets are separate, visible
  tabs. Changes apply atomically on Save; Cancel leaves the session untouched.
- Stars 0–5, corruption status, Crystal effect, base sockets, socket contents,
  seed and tier are persisted with the item. Missing profile tiers now fall
  back to the catalog tier, so Angelic SS items no longer default to D.
- Stars are independent of D–SSS tier and required character level. Native Cube
  success increases `p`, failure reduces it with a zero floor, and corruption
  clears it. Five-star items cannot consume another upgrade recipe.
- Normal equipment `w=1` no longer falsely means corrupted. Corruption uses `r`;
  Wisdom clears `r` while preserving unrelated fields.
- Filled sockets use the Item Editor's base64 JSON `s1`… payload format, appear
  in hover previews, survive reload/export/Undo snapshots, and are destroyed by
  Empty Sockets. The recipe consumes two Sal runes and a Perfect gem while
  retaining the equipment's socket count and stars.
- Socket counts can be set for a starting scenario using the existing Cube
  socket-seed model. A separate natural-reroll button uses measured `a` chains
  where available and also rerolls the item's base stats.

## Evidence

`npm run verify` passed: all existing mechanics/transaction tests, 24,117 Item
Editor stat comparisons, 801 socket replays, seven item-setup test groups, static
web root/subfolder loading, compressed/plain data paths and 100,000 worker trials.

Browser verification used the isolated `127.0.0.1:17880` origin:

1. Angelic → Armor showed both chestplates.
2. Added St. Jupe's Plate of Command with 3 stars, 3 sockets, Angelic Gem in slot 1
   and Ol in slot 3. Reopened setup and verified all choices.
3. Opened Empty Sockets from setup, added ingredients, transmuted. All three
   sockets remained and were empty; the item retained 3 stars.
4. Marked the starting scenario corrupted, used the Angel's Wisdom shortcut,
   supplied ingredients and transmuted. Corruption cleared.
5. Reloaded the web package. Both crafts and the item/socket state remained.
6. At 1280 × 720 the document had no vertical overflow; the socket controls and
   Save button fit in the dialog. Hover previews are separate from the page scroll.
7. At 679 × 792, the setup dialog and Save button fit, the document had no vertical overflow, and the user preview retained its original session (history 0).
8. Existing Windows EXE SHA-256 remained `24ebfef522cb5b5d9dbca5ea82f5455722e271f9fb3fb775e2bc2b2e39f6ae74`.

## Remaining model limitations

This is not full current-game stat parity. Star stat multipliers, corruption
penalties, Crystal extra-affix values, Angelic augment effects and combined
equipment/socket totals are not calculated. The UI identifies displayed equipment
values as base rolls and lists socket references separately. Required level is a
catalog property, not an editable character-level scaling control.

Native socket-chain and catalog capacities can disagree (Tayrel's measured
chain capacity is 2 while its catalog reference says 6). The measured Item Editor
chain remains the source for its natural roll; current-build parity is unverified.
