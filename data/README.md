# HS Craft Sim — data assets

**Local data only:** The files described below are no longer tracked in the
maintained public source tree. They remain available in an existing development
workspace. For a fresh checkout, see [LOCAL-DATA.md](../LOCAL-DATA.md). The table
below describes historical provenance; current local file fingerprints are in
`config/local-data-manifest.json`. This documentation grants no distribution rights.

All files are generated from the game binary / shipped CSVs (AnkerGames Season 10 build,
`Hero_Siege.exe` SHA-256 `2034fad4…`) or copied from the verified Item Editor data set.
Regenerate with the scripts in `../tools/` (see `../RESEARCH.md`).

| File | What | Source |
|---|---|---|
| `recipes.json` | 146 cube recipes + 48 prospect recipes, names/descriptions in English, ingredient and result item references resolved against the catalog, `mechanic` id per recipe | `tools/build_recipes.py` ← `recipes_craft_raw.json`, `recipes_prospect_raw.json` |
| `recipes_craft_raw.json` / `recipes_prospect_raw.json` | faithful transcription of `global.craftComboList/craftComboResult` and `prospectItem/prospectResult` (`s_CraftData` fields) | `tools/parse_define_combos.py` on the decompiled definers |
| `items_catalog.json` | 2062 items: `kind` (normal/unique/runeword), `cls` (= crafting itemType), `sub`, `b` (= itemId), `key`, `name`, `rar`, `w`, `h`, `spr`, `stats` [[name, "min-max"]] | Item Editor `hs_full_catalog.json` |
| `icons/<spr>.png` | 1597 item sprites keyed by the catalog `spr` id | Item Editor `item_icons/` |
| `runewords.json` (100), `sets.json` (69) | runeword rune sequences/targets and set definitions | Item Editor |
| `dice_skill_targets.json`, `skill_element_targets.json` | seed targets for skill / element rerolls (dice) | Item Editor |
| `stat_names.json` | stat id → localisation key (149 entries; `data/translations/attributes.json` has the texts) | `tools/extract_static_switch.py` on `ReturnStatName` |
| `stat_pools.json` | generated-stat pools (groups 1–3: stat key, min, max, `keysBySubtype`) and the CPR constants | Item Editor `generated_pool_model.py` |
| `translations/<file>.json` | every shipped `translations*.csv` (11 languages), `craft_en.json` = the 245 `craft_*` keys | `tools/extract_translations.py` |

Item-instance keys used by the mechanics (save JSON `data`): `a` seed, `b` base id, `c` unique flag,
`j` weapon subtype, `i` extra seed, `s` socket seed, `r` corruption (`w` is not a corruption flag), `q` satanic-crystal slam,
`v`/`t` codex modifier flags, `l` augment level, `o` origin/amount flag, `g` equipped group, `h` generated flag.
Derived info keys (`item.GetItemInfo(n)`) are documented in `../research/iteminfo_keys.md`
(27 rarity, 32 tier, 34 weapon type, 21 two-handed, 31 max stack, 9 value).
