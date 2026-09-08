"""Execute current GetRuneword against captured repository metadata.

Fixture socket definitions are decoded runtime structs. The complete native
100-word search and type/handed/count/order checks run unchanged.
"""
import json
from native_item_generation import ItemGenerationOracle,ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

class WordMatchingOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__()
        self.rows=json.loads((ROOT/'runeword-definitions-native.json').read_text(encoding='utf8'))
        self.matching=False
        self.routines=json.loads((ROOT/'routines.json').read_text())['routines']
        self.uc.hook_add(UC_HOOK_CODE,self.service,begin=0x140000000+self.routines['gml_Script_GetSocketKey'],end=0x140000000+self.routines['gml_Script_GetSocketKey'])

    def service(self,uc,address,size,data):
        if not self.matching:return super().service(uc,address,size,data)
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        result=r8
        if self.script_hooks.get(address)=='GetRuneword':return
        if address==0x140000000+self.routines['gml_Script_GetSocketKey']:
            index=int(self.args(r9,40)[0]);value=next(h for h,n in self.strings.items() if n=='s'+str(index))
            self.put(r8,value)
        elif address==0x14b4c9800 and self.ids[rdx&0xffffffff]=='itemRepoRuneword':
            result=r9;self.put(result,100000+int(r8))
        elif address==0x14b4c9800 and self.ids[rdx&0xffffffff].startswith('runeword'):
            owner=self.value(rcx);name=self.ids[rdx&0xffffffff];value=self.objects[owner].get(name)
            if r8!=0x80000000:value=self.arrays[value][int(r8)]
            result=r9;self.put(result,value)
        elif address==0x14b4c6210 and self.ids[self.stack64(40)&0xffffffff]=='is_string':
            value=self.args(r9,48)[0];self.put(r8,value in self.strings)
        else:return super().service(uc,address,size,data)
        uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)

    def capture_match(self,definition,*,item_type=3,handed=1,sockets=0,rarity=1):
        self.matching=False
        self.capture_item({'calls':[]},{'a':1,'b':0,'c':0,'j':1,**definition},item_type,entry=0x103000)
        self.info={27:rarity,21:handed};self.current={20:sockets}
        self.objects[13]=self.info;self.objects[14]=self.current
        for row in self.rows:
            self.objects[100000+row['b']]={name:self.array(value) if isinstance(value,list) else value for name,value in row['fields'].items()}
        rsp=0x3f0008;self.write64(rsp,0x103000);self.write64(rsp+40,0x111000)
        for reg,val in ((UC_X86_REG_RSP,rsp),(UC_X86_REG_RCX,0),(UC_X86_REG_RDX,0),(UC_X86_REG_R8,0x112000),(UC_X86_REG_R9,1)):
            self.uc.reg_write(reg,val)
        self.matching=True
        try:self.uc.emu_start(0x1438a8f70,0x103000,count=3000000)
        except Exception:
            print('Stopped',hex(self.uc.reg_read(UC_X86_REG_RIP)),self.trace[-8:],flush=True);raise
        finally:self.matching=False
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x103000
        return dict(word=self.value(0x112000),trace=self.trace)

if __name__=='__main__':
    oracle=WordMatchingOracle()
    for row in [r for r in oracle.rows if r['b'] in (1,93)]:
        ids=row['fields']['runewordRunes'];definition={f's{i+1}':{'a':1,'b':b,'c':0} for i,b in enumerate(ids)}
        print(row['b'],oracle.capture_match(definition,sockets=len(ids),item_type=11 if row['b']==93 else 3))
