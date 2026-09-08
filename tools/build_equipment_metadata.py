"""Publish reviewed native equipment metadata, excluding shared stat transforms."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'research/current/equipment-definitions-native.json').read_text())
weapons=['Sword','Dagger','Mace','Axe','Claw','Polearm','Chainsaw','Staff','Cane','Wand','Book','Spellblade','Bow','Gun','Flask','Throwing','Universal']
types={'Helmets':0,'Chests':1,'Boots':2,'Gloves':4,'Amulets':5,'Shields':6,'Rings':7,'Belts':8}
rules={}
for routine,definition in data.items():
    if not routine.startswith('gml_Script_DefineItemNormal'):continue
    suffix=routine.removeprefix('gml_Script_DefineItemNormal')
    if suffix.startswith('Weapons'): cls,sub=3,weapons.index(suffix.removeprefix('Weapons'))+1
    elif suffix in types: cls,sub=types[suffix],0
    else: continue
    for row in definition['rows']:
        info={int(args[0]):args[1] for name,args in row['calls'] if name in ('SetBaseItemInfo','itemBaseInfoStruct')}
        assert info,(routine,row['b'])
        capacity=int(info.get(7,0));handed=int(info.get(21,1))
        assert 0<=capacity<=6 and handed in (1,2),(routine,row['b'],info)
        rules[f'normal:{cls}:{sub}:{row["b"]}']={'maxSockets':capacity,'handed':handed}
catalog=json.loads((ROOT/'data/items_catalog.json').read_text(encoding='utf8'))
expected={f'normal:{r["cls"]}:{r["sub"]}:{r["b"]}' for r in catalog if r['kind']=='normal' and (r['cls'] in types.values() or r['cls']==3)}
assert expected<=rules.keys(),expected-rules.keys()
print('Published',len(rules),'current equipment capacities and handedness; all',len(expected),'catalog bases covered.')
enhancements={}
for routine,definition in data.items():
    if not routine.startswith('gml_Script_DefineItemUnique'):continue
    suffix=routine.removeprefix('gml_Script_DefineItemUnique')
    if suffix.startswith('Weapons'): cls,sub=3,weapons.index(suffix.removeprefix('Weapons'))+1
    elif suffix in {**types,'Charms':10,'Flask':18}:cls,sub={**types,'Charms':10,'Flask':18}[suffix],0
    else:continue
    for row in definition['rows']:
        info={int(args[0]):args[1] for name,args in row['calls'] if name in ('SetBaseItemInfo','itemBaseInfoStruct')}
        key=f'unique:{cls}:{sub}:{row["b"]}'
        tier=int(info[32]);rarity=int(info.get(27,6))
        assert 0<=tier<=5 and rarity in (6,7,9,10),(key,tier,rarity)
        rules[key]={'tier':tier,'rarity':rarity}
        values=[info.get(15+i,0) for i in range(6)]
        assert all(v in (0,1,2) for v in values)
        if any(values):enhancements[f'unique:{cls}:{sub}:{row["b"]}']=values
(ROOT/'engine/socket_enhancement_rules.js').write_text('// Current native info fields 15 + socket index.\nexport const SOCKET_ENHANCEMENTS = '+json.dumps(enhancements,separators=(',',':'))+';\n',encoding='utf8',newline='\n')
print('Published',len(enhancements),'equipment socket enhancement definitions.')
output={'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4','items':rules}
(ROOT/'engine/equipment_rules.js').write_text('// Current native equipment metadata; shared stat transforms excluded.\nexport const EQUIPMENT_RULES = '+json.dumps(output,separators=(',',':'))+';\n',encoding='utf8',newline='\n')
changed=0
for row in catalog:
    current=rules.get(f'{row["kind"]}:{row["cls"]}:{row["sub"]}:{row["b"]}')
    if row['kind']!='unique' or not current:continue
    rarity={6:'Satanic',7:'Angelic',9:'Heroic',10:'Unholy'}[current['rarity']]
    tier=['D','C','B','A','S','SS'][current['tier']]
    changed+=row.get('rar')!=rarity or row.get('tier')!=tier
    row.update(rar=rarity,tier=tier)
(ROOT/'data/items_catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
print('Updated tier/rarity on',changed,'catalog rows; published',len(rules)-len(expected),'Unique equipment identities.')
