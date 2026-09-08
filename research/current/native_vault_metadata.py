"""Capture each native Vault case up to its objective-structure allocation."""
import json,pefile
from native_equipment_definitions import EquipmentOracle,config_for,ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

class VaultMetadataOracle(EquipmentOracle):
    def __init__(self):
        pe=pefile.PE(str(ROOT/'HeroSiegeC6E.exe'),fast_load=True)
        super().__init__(**config_for(pe,0xc210c0,0xc272b0))
        self.uc.hook_add(UC_HOOK_CODE,self.service,begin=0x14018bf00,end=0x14018bf00)

    def service(self,uc,address,size,data):
        if address==0x14b4c6210 and self.ids[self.stack64(40)&0xffffffff]=='@@NewGMLObject@@':
            assert any(args[0]==32 for _,args in self.calls)
            self.metadata_boundary=hex(self.stack64(0))
            uc.reg_write(UC_X86_REG_RIP,self.stop);uc.emu_stop();return
        if address in (0x14018bf00,0x14018bf30):
            result=uc.reg_read(UC_X86_REG_RCX);self.put(result,uc.reg_read(UC_X86_REG_RDX))
            uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8);return
        return super().service(uc,address,size,data)

if __name__=='__main__':
    x=VaultMetadataOracle();rows=[]
    for i in range(7):
        result=x.capture(i);result['stopBeforeObjectives']=x.metadata_boundary;rows.append(result)
        print(i,result['calls'],flush=True)
    (ROOT/'vault-metadata-native.json').write_text(json.dumps({'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
        'source':'Original DefineItemNormalVault cases until objective allocation; excludes shared prefix and objective generation.',
        'rows':rows},separators=(',',':'))+'\n',encoding='utf8')
