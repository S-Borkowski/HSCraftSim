"""Decode YYC "static switch tables" from a raw Ghidra decompile.

GameMaker's C++ export compiles `switch (x) { case 5: ... }` on RValues into a lazily
initialised static table of {RValue key (16 bytes); int32 caseIndex} entries (stride 0x14),
a linear search comparing `x` against each key, and a C switch on the case index.
The table initialisation is emitted inline as absolute-address stores, e.g.

    *(undefined4 *)0x150cfd5dc = 10;   // kind int64
    *(undefined8 *)0x150cfd5d0 = 1;    // key value
    *(undefined4 *)0x150cfd5e0 = 0;    // case index

This script parses those stores and the `case N:` bodies and prints the mapping
key -> case -> (returned pooled string / constant if recognisable).

usage: extract_static_switch.py <file.c> [strpool.json] [-o out.json]
"""
from __future__ import annotations

import json
import re
import struct
import sys

IMAGE_BASE = 0x140000000


def parse_tables(text: str):
    """Return {table_base: {index: {"key":..., "kind":..., "case":...}}} from absolute stores."""
    stores = {}
    for m in re.finditer(r"\*\((undefined[48]|int|uint|longlong|ulonglong|double) \*\)0x(1[45][0-9a-f]{7}) = (-?0x[0-9a-f]+|-?\d+(?:\.\d+)?(?:e[-+]?\d+)?);", text):
        addr = int(m.group(2), 16)
        val = m.group(3)
        stores[addr] = (m.group(1), val)
    for m in re.finditer(r"([uidlfc])Ram0000000(1[45][0-9a-f]{7}) = (-?0x[0-9a-f]+|-?\d+(?:\.\d+)?(?:e[-+]?\d+)?);", text):
        addr = int(m.group(2), 16)
        kind = {"u": "undefined4", "i": "int", "d": "double", "l": "longlong", "f": "float", "c": "char"}[m.group(1)]
        stores[addr] = (kind, m.group(3))
    # group by table base: an entry starts where a kind (4-byte store at +0xc) exists
    tables = {}
    kinds = sorted(a for a, (t, v) in stores.items() if t == "undefined4" and (a - 0xc) in stores)
    for kaddr in kinds:
        base_entry = kaddr - 0xc
        # find the table base by walking back in 0x14 steps while entries exist
        b = base_entry
        while (b - 0x14) in stores and (b - 0x14 + 0xc) in stores:
            b -= 0x14
        idx = (base_entry - b) // 0x14
        t = tables.setdefault(b, {})
        kind = int(stores[kaddr][1], 0)
        keyt, keyv = stores[base_entry]
        if kind == 0:  # real stored as double bits or as literal
            try:
                key = struct.unpack("<d", struct.pack("<q", int(keyv, 0)))[0] if keyv.startswith(("0x", "-0x")) else float(keyv)
            except Exception:
                key = keyv
        else:
            key = int(keyv, 0) if not keyv.replace(".", "").lstrip("-").isdigit() or "." not in keyv else float(keyv)
        case = stores.get(base_entry + 0x10, (None, None))[1]
        t[idx] = {"key": key, "kind": kind, "case": int(case, 0) if case is not None else None}
    return tables


def parse_cases(text: str):
    """case N: ... -> first pooled RValue address referenced (uRam.../0x15...) or return constant."""
    cases = {}
    for m in re.finditer(r"case (0x[0-9a-f]+|\d+):(.*?)(?=case (?:0x[0-9a-f]+|\d+):|default:|\n\s*\}\n)", text, re.S):
        body = m.group(2)
        n = int(m.group(1), 0)
        pool = re.search(r"uRam0000000(1[45][0-9a-f]{7})", body)
        num = re.search(r"uStack_\w+ = (0x[0-9a-f]{16}|\d+);", body)
        cases[n] = {"pool": int(pool.group(1), 16) if pool else None, "body": body.strip()[:200]}
        if num:
            v = num.group(1)
            if v.startswith("0x") and len(v) == 18:
                cases[n]["double"] = struct.unpack("<d", struct.pack("<Q", int(v, 16)))[0]
    return cases


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    out = sys.argv[sys.argv.index("-o") + 1] if "-o" in sys.argv else None
    if out in args:
        args.remove(out)
    text = open(args[0], encoding="utf-8", errors="replace").read()
    strpool = json.load(open(args[1], encoding="utf-8")) if len(args) > 1 else {}
    tables = parse_tables(text)
    cases = parse_cases(text)
    result = {}
    for base, entries in tables.items():
        rows = []
        for idx in sorted(entries):
            e = entries[idx]
            c = cases.get(e["case"], {})
            s = strpool.get(hex(c["pool"] - IMAGE_BASE)) if c.get("pool") else None
            rows.append({"key": e["key"], "kind": e["kind"], "case": e["case"], "string": s, "double": c.get("double")})
        result[hex(base)] = rows
    if out:
        json.dump(result, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"{out}: {len(result)} tables, {sum(len(v) for v in result.values())} entries")
    else:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        for base, rows in result.items():
            print("table", base, len(rows))
            for r in rows[:400]:
                print(f"  {r['key']!s:>8} -> case {r['case']:>3}  {r['string'] or r['double'] or ''}")


if __name__ == "__main__":
    main()
