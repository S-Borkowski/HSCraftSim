"""Capture native proc selector tables and multi-property affix modifier cases."""
import json
from capture_jewelry_affixes import AffixOracle
from native_item_generation import Cpr, ROOT
from native_natural_sockets import BUILD

class ForcedCpr(Cpr):
 def __init__(self,seed,selector):super().__init__(seed);self.selector=selector
 def irandom(self,upper):
  roll=super().irandom(upper)
  if self.selector is not None:
   roll=self.selector;self.selector=None;assert 0<=roll<=upper
  return roll

class ProcOracle(AffixOracle):
 def observe_call(self,uc,address,size,data):
  super().observe_call(uc,address,size,data)
  if self.observe[address] in ('gml_Script_ReturnPrefixStats','gml_Script_ReturnSuffixStats') and self.forced is not None:
   self.rng=ForcedCpr(self.definition['a'],self.forced)

def main():
 oracle=ProcOracle();oracle.existing={};oracle.forced=None;tables={};fixtures=[]
 for side,id,count,key in [(0,521,45,125),(0,526,46,113),(0,531,47,116),(0,536,51,185),(1,418,24,205)]:
  values=[]
  for selector in range(count):
   oracle.forced=selector
   result=oracle.capture_item({'calls':[['SetBaseItemInfo',[32,4]]]},{'a':123456,'b':14,'c':0,'j':1,'p':0,'r':0},3,entry=[0x1458364a0,0x145c8bec0][side],params=[100,101,id])
   values.append(oracle.arrays[16777984] if side else result['stats'][key])
  tables[str(id)]=values
 oracle.forced=None
 source=json.loads((ROOT/'normal-affixes-native.json').read_text(encoding='utf8'))
 for side in range(2):
  for record in source[['prefix','suffix'][side]]:
   if len(record['stats'])==2 and not (side==0 and 702<=record['id']<=741):continue
   keys=[int(k) for k in record['stats'] if int(k)>=20]
   for tier,p,r,prior in [(0,0,0,0),(2,3,0,0),(4,5,0,0),(4,0,1,0),(4,5,0,10),(4,0,1,10)]:
    definition=dict(a=123456,b=14,c=0,j=1,p=p,r=r);oracle.existing={key:prior for key in keys} if prior else {}
    result=oracle.capture_item({'calls':[['SetBaseItemInfo',[32,tier]]]},definition,3,entry=[0x1458364a0,0x145c8bec0][side],params=[100,101,record['id']])
    values={str(k):oracle.arrays.get(v,v) for k,v in result['stats'].items()}
    fixtures.append(dict(side=side,id=record['id'],tier=tier,definition=definition,existing=oracle.existing,values=values,trace=[t for t in result['trace'] if t[0] in ('draw','float')]))
 (ROOT/'normal-complex-affixes-native.json').write_text(json.dumps(dict(buildSha256=BUILD,tables=tables,fixtures=fixtures),separators=(',',':')),encoding='utf8')
 print('Captured proc tables and',len(fixtures),'complex/superior cases',flush=True)

if __name__=='__main__':main()
