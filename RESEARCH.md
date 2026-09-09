> **Source distribution:** This is a historical research notebook. Referenced raw exports, captured maps/data, game assets and native fixtures are local inputs/outputs, not part of the maintained public source tree. Available tools are described in [the scripts guide](docs/RESEARCH-SCRIPTS.md); see [distribution scope](DISTRIBUTION.md). Old incomplete or contradictory findings are superseded by later verification notes.

> **Current native update:** Star/corruption arithmetic, Crystal stat pools and 144 socketable definitions are now extracted from the supplied clean `c6ecc069…` binary. See [verified rules and limitations](research/current/VERIFIED_RULES.md).

> **2026-09-07 correction:** `w` is not a corruption flag; `r` is. The star-upgrade success branch increments `p`. See [ITEM_STATE_CORRECTIONS.md](research/ITEM_STATE_CORRECTIONS.md). Older contradictory statements below are superseded.

> **v0.3 düzeltmesi:** Aşağıdaki eski `s` seed / soket açıklamaları güncel kabul edilmemelidir. Kullanıcının Item Editor’ındaki 267 ölçülmüş soket zinciri `a` alanından üretilir. Yeni model ve kaynak build ayrımı için README.md ve data/item_profiles.json/editorSource kullanılır.

# HS Craft Sim — research record (Hero Siege Season 10 crafting simulator)

> 2026-09-07 review: This is a historical research record, not an attestation of
> the current game build. The current executable and backup hashes differ from
> the builds cited below. Some conclusions below contradict one another (flags,
> thresholds, prospect count), and the former UI did not apply inventory changes.
> See README.md for the implemented scope and remaining limitations. Current
> exported UI art and source fingerprints are in data/game/manifest.json.

Goal: a "Craft of Exile"-style offline simulator that reproduces Hero Siege's
crafting table (the "cube") 100%: every recipe, every reroll, sockets, satanic
crystal (corruption), augments, dust infusion, runewords, tarot results, and the
item generation model behind them. Engine + data first; UI polish is done later
by ChatGPT, so the UI must be a thin layer over a clean JSON data set and a pure
simulation core.

Build under study: AnkerGames S10 (`Hero_Siege.exe.aurie_backup`, SHA-256
`2034fad4…`, image base 0x140000000). The Item Editor's profile data is bound to
Steam 7.0.5.0 (`438bf484…`). Both are Season 10 code; recipe/table *shapes*
match, exact RVAs do not.

Everything below was extracted statically from the exe (Ghidra headless
decompile + custom annotators), so it does not depend on a running game.

## 1. Status (2026-09-06)

| Piece | State | Where |
|---|---|---|
| Recipe table (146 cube recipes) | **extracted, verified against catalog names** | `data/recipes_craft_raw.json`, readable dump `research/recipes_readable.txt` |
| Prospect table (48 recipes, mining prospecting cube) | extracted | `data/recipes_prospect_raw.json` |
| Localisation (11 languages) | extracted | `data/translations/*.json` (245 `craft_*` keys in `craft_en.json`) |
| Static string pool (33,144 literals) | extracted | `research/decomp/strpool.json` |
| `s_CraftData` constructor contract | verified | §3 |
| Pilipali obfuscation | reverse engineered | §4 |
| `DoCraftResult` (the cube executor, 890 KB decompile after switch recovery) | decompiled + lifted, **mechanics reading in progress** | `research/decomp/docraft2/` |
| Recipe matching (`CraftFindRecipeItems`, `GetCraftItemsAvailable`) | decompiled + lifted, partially read | `research/decomp/craft/` |
| Item instance model (`s_ItemInstanceStruct` + methods) | decompiled + lifted | `research/decomp/item/` |
| Item generation chain (`CreateItemNew`, `GenerateItemRandomStats`, `LoadRandomSatanicStat`, CPR RNG) | decompiled earlier; Python model exists in Item Editor | Item Editor `generated_pool_model.py` |
| Engine (`engine/`: CPR RNG, items, recipes/matching, 32 mechanics) + thin UI (`ui/index.html`) | **working** — `node tests/test_mechanics.mjs` and `python -m unittest tests.test_cpr` pass; browser smoke test OK | `README.md` |
| Runtime constants | `global.zrm` = 99 confirmed; max seed = protected `GetVariable(gDataProtected[192])`, engine uses 1e9 | `engine/mechanics.js` DEFAULT_CONFIG |
| Per-item generated-pool slot config (`itemBaseStatStruct` slots of normal items) | not extracted — stats of normal items beyond their catalog ranges are approximate | Item Editor profiles cover 21 uniques |

## 2. What the game calls things

| Concept | Game name | Where |
|---|---|---|
| Crafting table / cube | **Craft** (`craft*` globals, `UiACraftButton`, `Craft_Cube_obj`) | UI + `DoCraftResult` |
| Recipe tables | `global.craftComboList[i]` (ingredients, array of `s_CraftData`) and `global.craftComboResult[i]` (result, one `s_CraftData`), i = 0..145 | built in `gml_GlobalScript_DefineCraftingCombos` (RVA 0x775f90) |
| Prospect tables | `prospectItem[i]` (one `s_CraftData`), `prospectResult[i]` (array of `s_CraftData` with `tierRequirement` = prospect tier) | `gml_GlobalScript_DefineProspectCombos` (RVA 0x12070b0) |
| Recipe entry | `s_CraftData` struct, see §3 | ctor `gml_Script_s_CraftData` (RVA 0x7755f0) |
| Recipe execution | `DoCraftResult(profileData, recipeIndex, item, itemMap, ?, ?)` — validation chain + 32-way switch on `resultType` | RVA 0x803010, method of `DefineCraftingFuncs` |
| Recipe matching | `CraftFindRecipeItems(ingredients, grid, foundMap, count)`, `GetCraftItemsAvailable`, `CountInventoryItem`, `GetItemFromFingerprint` | `research/decomp/craft/*.lifted.txt` |
| Recipe names | `craftName` / `craftDesc` = loc keys (`translationsItem.csv`), or catalog item name when absent | `GetCraftRecipeName` |
| Obfuscation | `PilipaliEncrypt` / `PilipaliDecrypt` (§4) — only `amount` is stored encrypted | |
| "Corruption" | Satanic Crystal family: `craft_roll_satanic_crystal` (resultType 42), remove (77), cleanse via Prophet's Wisdom (48) / Angel's Wisdom (76); `item_corrupted` flags | |
| Item generation | `CreateItemNew` → `cpr_init(a)` → `GenerateItemRandomStats` → `LoadRandomSatanicStat` → `GenerateItemSpecialStats` → sockets via `s` seed | Item Editor `PERFECT_ROLL_RESEARCH.md` |
| RNG | `cpr_init(seed)`, `cpr_irandom(n)` = floor((n+0.99999)*state/1073741823), state = int(fmod(1789570533*seed+465707, 2^31)) & 0x3FFFFFFF | `generated_pool_model.py` |
| Item instance | `s_ItemInstanceStruct` = { itemDefinitionStruct (save JSON: a,b,c,j,d,e,g,o,…), itemInfoStruct (derived info, numeric-string keys), itemStatStruct (rolled stats), itemType, itemRegion, itemAccount, itemTimeStamp, itemOnlinePending, itemDataHash } with methods `GetItemDef(key)`, `SetItemDef(key,v)`, `GetItemInfo(idx)`, `SetItemInfo(idx,v)`, `GetItemStat(id, dflt)`, `SetItemStat`, `AddStat`, `GetItemStatArray`, `GenerateItemHash` | `research/decomp/item/` |
| Sockets / runewords | `DefineItemNormalSocketable`, `DefineItemRunewords`, `GetRuneword`, `LoadRunewords`, `InventorySocketItem` | Item Editor `hs_runewords.json` |
| Upgrades / augments | `GetStatUpgrades`, `LoadAngelicAugmentFunc`, `ReturnSubAugment`, `GenerateItemHighRoller` | |
| Jewelcrafting | `JewelcraftingAdd`, `GetJewelcraftingLevel`, player stat 157 (`ReturnSpecificStat(mplr,157)`) gates jewel recipes (37..41) at 750/1500/2250/3000/3750 | `DoCraftResult` table A |

Item types (= catalog `cls`): 0 helmet, 1 body, 2 boots, 3 weapon, 4 gloves,
5 amulet, 6 shield, 7 ring, 8 belt, 10 charm, 11 consumable, 12 key, 13 tarot,
14 material, 15 socketable (runes/gems/jewels), 16 relic, 18 potion, 19 other.
Catalog row = (`kind` normal/unique, `cls`, `b`) ⇔ crafting (`isUnique`,
`itemType`, `itemId`). Verified: (14,69) Infernal Codex Page, (11,23) Infernal
Codex, (13,24) The Wheel of Fortune, (15,82) Exan Jewel, (12,8) Angelic Key.

## 3. `s_CraftData` (recipe entry) — constructor contract

`new s_CraftData(itemType, itemId, resultChance=100, isUnique=false, amount=1, tierRequirement, rarityRequirement)`

Fields after construction: `itemType, itemId, resultChance, amount (Pilipali-encrypted), resultType=0, sockets=undefined, isUnique, tierRequirement, rarityRequirement, craftName=undefined, craftDesc=undefined, allowMultiCraft=false, keepItem=false`.
The definer then sets `resultType`, `craftName`, `craftDesc`, `allowMultiCraft`, `keepItem` directly (plain int64 / pooled strings).

Ingredient conventions seen in the table:
- `itemType` may be an **array** of types (e.g. `[1,2,3,4,5,6,7,8,10,18,0]` = any equipment + charm + potion), `itemId` may be `undefined` (any item of that type) or an array of ids (e.g. Sal/Hel recipes accept `[38,44,50,56,68,134,62]` = any Perfect gem).
- `tierRequirement` on an ingredient (Gypsy's Prophecy needs tier ≥ 5 = SS) is compared with `item.GetItemInfo(32)`; `rarityRequirement` with `item.GetItemInfo(27)`.
- `amount` = stack count consumed; `allowMultiCraft` (M) lets the cube repeat the recipe; `keepItem` (K) keeps the equipment.

Result-type histogram (146 recipes): 0 ×89 (plain "make item"), then one each of 1,2,3,17,18,19,34,35,36,42,45..61,63..70,75,76,77 and 37–41 for the 16 jewel recipes.

## 4. Pilipali (anti-cheat obfuscation)

```
E = global.pilipaliEncryptValue           (set at boot)
PilipaliEncrypt(v):  enc = int64(v + E) XOR int64(E); pilipaliHashMap[string(v)] = md5(string(enc) + salt); return enc
PilipaliDecrypt(enc, fallback=39, salt?): v = (enc XOR E) - E; verify md5 against pilipaliHashMap; on mismatch -> fallback
```
Only `s_CraftData.amount` is stored encrypted; `resultType` and everything else is plain. The static tables therefore already contain the plain amounts (the definer passes plain constants to the constructor).

## 5. `DoCraftResult` structure (RVA 0x803010, 442,992 bytes)

Arguments: `arg0` profile/inventory data, `arg1` recipe index, `arg2` item (`s_ItemInstanceStruct`) placed in the cube, `arg3` item map (ds_map fingerprint→item), `arg4/arg5` flags (default 1). Returns a result struct `{edit:{}, remove:[], log_ids:{}, generate_add:[], success…}` that `CraftEditGrid` / `CraftEditPlayerInventory` / `EditItemData` / `InventoryUpdateExt` apply to the inventory.

1. **Validation chain** (first half): for each resultType a precondition on the cube item; failure shows a debug/UI message and jumps to the fail label. Seen: rt1 reroll needs `GetItemInfo(27) < 6`; rt48/76 cleanse need corruption flags (`GetItemDef("v")`, `"t"`); rt46/47 use `itemDefinitionStruct.c`/`.w`; rt18 satanic dice checks `GetItemStat(20)`; rt45 mallet checks `GetItemDef("q")` (sockets?); rt24 `GetItemInfo(50)`; rt4 `GetItemDef("l")`; rt5–14 `GetItemInfo(32)`; rt53 `GetItemDef("b")`; rt15/16 `GetItemInfo(27)`.
2. **Jewel gate** (table A): resultType 37..41 → jewelcrafting level (`ReturnSpecificStat(mplr,157)`) must reach 750/1500/2250/3000/3750.
3. **Dust/elemelon table** (table B): rt 17 → `GetUniqueRepoStruct(10,·,51)` (Supreme Elemelon); rt 34/35/36 → random Destiny Shard Fragment (`GetNormalRepoStruct(14,·,66)`) / Satanic Crystal Fragment (`14,·,60`) counts.
4. **Main dispatch** (table C → 32 cases, jump table at RVA 0x86f1d8 that Ghidra could not recover without `HsSwitchFix.java`):

| case | resultTypes | meaning |
|---|---|---|
| 0 | 0, 66, 67, 68, 69, 70 | plain create of (itemType,itemId,isUnique,amount) |
| 1 | 37–41 | jewel crafts (tiered) |
| 2 | 1 | Re-roll affixes (Tinkerer's Toolkit) |
| 3 | 18 | Satanic Dice |
| 4 | 53 | Upgrade Infernal Codex |
| 5 | 19 | Blessed Dice |
| 6 | 42 | Satanic Crystal |
| 7 | 77 | Remove Satanic Crystal effect |
| 8 | 2 | Empty sockets |
| 9 | 3 | Add sockets |
| 10 | 45 | Blacksmith's Mallet (delete sockets) |
| 11 | 17 | Supreme Elemelon |
| 12 | 34, 35, 36 | dust → random fragments |
| 13 | 4–16 | legacy tier crafts (not in the current table) |
| 14 / 15 | 51 / 52 | Divine Sun → random Angelic, Divine Moon → random Unholy |
| 16–25 | 54, 55, 56, 57, 58, 59, 60, 61, 63+64, 65 | tarot random results (unique, rune, 12 keys, 10 materials, relic unique, 10 tarot, 8 orbs, essence vault, 25 tarot, pristine gem) |
| 26 | 50 | Reflection of Tarethiel (mirror) |
| 27 / 28 | 48 / 76 | Prophet's Wisdom / Angel's Wisdom cleanse |
| 29 | 75 | Angel's Wisdom craft |
| 30 | 49 | Essence of Chaos on codex |
| 31 | 47, 46 | Destiny Shard / Gypsy's Prophecy (level ±, corrupt) |

Case bodies are in `research/decomp/docraft5/DoCraftResult.lifted.txt` (full decompile after the
`JumpTable` override, 28,813 lines). `EDIT` below = `result.edit[itemKey]`, the field changes
`EditItemData` applies to the cube item's definition; `ADDLIST` = `result.generate_add` (new items).

| case | what the code does |
|---|---|
| 0 (create) | repo = `GetNormalRepoStruct(itemType, 0, itemId)` / `GetUniqueRepoStruct(...)` (id from `craft.itemId`, or `arg3` when undefined); `ADDLIST.push(new s_ItemInstanceStruct(repo.itemType, repo.GetBaseItemDef("b"), repo.GetBaseItemDef("j"), true))`, `.itemDefinition.o = 40` when a flag is set (stack amount?) |
| 1 (jewels 37–41) | same as case 0 |
| 2 (reroll affixes) | `EDIT.a = GetItemSeed()` (new seed), `EDIT.sh = item.GetItemDef("sh")` (keep) |
| 3 (satanic dice) | `EDIT.sh` kept; **`EDIT.r = 1`** on the corruption branch (roll), then `EDIT.a = GetItemSeed()` |
| 4 (upgrade codex) | `EDIT.p = {}`(new page struct) / `EDIT.sh` kept |
| 5 (blessed dice) | `EDIT.a = GetItemSeed()`, `EDIT.sh` kept — no downside |
| 6 (satanic crystal) | `EDIT.sh` kept, `EDIT.ab = GetItemSeed()` (crystal affix seed); roll vs threshold → `EDIT.r = 1` (brick) **or** `EDIT.q = 1` (extra affix) **or** `EDIT.q = 2` (extra socket) |
| 7 (remove crystal) | `EDIT.q = 0`, `EDIT.ab = GetItemSeed()` |
| 8 (empty sockets) | `EDIT.unset = [GetSocketKey(i) for i in 1..GetItemStat(20)]`, then `CreateItemNew(item)` |
| 9 (add sockets) | `EDIT.s = irandom_range(1, maxSockets)` (socket seed / count), `EDIT.sh` kept |
| 10 (delete sockets) | `EDIT.s = 0` |
| 0xb (elemelon) | create result (unique charm 51) + `AchievementSet(91,1)` + effect instance |
| 0xc (dust → fragments) | create fragment item(s) from table B (random counts) |
| 0xd (legacy tier) | `EDIT.p = item.GetItemDef("p")` |
| 0xe/0xf/0x10 (divine sun/moon/random unique) | `AwardTitle(2)`; pick from candidate array `GetUniqueRepoStruct(arr[i]...)` |
| 0x11 (random rune) | `GetNormalRepoStruct(15, ·, pick among 4 ids)` |
| 0x12 (12 dungeon keys) | `GetDungeonKeys(false)` → `choose_array` → `GetNormalRepoStruct(12, ·, key)`, `o = 12` |
| 0x13 (10 materials) | `GetNormalRepoStruct(14, ·, random id ≤ 58)`, `o = 10` |
| 0x14 (relic unique) | `GetUniqueRepoStruct(0,0,0)` placeholder + random relic pick |
| 0x15 (10 tarot) | `AwardTitle(2), AwardTitle(12)`; `GetNormalRepoStruct(13, ·, random ≤ 58)`, `o = 10` |
| 0x16 (8 orbs) | `GetNormalRepoStruct(15, ·, random)`, `o = 8` |
| 0x17 (essence vault) | `IsQuestCompleted(1282)` gate; `GetNormalRepoStruct(19, ·, 6)` |
| 0x18 (25 tarot) | `GetNormalRepoStruct(13, ·, random ≤ 6)`, `o = 25` |
| 0x19 (pristine gem) | `GetNormalRepoStruct(15, ·, one of 7 pristine ids)` |
| 0x1a (mirror) | new item with `a = item.a`, **`t = 1`** (mirrored flag), `w`, `q` copied |
| 0x1b/0x1c (cleanse) | clear the bricked flag (`w`) — see lifted text |
| 0x1d (Angel's Wisdom craft) | `GetNormalRepoStruct(14, ·, 70)` |
| 0x1e (essence of chaos) | codex modifier edit |
| 0x1f (destiny shard / gypsy) | level ± / brick roll |
| tail | for each ADDLIST entry: `itemDefinitionStruct.a = GetItemSeed()`, `.o` copied, `CreateItemNew`, `GridAddToStack`/`GridAddItem`/`AddItemToMap`; `generate_add`; `InventoryUpdateExt` |

Item-definition flags learned: `w` bricked, `q` satanic-crystal effect (1 affix / 2 socket / 0 none), `ab` crystal affix seed, `r` corrupted flag (set by dice/crystal/destiny, cleared by Prophet's/Angel's Wisdom), `t` mirrored, `s` socket seed/count, `sh` = kept across edits (shown/identified?), `p` level offset / codex page, `o` stack amount, `u`/`v` codex buff/debuff indices, `unset` = socket keys to clear.

### 5d. Exact rolls (all use `roll = irandom(global.zrm)`, native `irandom`; seeds use `GetItemSeed() = max(1, irandom(GPV(gDataProtected, 1)))`)

| mechanic | roll logic |
|---|---|
| Satanic Dice (rt18) | `roll = irandom(zrm)`; **`roll >= 62` → `r = 1` (corrupted)**; always `a = GetItemSeed()` (new stats) |
| Blessed Dice (rt19) | `a = GetItemSeed()`, nothing else |
| Satanic Crystal (rt42) | thresholds `lo = 0, hi = 50`; if `GetItemInfo(27) >= 6` (unique tier): `lo = 8, hi = 38`; if itemType == 10 (charm): `lo = 0`. `roll < lo` → `q = 2` (extra socket); `lo <= roll < hi` → `q = 1` (extra affix, seed `ab = GetItemSeed()`); `roll >= hi` → `r = 1` (corrupted). |
| Remove Satanic Crystal (rt77) | `q = 0`, `ab = GetItemSeed()` |
| Tinkerer's Toolkit (rt1) | `a = GetItemSeed()` |
| Add Sockets (rt3) | `s = max(1, irandom(protectedMax))` (new socket seed → count = `1 + cpr_irandom(capacity-1)` on load) |
| Blacksmith's Mallet (rt45) | `s = 0` |
| Empty Sockets (rt2) | `unset = [GetSocketKey(1..GetItemStat(20))]` |
| Destiny Shard / Gypsy's Prophecy (rt47/46) | `p0 = IsDefinedDefault(item.p, 0)`; `roll < 8` → `p = p0 - 1`; `8 <= roll < 30` → `p = max(p0 - 1, 0)`; else → `p = 0` and `r = 1` (corrupted). Both arithmetic helpers are the `-=` core (`sub_18be80`), so `p` is a *penalty-style* offset (lower = better); how `p` feeds the level is still to be confirmed in `CreateItemNew`/`LoadItemInfo`. |
| Dust → fragments (rt34/35/36 = lesser/normal/greater) | `first = irandom(zrm)`: `< 25` → Destiny Shard Fragment (14#66) else Satanic Crystal Fragment (14#60); `second = irandom(zrm)`: `< 5` / `< 35` / else → counts shard {8,18,35}/{15,28,50}/{25,40,65}, crystal {5,10,15}/{10,18,25}/{12,25,40} |
| Essence of Chaos (rt49) | `u = irandom(10)`, `v = irandom(7)`, re-rolled while equal to the codex's current stat 376 / 378 values |
| Prophet's / Angel's Wisdom (rt48/76) | `r = 0` |
| Reflection (rt50) | new item: `a` copied, `t = 1`, `w`/`p`/`q`/`ab` copied when present |
| Random rune (rt55) | `choose(200, 201, 202, 203)` (Fawn/Flo/Nju/Jol) or `irandom(36)+1` / `irandom(32)+1` depending on the branch |
| 10× material (rt57) | `switch irandom(3)`: 0 → `irandom(23)+0`, 1 → `irandom(3)+40`, 2 → `irandom(23)+0`, 3 → `irandom(3)+62`; stack `o = 10` |
| 10× / 25× tarot (rt59, 63/64) | `irandom(21) + 19` (arcana 19..40), `o = 10` / `25` |
| 8× orb (rt60) | `irandom(17) + 112` (socketable 112..129), `o = 8` |
| Random unique (rt54) | `irandom(5)` tier → pick from `lootListUnique[5]` list (rejection loop); Divine Sun/Moon keep re-picking until `GetItemInfo(27) == 7` (angelic) / `== 10` (unholy) |
| Relic unique (rt58) | `irandom(8)` → relic pick |
| 12 dungeon keys (rt56) | `choose_array(GetDungeonKeys(false))`, `o = 12` |
| Essence vault (rt61) | tier from thresholds 50/40/30/20 (quest 1282 gate) → `GetNormalRepoStruct(19, ·, tier)` |
| Pristine gem (rt65) | `choose(39, 135, 45, 51, 57, 63, 69)` |

`global.zrm` **= 99** (DefineGlobals, RVA 0x918a06: `FUN_140189270(zrm, 0x63)`), so every roll above is `irandom(99)` and the thresholds are exact percentages. The max seed is `GetVariable(gDataProtected[192])` (protected storage; the dumped array is an identity map, so the value is not in `gjson.json`); Item Editor research says 1..1,000,000,000.

### 5a. Validation messages (cube item preconditions, first half of `DoCraftResult`)

`"Item in craft grid deadzone"`, rt1 `"Can't reroll this item."` (rarity ≥ 6), rt48/76 `"Can't unbrick this item."`,
rt49 `"Already has modifier, is not infernal codex or is satanic"` (`GetItemDef("v")`), rt46 `"Item is already bricked."`
(`itemDefinitionStruct.w`), rt47 `"Item is bricked or lower than SS tier satanic."`, rt18 `"Item has no sockets or is unique."`
(`GetItemStat(20)` = socket count stat), rt45 `"Item doesnt have satanic crystal slam."` (`GetItemDef("q")`), rt42 `"Flask not valid"`,
`"Vault not valid"`, `"Item is not Identified"`, `"Cannot add on rakhuls ritual band"`, rt24 `"Item Already has affix or is bricked."`
(`GetItemInfo(50)`), rt4 `"item is max level or doesnt have an augment"` (`GetItemDef("l")`), rt5–14 `"MAX level or tier doesnt match"`
(`GetItemInfo(32)`), rt53 `"MAX tier codex"` (`GetItemDef("b")`), rt15/16 `"MAX level or rarity doesnt match"`, rt2 `"No sockets to remove!"`,
jewels `"Not enough Jewelcrafting level"`, rt3 `"Can't add sockets to this item."`.
So in the save JSON: `w` = bricked/corrupted, `q` = satanic-crystal slam applied, `v`/`t` = codex modifier flags, `l` = augment level, `h` = 1 on freshly generated results.

### 5b. Helper facts

- `GetUniqueRandomItemID(itemType, weaponType)` / `GetNormalRandomItemID` return `global.itemAmountUnique[type][weaponType] - 1` (or `[type] - 1`): the **highest id** of that class, i.e. the upper bound for a random pick (the roll happens in the caller).
- `item.GetItemInfo(n)` keys are documented in `research/iteminfo_keys.md` (27 rarity, 32 tier, 34 weaponType, 21 two-handed, 31 max stack…).
- Stat ids → loc keys: `data/stat_names.json` (149 entries, from `ReturnStatName`'s static switch table via `tools/extract_static_switch.py`). Stat 20 = socket count (checked as "has sockets").

### 5c. Item generation model (what a reroll must reproduce)

The Item Editor's `generated_pool_model.py` (exported to `data/stat_pools.json`) encodes the verified CPR draw order
for unique items: definition-range draws (one `cpr_irandom(max-min)` per defined stat, key 221 draws its target
identity first), then **4 generated slots** — per slot `draw(2)` group roll, `draw(4)` subtype roll, if the slot's
configured pool is non-zero: pool = configured (or 1+groupRoll when configured = 4), `selector = draw(len(pool)-1)`,
`value = min + draw(max-min)`; then sub-skill rejection loops, the socket tail (`stat 20`), and the special tail
(damage type identity + value). Pools: group 1 (23 entries), 2 (17), 3 (17) with `keysBySubtype` variants.
Normal (non-unique) items use `GenerateItemRandomStats`: stat count = `table[rarity] + cpr_irandom(a) + cpr_irandom(b)`
then `LoadRandomSatanicStat` per stat (nested static switch: rarity table → pool entry 0..22). Decompiles in
`research/decomp/gen/`. Stat 20 = socket count; sockets use the independent `s` seed (see Item Editor
`PERFECT_ROLL_RESEARCH.md`: `1 + cpr_irandom(capacity - 1)`).

## 6. Tooling (all in `tools/`)

- `extract_translations.py` — pipe CSV → JSON.
- `parse_define_combos.py` — emulates the YYC helper calls in the definer decompile → recipe JSON (uses `research/decomp/strpool.json`).
- `lift_yyc.py` — general YYC-decompile → pseudo-GML lifter (helper contract documented in its docstring).
- `outline_docraft.py` — quick branch outline.
- Scratchpad helpers (session b6bde708): `strpool.py` (string pool from static initialisers), `leascan.py`, `fixnames.py`, `condense.py`, Ghidra `HsDecomp.java` + `HsSwitchFix.java` (jump-table override).

YYC helper cheat sheet (verified by disassembly): `FUN_1401891d0` copy, `FUN_140189220` const, `FUN_1401ce8e0` int64, `FUN_140189270/190` real, `func_18b8a0` bool, `FUN_14b519170` array literal, `FUN_14018cb90` index, `GetVar`/`FUN_14b4c0db0` get/set field, `FUN_14b4bd400` call method, `FUN_14024dda0` ==int64, `FUN_1401892e0` ==real, `FUN_140227830` >, `FUN_140227890` >=, `FUN_14018ccc0` <, `FUN_1401892c0` ==, `FUN_14018b980` ++, `FUN_14b4bcca0` YYCreateString (string pool init stubs).

## 7. Data that already exists (Item Editor, reuse as-is)

`C:\Users\falor\OneDrive\Belgeler\Hero Siege\source\HSItemEditor\`: `hs_full_catalog.json` (2062 rows), `hs_perfect_roll_profiles.json`, `hs_runewords.json` (100), `hs_sets.json` (69), `hs_dice_skill_targets.json`, `hs_skill_element_targets.json`, `item_icons/` (1597 PNG by sprite id), `generated_pool_model.py`, `roll_profile_db.py`.

## 8. Still to extract

1. Read the 32 `DoCraftResult` cases → per-mechanic spec (rolls, chances, corruption outcomes).
2. Item-info index map (`GetItemInfo(27)` rarity, `(32)` tier, `(46)`, `(50)`, `(157)`…) from `s_SetItemInfo` / `CreateItemNew`.
3. Random item pickers: `GetNormalRandomItemID`, `GetUniqueRandomItemID`, `DropUniqueItems`, `ReturnRandomSatanic` (batch 3 decompile).
4. Socketable definitions (`DefineItemNormalSocketable`), prospect executor (`UiAProspectButton`, `Prospect_Cube` anon@320), jewelcrafting (`JewelcraftingAdd`).
5. Satanic stat table / affix count rules (already decompiled in scratchpad `maxroll/`), upgrades (`GetStatUpgrades`).

## 9. Architecture (proposal)

- `data/` — generated JSON: `recipes.json`, `items.json` (from catalog), `stat_names.json`, `satanic_stats.json`, `socketables.json`, `runewords.json`, `sets.json`, `translations/<lang>.json`, `icons/`.
- `engine/` — pure JS (and a Python twin for tests): CPR RNG, item model, generation chain, recipe application. Deterministic given (recipe, inputs, seed).
- `ui/` — static HTML/JS app (no server): item picker, cube grid, result panel, probability panel (Monte Carlo over seeds), history. ChatGPT restyles this layer.
- `tools/` — extractors with the exe SHA recorded in every output.
