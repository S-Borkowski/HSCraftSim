"""Export original element bundles and gem-specific equipment bonuses."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'research/current/special-generation-native.json').read_text(encoding='utf8'))
assert not data['errors']
for key,rule in data['rules'].items():
    # GenerateItemSpecialStats enables repeated gem bonuses only for the two
    # native (itemType, baseId) branches (1,35) and (3,6).
    _,cls,sub,base=key.split(':')
    rule['stackSockets']=(int(cls),int(base)) in ((1,35),(3,6))
(root/'engine/current_special_rules.js').write_text('// Native GenerateItemSpecialStats; '+data['buildSha256']+'\nexport const CURRENT_SPECIAL_RULES = '+json.dumps(data['rules'],separators=(',',':'))+';\n',encoding='utf8')
(root/'tests/current_special_native.json').write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf8')
pipeline=json.loads((root/'research/current/special-pipeline-native.json').read_text(encoding='utf8'))
assert not pipeline['errors']
fixtures=[{k:v for k,v in f.items() if k!='trace'} for f in pipeline['fixtures']]
(root/'tests/current_special_pipeline_native.json').write_text(json.dumps({'buildSha256':data['buildSha256'],'fixtures':fixtures},separators=(',',':'))+'\n',encoding='utf8')
print('Published',len(data['rules']),'special definitions;',len(data['fixtures']),'native cases;',len(fixtures),'pipeline cases')
