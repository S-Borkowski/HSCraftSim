"""Execute current tooltip numeric blocks with fixture-owned item/context data.

These boundaries precede formatting. No combat stats, localization or guessed
damage ranges are substituted for the original item's numeric tooltip code.
"""
import json,struct
from native_item_generation import ItemGenerationOracle
from unicorn.x86_const import *


class DisplayOracle(ItemGenerationOracle):
    PARTS={
        'attack':(0x143e9c587,0x143e9dcf6,0xb7c8,0xb7d8),
        'speed':(0x143e9e556,0x143e9f561,0xb808,0xb818),
        'defense':(0x143e9fdc6,0x143ea1c2a,0xb848,0xb858),
    }

    def capture_display(self,part,stats,*,item_type=3,rarity=6,w=1,level=100):
        self.arrays={};self.lvalues={};self.objects={};self.current=dict(stats)
        self.definition={'w':w};self.info={27:rarity};self.trace=[]
        self.handles={'itemDefinitionStruct':10,'GetItemInfo':20,'GetItemStat':21}
        self.methods={20:'GetItemInfo',21:'GetItemStat'}
        self.objects={10:self.definition}
        frame=0x3d0008;self.uc.mem_write(frame,bytes(0x10000))
        self.put(frame+0xb518,item_type);self.put(frame+0xb558,level)
        for i,value in enumerate((0,0,100)):
            self.put(0x110000+16*i,value);self.write64(0x111000+8*i,0x110000+16*i)
        self.uc.mem_write(frame+0xf568,struct.pack('<I',3))
        self.write64(frame+0xf570,0x111000)
        self.uc.reg_write(UC_X86_REG_RSP,frame)
        start,stop,raw,modified=self.PARTS[part]
        self.uc.emu_start(start,stop,count=100000)
        assert self.uc.reg_read(UC_X86_REG_RIP)==stop,hex(self.uc.reg_read(UC_X86_REG_RIP))
        return {'base':self.value(frame+raw),'modified':self.value(frame+modified),'trace':self.trace}


if __name__=='__main__':
    x=DisplayOracle()
    for part,stats in [('attack',{22:64,28:479}),('speed',{23:1.75,68:40}),('defense',{154:329,29:584})]:
        try: print(part,x.capture_display(part,stats,item_type=1 if part=='defense' else 3))
        except Exception as e:print(part,'ERROR',str(e),'at',hex(x.uc.reg_read(UC_X86_REG_RIP)),x.trace[-10:])
