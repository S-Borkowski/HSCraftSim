import json
from native_normal_state import NormalStateOracle
from audit_generation_coverage import equipment_rows,ROOT
oracle=NormalStateOracle(); out=[]
key,cls,sub,row=next(r for r in equipment_rows() if r[0]=='normal:3:1:14')
for n in [10,100,200,666,1000,1001,1002,1003,1004,1005,1006,6666,6668]:
 for a in [1,42,123456]:
  d=dict(a=a,b=row['b'],c=0,j=sub,n=n);r=oracle.capture_state(row,d,cls);out.append(dict(definition=d,**r))
  print(n,a,'rarity',r['rarity'],'slots',r['sockets'],'affixes',r['selection']['affixCount'],'superior',r['selection']['superiorCount'],'draws',len(r['selection']['draws']),flush=True)
(ROOT/'special-normal-probe.json').write_text(json.dumps(out,separators=(',',':')),encoding='utf8')
