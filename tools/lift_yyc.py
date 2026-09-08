"""Lift a fixnames-annotated Ghidra decompile of a YYC (GameMaker C++) script into pseudo-GML.

usage: lift_yyc.py <name>.named.c [<name>.c] [strpool.json] [-o out.txt]

The YYC runtime helpers used by Hero Siege's compiled scripts are extremely regular.
This lifter recognises the common ones and prints one readable line per meaningful
statement, keeping the original line number so the raw decompile can be consulted.
The raw (un-annotated) decompile is only needed to resolve runtime-initialised string
constants (bare 0x15........ pool addresses -> strpool.json literals).

Helper contract (verified by disassembly, see RESEARCH.md):
    FUN_1401891d0(&dst, src)        dst = src            (RValue copy)
    FUN_140189220(&dst, RV(c))      dst = c              (double / bool / int64 const)
    FUN_140189270(&dst, n)          dst = real(n)
    FUN_140189190(&dst, n)          dst = real(n)        (no free)
    FUN_1401ce8e0(&dst, n)          dst = int64(n)
    func_0x00014018b8a0(&dst, b)    dst = bool(b)
    func_0x0001401b6480(&dst, p)    dst = objref(p)      (self / global scope)
    FUN_14b519170(&dst, self, n, last)  dst = [slot20, S28, S30 ... , last]  (array literal)
    FUN_14018cb90(x, i)             x[i]
    GetVar(x, ID_f, idx, &dst)      dst = x.f  / x.f[idx]
    FUN_14b4c0db0(x, ID_f, idx, &v) x.f = v    / x.f[idx] = v
    func_0x000140188ee0(scope, ID_f)  scope.f (global / self variable reference)
    FUN_1401bb9d0(x)                object pointer of x (method receiver)
    FUN_14b4bd400(m, other, &res, argc)  res = m(args)   args pointer array at S28
    CallBuiltin(self, other, &res, argc) res = <pending builtin>(args)
    Name(self, other, &res, argc, argv)   res = Name(args)          (direct GML script call)
    FUN_14024dda0(x, n)   x == n (int64)      FUN_1401892e0(x, n)  x == n (real)
    FUN_140227830(x, n)   x > n               FUN_140227890(x, n)  x >= n
    FUN_14018ccc0(x, n)   x < n               FUN_1401892c0(a, b)  a == b
    Compare(a, b, mode, flag)   a <cmp> b     Truthy(x) -> bool(x)  SetBool(&dst, b)
    ADD/SUB/MUL/DIV(&a, b)      a op= b
"""
from __future__ import annotations

import json
import re
import sys

IMAGE_BASE = 0x140000000
TYPES = r"(?:undefined|longlong|ulonglong|int|uint|byte|char|code|short|bool)\d*"
CAST_STACK_RE = re.compile(r"\*\(" + TYPES + r" \*+\)\(&stack0x0*([0-9a-f]+) \+ lVar\d\)")
CAST_LOCAL_RE = re.compile(r"\*\(" + TYPES + r" \*+\)\(\(?(?:longlong\))?&(\w+) \+ lVar\d\)")
CAST_RE = re.compile(r"\*\(" + TYPES + r" \*+\)")
STACK_ADDR_RE = re.compile(r"&stack0x0*([0-9a-f]+) \+ lVar\d")
STACK_IDX_RE = re.compile(r"\(&stack0x0*([0-9a-f]+)\)\[lVar\d\]")
LOCAL_ADDR_RE = re.compile(r"\(?(?:longlong\))?&(\w+) \+ lVar\d")

PURE = {"is_undefined", "is_array", "is_string", "is_real", "is_struct", "string", "real", "floor", "ceil",
        "round", "abs", "min", "max", "irandom", "random", "irandom_range", "random_range", "choose",
        "array_length", "struct_get_from_hash", "variable_struct_get", "variable_struct_exists",
        "ds_map_find_value", "ds_map_exists", "ds_list_find_value", "ds_list_size", "ds_map_size",
        "array_contains", "string_length", "string_copy", "string_upper", "string_lower", "int64",
        "sqrt", "power", "clamp", "lerp", "sign", "frac", "variable_struct_names_count",
        "variable_struct_get_names", "ds_map_keys_to_array", "json_stringify", "json_parse",
        "md5_string_utf8", "array_get", "@@array_get@@", "instance_exists", "room_get_name",
        "struct_exists", "is_method", "typeof", "array_create", "sha1_string_utf8", "ToInt"}


def norm(line: str) -> str:
    line = STACK_IDX_RE.sub(lambda m: "S" + m.group(1), line)
    line = CAST_STACK_RE.sub(lambda m: "S" + m.group(1), line)
    line = CAST_LOCAL_RE.sub(lambda m: m.group(1), line)
    line = CAST_RE.sub("", line)
    line = STACK_ADDR_RE.sub(lambda m: "&S" + m.group(1), line)
    line = LOCAL_ADDR_RE.sub(lambda m: "&" + m.group(1), line)
    line = line.replace("(longlong)", "").replace("func_0x000140658400", "ShowDebug")
    line = re.sub(r"\((?:undefined|int|uint|byte|char|code|double|longlong|ulonglong|short|bool)\d* ?\**\) ?(?=[\w*&(])", "", line)
    line = re.sub(r"\s+", " ", line)
    line = re.sub(r"\s+([,;)])", r"\1", line)
    line = re.sub(r"\(\s+", "(", line)
    return line.strip()


def join_statements(lines):
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
        if depth <= 0 and (s.rstrip().endswith((";", "{", "}", ":")) or s.strip().startswith(("if", "else", "}", "do", "while", "code_", "switch", "case", "default"))):
            yield " ".join(buf), start
            buf = []
            depth = 0
    if buf:
        yield " ".join(buf), start


SKIP_RE = re.compile(
    r"^(puStack_8 = |puStack_30 = |uStack_8 = TX_|FREE\(|COPY\(|COPYref\(|RVdtor|LocalsInit|LocalsFree|"
    r"S40 = 0x|S40 = \d+;|S\w+ = S\w+ & 0x1f;|S\w+ = 1;$|if \(\(S\w+ << |S\w+ = 0;$|"
    r"\*S\w+ = 0;$|\(S\w+ \+ 8\) = 0;$|\(S\w+ \+ 0xc\) = 5;$|S\w+ = \(S\w+ \+ 0xc\);|"
    r"func_0x000140189170|func_0x000140189190\(&S\w+,0\);|"
    r"\(&stack0x\w+\)\[lVar\d\] = [01];$|uStack_\w+ = 0x[0-9a-f]+;$|uStack_\w+ = \d+;$|"
    r"FUN_14b4ba590\(|func_0x00014b4ba4e0\(|_RV\(0\) = |lStackX_20 = RVdtor|"
    r"\(S\w+\)\[lVar\d\] = [01];$|S\w+ = lVar5;|"
    r"S\w+ = \(S\w+ \| \d+\);|S\w+ = \(S\w+ & 0x[0-9a-f]+\);|"
    r"func_0x000140188e90\(|func_0x000140188eb0\(|S\w+ = &S\w+ \+ |"
    r"lStackX_20\._0_4_|lVar5 = |uVar4 = S8d48;|S6c98 = uVar4;|S8d48 = Sac0;|S8d50 = Sac8;|"
    r"uVar4 = 6;|S\w+ = S8d48;|S\w+ = S8d50;|S\w+ = 0x[0-9a-f]+;$|"
    r"\w+ = \w+\._4_4_;|\w+ = \(\w+ \+ (?:1|4|0xc)\);|\w+ = \w+\[[123]\];|\w+ = RV\([^)]*\)\.f[48];|"
    r"\w+ = \w+\._4_4_ \| |\w+ = CONCAT44\(\w+\._4_4_,|\w+ = \w+ \| 0x[0-9a-f]+;|\w+ = \w+ & 0xffffff;|"
    r"\(\w+ \+ 0xc\) = |\(\w+ \+ 8\) = |\(\w+ \+ 1\) = |\*\w+ = 0;$|\w+\[\d\] = |auStack_\w+\[0\] = \d+;|"
    r"\(\*\(\w+ \+ 0x58\) \+ 0x14\)|FUN_14b8f64f0\(|FUN_14b8f6490\(|FUN_14b8f6978\(|FUN_1401bd300\(|func_0x00014b4d1fa0\()"
)


class Lifter:
    def __init__(self, strpool=None):
        self.strpool = strpool or {}
        self.val: dict[str, str] = {}
        self.ptr: dict[str, str] = {}
        self.last = "?"
        self.pending_builtin = None
        self.argv_base = None
        self.method_slot = None
        self.alias: dict[str, str] = {}   # pointer variable -> pointer array it points at
        self.argsptr = "S8d50"      # name of the argument-pointer local (args[k] = *(argsptr + 8k))
        self.argcname = "S8d48"
        self.out: list[tuple[int, str]] = []

    def emit(self, ln, text):
        self.out.append((ln, text))

    def strconst(self, raw_expr):
        if raw_expr is None:
            return None
        m = re.fullmatch(r"&?(0x1[45][0-9a-f]{7})", raw_expr.strip())
        if not m:
            return None
        key = hex(int(m.group(1), 16) - IMAGE_BASE)
        if key in self.strpool:
            return '"' + self.strpool[key] + '"'
        return None

    def expr(self, e: str, raw: str | None = None) -> str:
        e = e.strip()
        s = self.strconst(raw)
        if s is not None:
            return s
        if e.startswith("&"):
            e = e[1:]
        if e in self.val:
            return self.val[e]
        if re.fullmatch(r"uVar\d+", e):
            return self.last
        if e in self.ptr:
            tgt = self.ptr[e]
            return self.val.get(tgt, tgt)
        m = re.fullmatch(r"RV\(i64:(-?\d+)\)", e)
        if m:
            return m.group(1)
        m = re.fullmatch(r"RV\(i32:(-?\d+)\)", e)
        if m:
            return m.group(1)
        m = re.fullmatch(r"_?RV\((.*)\)", e)
        if m:
            inner = m.group(1)
            if inner == "0":
                return "RV0"
            if re.fullmatch(r"-?\d+\.0", inner):
                return inner[:-2]
            return inner
        m = re.fullmatch(r"\((\w+) \+ (0x[0-9a-f]+|\d+)\)", e)
        if m and m.group(1) == self.argsptr:
            return f"arg{int(m.group(2), 0)//8}"
        m = re.fullmatch(r"(\w+)\[(\d+)\]", e)
        if m and m.group(1) == self.argsptr:
            return f"arg{int(m.group(2))}"
        if e == "*" + self.argsptr:
            return "arg0"
        m = re.fullmatch(r"CONCAT44\(\w+,_?ID_(\w+)\)", e)
        if m:
            return "ID:" + m.group(1)
        m = re.fullmatch(r"CONCAT44\((?:_?RV\(([^)]*)\)\.f4|RV\(0\)),_?RV\(([^)]*)\)\)", e)
        if m:
            return self.expr("RV(" + m.group(2) + ")")
        return e

    def argv(self, argc, base=None):
        base = base or self.argv_base
        args = []
        if base is None:
            return [f"?arg{k}" for k in range(argc)]
        seen = set()
        while base in self.alias and base not in seen:
            seen.add(base)
            base = self.alias[base]
        m = re.fullmatch(r"S([0-9a-f]+)", base)
        m2 = re.fullmatch(r"(puStack_|ppuStack_)([0-9a-f]+)", base)
        m3 = re.fullmatch(r"apuStack_\w+", base)
        for k in range(argc):
            if m:
                pslot = "S%x" % (int(m.group(1), 16) + 8 * k)
            elif m2:
                pslot = "%s%x" % (m2.group(1), int(m2.group(2), 16) - 8 * k)
            elif m3:
                pslot = f"{base}[{k}]"
            else:
                pslot = base if k == 0 else f"{base}+{8*k}"
            vslot = self.ptr.get(pslot)
            if vslot is None:
                args.append(f"?{pslot}")
            else:
                args.append(self.val.get(vslot, vslot))
        return args

    def raw_operand(self, r: str, pattern: str):
        if r is None:
            return None
        m = re.search(pattern, r)
        return m.group(1) if m else None

    def stmt(self, s: str, r: str | None, ln: int):
        n = norm(s)
        rn = norm(r) if r is not None else None
        if not n or "&TX_" in n or SKIP_RE.match(n):
            return
        mlhs = re.match(r"(uVar\d+|puVar\d+|pcVar\d+|plVar\d+|iVar\d+|cVar\d+|bVar\d+|lVar\d+|dVar\d+) = ", n)
        lhs = mlhs.group(1) if mlhs else None
        prev = self.last
        self._stmt(n, rn, ln)
        if lhs and self.last is not prev:
            # a producer statement assigned to a temporary: remember the value under its name
            self.val[lhs] = self.last

    def _stmt(self, n: str, rn: str | None, ln: int):
        m = re.match(r"FUN_1401bd1c0\(&?(\w+),", n)
        if m:  # argument normalisation helper: FUN_1401bd1c0(&argc_slot, argc, min, argv)
            a = m.group(1)
            self.argcname = a
            mm = re.fullmatch(r"aiStack_([0-9a-f]+)", a)
            if mm:
                self.argsptr = "puStack_%x" % (int(mm.group(1), 16) - 8)
            # S-frame functions copy the pointer into S8d50 afterwards; keep the default there
            return
        m = re.fullmatch(r"(\w+) = \((\w+) \+ (0x[0-9a-f]+|\d+)\);", n)
        if m and m.group(2) == self.argsptr:
            self.val[m.group(1)] = f"arg{int(m.group(3), 0)//8}"
            return
        m = re.fullmatch(r"(\w+) = \*(\w+);", n)
        if m and m.group(2) == self.argsptr:
            self.val[m.group(1)] = "arg0"
            return
        m = re.fullmatch(r"(\w+) = (\w+)\[(\d+)\];", n)
        if m and m.group(2) == self.argsptr:
            self.val[m.group(1)] = f"arg{int(m.group(3))}"
            return
        m = re.fullmatch(r"(\w+)\[(\d+)\] = (auStack_\w+|&\w+);", n)
        if m:  # pointer-array element: apuStack_140[0] = auStack_6e8
            self.ptr[f"{m.group(1)}[{m.group(2)}]"] = m.group(3).lstrip("&")
            return
        m = re.fullmatch(r"(\w+) = (apuStack_\w+);", n)
        if m:  # pointer to a pointer array
            self.alias[m.group(1)] = m.group(2)
            self.argv_base = m.group(2)
            return
        m = re.fullmatch(r"(\w+) = (auStack_\w+);", n)
        if m:
            self.ptr[m.group(1)] = m.group(2)
            return
        m = re.fullmatch(r"(\w+) = &(\w+);", n)
        if m:
            lhs, rhs = m.groups()
            if rhs in self.ptr or re.fullmatch(r"puStack_[0-9a-f]+", rhs):
                self.alias[lhs] = rhs
                self.argv_base = rhs
            else:
                self.ptr[lhs] = rhs
            return
        m = re.fullmatch(r"(\w+) = (uVar\d+);", n)
        if m:
            self.val[m.group(1)] = self.last
            return
        m = re.fullmatch(r"(S\w+) = (S\w+);", n)
        if m:
            lhs, rhs = m.groups()
            if rhs in self.ptr:
                self.ptr[lhs] = self.ptr[rhs]
                if self.ptr[rhs] in self.ptr:
                    self.argv_base = self.ptr[rhs]
                self.val.pop(lhs, None)
            else:
                self.val[lhs] = self.val.get(rhs, rhs)
            return
        m = re.fullmatch(r"(u?Stack_\w+|uStack_\w+|lStack_\w+|dStack_\w+) = \*?(puVar\d+|plVar\d+|pdVar\d+|uStack_\w+|lStack_\w+|dStack_\w+);", n)
        if m:  # RValue copy between locals (the 8-byte part carries the value)
            self.val[m.group(1)] = self.expr(m.group(2))
            return
        m = re.fullmatch(r"if \(?(?:\(\w+ \*\) ?)?(?:(\w+) = )?((?:CallBuiltin|[A-Z]\w+)\(.*\)) != &?(\w+)\)? \{", n)
        if m:  # call whose result pointer is compared with the destination local: X = call(...)
            self._stmt(m.group(2) + ";", None, ln)
            self.val[m.group(3)] = self.last
            if m.group(1):
                self.val[m.group(1)] = self.last
            self.emit(ln, "if true {")
            return
        m = re.fullmatch(r"(\w+) = (&?_?RV\(.*\)|0x1[45][0-9a-f]{7}|-?\d+);", n)
        if m:
            self.val[m.group(1)] = self.expr(m.group(2), self.raw_operand(rn, r"= (.+);$"))
            return
        if "= _ID_@@NewGMLObject@@;" in n:
            self.pending_builtin = "new"
            return
        if "= _ID_@@NewGMLArray@@;" in n:
            self.pending_builtin = "array"
            return
        m = re.search(r"= _?ID_([A-Za-z0-9_@]+);$", n)
        if m and n.split(" = ")[0] in ("lStackX_20", "uStackX_20", "S1ffffffffffffff8", "Sfffffffffffffff8"):
            self.pending_builtin = m.group(1)
            return
        m = re.fullmatch(r"(?:uVar\d+ = )?FUN_1401891d0\(&?(\w+),(.+)\);", n)
        if m:
            self.val[m.group(1)] = self.expr(m.group(2), self.raw_operand(rn, r"FUN_1401891d0\(&?\w+,(.+)\);$"))
            return
        m = re.fullmatch(r"FUN_140189220\(&?(\w+),(.+)\);", n)
        if m:
            self.val[m.group(1)] = self.expr(m.group(2), self.raw_operand(rn, r"FUN_140189220\(&?\w+,(.+)\);$"))
            return
        m = re.fullmatch(r"(?:FUN_1401ce8e0|FUN_140189270|FUN_140189190)\(&?(\w+),(0x[0-9a-f]+|-?\d+|_?ID_\w+)\);", n)
        if m:
            v = m.group(2)
            self.val[m.group(1)] = v.lstrip("_") if "ID_" in v else str(int(v, 0))
            return
        m = re.fullmatch(r"(?:uVar\d+ = )?func_0x00014018b8a0\(&?(\w+),(-?\d+)\);", n)
        if m:
            self.val[m.group(1)] = "true" if int(m.group(2)) else "false"
            self.last = self.val[m.group(1)]
            return
        m = re.fullmatch(r"func_0x0001401b6480\(&?(\w+),_?RV\(0\)\);", n)
        if m:
            self.val[m.group(1)] = "global"
            return
        m = re.fullmatch(r"uVar\d+ = func_0x000140188e[ef]0\((_?RV\(0\)|\w+),_?ID_(\w+)\);", n)
        if m:
            base = "global" if m.group(1).endswith("RV(0)") else self.expr(m.group(1))
            self.last = f"{base}.{m.group(2)}"
            return
        m = re.fullmatch(r"uVar\d+ = FUN_14b519170\(&?(\w+),\w+,(0x[0-9a-f]+|\d+),(.+)\);", n)
        if m:
            count = int(m.group(2), 0)
            elems = []
            for k in range(count - 1):
                slot = "uStackX_20" if k == 0 else "S%x" % (0x20 + 8 * k)
                elems.append(self.val.get(slot, f"?{slot}"))
            elems.append(self.expr(m.group(3), self.raw_operand(rn, r",(0x[0-9a-f]+)\);$")))
            self.last = "[" + ", ".join(elems) + "]"
            return
        m = re.fullmatch(r"(?:uVar\d+ = )?FUN_14018b910\(&?(\w+),(.+)\);", n)
        if m:  # set RValue = double expression
            self.val[m.group(1)] = self.expr(m.group(2))
            return
        m = re.fullmatch(r"(?:uVar\d+ = )?FUN_14b511230\(&?(\w+),&?(\w+),(uVar\d+|\w+),0\);", n)
        if m:  # array_get(arr, idx)
            self.last = f"{self.expr(m.group(2))}[{self.expr(m.group(3))}]"
            self.val[m.group(1)] = self.last
            self.produced = True
            return
        m = re.fullmatch(r"(?:uVar\d+ = )?(FUN_14b5116[0-9a-f]0|FUN_14b5113[0-9a-f]0|FUN_14b5114a0)\(&?(\w+),(\d+),&?(\w+)\);", n)
        if m:  # direct builtin call: fn(&result, argc, argv)
            name = {"FUN_14b511630": "irandom_range", "FUN_14b511350": "choose", "FUN_14b5114a0": "bi_b5114a0"}.get(m.group(1), m.group(1))
            args = self.argv(int(m.group(3)), m.group(4))
            self.last = f"{name}({', '.join(args)})"
            self.val[m.group(2)] = self.last
            self.produced = True
            return
        m = re.fullmatch(r"uVar\d+ = FUN_14018cb90\((&?\w+|uVar\d+),(uVar\d+|\d+|&?\w+)\);", n)
        if m:
            self.last = f"{self.expr(m.group(1))}[{self.expr(m.group(2))}]"
            return
        m = re.fullmatch(r"(?:uVar\d+ = )?FUN_14018b980\(&?(\w+)\);", n)
        if m:
            cur = self.expr(m.group(1))
            self.emit(ln, f"{cur} += 1")
            return
        m = re.fullmatch(r"uVar\d+ = func_0x00014018b960\(&?(\w+)\);", n)
        if m:
            self.last = f"int({self.expr(m.group(1))})"
            return
        m = re.fullmatch(r"uVar\d+ = FUN_1401b6490\(&?(\w+),&?(\w+),0\);", n)
        if m:
            self.val[m.group(2)] = self.expr(m.group(1))
            self.emit(ln, f"{self.expr(m.group(1))} += 1")
            self.last = self.val[m.group(2)]
            return
        m = re.fullmatch(r"(?:FUN_14b4c08c0|GetVar)\(&?(\w+), ?_?ID_(\w+), ?(\w+), ?&?(\w+)(?:,.*)?\);", n)
        if m:
            src, field, idx, dst = m.groups()
            base = self.expr(src)
            text = f"{base}.{field}" if idx == "0x80000000" else f"{base}.{field}[{self.expr(idx)}]"
            self.val[dst] = text
            self.method_slot = dst
            return
        m = re.fullmatch(r"FUN_14b4c0db0\(&?(\w+), ?_?ID_(\w+), ?(\w+), ?&?(\w+)\);", n)
        if m:
            dst, field, idx, src = m.groups()
            base = self.expr(dst)
            target = f"{base}.{field}" if idx == "0x80000000" else f"{base}.{field}[{self.expr(idx)}]"
            self.emit(ln, f"{target} = {self.expr(src)}")
            return
        m = re.fullmatch(r"uVar\d+ = FUN_1401bb9d0\(\(?&?(\w+)\)?\);", n)
        if m:
            return
        m = re.fullmatch(r"(?:uVar\d+ = )?FUN_14b4bd400\(\w+, ?\w+, ?&?(\w+), ?(\d+)(?:, ?([^,]+))?(?:, ?&?(\w+))?\);", n)
        if m:
            res, argc = m.group(1), int(m.group(2))
            base = m.group(4) if m.group(4) else None
            method = self.val.get(self.method_slot, "?method") if self.method_slot else "?method"
            call = f"{method}({', '.join(self.argv(argc, base))})"
            self.last = call
            self.val[res] = call
            return
        m = re.fullmatch(r"(?:\w+ = )?CallBuiltin\([^,]+, ?[^,]+, ?&?(\w+), ?(\d+)(?:, ?([^,]+))?(?:, ?&?(\w+))?\);", n)
        if m:
            res, argc = m.group(1), int(m.group(2))
            idexpr, base = m.group(3), m.group(4)
            if idexpr:
                idv = self.expr(idexpr)
                if idv.startswith("ID:"):
                    self.pending_builtin = idv[3:]
            args = self.argv(argc, base if base else None)
            b = self.pending_builtin or "?builtin"
            if b == "new":
                call = f"new {args[0]}({', '.join(args[1:])})" if args else "{}"
            elif b == "array":
                call = "[" + ", ".join(args) + "]"
            else:
                call = f"{b}({', '.join(args)})"
            self.pending_builtin = None
            self.last = call
            if b in PURE:
                self.val[res] = call
            else:
                t = f"t{ln}"
                self.emit(ln, f"{t} = {call}")
                self.val[res] = t
                self.last = t
            return
        m = re.fullmatch(r"(?:\w+ = )?([A-Z][A-Za-z0-9_]+)\(\w+, ?\w+, ?&?(\w+), ?(\d+)(?:, ?&?(\w+))?\);", n)
        if m and m.group(1) not in ("Compare", "Truthy", "SetBool", "GetVar"):
            name, res, argc = m.group(1), m.group(2), int(m.group(3))
            base = m.group(4) if m.group(4) else None
            call = f"{name}({', '.join(self.argv(argc, base))})"
            if name in PURE:
                self.val[res] = call
                self.last = call
            else:
                t = f"t{ln}"
                self.emit(ln, f"{t} = {call}")
                self.val[res] = t
                self.last = t
            return
        m = re.fullmatch(r"(\w+) = (FUN_14024dda0|FUN_1401892e0|FUN_140227830|FUN_140227890|FUN_14018ccc0)\((&?\w+|uVar\d+),(-?\w+)\);", n)
        if m:
            op = {"FUN_14024dda0": "==", "FUN_1401892e0": "==", "FUN_140227830": ">", "FUN_140227890": ">=", "FUN_14018ccc0": "<"}[m.group(2)]
            v = m.group(4)
            v = str(int(v, 0)) if re.fullmatch(r"-?0x[0-9a-f]+|-?\d+", v) else v
            self.val[m.group(1)] = f"({self.expr(m.group(3))} {op} {v})"
            return
        m = re.fullmatch(r"(\w+) = FUN_1401892c0\((&?\w+|uVar\d+),(&?\w+|uVar\d+)\);", n)
        if m:
            self.val[m.group(1)] = f"({self.expr(m.group(2))} == {self.expr(m.group(3))})"
            return
        m = re.fullmatch(r"(\w+) = Compare\((&?\w+|uVar\d+),(&?\w+|uVar\d+),_?RV\([^)]*\),(\d)\);", n)
        if m:
            self.val[m.group(1)] = f"cmp({self.expr(m.group(2))}, {self.expr(m.group(3))})"
            return
        m = re.fullmatch(r"(\w+) = Truthy\((&?\w+|uVar\d+)\);", n)
        if m:
            self.val[m.group(1)] = f"bool({self.expr(m.group(2))})"
            return
        m = re.fullmatch(r"SetBool\(&?(\w+),(.+)\);", n)
        if m:
            self.val[m.group(1)] = f"bool({self.expr(m.group(2))})"
            return
        m = re.fullmatch(r"(ADD|SUB|MUL|DIV)\(&?(\w+),(.+)\);", n)
        if m:
            op = {"ADD": "+", "SUB": "-", "MUL": "*", "DIV": "/"}[m.group(1)]
            a = self.expr(m.group(2))
            self.val[m.group(2)] = f"({a} {op} {self.expr(m.group(3), self.raw_operand(rn, r',(.+)\);$'))})"
            return
        m = re.fullmatch(r"if \((.+)\) (\{|goto \w+;|break;|return .*;)", n)
        if m:
            c = m.group(1)
            c = re.sub(re.escape(self.argsptr) + r"\[(\d+)\]", lambda mm: f"arg{mm.group(1)}", c)
            c = re.sub(r"\*" + re.escape(self.argsptr) + r"\b", "arg0", c)
            c = re.sub(r"\b(cVar\d+|uVar\d+|iVar\d+|bVar\d+|puVar\d+|S[0-9a-f]+|t\d+)\b", lambda mm: self.val.get(mm.group(1), self.last if mm.group(1).startswith("uVar") else mm.group(1)), c)
            c = re.sub(r"^(.+) == '\\0'$", r"!(\1)", c)
            c = re.sub(r"^(.+) != '\\0'$", r"\1", c)
            c = re.sub(r"^!\(\((.+)\)\)$", r"!(\1)", c)
            self.emit(ln, f"if {c} {m.group(2)}")
            return
        if n in ("else {", "}", "} else {", "do {", "while( true ) {") or n.startswith(("code_r0x", "} while", "switch", "case", "default:", "goto ", "return", "break;")):
            self.emit(ln, n)
            return
        m = re.fullmatch(r"(\w+) = (.+);", n)
        if m and not n.startswith("uStack_"):
            rhs = m.group(2)
            if rhs.startswith("&") and re.fullmatch(r"&\w+", rhs):
                self.ptr[m.group(1)] = rhs[1:]
                return
            self.val[m.group(1)] = self.expr(rhs) if len(rhs) < 60 else rhs
            return
        self.emit(ln, "//? " + n[:160])


def postprocess(out):
    """Remove empty blocks left behind by skipped RValue bookkeeping."""
    changed = True
    while changed:
        changed = False
        res = []
        i = 0
        while i < len(out):
            ln, t = out[i]
            nxt = out[i + 1][1] if i + 1 < len(out) else None
            if t.endswith("{") and nxt == "}":
                i += 2
                changed = True
                continue
            if t == "else {" and nxt == "}":
                i += 2
                changed = True
                continue
            res.append((ln, t))
            i += 1
        out = res
    return out


def lift(named_path, raw_path=None, strpool_path=None):
    strpool = json.load(open(strpool_path, encoding="utf-8")) if strpool_path else {}
    named = open(named_path, encoding="utf-8", errors="replace").read().splitlines()
    raw = open(raw_path, encoding="utf-8", errors="replace").read().splitlines() if raw_path else None
    lf = Lifter(strpool)
    ns = list(join_statements(named))
    rs = list(join_statements(raw)) if raw else [(None, None)] * len(ns)
    if raw and len(ns) != len(rs):
        print(f"warning: statement count mismatch {len(ns)} vs {len(rs)}; strings unresolved", file=sys.stderr)
        rs = [(None, None)] * len(ns)
    for (s, ln), (r, _) in zip(ns, rs):
        lf.stmt(s, r, ln)
    return postprocess(lf.out)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    dst = None
    if "-o" in sys.argv:
        dst = sys.argv[sys.argv.index("-o") + 1]
        args = [a for a in args if a != dst]
    named = args[0]
    raw = args[1] if len(args) > 1 else None
    pool = args[2] if len(args) > 2 else None
    out = lift(named, raw, pool)
    text = "\n".join(f"{ln:6} {t}" for ln, t in out)
    if dst:
        open(dst, "w", encoding="utf-8").write(text)
        print(f"{dst}: {len(out)} lines")
    else:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        print(text)


if __name__ == "__main__":
    main()
