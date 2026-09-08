"""Capture current Crystal pool outcomes by running native LoadRandomSatanicStat."""
import json
import math
import struct
from native_modifier_oracle import ModifierOracle, ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

class CrystalOracle(ModifierOracle):
    def __init__(self):
        super().__init__()
        self.arrays={}
        for address in (0x14b5220b0,0x14018d280,0x14b51a170,0x1401bd8b0,0x1401bd9f0,0x1401897c0):
            self.uc.hook_add(UC_HOOK_CODE,self.service,begin=address,end=address)

    def array(self,values):
        if not self.arrays:self.array_elements={}
        handle=10000000+len(self.arrays)
        self.arrays[handle]=values
        return handle

    def service(self,uc,address,size,_):
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        result=r8
        if address==0x1401897c0:
            # Assignment preserves the RValue. Fixture-owned data does not
            # participate in the game runner's GC or reference-count callbacks.
            uc.mem_write(rcx,bytes(uc.mem_read(rdx,16)));result=rcx
        elif address==0x1401bd8b0:
            assert rdx>=r8, 'This fixture needs padded arguments'
            uc.mem_write(rcx,struct.pack('<IIQ',rdx,0,r9));result=rcx
        elif address==0x1401bd9f0: result=0
        elif address==0x14b5220b0:
            values=[self.value(r9)] if r8 else []
            values += [self.value(self.stack64(40+8*i)) for i in range(r8-1)]
            result=rcx;self.put(result,self.array(values))
        elif address==0x14b51a170:
            result=rcx;self.put(result,self.arrays[self.value(rdx)][r8])
        elif address==0x14018d280:
            # The runner returns an element address, which callers may retain.
            # A shared scratch RValue aliases distinct bounds in native code.
            owner=self.value(rcx);pair=(owner,rdx)
            if pair not in self.array_elements:self.array_elements[pair]=0x160000+16*len(self.array_elements)
            result=self.array_elements[pair];self.put(result,self.arrays[owner][rdx])
        elif address==0x1407213f0:
            upper=self.args(r9,40)[0]
            index=len(self.draws)
            roll=self.selector if index==0 else (upper if self.maximum else 0)
            assert 0<=roll<=upper,(roll,upper)
            self.draws.append(upper);self.put(r8,roll)
        elif address==0x14b4c6210 and self.ids[self.stack64(40)&0xffffffff] in ('ceil','is_array','@@NewGMLArray@@'):
            name=self.ids[self.stack64(40)&0xffffffff];args=self.args(r9,48)
            value=math.ceil(args[0]) if name=='ceil' else (args[0] in self.arrays if name=='is_array' else self.array(args))
            self.put(r8,value)
        elif address==0x14b4c6340:
            method=self.value(self.stack64(40));name=self.methods[method];args=self.args(r9,48)
            if name=='GetItemStat': self.put(r8,self.current.get(args[0]))
            elif name=='GetItemInfo': self.put(r8,self.rarity)
            elif name=='SetItemStat': self.current[args[0]]=args[1];self.put(r8,None)
            else: return super().service(uc,address,size,_)
        else: return super().service(uc,address,size,_)
        uc.reg_write(UC_X86_REG_RAX,result)
        uc.reg_write(UC_X86_REG_RIP,self.stack64(0))
        uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)

    def capture(self,group,selector,subtype=1,maximum=False,itemType=1,unique=True,rarity=6,existing=None):
        self.selector=selector;self.maximum=maximum;self.rarity=rarity;self.draws=[];self.current=dict(existing or {});self.arrays={}
        self.definition={'c':int(unique)}
        self.handles={'itemType':itemType,'itemDefinitionStruct':10,'AddStat':20,'SetItemStat':21,'GetItemStat':23,'GetItemInfo':24}
        self.methods={v:k for k,v in self.handles.items() if v>=20}
        for index,value in enumerate((group,100,subtype,None)):
            self.put(0x110000+16*index,value);self.write64(0x111000+8*index,0x110000+16*index)
        rsp=0x3f0008;self.write64(rsp,0x103000);self.write64(rsp+40,0x111000)
        for register,value in ((UC_X86_REG_RSP,rsp),(UC_X86_REG_RCX,0),(UC_X86_REG_RDX,0),(UC_X86_REG_R8,0x112000),(UC_X86_REG_R9,4)):
            self.uc.reg_write(register,value)
        try: self.uc.emu_start(0x14429a250,0x103000,count=1000000)
        except Exception:
            print('Stopped at',hex(self.uc.reg_read(UC_X86_REG_RIP)))
            raise
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x103000
        return {'stats':{k:self.arrays.get(v,v) for k,v in self.current.items()},'draws':self.draws}

if __name__=='__main__':
    oracle=CrystalOracle()
    pools={};fixtures=[]
    for group,count in ((1,23),(2,17),(3,17),(5,18)):
        pool=[]
        for selector in range(count):
            keys=[];ranges=set()
            for subtype in range(1,6):
                low=oracle.capture(group,selector,subtype)
                high=oracle.capture(group,selector,subtype,maximum=True)
                key,minimum,maximum=low['stats'][0]
                keys.append(int(key));ranges.add((minimum,maximum))
                assert low['stats'][key]==minimum and high['stats'][key]==maximum
                for existing in (0,87.25):
                    for itemType,unique,rarity in ((1,True,7),(10,True,6),(10,False,1),(10,False,2)):
                        result=oracle.capture(group,selector,subtype,maximum=True,itemType=itemType,unique=unique,rarity=rarity,existing={key:existing})
                        fixtures.append(dict(group=group,selector=selector,subtype=subtype,itemType=itemType,unique=unique,rarity=rarity,existing=existing,key=int(key),maximum=True,expected=result['stats'][key]))
            assert len(ranges)==1
            minimum,maximum=ranges.pop()
            pool.append({'minimum':minimum,'maximum':maximum,**({'key':keys[0]} if len(set(keys))==1 else {'keysBySubtype':keys})})
        pools[group]=pool
    rules={'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4','pools':pools,'charmMultipliers':{'1':0.33,'2':0.66}}
    (ROOT.parent.parent/'data/current_crystal_rules.json').write_text(json.dumps(rules,indent=2)+'\n')
    (ROOT.parent.parent/'engine/crystal_rules.js').write_text('// Extracted by native_crystal_oracle.py from current native pool code.\nexport const CRYSTAL_RULES = '+json.dumps(rules,separators=(',',':'))+';\n')
    (ROOT.parent.parent/'tests/current_crystal_native.json').write_text(json.dumps({'buildSha256':rules['buildSha256'],'oracle':'Native LoadRandomSatanicStat with controlled CPR extremes','rows':fixtures},separators=(',',':'))+'\n')
    print(f'PASS {sum(map(len,pools.values()))} native pool entries; {len(fixtures)} native Crystal values')
