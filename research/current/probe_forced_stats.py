import json
from native_normal_state import NormalStateOracle
from audit_generation_coverage import equipment_rows,ROOT
oracle=NormalStateOracle();records=[]
for key,cls,sub,row in equipment_rows():
 if key not in ['normal:3:1:14','normal:7:0:4','normal:1:0:4']:continue
 for patch in ([{'n':n} for n in [0,2,3,4,6,10,100,200,666,1000,1001,1006,6666,6668]]+[{'zz':{'sockets':2}},{'zz':{'sockets':2},'s':0},{'n':1001,'s':0},{'n':6666,'s':0}]):
  for seed in [1,42]:
   d=dict(a=seed,b=row['b'],c=0,j=sub,**patch);r=oracle.capture(row,d,cls)
   records.append(dict(profile=key,definition=d,selection=oracle.selection,info=r['info'],stats=r['stats']))
(ROOT/'forced-stats-probe.json').write_text(json.dumps(dict(fixtures=records),separators=(',',':')),encoding='utf8')
print('Captured',len(records))
