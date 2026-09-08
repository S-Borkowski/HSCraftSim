"""Run CreateItemNew's socket required-level accumulation block unchanged.

Only the parent level and child item-info storage are fixture-owned. This
does not emulate deserialization or recursive creation of socket contents.
"""
import json
from native_item_generation import ItemGenerationOracle, ROOT
from unicorn.x86_const import *


class SocketLevelOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__()
        self.capture_item({'calls': []}, {'a': 1, 'b': 0, 'c': 0}, entry=0x103000)

    def service(self, uc, address, size, data):
        if address == 0x14b4c6340 and uc.reg_read(UC_X86_REG_RCX) == 200:
            name = self.methods[self.value(self.stack64(40))]
            args = self.args(uc.reg_read(UC_X86_REG_R9), 48)
            assert name == 'GetItemInfo' and args == [1]
            result = uc.reg_read(UC_X86_REG_R8)
            self.put(result, self.child_level)
            uc.reg_write(UC_X86_REG_RAX, result)
            uc.reg_write(UC_X86_REG_RIP, self.stack64(0))
            uc.reg_write(UC_X86_REG_RSP, uc.reg_read(UC_X86_REG_RSP) + 8)
        else:
            super().service(uc, address, size, data)

    def capture(self, parent_level, child_level):
        self.child_level = child_level
        rsp, rbp = 0x3e0000, 0x3e2000
        self.uc.mem_write(rsp, bytes(0x6000))
        self.put(rbp + 0x1c0, 200)
        self.put(rbp + 0x2f0, parent_level)
        for reg, value in ((UC_X86_REG_RSP, rsp), (UC_X86_REG_RBP, rbp),
                           (UC_X86_REG_RDI, 0), (UC_X86_REG_RSI, 1), (UC_X86_REG_R15, 0)):
            self.uc.reg_write(reg, value)
        self.uc.emu_start(0x1406f6522, 0x1406f65ed, count=100000)
        assert self.uc.reg_read(UC_X86_REG_RIP) == 0x1406f65ed
        return self.value(rbp + 0x2f0)


if __name__ == '__main__':
    rows = json.loads((ROOT / 'socket-definitions.json').read_text())
    oracle = SocketLevelOracle()
    fixtures = []
    for row in rows:
        info = {int(key): value for name, (key, value) in row['calls'] if name == 'itemBaseInfoStruct'}
        for level in (1, 25, 70, 100):
            fixtures.append(dict(id=row['b'], baseLevel=level, childLevel=info[1],
                requiredLevel=oracle.capture(level, info[1])))
    (ROOT.parent.parent / 'tests/current_socket_level_native.json').write_text(json.dumps({
        'buildSha256': 'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
        'source': 'CreateItemNew 0x1406f6522..0x1406f65ed; fixture-owned child info and accumulated parent level.',
        'fixtures': fixtures}, separators=(',', ':')) + '\n', encoding='utf8')
    print('Captured', len(fixtures), 'native socket level comparisons.')
