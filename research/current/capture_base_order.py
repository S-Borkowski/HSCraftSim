"""Verify the current base-stat stage for unchanged, simple Unique definitions.

Stop before generated affixes, sockets and special tails. These fixtures certify
base draw order only, never whole-item or natural-socket parity.
"""
import json
from native_item_generation import ItemGenerationOracle, ROOT
from unicorn.x86_const import UC_X86_REG_RIP


class BaseOrderOracle(ItemGenerationOracle):
    def observe_call(self,uc,address,size,data):
        if self.observe[address]=='gml_Script_GenerateItemRandomStats':
            uc.reg_write(UC_X86_REG_RIP,0x103000)
            uc.emu_stop()
        else:super().observe_call(uc,address,size,data)


def candidates(allow_changed=False):
    native=json.loads((ROOT/'equipment-definitions-native.json').read_text())
    profiles=json.loads((ROOT.parent.parent/'data/item_profiles.json').read_text(encoding='utf8'))['profiles']
    weapons=['Sword','Dagger','Mace','Axe','Claw','Polearm','Chainsaw','Staff','Cane','Wand','Book','Spellblade','Bow','Gun','Flask','Throwing','Universal']
    types={'Helmets':0,'Chests':1,'Boots':2,'Gloves':4,'Amulets':5,'Shields':6,'Rings':7,'Belts':8,'Charms':10,'Flask':18}
    for name,definition in native.items():
        if not name.startswith('gml_Script_DefineItemUnique'):continue
        suffix=name.removeprefix('gml_Script_DefineItemUnique')
        if suffix.startswith('Weapons'):cls,sub=3,weapons.index(suffix[7:])+1
        elif suffix in types:cls,sub=types[suffix],0
        else:continue
        for row in definition['rows']:
            key=f'unique:{cls}:{sub}:{row["b"]}'
            profile=profiles.get(key)
            if not profile or not profile.get('tooltip') or profile.get('dynamic'):continue
            if any(method not in ('SetBaseItemStat','itemBaseStatStruct','SetBaseItemInfo','itemBaseInfoStruct') for method,args in row['calls']):continue
            stats={int(args[0]):args[1] if isinstance(args[1],list) else [args[1]] for method,args in row['calls'] if method in ('SetBaseItemStat','itemBaseStatStruct')}
            imported={s['statKey']:s['values'] for s in profile['tooltip']['stats']}
            if stats==imported or allow_changed and stats.keys()==imported.keys():yield key,cls,sub,row,stats


def main():
    oracle=BaseOrderOracle();output=[];orders={};excluded=[]
    for key,cls,sub,row,stats in candidates():
        records=[]
        # Different seeds exercise low/high values without fixture-derived RNG.
        for seed in [1,123456,999999937]:
            result=oracle.capture_item(row,{'a':seed,'b':row['b'],'c':1,'j':sub,'p':0,'r':0},cls)
            order=[int(t[1]) for t in result['trace'] if t[0]=='add' and len(stats.get(int(t[1]),[]))==2]
            expected=sorted((k for k,v in stats.items() if len(v)==2 and k!=20),key=str)
            if order!=expected:
                excluded.append({'key':key,'order':order,'expected':expected});break
            if key in orders:assert orders[key]==order
            records.append({'profile':key,'seed':seed,'values':result['stats'],
                            'draws':[t[1:] for t in result['trace'] if t[0]=='draw']})
        else:
            orders[key]=order;output.extend(records)
        if len(orders)%50==0:print('Verified base stage:',len(orders),flush=True)
    data={'source':'CreateItemNew base stage, before GenerateItemRandomStats; unchanged static definitions only.',
          'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
          'orders':orders,'fixtures':output,'excluded':excluded}
    (ROOT/'base-order-native.json').write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
    print('Captured',len(output),'native base stages across',len(orders),'items;',len(excluded),'complex paths excluded.',flush=True)


if __name__=='__main__':main()
