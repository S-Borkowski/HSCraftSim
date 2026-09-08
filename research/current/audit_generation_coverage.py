"""Inventory current equipment generation branches without changing runtime data."""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEAPONS = ['Sword','Dagger','Mace','Axe','Claw','Polearm','Chainsaw','Staff','Cane','Wand','Book','Spellblade','Bow','Gun','Flask','Throwing','Universal']
TYPES = {'Helmets':0,'Chests':1,'Boots':2,'Gloves':4,'Amulets':5,'Shields':6,'Rings':7,'Belts':8,'Charms':10,'Flask':18}

def equipment_rows():
    native=json.loads((ROOT/'equipment-definitions-native.json').read_text(encoding='utf8'))
    for name, definition in native.items():
        for kind in ('Unique','Normal'):
            prefix='gml_Script_DefineItem'+kind
            if not name.startswith(prefix): continue
            suffix=name.removeprefix(prefix)
            if suffix.startswith('Weapons'): cls,sub=3,WEAPONS.index(suffix[7:])+1
            elif suffix in TYPES: cls,sub=TYPES[suffix],0
            else: continue
            for row in definition['rows']:
                yield f'{kind.lower()}:{cls}:{sub}:{row["b"]}',cls,sub,row

def stat_definitions(row):
    return {str(args[0]):args[1] if isinstance(args[1],list) else [args[1]]
            for name,args in row['calls'] if name in ('SetBaseItemStat','itemBaseStatStruct')}

if __name__=='__main__':
    profiles=json.loads((ROOT.parent.parent/'data/item_profiles.json').read_text(encoding='utf8'))['profiles']
    groups=Counter(); methods=Counter(); ranges=Counter(); examples={}
    for key,cls,sub,row in equipment_rows():
        stats=stat_definitions(row)
        extra=[name for name,_ in row['calls'] if name not in ('SetBaseItemStat','itemBaseStatStruct','SetBaseItemInfo','itemBaseInfoStruct')]
        group=(key.split(':')[0],bool(profiles.get(key,{}).get('dynamic')),bool(extra),bool(stats.get('221')))
        groups[str(group)]+=1
        methods.update(extra)
        ranges[str(stats.get('20'))]+=1
        examples.setdefault(str(group),(key,stats.get('20'),extra))
    print(json.dumps({'groups':groups,'methods':methods,'socketRanges':ranges,'examples':examples},indent=2))
