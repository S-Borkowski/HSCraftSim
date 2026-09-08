"""Export native normal base definitions and superior-prefix RNG bounds."""
import json
from audit_generation_coverage import equipment_rows,stat_definitions,ROOT
from native_natural_sockets import BUILD

rules={}
for key,cls,sub,row in equipment_rows():
    if not key.startswith('normal:'):continue
    info={int(a[0]):a[1] for n,a in row['calls'] if n in ('SetBaseItemInfo','itemBaseInfoStruct')}
    rules[key]={'tier':info[32],'capacity':info.get(7,0),'stats':stat_definitions(row)}
prefixes={str(r['id']):[d[1]-d[0] for d in r['draws']] for r in json.loads((ROOT/'normal-affixes-native.json').read_text())['prefix'] if 702<=r['id']<=741}
result={'buildSha256':BUILD,'items':rules,'superiorDraws':prefixes}
(ROOT.parent.parent/'engine/normal_state_rules.js').write_text('// Native normal base definitions; affix selection is a separate stage.\nexport const NORMAL_STATE_RULES = '+json.dumps(result,separators=(',',':'))+';\n',encoding='utf8')
print('Exported',len(rules),'normal definitions and',len(prefixes),'superior RNG entries')
