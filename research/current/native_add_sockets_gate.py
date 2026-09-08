"""Execute only the current DoCraftResult Add Sockets eligibility block.

Inputs (itemType, info27/50, def.s and stat20) and runner storage are fixture
owned. The original branch sequence runs unchanged from 0x140807345 until its
decision at 0x140808532. Ingredient matching, mutation and global craft guards
are outside this boundary. The game is never launched.
"""
import itertools
import json
from native_item_generation import ItemGenerationOracle, ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_RIP, UC_X86_REG_RSP


class AddSocketsGateOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__()
        # Initialize the fixture services without executing item generation.
        self.capture_item({'calls':[]},{'a':1,'b':0,'c':0},3,entry=0x103000)
        self.gate_stack=0x3e0000
        self.uc.hook_add(UC_HOOK_CODE,self.stop_gate,begin=0x140808532,end=0x140808532)

    def stop_gate(self,uc,address,size,data):
        self.allowed=not bytes(uc.mem_read(self.gate_stack+0x151,1))[0]
        uc.reg_write(UC_X86_REG_RIP,0x103000)
        uc.emu_stop()

    def capture(self,item_type,rarity,restricted,seed,count):
        self.allowed=None
        self.definition={} if seed is None else {'s':seed}
        self.info={27:rarity,50:restricted}
        self.current={20:count}
        self.trace=[]
        rsp=self.gate_stack
        self.uc.mem_write(rsp,bytes(0x9000))
        self.put(rsp+0x340,item_type)
        self.write64(rsp+0x8d48,3)
        self.write64(rsp+0x8d50,0x111000)
        self.put(0x110020,100)
        self.write64(0x111010,0x110020)
        self.uc.reg_write(UC_X86_REG_RSP,rsp)
        self.uc.emu_start(0x140807345,0x103000,count=300000)
        assert self.allowed is not None,'Native eligibility decision was not reached'
        return self.allowed


if __name__=='__main__':
    oracle=AddSocketsGateOracle()
    rows=[]
    for cls,rarity,restricted,seed,count in itertools.product(range(14),range(11),(False,True),(None,0,123456),(0,3)):
        rows.append(dict(itemType=cls,rarity=rarity,restricted=restricted,seed=seed,count=count,
            allowed=oracle.capture(cls,rarity,restricted,seed,count)))
    path=ROOT.parent.parent/'tests/current_add_sockets_gate_native.json'
    path.write_text(json.dumps({'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
        'source':'Native DoCraftResult Add Sockets eligibility block; fixture-owned item fields, no mutation or ingredient matching.',
        'fixtures':rows},separators=(',',':'))+'\n',encoding='utf8',newline='\n')
    print('Captured',len(rows),'native Add Sockets decisions;',sum(r['allowed'] for r in rows),'allowed.',flush=True)
