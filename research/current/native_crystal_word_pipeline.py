"""Original CreateItemNew through Crystal application and word recognition."""
import json
from native_word_matching import WordMatchingOracle,ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *


class CrystalWordOracle(WordMatchingOracle):
    def __init__(self):
        super().__init__()
        self.uc.hook_add(UC_HOOK_CODE,self.word_boundary,begin=0x1406f3a34,end=0x1406f3a34)

    def service(self,uc,address,size,data):
        name=self.script_hooks.get(address)
        if name=='CreateItemInit':return
        if name=='GetRuneword':
            for row in self.rows:
                self.objects[100000+row['b']]={name:self.array(value) if isinstance(value,list) else value for name,value in row['fields'].items()}
            self.matching=True
        return super().service(uc,address,size,data)

    def word_boundary(self,uc,*_):
        self.word=self.value(uc.reg_read(UC_X86_REG_RAX))
        self.reached=True;uc.reg_write(UC_X86_REG_RIP,0x103000);uc.emu_stop()

    def capture_pipeline(self,row,definition,cls):
        self.reached=False;self.matching=False
        try:result=self.capture_item(row,definition,cls)
        finally:self.matching=False
        assert self.reached,'Full item/Crystal/recognition boundary not reached'
        return dict(word=self.word,stats={k:self.arrays.get(v,v) for k,v in result['stats'].items()},info=result['info'])


if __name__=='__main__':
    from audit_generation_coverage import equipment_rows
    oracle=CrystalWordOracle();word=oracle.rows[0]
    _,cls,sub,row=next(r for r in equipment_rows() if r[0]=='normal:3:1:0')
    for q in (0,1,2):
        definition=dict(a=42,b=0,c=0,j=sub,q=q,ab=123456,zz={'sockets':len(word['fields']['runewordRunes'])})
        definition.update({f's{i+1}':dict(a=1,b=b,c=0) for i,b in enumerate(word['fields']['runewordRunes'])})
        print(json.dumps(oracle.capture_pipeline(row,definition,cls)),flush=True)
