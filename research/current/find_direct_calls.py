"""Locate candidate native direct calls; validate each hit with Capstone.

Routine ownership comes from the current executable's registered script map.
Indirect or inlined calls are deliberately outside this search boundary.
"""
import bisect
import json
import struct
import sys
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parent


def find_calls(names):
    metadata = json.loads((ROOT / 'routines.json').read_text())
    base = metadata['image_base']
    routines = metadata['routines']
    targets = {base + routines[name]: name for name in names}
    ordered = sorted((base + offset, name) for name, offset in routines.items())
    starts = [address for address, _ in ordered]
    pe = pefile.PE(str(ROOT / 'HeroSiegeC6E.exe'), fast_load=True)
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
    results = []
    for section in pe.sections:
        if not section.Characteristics & 0x20000000:
            continue
        code = section.get_data()
        start = base + section.VirtualAddress
        offset = code.find(b'\xe8')
        while offset >= 0:
            if offset + 5 <= len(code):
                address = start + offset
                target = address + 5 + struct.unpack_from('<i', code, offset + 1)[0]
                if target in targets:
                    instruction = next(md.disasm(code[offset:offset + 5], address))
                    assert instruction.mnemonic == 'call'
                    owner_index = bisect.bisect_right(starts, address) - 1
                    owner_start, owner_name = ordered[owner_index]
                    results.append(dict(callee=targets[target], address=hex(address),
                        precedingRoutine=owner_name, distance=hex(address-owner_start)))
            offset = code.find(b'\xe8', offset + 1)
    return results


if __name__ == '__main__':
    print(json.dumps(find_calls(sys.argv[1:]), indent=2))
