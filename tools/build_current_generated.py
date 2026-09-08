"""Publish current native definitions separately from historical editor models."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'research/current/dynamic-generation-native.json').read_text(encoding='utf8'))
candidates=json.loads((root/'research/current/subskill-candidates-native.json').read_text(encoding='utf8'))
assert candidates['buildSha256']==data['buildSha256']
face=json.loads((root/'research/current/face-of-existence-native.json').read_text(encoding='utf8'))
assert face['buildSha256']==data['buildSha256']
equipment=json.loads((root/'research/current/equipment-definitions-native.json').read_text(encoding='utf8'))
face_row=next(r for r in equipment['gml_Script_DefineItemUniqueHelmets']['rows'] if r['b']==88)
data['definitions'][face['profile']]={str(args[0]):args[1] if isinstance(args[1],list) else [args[1]]
    for name,args in face_row['calls'] if name in ('SetBaseItemStat','itemBaseStatStruct')}
rules={}
for key,stats in data['definitions'].items():
    socket=stats.get('20',[0])
    rules[key]={'generated':True,'base':{'stats':stats,'order':sorted((int(k) for k in stats if int(k) not in (0,1,2,3,20,21)),key=str)},
                'range':[socket[0],socket[-1]],'socketRandom':len(socket)==2,'socketDrawUpper':socket[-1]-socket[0] if len(socket)==2 else 1}
    if '419' in stats:rules[key]['subskillCandidates']=candidates['valid']
    if key==face['profile']:rules[key]['faceCandidates']=face['candidates']
(root/'engine/current_generated_rules.js').write_text('// Extracted from current native item definitions; build '+data['buildSha256']+'.\nexport const CURRENT_GENERATED_RULES = '+json.dumps(rules,separators=(',',':'))+';\n',encoding='utf8')
fixtures=[{**{k:v for k,v in f.items() if k!='trace'},'draws':[t[1:] for t in f['trace'] if t[0]=='draw']} for f in data['fixtures']]
fixtures.extend(face['fixtures'])
(root/'tests/current_generated_native.json').write_text(json.dumps({'buildSha256':data['buildSha256'],'fixtures':fixtures},separators=(',',':'))+'\n',encoding='utf8')
print('Published',len(rules),'current generated definitions;',len(fixtures),'native cases')
