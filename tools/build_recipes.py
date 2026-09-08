"""Build data/recipes.json (clean, UI-ready) from the raw extracted tables.

Joins recipes_craft_raw.json / recipes_prospect_raw.json with the item catalog and the
English localisation so every ingredient/result carries names, sprite ids and rarity.
"""
from __future__ import annotations

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

TYPE_NAMES = {0: "helmet", 1: "body", 2: "boots", 3: "weapon", 4: "gloves", 5: "amulet", 6: "shield",
              7: "ring", 8: "belt", 10: "charm", 11: "consumable", 12: "key", 13: "tarot", 14: "material",
              15: "socketable", 16: "relic", 18: "potion", 19: "other"}

# resultType -> mechanic id + DoCraftResult switch case (see RESEARCH.md §5)
MECHANICS = {
    0: ("create", 0), 66: ("create", 0), 67: ("create", 0), 68: ("create", 0), 69: ("create", 0), 70: ("create", 0),
    37: ("jewel_tier", 1), 38: ("jewel_tier", 1), 39: ("jewel_tier", 1), 40: ("jewel_tier", 1), 41: ("jewel_tier", 1),
    1: ("reroll_affixes", 2), 18: ("satanic_dice", 3), 53: ("upgrade_codex", 4), 19: ("blessed_dice", 5),
    42: ("satanic_crystal", 6), 77: ("remove_satanic_crystal", 7), 2: ("empty_sockets", 8), 3: ("add_sockets", 9),
    45: ("delete_sockets", 10), 17: ("supreme_elemelon", 11), 34: ("dust_to_fragments", 12), 35: ("dust_to_fragments", 12),
    36: ("dust_to_fragments", 12), 51: ("random_angelic", 14), 52: ("random_unholy", 15), 54: ("random_unique", 16),
    55: ("random_rune", 17), 56: ("random_dungeon_keys", 18), 57: ("random_materials", 19), 58: ("random_relic_unique", 20),
    59: ("random_tarot_10", 21), 60: ("random_orbs", 22), 61: ("random_essence_vault", 23), 63: ("random_tarot_25", 24),
    64: ("random_tarot_25", 24), 65: ("random_pristine_gem", 25), 50: ("mirror", 26), 48: ("cleanse_prophet", 27),
    76: ("cleanse_angel", 28), 75: ("craft_angels_wisdom", 29), 49: ("essence_of_chaos", 30), 47: ("destiny_shard", 31),
    46: ("gypsys_prophecy", 31),
}
for k in range(4, 17):
    MECHANICS.setdefault(k, ("legacy_tier_craft", 13))


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as handle:
        return json.load(handle)


def main():
    catalog = load("items_catalog.json")
    by_addr = {}
    for row in catalog:
        by_addr.setdefault((row["kind"] == "unique", int(row["cls"]), int(row["b"])), row)
    loc = {}
    for stem in ("item", "main", "attributes", "relic", "shop", "market", "ether", "talent", "subtalent", "questitems"):
        path = os.path.join(DATA, "translations", f"{stem}.json")
        if os.path.exists(path):
            for key, entry in json.load(open(path, encoding="utf-8"))["entries"].items():
                loc.setdefault(key, entry)

    def en(key):
        if not key:
            return None
        entry = loc.get(key)
        return entry.get("en") if entry else key

    def item_ref(entry):
        t, i, u = entry.get("itemType"), entry.get("itemId"), bool(entry.get("isUnique"))
        ref = {"itemType": t, "itemId": i, "isUnique": u}
        if isinstance(t, list):
            ref["typeNames"] = [TYPE_NAMES.get(int(x), str(x)) for x in t]
        elif t is not None:
            ref["typeName"] = TYPE_NAMES.get(int(t), str(t))
        if isinstance(i, list) or i is None or isinstance(t, list) or t is None:
            return ref
        row = by_addr.get((u, int(t), int(i)))
        if row:
            ref.update({"name": row["name"], "key": row.get("key"), "rarity": row.get("rar"), "sprite": row.get("spr"),
                        "w": row.get("w"), "h": row.get("h"), "catalogId": row.get("id")})
        return ref

    recipes = []
    for r in load("recipes_craft_raw.json")["recipes"]:
        res = r["result"]
        mech, case = MECHANICS.get(int(res["resultType"]), ("unknown", None))
        result = item_ref(res)
        result.update({"amount": res["amount"], "chance": res["resultChance"], "sockets": res["sockets"],
                       "tierRequirement": res["tierRequirement"], "rarityRequirement": res["rarityRequirement"]})
        ingredients = []
        for g in r["ingredients"]:
            ref = item_ref(g)
            ref.update({"amount": g["amount"], "tierRequirement": g["tierRequirement"],
                        "rarityRequirement": g["rarityRequirement"], "chance": g["resultChance"]})
            ingredients.append(ref)
        name = en(res["craftName"]) if res["craftName"] else (result.get("name") or f"recipe {r['index']}")
        recipes.append({
            "index": r["index"], "resultType": res["resultType"], "mechanic": mech, "switchCase": case,
            "name": name, "nameKey": res["craftName"], "description": en(res["craftDesc"]), "descriptionKey": res["craftDesc"],
            "allowMultiCraft": bool(res["allowMultiCraft"]), "keepItem": bool(res["keepItem"]),
            "ingredients": ingredients, "result": result,
        })

    prospect = []
    for r in load("recipes_prospect_raw.json")["recipes"]:
        ing = r["ingredients"] if isinstance(r["ingredients"], dict) else (r["ingredients"] or [{}])[0]
        outs = r["result"] if isinstance(r["result"], list) else [r["result"]]
        entry = item_ref(ing)
        entry.update({"amount": ing.get("amount"), "tierRequirement": ing.get("tierRequirement"),
                      "rarityRequirement": ing.get("rarityRequirement")})
        results = []
        for o in outs:
            ref = item_ref(o)
            ref.update({"amount": o["amount"], "chance": o["resultChance"], "resultType": o["resultType"],
                        "tier": o["tierRequirement"]})
            results.append(ref)
        prospect.append({"index": r["index"], "input": entry, "results": results})

    out = {"source": "gml_GlobalScript_DefineCraftingCombos / DefineProspectCombos (AnkerGames S10, exe 2034fad4…)",
           "typeNames": TYPE_NAMES, "mechanics": {str(k): v[0] for k, v in MECHANICS.items()},
           "recipes": recipes, "prospect": prospect}
    with open(os.path.join(DATA, "recipes.json"), "w", encoding="utf-8") as handle:
        json.dump(out, handle, ensure_ascii=False, indent=1)
    unresolved = [r["index"] for r in recipes if any("name" not in g and not isinstance(g.get("itemType"), list) and g.get("itemId") is not None and not isinstance(g.get("itemId"), list) for g in r["ingredients"])]
    print(f"recipes.json: {len(recipes)} cube recipes, {len(prospect)} prospect recipes; ingredients without catalog match: {unresolved}")


if __name__ == "__main__":
    main()
