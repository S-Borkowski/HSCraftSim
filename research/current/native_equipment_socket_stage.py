"""Capture normal equipment socket overrides at the native LoadCommonItems exit.

The supplied case definitions and runner storage are fixture-owned. Native
LoadCommonItems computes the count; later special/Crystal/socket-content stages
are outside this boundary. This does not certify natural sockets or affix rolls.
"""
import json
from native_item_generation import ItemGenerationOracle, ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_RIP


class EquipmentSocketStageOracle(ItemGenerationOracle):
    def observe_call(self, uc, address, size, data):
        super().observe_call(uc,address,size,data)
        if self.observe[address]=='gml_Script_LoadCommonItems':
            self.exit_address=self.stack64(0)
            self.exit_hook=uc.hook_add(UC_HOOK_CODE,self.stop_stage,begin=self.exit_address,end=self.exit_address)

    def stop_stage(self,uc,address,size,data):
        self.stage_completed=True
        uc.reg_write(UC_X86_REG_RIP,0x103000)
        uc.emu_stop()

    def capture_stage(self,row,definition,item_type):
        self.stage_completed=False;self.exit_hook=None
        try:
            result=self.capture_item(row,definition,item_type)
            assert self.stage_completed,'Normal socket stage was not reached'
            return result
        finally:
            if self.exit_hook is not None:self.uc.hook_del(self.exit_hook)


def normal_definitions():
    data=json.loads((ROOT/'equipment-definitions-native.json').read_text())
    weapons=['Sword','Dagger','Mace','Axe','Claw','Polearm','Chainsaw','Staff','Cane','Wand','Book','Spellblade','Bow','Gun','Flask','Throwing','Universal']
    types={'Helmets':0,'Chests':1,'Boots':2,'Gloves':4,'Amulets':5,'Shields':6,'Rings':7,'Belts':8}
    for routine,definition in data.items():
        if not routine.startswith('gml_Script_DefineItemNormal'):continue
        suffix=routine.removeprefix('gml_Script_DefineItemNormal')
        if suffix.startswith('Weapons') and suffix[7:] in weapons:cls,sub=3,weapons.index(suffix[7:])+1
        elif suffix in types:cls,sub=types[suffix],0
        else:continue
        for row in definition['rows']:
            info={int(args[0]):args[1] for name,args in row['calls'] if name in ('SetBaseItemInfo','itemBaseInfoStruct')}
            if info.get(7,0)>0:yield cls,sub,row,info


def main():
    oracle=EquipmentSocketStageOracle();fixtures=[]
    seeds=[0,1,2,42,123456,314159,999999937]
    for cls,sub,row,info in normal_definitions():
        for s in seeds:
            definition={'a':123456,'b':row['b'],'c':0,'j':sub,'q':0,'s':s}
            result=oracle.capture_stage(row,definition,cls)
            fixtures.append({'profile':f'normal:{cls}:{sub}:{row["b"]}','seed':s,'capacity':info[7],
                'count':result['stats'].get(20),'rarity':result['info'].get(27)})
        if len(fixtures)%140==0:print('Captured',len(fixtures),'socket overrides',flush=True)
    target=ROOT.parent.parent/'tests/current_equipment_sockets_native.json'
    target.write_text(json.dumps({'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
        'source':'Native LoadCommonItems exit; explicit socket seeds on current normal equipment case definitions. Later stages excluded.',
        'fixtures':fixtures},separators=(',',':'))+'\n',encoding='utf8',newline='\n')
    print('Captured',len(fixtures),'native socket overrides across',len(fixtures)//len(seeds),'normal equipment definitions.',flush=True)


if __name__=='__main__':main()
