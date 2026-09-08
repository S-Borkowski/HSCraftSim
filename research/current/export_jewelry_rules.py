"""Export native jewelry definitions as a compact, browser-only rule module."""
import json
from capture_jewelry_affixes import candidate_ids
from audit_generation_coverage import ROOT

def main():
 pools=json.loads((ROOT/'normal-jewelry-pools-native.json').read_text(encoding='utf8'))
 source=json.loads((ROOT/'normal-affixes-native.json').read_text(encoding='utf8'))
 tables=[]
 for side,ids in enumerate(candidate_ids()):
  table={}
  for record in source[['prefix','suffix'][side]]:
   if record['id'] not in ids:continue
   key,lo,hi,tier=record['stats']['10'];extra=side==0 and 426<=record['id']<=430
   assert len(record['stats'])==(3 if extra else 2)
   table[record['id']]=[key,lo,hi,bool(record['draws']),*(['class'] if extra else [])]
  tables.append(table)
 rules=dict(buildSha256=pools['buildSha256'],pools=pools['rules'],affixes=tables)
 (ROOT.parent.parent/'engine/normal_affix_rules.js').write_text('// Current native jewelry pools and prefix/suffix ranges. Generated from isolated native captures.\nexport const NORMAL_AFFIX_RULES = '+json.dumps(rules,separators=(',',':'))+';\n',encoding='utf8')
 for source_name,test_name in [('normal-affix-cases-57.json','current_jewelry_generation_native.json'),('jewelry-affix-values-native.json','current_jewelry_affixes_native.json')]:
  data=json.loads((ROOT/source_name).read_text(encoding='utf8'));data['buildSha256']=pools['buildSha256']
  (ROOT.parent.parent/'tests'/test_name).write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf8')
 print('Exported',sum(map(len,tables)),'affix definitions and native fixtures')
if __name__=='__main__':main()
