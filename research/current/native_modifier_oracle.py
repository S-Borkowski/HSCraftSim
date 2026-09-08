"""Replay current native definition generation with minimal runner/struct stubs.

The game's corruption, exclusion, star, tier and rounding branches execute as
machine code. Struct access and deterministic random draws are the only game
services replaced. No game executable is launched or altered.
"""
import json
import math
import struct
from native_upgrade_oracle import Oracle, ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

class ModifierOracle(Oracle):
    def __init__(self):
        super().__init__()
        self.ids = {}
        for name,address,_ in (line.split('\t') for line in (ROOT/'variable-slots.txt').read_text().splitlines() if line.count('\t')==2):
            if name in ('itemDefinitionStruct','r','p','struct_get_from_hash','itemBaseStatStruct','variable_struct_get','is_array','is_undefined','floor','AddStat','itemStatStruct','itemInfoStruct','GetBaseItemInfo','SetItemStat','zpm1','@@array_get@@','@@NewGMLArray@@','ceil','c','GetItemInfo','GetItemStat','itemType'):
                number=len(self.ids)+1000
                self.ids[number]=name
                self.uc.mem_write(int(address,16),struct.pack('<i',number))
        self.write64(0x150864090,0x130000)
        self.write64(0x130000,0x130100)
        self.write64(0x130108,0x130200)
        self.put(0x130300,0.01)
        for address in (0x130200,0x14b4c9800,0x14b4c6210,0x14b4c6340,0x1401bc0c0,0x1407213f0,0x1438433b0):
            self.uc.hook_add(UC_HOOK_CODE,self.service,begin=address,end=address)

    def put(self,address,value):
        self.uc.mem_write(address,struct.pack('<dII',float(value),0,0) if value is not None else struct.pack('<QII',0,0,5))

    def stack64(self,offset):
        return struct.unpack('<Q',self.uc.mem_read(self.uc.reg_read(UC_X86_REG_RSP)+offset,8))[0]

    def args(self,count,offset):
        pointer=self.stack64(offset)
        return [self.value(struct.unpack('<Q',self.uc.mem_read(pointer+8*i,8))[0]) for i in range(count)]

    def service(self,uc,address,size,_):
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        result=r8
        if address==0x130200:
            result=0x130300
        elif address==0x1401bc0c0:
            result=int(self.value(rcx))
        elif address==0x14b4c9800:
            member=self.ids[rdx & 0xffffffff]
            result=r9
            self.put(result,self.handles[member])
        elif address==0x14b4c6210:
            name=self.ids[self.stack64(40)&0xffffffff]
            args=self.args(r9,48)
            if name=='struct_get_from_hash': value=self.definition[self.ids[int(args[1])]]
            elif name=='variable_struct_get': value=self.objects[args[0]].get(int(args[1]))
            elif name=='is_undefined': value=args[0] is None
            elif name=='is_array': value=False
            elif name=='floor': value=math.floor(args[0])
            else: raise ValueError((name,args))
            self.put(r8,value)
        elif address==0x14b4c6340:
            method=self.value(self.stack64(40))
            name=self.methods[method]
            args=self.args(r9,48)
            if name=='GetBaseItemInfo': value=self.tier
            elif name in ('AddStat','SetItemStat'):
                key=int(args[0]); value=None
                self.current[key]=(self.current.get(key,0)+args[1]) if name=='AddStat' else args[1]
            else: raise ValueError((name,args))
            self.put(r8,value)
        elif address==0x1407213f0:
            # Scalar fixtures never need RNG. Fail if the test accidentally does.
            raise ValueError('Unexpected random draw in scalar fixture')
        elif address==0x1438433b0:
            self.put(r8,0) # Price is independent of returned stats.
        uc.reg_write(UC_X86_REG_RAX,result)
        uc.reg_write(UC_X86_REG_RIP,self.stack64(0))
        uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)

    def generate(self,key,value,stars=0,corrupted=False,tier=5,skill=None):
        self.definition={'p':stars,'r':int(corrupted)}
        self.tier=tier
        self.current={}
        base={key:value}
        if skill is not None: base[{203:202,206:205,209:208}[key]]=skill
        self.handles={'itemDefinitionStruct':10,'itemBaseStatStruct':11,'itemStatStruct':12,'itemInfoStruct':13,
                      'AddStat':20,'SetItemStat':21,'GetBaseItemInfo':22}
        self.methods={v:k for k,v in self.handles.items() if v>=20}
        self.objects={11:base,12:self.current,13:{}}
        for index,value in enumerate((key,100,101)):
            self.put(0x110000+16*index,value)
            self.write64(0x111000+8*index,0x110000+16*index)
        rsp=0x3f0008
        self.write64(rsp,0x103000); self.write64(rsp+40,0x111000)
        for register,value in ((UC_X86_REG_RSP,rsp),(UC_X86_REG_RCX,0),(UC_X86_REG_RDX,0),(UC_X86_REG_R8,0x112000),(UC_X86_REG_R9,3)):
            self.uc.reg_write(register,value)
        try: self.uc.emu_start(0x140702240,0x103000,count=1000000)
        except Exception:
            print('Stopped at',hex(self.uc.reg_read(UC_X86_REG_RIP)))
            raise
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x103000
        return self.current.get(key)

if __name__=='__main__':
    oracle=ModifierOracle()
    rules=json.loads((ROOT.parent.parent/'data/current_modifier_rules.json').read_text())
    rows=[]
    keys=sorted(set(map(int,rules['upgrades']))|set(rules['corruptionExempt'])|{201,202,203,206,209,288,352})
    for key in keys:
        if not 22<=key<476 or key in rules['nonNumericStats'] or key==221: continue
        for value in (83,83.25,-17):
            for stars,corrupted,tier in ((0,True,5),(1,False,5),(3,False,5),(5,False,5),(3,False,0),(3,False,2),(3,True,5)):
                expected=oracle.generate(key,value,stars,corrupted,tier)
                assert expected is not None,(key,value)
                rows.append(dict(key=key,value=value,stars=stars,corrupted=corrupted,tier=tier,expected=expected))
    for key in (203,206,209):
        for skill in (569,570,557,573,531,571,609,532,548,553):
            for stars in (1,3,5):
                for level in (0,1,1.25,2,8):
                    rows.append(dict(key=key,value=level,stars=stars,corrupted=False,tier=5,skillId=skill,
                        expected=oracle.generate(key,level,stars,False,5,skill)))
    target=ROOT.parent.parent/'tests/current_modifier_native.json'
    target.write_text(json.dumps({'buildSha256':rules['buildSha256'],'oracle':'Unmodified native CreateItemCheckGenerationCases executed in x86-64 emulator; scalar definitions','rows':rows},separators=(',',':'))+'\n')
    print(f'PASS {len(rows)} native star/corruption fixtures; {target}')
