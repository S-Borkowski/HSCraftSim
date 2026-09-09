"""Degisken adlarini cozen aciklamali disassembler.

.data icinde 16 hizali {int32 id; int32 pad; const char* name;} yuvalari var.
YYC kodu `mov edx, dword ptr [rip+X]` ile id alanini okur, X = yuva tabani.
"""
import json
import struct
import fp

_name_cache = {}


def slot_name(rva, delta=0):
    key = (rva, delta)
    if key in _name_cache:
        return _name_cache[key]
    result = None
    b = fp.exe.read(rva + delta, 16)
    if b and len(b) == 16:
        _id, _pad, ptr = struct.unpack('<iiQ', b)
        if ptr > fp.IB:
            t = ptr - fp.IB
            if fp.exe.sec_of(t) == '.rdata':
                s = fp.exe.read(t, 96)
                if s:
                    z = s.find(b'\0')
                    if 0 < z < 80 and all(32 <= c < 127 for c in s[:z]):
                        result = s[:z].decode()
    _name_cache[key] = result
    return result


def rdata_str(rva):
    if fp.exe.sec_of(rva) != '.rdata':
        return None
    s = fp.exe.read(rva, 128)
    if not s:
        return None
    z = s.find(b'\0')
    if 0 < z < 110 and all(32 <= c < 127 for c in s[:z]):
        return s[:z].decode()
    return None


def rdata_double(rva):
    if fp.exe.sec_of(rva) != '.rdata':
        return None
    b = fp.exe.read(rva, 8)
    if not b or len(b) < 8:
        return None
    try:
        return struct.unpack('<d', b)[0]
    except Exception:
        return None


def walk(rva, size=None, delta=0):
    """(adres, mnemonic, operand, aciklama) uretir."""
    size = size or fp.extent(rva)
    code = fp.exe.read(rva, size)
    for i in fp.md.disasm(code, fp.IB + rva):
        a = i.address - fp.IB
        note = ''
        if i.mnemonic == 'call':
            try:
                t = int(i.op_str, 16) - fp.IB
                note = '  -> ' + (fp.BYADDR.get(t) or f'sub_{t:x}')
            except ValueError:
                note = '  -> [indirect]'
        for op in i.operands:
            if op.type == 3 and op.mem.base == 41:
                t = a + i.size + op.mem.disp
                sec = fp.exe.sec_of(t)
                if sec == '.data':
                    n = slot_name(t, delta)
                    if n:
                        note += f'  VAR={n}'
                elif sec == '.rdata':
                    s = rdata_str(t)
                    if s:
                        note += f'  "{s}"'
                    else:
                        d = rdata_double(t)
                        if d is not None and abs(d) < 1e9:
                            note += f'  const={d:g}'
        yield a, i.mnemonic, i.op_str, note


def names(rva, size=None, delta=0):
    """Rutinin dokundugu degisken adlari, gorulme sirasiyla."""
    seen, out = set(), []
    for _a, _m, _o, n in walk(rva, size, delta):
        if 'VAR=' in n:
            v = n.split('VAR=')[1].split()[0]
            if v not in seen:
                seen.add(v)
                out.append(v)
    return out


def show(rva, size=None, delta=0, quiet=True, limit=None):
    nm = fp.BYADDR.get(rva) or f'rva_{rva:x}'
    print(f'===== {nm}  rva=0x{rva:x}  uzunluk={fp.extent(rva)} =====')
    count = 0
    for a, m, o, n in walk(rva, size, delta):
        if quiet and not n:
            continue
        print(f'  +{a - rva:<6d} 0x{a:07x}  {m:<9s} {o}{n}')
        count += 1
        if limit and count >= limit:
            print('  ... kesildi')
            break
