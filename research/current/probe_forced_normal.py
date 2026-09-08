import json
from native_normal_state import NormalStateOracle
from audit_generation_coverage import equipment_rows,ROOT
oracle=NormalStateOracle(); rows=[]
key,cls,sub,row=next(r for r in equipment_rows() if r[0]=='normal:3:1:14')
for patch in ([{'n':n} for n in [0,1,2,3,4,5,6,7,8,100,6666]]+ [{'zz':z} for z in [{},{'dropQuality':1},{'dropQuality':2},{'dropQuality':3},{'dropQuality':5},{'sockets':3},{'dropQuality':2,'sockets':3}]]):
 for a in [1,42,123456]:
  definition=dict(a=a,b=row['b'],c=0,j=sub,**patch)
  try:
   result=oracle.capture_state(row,definition,cls);rows.append(dict(definition=definition,**result))
   print(json.dumps(dict(definition=definition,rarity=result['rarity'],sockets=result['sockets'],selection=result['selection'])),flush=True)
  except Exception as e: print('ERROR',patch,a,repr(e),flush=True);raise
(ROOT/'forced-normal-probe.json').write_text(json.dumps(rows,separators=(',',':')),encoding='utf8')
