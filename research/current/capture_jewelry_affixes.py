"""Capture every jewelry affix across stars, corruption and existing values."""
import json
from native_item_generation import ItemGenerationOracle,ROOT
from native_natural_sockets import BUILD

def candidate_ids():
 pools=json.loads((ROOT/'normal-jewelry-pools-native.json').read_text(encoding='utf8'))['rules'];ids=[set(),set()]
 for groups in pools.values():
  for _,entries in groups:
   for side,bases,*fixed in entries:
    for base in bases if isinstance(bases,list) else [bases]:ids[side].update([base] if fixed else range(base,base+5))
 return ids
class AffixOracle(ItemGenerationOracle):
 def observe_call(self,uc,address,size,data):
  super().observe_call(uc,address,size,data)
  if self.observe[address] in ('gml_Script_ReturnPrefixStats','gml_Script_ReturnSuffixStats'):self.current.update(self.existing)

def main():
 tables=json.loads((ROOT/'normal-affixes-native.json').read_text());oracle=AffixOracle();fixtures=[]
 contexts=[(4,0,0,0),(0,5,0,0),(2,3,0,0),(4,5,0,0),(4,0,1,0),(4,5,0,0.2),(4,0,1,10)]
 for side,ids in enumerate(candidate_ids()):
  source={r['id']:r for r in tables[['prefix','suffix'][side]]}
  for i,id in enumerate(sorted(ids)):
   key=source[id]['stats']['10'][0]
   for tier,p,r,existing in contexts:
    definition=dict(a=123456,b=0,c=0,j=0,p=p,r=r);oracle.existing={key:existing} if existing else {}
    result=oracle.capture_item({'calls':[['SetBaseItemInfo',[32,tier]]]},definition,5,entry=[0x1458364a0,0x145c8bec0][side],params=[100,101,id])
    values={str(k):oracle.arrays.get(v,v) for k,v in result['stats'].items()}
    fixtures.append(dict(side=side,id=id,tier=tier,definition=definition,existing=oracle.existing,values=values,trace=[t for t in result['trace'] if t[0] in ('draw','float')]))
   if i%100==0:print('Affixes',side,i,'cases',len(fixtures),flush=True)
 output=dict(buildSha256=BUILD,fixtures=fixtures)
 (ROOT/'jewelry-affix-values-native.json').write_text(json.dumps(output,separators=(',',':')),encoding='utf8')
 print('Finished',len(fixtures),flush=True)
if __name__=='__main__':main()
