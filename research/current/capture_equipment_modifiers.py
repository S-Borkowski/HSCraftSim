"""Whole native normal items: one base per type/subtype/tier, modifier and superior paths."""
import json
from native_normal_state import NormalStateOracle
from audit_generation_coverage import equipment_rows,ROOT
from native_natural_sockets import BUILD

def main():
 oracle=NormalStateOracle();seen=set();fixtures=[]
 for key,cls,sub,row in equipment_rows():
  if not key.startswith('normal:') or cls in (5,7):continue
  tier=next(args[1] for name,args in row['calls'] if name in ('SetBaseItemInfo','itemBaseInfoStruct') and args[0]==32)
  identity=(cls,sub,tier)
  if identity in seen:continue
  seen.add(identity)
  for seed,p,r in [(6,0,0),(1460,0,0),(4018,0,0),(57,5,0),(123456,5,0),(1460,5,0),(57,0,1),(1460,0,1)]:
   definition=dict(a=seed,b=row['b'],c=0,j=sub,p=p,r=r)
   result=oracle.capture(row,definition,cls)
   values={str(k):oracle.arrays.get(v,v) for k,v in result['stats'].items()}
   trace=[t for t in result['trace'] if t[0] in ('draw','float','choose','seed','gml_Script_ReturnPrefixStats','gml_Script_ReturnSuffixStats')]
   fixtures.append(dict(profile=key,definition=definition,values=values,rarity=result['info'][27],requiredLevel=result['info'][1],trace=trace))
  print('Modifiers',identity,len(fixtures),flush=True)
 (ROOT/'normal-equipment-modifiers-native.json').write_text(json.dumps(dict(buildSha256=BUILD,fixtures=fixtures),separators=(',',':')),encoding='utf8')
 print('Finished',len(fixtures),flush=True)

if __name__=='__main__':main()
