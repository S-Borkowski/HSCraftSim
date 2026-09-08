"""Join native Codex effect ranges with the game's English localization."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
native=json.loads((root/'research/current/codex-effects-native.json').read_text())
texts=json.loads((root/'data/translations/attributes.json').read_text(encoding='utf8'))['entries']
rules={}
for kind,prefix in [('buffs','codexBuff'),('debuffs','codexDebuff')]:
    rules[kind]={}
    for row in native[kind][1:]:
        n=row['id'];value=row['1'];lo,hi=value if isinstance(value,list) else (value,value)
        key=f'{prefix}{n:02d}';namekey=f'{prefix}Name{n:02d}'
        rules[kind][n]={'name':texts.get(namekey,{}).get('en') or texts[key]['en'],
            'description':texts[key]['en'],'min':lo,'max':hi}
(root/'engine/codex_effect_rules.js').write_text('// Native GetCodexBuffs/GetCodexDebuffs plus English game text.\nexport const CODEX_EFFECT_RULES = '+json.dumps(rules,separators=(',',':'))+';\n',encoding='utf8')
print('Published 10 buffs and 7 debuffs.')
