"""Native normal name selection with fixture-owned English/string services."""
import json
from probe_normal_names import NameProbe, ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *


class NormalNameOracle(NameProbe):
    def __init__(self):
        super().__init__()
        self.english=json.loads((ROOT.parent.parent/'data/translations/item.json').read_text(encoding='utf8'))['entries']
        self.string_ids={v:k for k,v in self.strings.items()}
        # The text dump omits the empty initializer used for both name parts.
        self.put(0x150bfa3f8,self.text_value(''))
        for address in (0x14018c1b0,0x14018c3f0):
            self.uc.hook_add(UC_HOOK_CODE,self.service,begin=address,end=address)

    def text_value(self,text):
        if text not in self.string_ids:
            handle=50000000+len(self.strings)
            self.strings[handle]=text;self.string_ids[text]=handle
        return self.string_ids[text]

    def service(self,uc,address,size,data):
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        if self.script_hooks.get(address)=='GetLocalized':
            args=self.args(r9,40);key=self.strings[args[0]]
            assert key in self.english,('Missing original English text',key)
            self.trace.append(['localized',key])
            self.put(r8,self.text_value(self.english[key]['en']));result=r8
        elif address in (0x14018c1b0,0x14018c3f0):
            left,right=(rcx,rdx) if address==0x14018c1b0 else (rdx,r8)
            a,b=self.value(left),self.value(right)
            if a not in self.strings and b not in self.strings:return
            assert a in self.strings and b in self.strings,('Mixed name operation',a,b,hex(self.stack64(0)))
            self.put(rcx,self.text_value(self.strings[a]+self.strings[b]));result=rcx
        else:return super().service(uc,address,size,data)
        uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)

    def capture_name(self,row,definition,cls):
        result=self.capture(row,definition,cls)
        return {k:self.strings[v] for k,v in result['info'].items() if v in self.strings}

    def affix_key(self,side,index):
        address=next(a for a,n in self.observe.items() if n==('ReturnPrefixName' if side==0 else 'ReturnSuffixName'))
        self.trace=[];self.put(0x110000,index);self.write64(0x111000,0x110000)
        rsp=0x3f0008;self.write64(rsp,0x103000);self.write64(rsp+40,0x111000);self.put(0x112000,None)
        for register,value in ((UC_X86_REG_RSP,rsp),(UC_X86_REG_RCX,0),(UC_X86_REG_RDX,0),(UC_X86_REG_R8,0x112000),(UC_X86_REG_R9,1)):
            self.uc.reg_write(register,value)
        self.uc.emu_start(address,0x103000,count=1000000)
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x103000
        value=self.value(0x112000)
        return self.strings.get(value,value)


if __name__=='__main__':
    from audit_generation_coverage import equipment_rows
    oracle=NormalNameOracle()
    key,cls,sub,row=next(r for r in equipment_rows() if r[0]=='normal:3:1:0')
    for quality in (1,100,200,1000):
        print(quality,oracle.capture_name(row,dict(a=1,b=0,c=0,j=sub,n=quality),cls))
    print('Prefix 251:',oracle.affix_key(0,251))
