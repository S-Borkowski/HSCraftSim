"""Extract Hero Siege translation CSVs into JSON for the craft simulator.

The game ships pipe-delimited CSVs next to Hero_Siege.exe:
    translationsItem.csv, translationsMain.csv, translationsAttributes.csv, ...
Each data row is  key|en|fi|pt|ru|zh|ja|ko|de|fr|sp|pl ; section headers look
like  [Normal Axes]|en|fi|...  and carry the language order for the file.

Output: data/translations/<file-stem>.json  ->  {key: {lang: text}}
        data/translations/craft_en.json     ->  every craft_* key (en only)
"""
from __future__ import annotations

import csv
import io
import json
import os
import sys

BIN = r"C:\Users\falor\Downloads\testhero siege\Latest\Hero-Siege-AnkerGames (1)\HeroSiege\bin"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "translations")
FILES = [
    "translationsItem.csv", "translationsMain.csv", "translationsAttributes.csv",
    "translationsRelic.csv", "translationsShop.csv", "translationsMarket.csv",
    "translationsEther.csv", "translationsTalent.csv", "translationsSubTalent.csv",
    "translationsQuestItems.csv",
]


def read_text(path: str) -> str:
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "utf-16"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1")


def parse(path: str) -> tuple[dict, list[str], list[str]]:
    langs = ["en", "fi", "pt", "ru", "zh", "ja", "ko", "de", "fr", "sp", "pl"]
    table: dict[str, dict[str, str]] = {}
    sections: list[str] = []
    for line in read_text(path).splitlines():
        if not line.strip():
            continue
        cells = line.split("|")
        head = cells[0].strip()
        if head.startswith("[") and head.endswith("]"):
            sections.append(head[1:-1])
            declared = [c.strip() for c in cells[1:] if c.strip()]
            if declared:
                langs = declared
            continue
        key = head
        if not key:
            continue
        entry = {}
        for index, lang in enumerate(langs):
            value = cells[index + 1].strip() if index + 1 < len(cells) else ""
            if value:
                entry[lang] = value
        table[key] = entry
    return table, langs, sections


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    craft_en: dict[str, str] = {}
    summary = []
    for name in FILES:
        path = os.path.join(BIN, name)
        if not os.path.exists(path):
            summary.append(f"{name}: missing")
            continue
        table, langs, sections = parse(path)
        stem = name.replace("translations", "").replace(".csv", "").lower()
        with open(os.path.join(OUT, f"{stem}.json"), "w", encoding="utf-8") as handle:
            json.dump({"source": name, "languages": langs, "sections": sections, "entries": table},
                      handle, ensure_ascii=False, indent=1)
        for key, entry in table.items():
            if key.startswith("craft") and "en" in entry:
                craft_en[key] = entry["en"]
        summary.append(f"{name}: {len(table)} keys, {len(sections)} sections, langs={langs}")
    with open(os.path.join(OUT, "craft_en.json"), "w", encoding="utf-8") as handle:
        json.dump(dict(sorted(craft_en.items())), handle, ensure_ascii=False, indent=1)
    summary.append(f"craft_* english keys: {len(craft_en)}")
    with open(os.path.join(OUT, "_summary.txt"), "w", encoding="utf-8") as handle:
        handle.write("\n".join(summary) + "\n")
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("\n".join(summary))


if __name__ == "__main__":
    main()
