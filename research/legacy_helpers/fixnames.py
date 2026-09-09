"""Post-process Ghidra decompiler output: name gml routines, variable-id slots, RValue constants and rdata strings."""
import sys, re, os, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fp, an
IB = fp.IB
BYADDR = fp.BYADDR


HELPERS = {
 "14b4bd2d0":"CallBuiltin", "14b4c08c0":"GetVar", "14b526370":"BufferWrite", "14b4ce420":"Truthy",
 "14b4cf980":"ToInt", "14b4d02a0":"ToDouble", "14b4e1240":"Compare", "140188fa0":"FREE",
 "1401890d0":"COPY", "14018bac0":"ADD", "14018be80":"SUB", "1401b9730":"ADDI", "1401c4c80":"SetBool",
 "14b8f66d0":"LocalsInit", "14b8f6600":"LocalsFree", "14018b790":"COPYref", "140189080":"RVdtor",
 "14b4c0b40":"SetVar", "14b4bd7a0":"CallScript",
}

def name_for_call(addr):
    nm = BYADDR.get(addr - IB)
    if nm: return nm.replace("gml_Script_", "").replace("gml_Object_", "obj_")
    return None

def rvalue_const(rva):
    b = fp.exe.read(rva, 16)
    if not b or len(b) < 16: return None
    val, flags, kind = struct.unpack('<QII', b)
    if kind == 0: return f"RV({struct.unpack('<d', b[:8])[0]:g})"
    if kind == 13: return f"RV({'true' if val else 'false'})"
    if kind == 7: return f"RV(i32:{struct.unpack('<i', b[:4])[0]})"
    if kind == 10: return f"RV(i64:{struct.unpack('<q', b[:8])[0]})"
    if kind == 5: return "RV(undefined)"
    if kind == 1 and val > IB:
        rs = fp.exe.read(val - IB, 16)
        if rs:
            sp = struct.unpack('<Q', rs[:8])[0]
            if sp > IB:
                st = fp.exe.read(sp - IB, 120)
                if st:
                    z = st.find(b'\0')
                    if 0 <= z < 110: return 'RV("' + st[:z].decode('latin1', 'ignore') + '")'
        return "RV(string?)"
    return None

def describe_addr(a):
    rva = a - IB
    sec = fp.exe.sec_of(rva)
    if sec == '.data':
        n = an.slot_name(rva, -16)
        if n: return f"ID_{n}"
        c = rvalue_const(rva)
        if c: return c
        if rva & 0xF:
            c = rvalue_const(rva & ~0xF)
            if c: return f"{c}.f{rva & 0xF}"
        n2 = an.slot_name(rva, 0)
        if n2: return f"SLOT_{n2}"
        return f"G_{rva:x}"
    if sec == '.rdata':
        s = an.rdata_str(rva)
        if s: return f'STR("{s}")'
        d = an.rdata_double(rva)
        if d is not None and abs(d) < 1e12: return f"DBL({d:g})"
        return f"RD_{rva:x}"
    if sec == '.text':
        nm = name_for_call(a)
        if nm: return f"FN_{nm}"
        return f"TX_{rva:x}"
    return None

def annotate(text):
    def repl_call(m):
        nm = name_for_call(int(m.group(1), 16))
        return nm + "(" if nm else m.group(0)
    text = re.sub(r'(?:func_0x|FUN_)([0-9a-fA-F]{9})\(', repl_call, text)
    text = re.sub(r'FUN_([0-9a-fA-F]{9})', lambda m: HELPERS.get(m.group(1).lower(), m.group(0)), text)
    text = re.sub(r'\(\*\*\(code \*\*\)\(\*[A-Za-z_0-9]+ \+ 8\)\)\([A-Za-z_0-9]+,', 'GLOBAL(', text)
    text = re.sub(r'\(\*\*\(code \*\*\)\(\*[A-Za-z_0-9]+ \+ 0x10\)\)\([A-Za-z_0-9]+,', 'SETGLOBAL(', text)
    def repl_generic(m):
        d = describe_addr(int(m.group(1), 16))
        return d if d else m.group(0)
    text = re.sub(r'(?:PTR_)?(?:DAT|LAB|UNK|PTR|s_[A-Za-z0-9_]+)_([0-9a-fA-F]{9})\b', repl_generic, text)
    text = re.sub(r'[A-Za-z_]*Ram0{7}([0-9a-fA-F]{9})\b', repl_generic, text)
    text = re.sub(r'\b0x(1[45][0-9a-fA-F]{7})\b', repl_generic, text)
    return text

if __name__ == "__main__":
    d = sys.argv[1]
    for f in sorted(os.listdir(d)):
        if f.endswith(".c") and not f.endswith(".named.c"):
            t = open(os.path.join(d, f), encoding="utf-8", errors="ignore").read()
            open(os.path.join(d, f[:-2] + ".named.c"), "w", encoding="utf-8").write(annotate(t))
