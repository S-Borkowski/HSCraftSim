"""Execute the current game's upgrade table in an isolated x86-64 emulator.

No game process, save, or network access. Only runner value comparison and
Windows static-initialization plumbing are stubbed; the native table, branch
selection, arithmetic and return code execute unchanged.
"""
import json
import hashlib
import struct
from pathlib import Path
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_64, UC_HOOK_CODE
from unicorn.x86_const import *

ROOT = Path(__file__).resolve().parent
BASE = 0x140000000

class Oracle:
    def __init__(self):
        binary=ROOT / 'HeroSiegeC6E.exe'
        assert hashlib.file_digest(binary.open('rb'),'sha256').hexdigest()=='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4', 'Unexpected native build'
        self.uc = Uc(UC_ARCH_X86, UC_MODE_64)
        pe = pefile.PE(str(ROOT / 'HeroSiegeC6E.exe'), fast_load=True)
        for section in pe.sections:
            address = BASE + section.VirtualAddress
            size = (max(section.Misc_VirtualSize, section.SizeOfRawData) + 4095) & ~4095
            self.uc.mem_map(address, size)
            self.uc.mem_write(address, section.get_data())
        self.uc.mem_map(0x100000, 0x300000)
        self.uc.reg_write(UC_X86_REG_GS_BASE, 0x100000)
        self.write64(0x100058, 0x101000)
        self.write64(0x101000, 0x102000)
        self.uc.mem_write(0x102014, struct.pack('<i', -1000000))
        for address in [0x14b4ea180, 0x1401899b0, 0x14b8ff430, 0x14b8ff3d0, 0x14b8ff8b8]:
            self.uc.hook_add(UC_HOOK_CODE, self.helper, begin=address, end=address)

    def write64(self, address, value):
        self.uc.mem_write(address, struct.pack('<Q', value))

    def value(self, address):
        raw = bytes(self.uc.mem_read(address, 16))
        kind = struct.unpack_from('<I', raw, 12)[0] & 0xffffff
        if kind in (0, 13): return struct.unpack_from('<d', raw)[0]
        if kind == 10: return struct.unpack_from('<q', raw)[0]
        if kind == 7: return struct.unpack_from('<i', raw)[0]
        if kind == 5: return None
        raise ValueError(f'Unsupported runner value {kind} at {address:x}')

    def helper(self, uc, address, size, _):
        rcx, rdx = uc.reg_read(UC_X86_REG_RCX), uc.reg_read(UC_X86_REG_RDX)
        result = 0
        if address in (0x14b4ea180, 0x1401899b0):
            a, b = self.value(rcx), self.value(rdx)
            result = int(a == b) if address == 0x1401899b0 else (0 if a==b else -2 if a is None or b is None else (a > b) - (a < b))
        elif address == 0x14b8ff430:
            uc.mem_write(rcx, struct.pack('<i', -1))
        elif address == 0x14b8ff3d0:
            uc.mem_write(rcx, struct.pack('<i', -1000000))
        rsp = uc.reg_read(UC_X86_REG_RSP)
        destination = struct.unpack('<Q', uc.mem_read(rsp, 8))[0]
        uc.reg_write(UC_X86_REG_RAX, result & 0xffffffffffffffff)
        uc.reg_write(UC_X86_REG_RSP, rsp + 8)
        uc.reg_write(UC_X86_REG_RIP, destination)

    def upgrade(self, key, mode, tier):
        for index, value in enumerate((key, mode, tier)):
            pointer = 0x110000 + index * 16
            self.uc.mem_write(pointer, struct.pack('<qII', value, 0, 10))
            self.write64(0x111000 + index * 8, pointer)
        rsp = 0x3f0008
        self.write64(rsp, 0x103000)
        self.write64(rsp + 40, 0x111000)
        self.uc.mem_write(0x112000, bytes(16))
        for register, value in ((UC_X86_REG_RSP,rsp),(UC_X86_REG_RCX,0),(UC_X86_REG_RDX,0),(UC_X86_REG_R8,0x112000),(UC_X86_REG_R9,3)):
            self.uc.reg_write(register,value)
        try:
            self.uc.emu_start(0x14395b740, 0x103000, count=1000000)
        except Exception:
            print('Stopped at', hex(self.uc.reg_read(UC_X86_REG_RIP)))
            raise
        assert self.uc.reg_read(UC_X86_REG_RIP) == 0x103000
        return self.value(0x112000)

if __name__ == '__main__':
    rules = json.loads((ROOT.parent.parent / 'data/current_modifier_rules.json').read_text())
    oracle = Oracle()
    rows = []
    for key in [*map(int, rules['upgrades']), 9999]:
        for tier in range(7):
            amount, additive = oracle.upgrade(key,0,tier), oracle.upgrade(key,1,tier)
            expected = rules['upgrades'].get(str(key), {'amount':0,'additive':True})
            assert amount == expected['amount'] * rules['tierMultipliers'][tier], (key,tier,amount,expected)
            assert bool(additive) == expected['additive'], (key,tier,additive,expected)
            rows.append({'key':key,'tier':tier,'amount':amount,'additive':bool(additive)})
    target = ROOT.parent.parent / 'tests/current_upgrade_native.json'
    target.write_text(json.dumps({'buildSha256':rules['buildSha256'],'oracle':'Unmodified native GetStatUpgrades executed in x86-64 emulator','rows':rows}, separators=(',',':'))+'\n')
    print(f'PASS {len(rows)} native upgrade/tier combinations; {target}')
