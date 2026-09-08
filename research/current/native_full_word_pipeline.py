"""Full base/normal/Crystal/matching/LoadRunewords chain, decoded socket fixtures."""
import json
from native_crystal_word_pipeline import CrystalWordOracle,ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *


class FullWordOracle(CrystalWordOracle):
    def __init__(self):
        super().__init__()
        self.socket_rows=json.loads((ROOT/'socket-definitions.json').read_text())
        self.uc.hook_add(UC_HOOK_CODE,self.full_boundary,begin=0x1406f3c24,end=0x1406f3c24)

    def word_boundary(self,uc,*_):
        self.word=self.value(uc.reg_read(UC_X86_REG_RAX))
        self.before_word=dict(self.current)

    def full_boundary(self,uc,*_):
        self.reached=True;uc.reg_write(UC_X86_REG_RIP,0x103000);uc.emu_stop()

    def service(self,uc,address,size,data):
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        result=r8
        if self.script_hooks.get(address)=='GetRuneword':
            super().service(uc,address,size,data)
            for row in self.rows:
                obj=self.objects[100000+row['b']]
                for i,(field,source) in enumerate((('itemBaseStatStruct','SetBaseItemStat'),('itemData2H','itemData2H'),('itemDataArmor','itemDataArmor'),('itemBaseInfoStruct','itemBaseInfoStruct'))):
                    owner=200000+row['b']*4+i
                    self.objects[owner]={int(k):self.array(v) if isinstance(v,list) else v for n,(k,v) in row['calls'] if n==source}
                    obj[field]=owner
            rune_items=[None]*(max(r['b'] for r in self.socket_rows)+1)
            for row in self.socket_rows:
                owner=300000+row['b'];rune_items[row['b']]=owner
                self.objects[owner]={int(k):v for n,(k,v) in row['calls'] if n=='itemBaseInfoStruct'}
            self.rune_items=self.array(rune_items)
            return
        if self.matching and address==0x14b4c9800:
            name=self.ids[rdx&0xffffffff]
            owner=self.value(rcx) if name in ('itemBaseStatStruct','itemData2H','itemDataArmor') else None
            if name=='itemRepoNormal' and r8==15:value=self.rune_items
            elif name in ('itemBaseStatStruct','itemData2H','itemDataArmor') and owner in self.objects and 100001<=owner<=100100:
                value=self.objects[owner][name]
            else:return super().service(uc,address,size,data)
            result=r9;self.put(result,value)
        elif self.matching and address==0x14b4c6340:
            name=self.methods[self.value(self.stack64(40))];args=self.args(r9,48)
            if name in ('GetBaseItemStat','GetBaseItemInfo') and 100001<=rcx<=100100:
                table=self.objects[rcx]['itemBaseStatStruct' if name=='GetBaseItemStat' else 'itemBaseInfoStruct']
                value=self.objects[table].get(int(args[0]))
            elif name=='GetBaseItemInfo' and 300000<=rcx<301000:value=self.objects[rcx].get(int(args[0]))
            else:return super().service(uc,address,size,data)
            self.put(r8,value)
        else:return super().service(uc,address,size,data)
        uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)


if __name__=='__main__':
    from audit_generation_coverage import equipment_rows
    oracle=FullWordOracle();word=oracle.rows[0]
    _,cls,sub,row=next(r for r in equipment_rows() if r[0]=='normal:3:1:0')
    for q in (0,1,2):
        definition=dict(a=42,b=0,c=0,j=sub,q=q,ab=123456,zz={'sockets':len(word['fields']['runewordRunes'])})
        definition.update({f's{i+1}':dict(a=1,b=b,c=0) for i,b in enumerate(word['fields']['runewordRunes'])})
        print(json.dumps(oracle.capture_pipeline(row,definition,cls)),flush=True)
