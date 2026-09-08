"""Turn the Ghidra decompile of DefineCraftingCombos / DefineProspectCombos into JSON.

The YYC (GameMaker C++ export) code that defines the crafting tables is extremely
regular: every recipe is

    craftComboResult[i] = new s_CraftData(itemType, itemId, chance, isUnique, amount, ...)
    craftComboResult[i].resultType = N          (plain int64, see FUN_1401ce8e0)
    craftComboResult[i].craftName  = "loc_key"  (static string pool, see strpool.json)
    craftComboResult[i].craftDesc  = "loc_key"
    craftComboList[i++] = [ new s_CraftData(...), new s_CraftData(...), ... ]

This script is a tiny "emulator" for the handful of runtime helpers the compiler
emits (RValue copy / const set / array build / struct field set), so the JSON is a
faithful transcription of the game's own table rather than a hand copy.

Inputs : <name>.named.c (ids resolved), <name>.c (raw, keeps string-pool addresses),
         strpool.json ({rva_hex: literal}) from strpool.py
Output : JSON list of recipes.

Constructor contract (gml_Script_s_CraftData, verified from its decompile):
    arg0 itemType, arg1 itemId, arg2 resultChance (default 100),
    arg3 isUnique (default false), arg4 amount (default 1, stored Pilipali-encrypted),
    arg5 tierRequirement, arg6 rarityRequirement,
    resultType = 0, sockets/craftName/craftDesc = undefined,
    allowMultiCraft = false, keepItem = false.
"""
from __future__ import annotations

import json
import re
import sys

IMAGE_BASE = 0x140000000

CTOR_ARGS = ["itemType", "itemId", "resultChance", "isUnique", "amount",
             "tierRequirement", "rarityRequirement"]
CTOR_DEFAULTS = {"resultChance": 100.0, "isUnique": False, "amount": 1.0,
                 "tierRequirement": None, "rarityRequirement": None,
                 "resultType": 0, "sockets": None, "craftName": None, "craftDesc": None,
                 "allowMultiCraft": False, "keepItem": False}

UNDEF = "__undefined__"


class Ref:
    """Reference to a value cell (struct or the global scope)."""

    def __init__(self, target):
        self.target = target

    def __repr__(self):
        return f"Ref({type(self.target).__name__})"


class Func:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Func({self.name})"


TYPES = r"(?:undefined|longlong|ulonglong|int|uint|byte|char|code|short)\d*"
CAST_STACK_RE = re.compile(r"\*\(" + TYPES + r" \*+\)\(&stack0x([0-9a-f]+) \+ lVar\d\)")   # memory slot
CAST_LOCAL_RE = re.compile(r"\*\(" + TYPES + r" \*+\)\(\(?(?:longlong\))?&(\w+) \+ lVar\d\)")  # memory slot (local)
CAST_RE = re.compile(r"\*\(" + TYPES + r" \*+\)")
STACK_ADDR_RE = re.compile(r"&stack0x([0-9a-f]+) \+ lVar\d")            # address value
STACK_IDX_RE = re.compile(r"\(&stack0x([0-9a-f]+)\)\[lVar\d\]")
LOCAL_ADDR_RE = re.compile(r"\(?(?:longlong\))?&(\w+) \+ lVar\d")


def _sname(hexstr: str) -> str:
    return "S" + (hexstr[-4:].lstrip("0") or "0")


def norm(line: str) -> str:
    line = STACK_IDX_RE.sub(lambda m: _sname(m.group(1)), line)
    line = CAST_STACK_RE.sub(lambda m: _sname(m.group(1)), line)
    line = CAST_LOCAL_RE.sub(lambda m: m.group(1), line)
    line = CAST_RE.sub("", line)
    line = STACK_ADDR_RE.sub(lambda m: "&" + _sname(m.group(1)), line)
    line = LOCAL_ADDR_RE.sub(lambda m: "&" + m.group(1), line)
    line = line.replace("(longlong)", "")
    return line.strip()


def const_value(expr: str):
    expr = expr.strip()
    if expr in ("&RV(undefined)", "RV(undefined)"):
        return UNDEF
    m = re.fullmatch(r"&?RV\((true|false)\)", expr)
    if m:
        return m.group(1) == "true"
    m = re.fullmatch(r"&?RV\(i64:(-?\d+)\)", expr)
    if m:
        return int(m.group(1))
    m = re.fullmatch(r"&?RV\(i32:(-?\d+)\)", expr)
    if m:
        return int(m.group(1))
    m = re.fullmatch(r"&?RV\(([-+0-9.e]+)\)", expr)
    if m:
        return float(m.group(1))
    m = re.fullmatch(r'&?RV\("(.*)"\)', expr)
    if m:
        return m.group(1)
    return None


def slot_step(name: str):
    """(prefix, number, direction) so consecutive argv pointers can be enumerated."""
    m = re.fullmatch(r"S([0-9a-f]+)", name)
    if m:
        return "S", int(m.group(1), 16), +8
    m = re.fullmatch(r"(a?pu?Stack_)([0-9a-f]+)", name)
    if m:
        return m.group(1), int(m.group(2), 16), -8
    return None


def next_slot(name: str, k: int) -> str:
    prefix, num, step = slot_step(name)
    val = num + step * k
    if prefix == "S":
        return "S%x" % val
    return "%s%x" % (prefix, val)


class Emulator:
    def __init__(self, strpool: dict, array_fields: tuple[str, ...]):
        self.strpool = strpool
        self.array_fields = array_fields
        self.val: dict[str, object] = {}
        self.ptr: dict[str, str] = {}
        self.last = None
        self.pending_builtin = None
        self.argv_base = None
        self.cur_index = None
        self.arrays: dict[str, dict[int, object]] = {f: {} for f in array_fields}
        self.warnings: list[str] = []
        self.self_ref = Ref("self")
        self.slot_consts: dict[int, tuple[int, object]] = {}   # stack offset -> (seq, value) for array-literal elements
        self.seq = 0

    # -- helpers -----------------------------------------------------------------
    def value_of(self, expr: str, raw_expr: str | None = None):
        expr = expr.strip()
        c = const_value(expr)
        if c is not None:
            if raw_expr is not None:
                m = re.fullmatch(r"0x(1[45][0-9a-f]{7})", raw_expr.strip())
                if m:  # bare absolute address = runtime-initialised static string
                    rva = int(m.group(1), 16) - IMAGE_BASE
                    if hex(rva) in self.strpool:
                        return self.strpool[hex(rva)]
            return c
        if re.fullmatch(r"uVar\d+", expr):
            return self.last
        if expr in self.val:
            return self.val[expr]
        if raw_expr is not None:
            m = re.fullmatch(r"0x(1[45][0-9a-f]{7})", raw_expr.strip())
            if m:
                rva = int(m.group(1), 16) - IMAGE_BASE
                if hex(rva) in self.strpool:
                    return self.strpool[hex(rva)]
                self.warnings.append(f"unknown pool address {raw_expr}")
                return f"<pool {raw_expr}>"
        self.warnings.append(f"unresolved value expr {expr!r}")
        return f"<unresolved {expr}>"

    def argv(self, argc: int):
        base = self.argv_base
        out = []
        for k in range(argc):
            pslot = next_slot(base, k)
            vslot = self.ptr.get(pslot)
            if vslot is None:
                self.warnings.append(f"argv pointer {pslot} unset")
                out.append(f"<argv {pslot}>")
            else:
                out.append(self.val.get(vslot, f"<slot {vslot}>"))
        return out

    # -- statement handlers --------------------------------------------------------
    def stmt(self, named: str, raw: str, lineno: int):
        n = norm(named)
        r = norm(raw)
        if not n or n.startswith(("puStack_8 =", "puStack_30 =")) or "&TX_" in n:
            return
        m = re.fullmatch(r"(\w+) = &(\w+);", n)
        if m:
            lhs, rhs = m.groups()
            self.ptr[lhs] = rhs
            if rhs in self.ptr:  # pointer to a pointer array => argv base
                self.argv_base = rhs
            return
        m = re.fullmatch(r"(\w+) = (auStack_\w+);", n)
        if m:
            self.ptr[m.group(1)] = m.group(2)
            return
        m = re.fullmatch(r"(\w+) = (&?RV\(.*\)|_RV\(.*\)|0x1[45][0-9a-f]{7}|-?\d+);", n)
        if m:  # constant into a stack slot (array-literal elements, argument slots)
            if re.fullmatch(r"-?\d+", m.group(2)):
                self.val[m.group(1)] = int(m.group(2))
                return
            rm = re.fullmatch(r"(\w+) = (.+);", r)
            self.val[m.group(1)] = self.value_of(m.group(2).lstrip("_"), rm.group(2) if rm else None)
            addr = None
            if m.group(1) == "uStackX_20":
                addr = 0x20
            else:
                ms = re.fullmatch(r"S([0-9a-f]{1,4})", m.group(1))
                if ms:
                    addr = int(ms.group(1), 16)
                    if addr > 0x7fff:
                        addr -= 0x10000
            if addr is not None and addr < 0x100:
                self.seq += 1
                self.slot_consts[addr] = (self.seq, self.val[m.group(1)])
            return
        m = re.match(r"uVar\d+ = FUN_14b519170\(&?(\w+),\w+,(0x[0-9a-f]+|\d+),(.+)\);$", n)
        if m:  # array literal: elements in arg slots uStackX_20, S28, S30, ... plus the last call argument
            count = int(m.group(2), 0)
            rm = re.match(r"uVar\d+ = FUN_14b519170\(&?\w+,\w+,(?:0x[0-9a-f]+|\d+),(.+)\);$", r)
            # elements = the (count-1) most recent constant stores to the argument area, ascending by address
            recent = sorted(self.slot_consts.items(), key=lambda kv: -kv[1][0])[: count - 1]
            recent.sort(key=lambda kv: kv[0])
            elems = [v for _, (_, v) in recent]
            if len(elems) != count - 1:
                self.warnings.append(f"line {lineno}: array literal expected {count - 1} elements, found {len(elems)}")
            elems.append(self.value_of(m.group(3).lstrip("_"), rm.group(1) if rm else None))
            self.last = elems
            return
        m = re.fullmatch(r"(\w+) = (uVar\d+|\w+);", n)
        if m and not n.startswith("uStack_"):
            lhs, rhs = m.groups()
            if rhs in ("true", "false"):
                self.val[lhs] = rhs == "true"
            elif re.fullmatch(r"uVar\d+", rhs):
                self.val[lhs] = self.last
            elif rhs in self.val:
                self.val[lhs] = self.val[rhs]
            return
        if "= _ID_@@NewGMLObject@@;" in n:
            self.pending_builtin = "object"
            return
        if "= _ID_@@NewGMLArray@@;" in n:
            self.pending_builtin = "array"
            return
        m = re.match(r"(?:uVar\d+ = )?FUN_1401891d0\(&?(\w+),(.+)\);$", n)
        if m:
            rm = re.match(r"(?:uVar\d+ = )?FUN_1401891d0\(&?(?:[^,]+),(.+)\);$", r)
            self.val[m.group(1)] = self.value_of(m.group(2), rm.group(1) if rm else None)
            return
        m = re.match(r"FUN_140189220\(&?(\w+),(.+)\);$", n)
        if m:
            rm = re.match(r"FUN_140189220\(&?(?:[^,]+),(.+)\);$", r)
            self.val[m.group(1)] = self.value_of(m.group(2), rm.group(1) if rm else None)
            return
        m = re.match(r"FUN_1401ce8e0\(&?(\w+),(0x[0-9a-f]+|-?\d+)\);$", n)
        if m:
            self.val[m.group(1)] = int(m.group(2), 0)
            return
        m = re.match(r"FUN_140189270\(&?(\w+),(-?\d+)\);$", n)
        if m:
            self.val[m.group(1)] = int(m.group(2))
            return
        m = re.match(r"uVar\d+ = func_0x00014018b8a0\(&?(\w+),(-?\d+)\);$", n)
        if m:  # bool RValue constructor
            self.val[m.group(1)] = bool(int(m.group(2)))
            self.last = self.val[m.group(1)]
            return
        m = re.match(r"uVar\d+ = func_0x00014018b8c0\(&?(\w+),ID_gml_Script_(\w+) \| 0x5000000,1\);$", n)
        if m:
            self.last = Func(m.group(2))
            return
        m = re.match(r"func_0x0001401b6480\(&?(\w+),_?RV\(0\)\);$", n)
        if m:
            self.val[m.group(1)] = self.self_ref
            return
        m = re.match(r"uVar\d+ = func_0x00014018b960\(&?(\w+)\);$", n)
        if m:
            v = self.last if re.fullmatch(r"uVar\d+", m.group(1)) else self.val.get(m.group(1))
            self.cur_index = int(v) if isinstance(v, (int, float)) else None
            if self.cur_index is None:
                self.warnings.append(f"line {lineno}: index read from non-numeric slot {m.group(1)}={v!r}")
            return
        m = re.match(r"uVar\d+ = FUN_1401b6490\(&?(\w+),&?(\w+),0\);$", n)
        if m:  # post-increment: tmp = i; i = i + 1; result -> tmp
            i_slot, tmp = m.groups()
            old = self.val.get(i_slot)
            self.val[tmp] = old
            self.val[i_slot] = (old or 0) + 1
            self.last = old
            return
        m = re.match(r"uVar\d+ = FUN_14018c0a0\(&?(\w+),&?(\w+),(-?\d+)\);$", n)
        if m:  # RValue arithmetic helper (sub_18be80 = subtract): dst = src - N
            src = self.val.get(m.group(2))
            n_ = int(m.group(3))
            self.last = (src - n_) if isinstance(src, (int, float)) and not isinstance(src, bool) else f"<{src}-{n_}>"
            self.val[m.group(1)] = self.last
            return
        m = re.match(r"uVar\d+ = FUN_1411fccc0\(&?(\w+),(0x[0-9a-f]+|-?\d+),&?(\w+)\);$", n)
        if m:  # local helper of DefineProspectCombos: dst = int64(c) - i
            c = int(m.group(2), 0)
            i = self.val.get(m.group(3))
            self.last = (c - i) if isinstance(i, (int, float)) and not isinstance(i, bool) else f"<{c}-{i}>"
            self.val[m.group(1)] = self.last
            return
        m = re.match(r"(\w+) = (true|false);$", n)
        if m:
            self.val[m.group(1)] = m.group(2) == "true"
            return
        m = re.match(r"(\w+) = FUN_14018ccc0\(&?(\w+),(-?\d+)\);$", n)
        if m:  # compare helper: c = (x < N)
            x = self.val.get(m.group(2))
            self.val[m.group(1)] = isinstance(x, (int, float)) and x < int(m.group(3))
            return
        m = re.match(r"FUN_14018b980\(&?(\w+)\);$", n)
        if m:  # ++
            x = self.val.get(m.group(1))
            if isinstance(x, (int, float)):
                self.val[m.group(1)] = x + 1
            return
        m = re.match(r"uVar\d+ = FUN_14018cb90\((&?\w+|uVar\d+),(uVar\d+|\d+)\);$", n)
        if m:  # array element access: x[idx]
            base_expr, idx_expr = m.groups()
            base = self.last if re.fullmatch(r"uVar\d+", base_expr) else self.val.get(base_expr.lstrip("&"))
            idx = self.cur_index if re.fullmatch(r"uVar\d+", idx_expr) else int(idx_expr)
            if isinstance(base, dict) and "__ctor" not in base:
                self.last = base.get(idx)
            elif isinstance(base, list):
                self.last = base[idx] if idx is not None and idx < len(base) else None
            else:
                self.warnings.append(f"line {lineno}: index {idx} into {base!r}")
                self.last = None
            return
        m = re.match(r"uVar\d+ = CallBuiltin\((.+)\);$", n)
        if m:
            argc = int(m.group(1).rsplit(",", 1)[1])
            args = self.argv(argc)
            if self.pending_builtin == "object":
                self.last = self.new_object(args, lineno)
            elif self.pending_builtin == "array":
                self.last = list(args)
            else:
                self.warnings.append(f"line {lineno}: CallBuiltin without pending builtin")
                self.last = None
            self.pending_builtin = None
            return
        m = re.match(r"(?:FUN_14b4c08c0|GetVar)\(&?(\w+),ID_(\w+),(\w+),&?(\w+)\);$", n)
        if m:
            src, field, idx, dst = m.groups()
            self.val[dst] = self.get_field(src, field, idx, lineno)
            return
        m = re.match(r"FUN_14b4c0db0\(&?(\w+),ID_(\w+),(\w+),&?(\w+)\);$", n)
        if m:
            dst, field, idx, src = m.groups()
            self.set_field(dst, field, idx, self.val.get(src, f"<slot {src}>"), lineno)
            return

    def new_object(self, args, lineno):
        ctor = args[0]
        if not isinstance(ctor, Func):
            self.warnings.append(f"line {lineno}: object without constructor ref: {ctor!r}")
        obj = {"__ctor": ctor.name if isinstance(ctor, Func) else str(ctor), "__line": lineno}
        obj.update(CTOR_DEFAULTS)
        for k, name in enumerate(CTOR_ARGS):
            if k + 1 < len(args):
                v = args[k + 1]
                if v == UNDEF:
                    continue  # constructor keeps the default for undefined
                obj[name] = v
        for name in ("itemType", "itemId"):
            obj.setdefault(name, None)
            if obj[name] == UNDEF:
                obj[name] = None
        return obj

    def resolve_index(self, idx):
        if idx == "0x80000000":
            return None
        if re.fullmatch(r"uVar\d+", idx):
            return self.cur_index
        return None

    def get_field(self, src, field, idx, lineno):
        holder = self.val.get(src)
        index = self.resolve_index(idx)
        if isinstance(holder, Ref) and field in self.arrays:
            if index is None:
                return self.arrays[field]
            return self.arrays[field].get(index, f"<missing {field}[{index}]>")
        if isinstance(holder, dict):
            return holder.get(field)
        self.warnings.append(f"line {lineno}: get {field} on {holder!r}")
        return None

    def set_field(self, dst, field, idx, value, lineno):
        holder = self.val.get(dst)
        index = self.resolve_index(idx)
        if value == UNDEF:
            value = None
        if isinstance(holder, Ref) and field in self.arrays:
            if index is None:
                self.warnings.append(f"line {lineno}: array set {field} without index")
                return
            if index in self.arrays[field]:
                self.warnings.append(f"line {lineno}: {field}[{index}] overwritten")
            self.arrays[field][index] = value
            return
        if isinstance(holder, dict) and any(holder is arr for arr in self.arrays.values()):
            self.warnings.append(f"line {lineno}: set {field} on whole array (index lost)")
            return
        if isinstance(holder, dict):
            holder[field] = value
            return
        self.warnings.append(f"line {lineno}: set {field} on {holder!r}")


def join_statements(lines):
    """Yield (statement, first_lineno) joining continuation lines of the decompile."""
    buf = []
    start = None
    depth = 0
    for i, line in enumerate(lines, 1):
        s = line.rstrip("\n")
        if not buf:
            if not s.strip():
                continue
            start = i
        buf.append(s.strip())
        depth += s.count("(") - s.count(")")
        if depth <= 0 and (s.rstrip().endswith((";", "{", "}")) or s.strip().startswith(("if", "else", "}", "do", "while"))):
            yield " ".join(buf), start
            buf = []
            depth = 0
    if buf:
        yield " ".join(buf), start


def parse(named_path, raw_path, strpool_path, array_fields):
    strpool = json.load(open(strpool_path, encoding="utf-8"))
    named_lines = open(named_path, encoding="utf-8", errors="replace").read().splitlines()
    raw_lines = open(raw_path, encoding="utf-8", errors="replace").read().splitlines()
    if len(named_lines) != len(raw_lines):
        raise SystemExit(f"line count mismatch {len(named_lines)} vs {len(raw_lines)}")
    em = Emulator(strpool, array_fields)
    named_stmts = list(join_statements(named_lines))
    raw_stmts = list(join_statements(raw_lines))
    if len(named_stmts) != len(raw_stmts):
        raise SystemExit(f"statement count mismatch {len(named_stmts)} vs {len(raw_stmts)}")
    # Structured emulation: the definers are straight-line code except for `for` loops that the
    # compiler renders as  i = 0; bVar = true; while(true){ if(!bVar){i++} bVar=false; c = (i < N); if(!c) break; ... }
    norms = [norm(n) for n, _ in named_stmts]
    match_close = {}
    stack = []
    for i, text in enumerate(norms):
        opens = text.count("{") - text.count("}")
        if text.endswith("{"):
            stack.append(i)
        elif text == "}" or text.startswith("} "):
            if stack:
                match_close[stack.pop()] = i
            if text.startswith("} else") or text.startswith("} while"):
                pass
        elif opens > 0:
            stack.append(i)
    pc = 0
    loops = []
    steps = 0
    while pc < len(named_stmts):
        steps += 1
        if steps > 2_000_000:
            em.warnings.append("emulation step limit hit")
            break
        text = norms[pc]
        (n, ln), (r, _) = named_stmts[pc], raw_stmts[pc]
        if text == "while( true ) {":
            loops.append((pc + 1, match_close.get(pc)))
            pc += 1
            continue
        m = re.fullmatch(r"if \(!(\w+)\) \{", text)
        if m:
            if em.val.get(m.group(1), False):
                pc = match_close.get(pc, pc) + 1
            else:
                pc += 1
            continue
        m = re.fullmatch(r"if \((\w+) == '\\0'\) break;", text)
        if m and loops:
            if not em.val.get(m.group(1), False):
                pc = loops[-1][1] + 1
                loops.pop()
            else:
                pc += 1
            continue
        if loops and pc == loops[-1][1]:
            pc = loops[-1][0]
            continue
        em.stmt(n, r, ln)
        pc += 1
    return em


def strip_private(obj):
    if isinstance(obj, Func):
        return f"<func {obj.name}>"
    if isinstance(obj, Ref):
        return "<ref>"
    if isinstance(obj, dict):
        return {k: strip_private(v) for k, v in obj.items() if not k.startswith("__") or k == "__line"}
    if isinstance(obj, list):
        return [strip_private(v) for v in obj]
    return obj


def main():
    if len(sys.argv) < 6:
        print("usage: parse_define_combos.py named.c raw.c strpool.json out.json RESULT_FIELD,LIST_FIELD")
        sys.exit(2)
    named, raw, pool, out, fields = sys.argv[1:6]
    result_field, list_field = fields.split(",")
    em = parse(named, raw, pool, (result_field, list_field))
    results = em.arrays[result_field]
    lists = em.arrays[list_field]
    indices = sorted(set(results) | set(lists))
    recipes = []
    for i in indices:
        res = results.get(i)
        ing = lists.get(i)
        entry = {"index": i, "result": strip_private(res), "ingredients": strip_private(ing)}
        if res is None or ing is None:
            em.warnings.append(f"recipe {i}: result={res is not None} ingredients={ing is not None}")
        recipes.append(entry)
    json.dump({"source": named.replace("\\", "/").split("/")[-1], "recipe_count": len(recipes),
               "warnings": em.warnings, "recipes": recipes},
              open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{out}: {len(recipes)} recipes, {len(em.warnings)} warnings")
    for w in em.warnings[:25]:
        print("  !", w)


if __name__ == "__main__":
    main()
