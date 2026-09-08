"""Verify native GetItemInfo defaults and the socket restriction equality."""
import json
from native_add_sockets_gate import AddSocketsGateOracle,ROOT
from unicorn.x86_const import *

class SocketRestrictionOracle(AddSocketsGateOracle):
    def service(self,uc,address,size,data):
        if address==0x130200 and uc.reg_read(UC_X86_REG_RCX)==0x120000:
            assert self.ids[uc.reg_read(UC_X86_REG_RDX)&0xffffffff]=='itemInfoStruct'
            result=0x122000;self.put(result,13)
            uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8);return
        return super().service(uc,address,size,data)

    def read_info(self,fields,params):
        self.capture_item({'calls':[]},{'a':1,'b':0,'c':0},entry=0x103000,params=params)
        self.info.update(fields)
        self.write64(0x120000,0x121000);self.write64(0x121008,0x130200)
        self.uc.reg_write(UC_X86_REG_RCX,0x120000)
        self.uc.emu_start(0x143e50130,0x103000,count=1000000)
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x103000
        return self.value(0x112000)

if __name__=='__main__':
    x=SocketRestrictionOracle();rows=[]
    for present,value in [(False,None),(True,None),(True,False),(True,True),(True,-1),(True,0),(True,1),(True,2)]:
        for fallback in (None,False,True,-1,2):
            fields={50:value} if present else {};params=[50,fallback]
            resolved=x.read_info(fields,params)
            allowed=x.capture(3,1,resolved,None,0)
            rows.append(dict(present=present,value=value,fallback=fallback,resolved=resolved,allowed=allowed))
    (ROOT.parent.parent/'tests/current_socket_restriction_native.json').write_text(json.dumps({'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
        'source':'Original GetItemInfo with fixture-owned fields, followed by original Add Sockets gate; producer of field 50 not inferred.',
        'fixtures':rows},separators=(',',':'))+'\n',encoding='utf8')
    print('Captured',len(rows),'native socket restriction/default cases.',flush=True)
