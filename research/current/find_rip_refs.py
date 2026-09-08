"""Read-only RIP-reference search, including code beyond embedded data tables."""
import bisect
import json
import re
import struct
import sys
from pathlib import Path
import pefile

root = Path(__file__).resolve().parent
pe = pefile.PE(str(root / 'HeroSiegeC6E.exe'), fast_load=True)
base = pe.OPTIONAL_HEADER.ImageBase
routines = json.loads((root / 'routines.json').read_text())['routines']
names = {base + v: k for k, v in routines.items()}
starts = sorted(names)
targets = {int(x, 0) for x in sys.argv[1:]}
for section in pe.sections:
    if not section.Characteristics & 0x20000000:
        continue
    data = section.get_data()
    origin = base + section.VirtualAddress
    # ModRM mod=00, r/m=101; the displacement begins after opcode + ModRM.
    for m in re.finditer(rb'[\x8b\x89\x8d][\x05\x0d\x15\x1d\x25\x2d\x35\x3d]', data):
        offset = m.start()
        target = origin + offset + 6 + struct.unpack_from('<i', data, offset + 2)[0]
        if target in targets:
            address = origin + offset
            index = bisect.bisect_right(starts, address) - 1
            print(hex(address), hex(target), names[starts[index]])
