"""Outline of DoCraftResult: split by resultType compare sites and list what each branch does."""
import re, sys, collections
path = sys.argv[1]
lines = open(path, encoding='utf-8', errors='replace').read().splitlines()
def norm(s):
    s = re.sub(r"\*\((?:undefined|longlong|ulonglong|int|uint|byte|char|code|short)\d* \*+\)", "", s)
    s = re.sub(r"\(?&stack0x0*([0-9a-f]+) \+ lVar\d\)?", lambda m: "S"+m.group(1), s)
    s = re.sub(r"\(\(longlong\)&(\w+) \+ lVar\d\)|\(&(\w+) \+ lVar\d\)|&(\w+) \+ lVar\d", lambda m: next(g for g in m.groups() if g), s)
    return s.replace("(longlong)", "").strip()
INTERESTING = re.compile(r"FUN_14024dda0\(S158,(\w+)\)|([A-Z][A-Za-z]+)\(|_ID_(\w+)|ID_(\w+)|RV\(([^)]*)\)|FUN_14b4bd400|FUN_140189220\(S\w+,(.+)\)|struct_get_from_hash")
out = []
cur = None
tokens = []
def flush():
    if cur is not None:
        out.append((cur, tokens[:]))
depth_markers = []
for i, raw in enumerate(lines, 1):
    s = norm(raw)
    m = re.search(r"FUN_14024dda0\(\w+,(0x[0-9a-f]+|\d+)\)", s)
    if m:
        flush(); cur = (i, int(m.group(1), 0)); tokens = []
        continue
    if cur is None: continue
    m = re.match(r"(?:\w+ = )?([A-Z][A-Za-z0-9]+)\((.*)", s)
    if m and m.group(1) not in ("FREE","COPY","COPYref","RVdtor","LocalsInit","LocalsFree","CONCAT44","RV","STR","GetVar","SETGLOBAL","GLOBAL","Compare","Truthy","SetBool","ADD","SUB","MUL","DIV"):
        tokens.append(f"{m.group(1)}()")
    m = re.search(r"GetVar\((S\w+),ID_(\w+),(\w+),(S\w+)\)", s)
    if m: tokens.append(f"get:{m.group(2)}")
    m = re.search(r"FUN_14b4c0db0\((S\w+),ID_(\w+),(\w+),(S\w+)\)", s)
    if m: tokens.append(f"set:{m.group(2)}")
    m = re.search(r"CONCAT44\(\w+,_ID_(\w+)\)", s)
    if m: tokens.append(f"builtin:{m.group(1)}")
    if "FUN_14b4bd400(" in s: tokens.append("CALLMETHOD")
    m = re.search(r"FUN_140189220\(S\w+,(&?RV\([^)]*\))\)", s)
    if m: tokens.append(f"c{m.group(1)[m.group(1).index('('):]}")
    m = re.search(r"(?:FUN_1401891d0|FUN_1401ce8e0)\(S\w+,(&?RV\([^)]*\)|0x[0-9a-f]+|\d+)\)", s)
    if m: tokens.append(f"k{m.group(1)}")
    m = re.search(r"Truthy\(", s)
    if m: tokens.append("if?")
flush()
for (ln, rt), toks in out:
    # compress runs
    comp = []
    for t in toks:
        if comp and comp[-1][0] == t: comp[-1][1] += 1
        else: comp.append([t, 1])
    txt = " ".join(t if n == 1 else f"{t}x{n}" for t, n in comp)
    print(f"\n### line {ln}  resultType == {rt}\n{txt}")
