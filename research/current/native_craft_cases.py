"""Bounded native DoCraftResult mutation cases with fixture-owned runner data.

This captures the selected case's edits, not ingredient matching, notifications,
repository item creation, or later regeneration. Controlled irandom values let
tests cover every threshold. No game process is started.
"""
import json
import struct
from native_item_generation import ItemGenerationOracle, ROOT
from unicorn import UC_HOOK_BLOCK, UC_HOOK_CODE
from unicorn.x86_const import *


class CraftCaseOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__()
        self.capture_item({'calls':[]},{'a':1,'b':0,'c':0},3,entry=0x103000)
        self.cases=[0x140000000+v for v in struct.unpack('<32I',self.uc.mem_read(0x140870048,128))]
        self.active_case=None
        self.uc.hook_add(UC_HOOK_BLOCK,self.boundary)
        self.uc.hook_add(UC_HOOK_CODE,self.service,begin=0x14b4c5ff0,end=0x14b4c5ff0)
        self.uc.hook_add(UC_HOOK_CODE,self.service,begin=0x14b51a3e0,end=0x14b51a3e0)

    def boundary(self,uc,address,size,data):
        if self.active_case is not None and 0x140803e80<=address<0x140870048:
            start=self.cases[self.active_case]
            end=min([a for a in self.cases if a>start]+[0x1408639f4])
            if not start<=address<end:
                self.completed=hex(address)
                uc.reg_write(UC_X86_REG_RIP,0x103000)
                uc.emu_stop()

    def service(self,uc,address,size,data):
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        result=r8
        if address==0x14b51a3e0:
            assert self.rolls,('Missing native irandom roll',rcx)
            value=self.rolls.pop(0);assert 0<=value<=rcx,(value,rcx)
            self.trace.append(['irandom',rcx,value])
            uc.reg_write(UC_X86_REG_XMM0,int.from_bytes(struct.pack('<d',value),'little'))
            result=0
        elif address==0x14b4c5ff0:
            name=self.ids[self.stack64(40)&0xffffffff]
            args=[] if name=='audio_play_sound' else self.args(r9,48)
            self.trace.append(['script',name,args])
            if name=='GetVariable':value=args[0]
            else:raise ValueError(('Unmapped script',name,args))
            self.put(r8,value)
        elif address==0x14b4c9800 and self.ids[rdx&0xffffffff]=='gDataProtected' and r8==192:
            result=r9;self.put(result,1000000000)
        elif address==0x14b4c9cf0 and self.ids[rdx&0xffffffff] in ('a','p','q','r','s','sh','ab','t','u','v'):
            owner=self.value(rcx);name=self.ids[rdx&0xffffffff];value=self.value(r9)
            assert owner==10,('Unexpected mutation target',owner,name)
            self.definition[name]=value;self.edits[name]=value
        elif address==0x14b4c6210:
            name=self.ids[self.stack64(40)&0xffffffff]
            args=[] if name=='audio_play_sound' else self.args(r9,48)
            self.trace.append(['builtin',name,args])
            if name=='irandom':
                assert self.rolls,('Missing controlled roll',args,hex(self.stack64(0)))
                value=self.rolls.pop(0);assert 0<=value<=args[0],(value,args)
                self.trace.append(['irandom',args[0],value])
            elif name in ('audio_play_sound','show_debug_message'):value=0
            elif name=='variable_struct_get' and args[0]==400:value=10
            else:return super().service(uc,address,size,data)
            self.put(r8,value)
        else:return super().service(uc,address,size,data)
        uc.reg_write(UC_X86_REG_RAX,result)
        uc.reg_write(UC_X86_REG_RIP,self.stack64(0))
        uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)

    def capture(self,case,rolls,definition=None,rarity=6,item_type=3):
        self.definition={'a':123456,'b':0,'c':int(rarity>=6),'j':1,'p':0,'q':0,'r':0,**(definition or {})}
        self.info={27:rarity,32:5};self.handles['itemType']=item_type
        self.objects[10]=self.definition;self.objects[13]=self.info;self.objects[400]={0:10}
        self.current={20:0};self.trace=[];self.edits={};self.rolls=list(rolls)
        rsp=0x3e0000;self.uc.mem_write(rsp,bytes(0x9000))
        for i,value in enumerate((100,0,100,400,0,0)):
            self.put(0x110000+16*i,value);self.write64(0x111000+8*i,0x110000+16*i)
        self.write64(rsp+0x8d48,6);self.write64(rsp+0x8d50,0x111000)
        self.put(rsp+0x180,400);self.put(rsp+0x168,0)
        self.put(0x130300,99);self.write64(rsp+0xf00,0x130300)
        self.uc.reg_write(UC_X86_REG_RSP,rsp)
        self.active_case=case;self.completed=None
        try:self.uc.emu_start(self.cases[case],0x103000,count=1000000)
        except Exception:
            print('Stopped',hex(self.uc.reg_read(UC_X86_REG_RIP)),self.trace[-5:],self.edits,flush=True)
            raise
        finally:self.active_case=None
        assert self.completed,'Native case did not reach its continuation'
        return {'edits':self.edits,'draws':self.trace,'continuation':self.completed,'unusedRolls':self.rolls}


if __name__=='__main__':
    oracle=CraftCaseOracle()
    fixtures=[]
    def add(case,mechanic,rolls,definition=None,rarity=6,item_type=3):
        result=oracle.capture(case,rolls,definition,rarity,item_type)
        assert not result['unusedRolls'],result
        edits={k:v for k,v in result['edits'].items() if k!='sh'}
        fixtures.append(dict(case=case,mechanic=mechanic,definition=definition or {},rarity=rarity,itemType=item_type,
            rolls=rolls,edits=edits,draws=[t[1:]for t in result['draws']if t[0]=='irandom']))
    for roll in range(100):
        add(3,'satanic_dice',[roll,8675309] if roll<62 else [roll])
        for item_type in (0,1,3,10,11):
            for rarity in (1,6,7,9,10):add(6,'satanic_crystal',[8675309,roll],rarity=rarity,item_type=item_type)
        for stars in range(5):add(31,'gypsys_prophecy',[roll],{'p':stars})
    for case,mechanic in ((2,'reroll_affixes'),(5,'blessed_dice'),(7,'remove_satanic_crystal'),(9,'add_sockets')):
        for seed in (0,1,123456,1000000000):add(case,mechanic,[seed],{'sh':731,'q':1,'ab':44},rarity=1)
    for case,mechanic in ((10,'delete_sockets'),(27,'cleanse_prophet'),(28,'cleanse_angel')):
        add(case,mechanic,[],{'s':123456,'sh':731,'r':1})
    path=ROOT.parent.parent/'tests/current_craft_cases_native.json'
    path.write_text(json.dumps({'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
        'source':'Original DoCraftResult mutation cases with controlled native irandom; matching, creation and regeneration excluded.',
        'fixtures':fixtures},separators=(',',':'))+'\n',encoding='utf8',newline='\n')
    print('Captured',len(fixtures),'native craft cases.',flush=True)
