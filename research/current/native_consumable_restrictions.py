"""Capture original consumable metadata, including the producer of info50.

The room-name service uses opaque fixture identities. Its return values are
only stored in Codex room metadata; they do not decide socket restrictions.
All original case branches and field writes execute in the emulator.
"""
import json,pefile,struct
from native_equipment_definitions import EquipmentOracle,config_for,ROOT
from unicorn.x86_const import *


class ConsumableRestrictionOracle(EquipmentOracle):
    def __init__(self):
        pe=pefile.PE(str(ROOT/'HeroSiegeC6E.exe'),fast_load=True)
        d=pe.OPTIONAL_HEADER.DATA_DIRECTORY[3]
        bounds={b:e for b,e,_ in struct.iter_unpack('<III',pe.get_data(d.VirtualAddress,d.Size))}
        start=json.loads((ROOT/'routines.json').read_text())['routines']['gml_Script_DefineItemNormalConsumable']
        super().__init__(**config_for(pe,start,bounds[start]))

    def service(self,uc,address,size,data):
        if address==0x14b4c6210 and self.ids[self.stack64(40)&0xffffffff]=='room_get_name':
            args=self.args(uc.reg_read(UC_X86_REG_R9),48)
            assert len(args)==1
            result=uc.reg_read(UC_X86_REG_R8)
            self.put(result,args[0])
            uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8);return
        return super().service(uc,address,size,data)


if __name__=='__main__':
    x=ConsumableRestrictionOracle();rows=[x.capture(i) for i in range(len(x.targets))]
    output=dict(buildSha256='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
        source='Original DefineItemNormalConsumable case bodies; room names opaque; shared constructor/prefix excluded.',rows=rows)
    (ROOT/'consumable-restrictions-native.json').write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf8')
    for row in rows:
        fields={int(k):v for name,(k,v) in row['calls'] if name in ('itemBaseInfoStruct','SetBaseItemInfo')}
        print('Consumable',row['b'],'info50 =',fields.get(50,'absent'),flush=True)
    print('Captured',len(rows),'original consumable definitions.',flush=True)
