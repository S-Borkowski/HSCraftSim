"""Publish verified current base values without replacing socket/special stages."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
native=json.loads((root/'research/current/base-ranges-native.json').read_text())
profiles=json.loads((root/'data/item_profiles.json').read_text(encoding='utf8'))['profiles']
definitions={};changed=0
for key,definition in native['definitions'].items():
    if any(int(k)<22 for k in definition['stats']):continue
    profile=profiles[key]
    assert not profile.get('dynamic')
    imported={str(s['statKey']):s['values'] for s in profile['tooltip']['stats'] if s['statKey']!=20}
    assert imported.keys()==definition['stats'].keys(),key
    assert all(len(v) in (1,2) and all(isinstance(n,(int,float)) for n in v) for v in definition['stats'].values()),key
    assert definition['order']==sorted((int(k) for k,v in definition['stats'].items() if len(v)==2),key=str)
    definitions[key]=definition
    changed+=imported!=definition['stats']
fixtures=[f for f in native['fixtures'] if f['profile'] in definitions]
assert len(fixtures)==9*len(definitions)
(root/'engine/base_stat_rules.js').write_text('// Current native base values only. Sockets and later generated/special effects are excluded.\nexport const BASE_STAT_RULES = '+json.dumps(definitions,separators=(',',':'))+';\n',encoding='utf8',newline='\n')
(root/'tests/current_base_ranges_native.json').write_text(json.dumps({'buildSha256':native['buildSha256'],'fixtures':fixtures},separators=(',',':'))+'\n',encoding='utf8',newline='\n')
print('Published',len(definitions),'current base definitions;',changed,'have changed values;',len(fixtures),'native fixtures.')
