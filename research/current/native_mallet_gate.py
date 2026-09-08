"""Current Blacksmith's Mallet eligibility: original native code, offline."""
import json
from native_item_generation import ItemGenerationOracle, ROOT
from native_natural_sockets import BUILD
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_RSP, UC_X86_REG_RIP


class MalletGateOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__()
        self.capture_item({'calls':[]},{'a':1,'b':0,'c':0},3,entry=0x103000)
        self.uc.hook_add(UC_HOOK_CODE,self.stop,begin=0x14081654a,end=0x14081654a)

    def stop(self, uc, *_):
        self.allowed=not bool(uc.mem_read(0x3e0322,1)[0])
        uc.reg_write(UC_X86_REG_RIP,0x103000);uc.emu_stop()

    def capture(self, rarity, count):
        self.allowed=None;self.info={27:rarity};self.current={20:count};self.trace=[]
        self.uc.mem_write(0x3e0000,bytes(0x9000))
        self.write64(0x3e8d48,3);self.write64(0x3e8d50,0x111000)
        self.put(0x110020,100);self.write64(0x111010,0x110020)
        self.uc.reg_write(UC_X86_REG_RSP,0x3e0000)
        self.uc.emu_start(0x14081605b,0x103000,count=100000)
        assert self.allowed is not None
        return self.allowed


if __name__=='__main__':
    oracle=MalletGateOracle()
    fixtures=[dict(rarity=rarity,count=count,allowed=oracle.capture(rarity,count))
              for rarity in range(11) for count in range(8)]
    assert all(r['allowed']==(r['rarity']<6 and r['count']>0) for r in fixtures)
    (ROOT.parent.parent/'tests/current_mallet_gate_native.json').write_text(json.dumps(
        dict(buildSha256=BUILD,boundary='DoCraftResult 0x14081605b..0x14081654a; recipe type matching and global guards separate',fixtures=fixtures),separators=(',',':'))+'\n',encoding='utf8')
    print('PASS',len(fixtures),'native Mallet eligibility cases')
