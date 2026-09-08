"""Publish current native equipment Runeword definitions and golden roll fixtures."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
native=json.loads((ROOT/'research/current/runeword-definitions-native.json').read_text())
catalog=json.loads((ROOT/'data/items_catalog.json').read_text(encoding='utf8'))
rows=[]
for row in native:
    f=row['fields'];types=f['runewordItemType'];types=types if isinstance(types,list) else [types]
    if types==[11]:continue # The seven Orb words already live in the Codex module.
    cat=next(r for r in catalog if r['kind']=='runeword' and r['b']==row['b'])
    tables={key:{int(args[0]):args[1] for name,args in row['calls'] if name==source} for key,source in [('oneHand','SetBaseItemStat'),('twoHand','itemData2H'),('armor','itemDataArmor')]}
    rows.append({'id':row['b'],'name':cat['name'],'catalogId':cat['id'],'sprite':cat['spr'],
                 'types':types,'weapons':f['runewordWeaponType'],'handed':f['runewordHanded'],'runes':f['runewordRunes'],'stats':tables})
socketables=json.loads((ROOT/'research/current/socket-definitions.json').read_text())
rune_ids={rune for word in rows for rune in word['runes']}
rune_levels={row['b']:next(args[1] for name,args in row['calls'] if name=='itemBaseInfoStruct' and args[0]==1)
             for row in socketables if row['b'] in rune_ids}
assert rune_levels.keys()==rune_ids
rules={'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4','words':rows,'runeLevels':rune_levels,
       'replaceStats':[113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,185,186,187]}
(ROOT/'engine/runeword_rules.js').write_text('// Generated from current native Runeword definitions.\nexport const RUNEWORD_RULES = '+json.dumps(rules,separators=(',',':'))+';\n')
rolls=json.loads((ROOT/'research/current/runeword-rolls-native.json').read_text())
(ROOT/'tests/current_runeword_native.json').write_text(json.dumps([r for r in rolls if any(w['id']==r['b'] for w in rows)],separators=(',',':'))+'\n')
print('Published',len(rows),'equipment Runewords.')
