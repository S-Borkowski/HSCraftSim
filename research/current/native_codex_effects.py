"""Read the current Codex modifier tables through their native query functions."""
import json
from native_crystal_oracle import CrystalOracle, ROOT
from unicorn.x86_const import *

class CodexEffectsOracle(CrystalOracle):
    def query(self, function, effect, mode):
        self.arrays = {}
        for i, value in enumerate((effect, mode)):
            self.put(0x110000 + i * 16, value)
            self.write64(0x111000 + i * 8, 0x110000 + i * 16)
        rsp = 0x3f0008
        self.write64(rsp, 0x103000)
        self.write64(rsp + 40, 0x111000)
        self.put(0x112000, None)
        for register, value in ((UC_X86_REG_RSP,rsp),(UC_X86_REG_RCX,0),(UC_X86_REG_RDX,0),(UC_X86_REG_R8,0x112000),(UC_X86_REG_R9,2)):
            self.uc.reg_write(register,value)
        try:
            self.uc.emu_start(function,0x103000,count=1000000)
        except Exception:
            print('Stopped at', hex(self.uc.reg_read(UC_X86_REG_RIP)), 'effect',effect,'mode',mode)
            raise
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x103000
        value = self.value(0x112000)
        return self.arrays.get(value,value)

if __name__ == '__main__':
    oracle=CodexEffectsOracle()
    result={}
    for name,address,count in [('buffs',0x141c35810,11),('debuffs',0x141c37f90,8)]:
        result[name]=[]
        for effect in range(count):
            row={'id':effect}
            for mode in [3,1,2]:
                row[str(mode)]=oracle.query(address,effect,mode)
            print(name,row,flush=True)
            result[name].append(row)
    (ROOT/'codex-effects-native.json').write_text(json.dumps(result,indent=2),encoding='utf8')
