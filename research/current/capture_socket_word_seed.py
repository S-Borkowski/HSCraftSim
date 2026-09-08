"""Native InventorySocketItem seed write after the protected max is decoded."""
import json
from native_craft_cases import CraftCaseOracle,ROOT
from unicorn.x86_const import *

class SocketSeedOracle(CraftCaseOracle):
    def capture_seed(self,roll):
        frame=0x3e0000;bp=frame+0x100
        self.uc.mem_write(frame,bytes(0x3000))
        self.definition={'a':123456,'b':23,'c':0,'i':777,'u':3,'v':5}
        self.objects[10]=self.definition;self.trace=[];self.rolls=[roll]
        key=next(h for h,name in self.strings.items() if name=='i')
        self.put(bp-0x70,1000000000)
        self.put(bp+0x460,1);self.write64(bp+0x198,bp+0x460)
        self.put(bp+0xe0,key);self.write64(bp+0x30,bp+0xe0)
        self.put(bp+0x280,self.handles['SetItemDef'])
        self.put(0x110000,100);self.write64(0x111000,0x110000)
        for reg,value in ((UC_X86_REG_RSP,frame),(UC_X86_REG_RBP,bp),(UC_X86_REG_R13,1),(UC_X86_REG_R14,1),(UC_X86_REG_R15,0x111000),(UC_X86_REG_R12,0),(UC_X86_REG_RDI,0x140189770)):
            self.uc.reg_write(reg,value)
        self.uc.emu_start(0x143daf284,0x143daf37a,count=100000)
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x143daf37a
        assert not self.rolls
        return dict(roll=roll,definition=self.definition,trace=self.trace)

if __name__=='__main__':
    oracle=SocketSeedOracle()
    fixtures=[oracle.capture_seed(roll) for roll in (0,1,2,57,123456,8675309,999999937,1000000000)]
    (ROOT.parent.parent/'tests/current_socket_word_seed_native.json').write_text(json.dumps(fixtures,separators=(',',':'))+'\n',encoding='utf8')
    print(json.dumps(fixtures,indent=2))
