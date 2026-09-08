import json
from native_normal_state import NormalStateOracle
from audit_generation_coverage import equipment_rows,ROOT
oracle=NormalStateOracle(); rows=[];seen=set()
patches=[{'n':n} for n in [0,2,3,4,6,10,100,200,666,1000,1001,1006,6666,6668]]+ [{'zz':z} for z in [{},{'dropQuality':3},{'dropQuality':200},{'sockets':0},{'sockets':2},{'dropQuality':100,'sockets':2}]]
for key,cls,sub,row in equipment_rows():
 if not key.startswith('normal:'):continue
 info={int(a[0]):a[1] for n,a in row['calls'] if n in ('SetBaseItemInfo','itemBaseInfoStruct')}
 shape=(cls,sub,info.get(32))
 if shape in seen:continue
 seen.add(shape)
 for p in patches:
  seed=[1,42,123456,57,548,1460,4018][len(seen)%7];definition=dict(a=seed,b=row['b'],c=0,j=sub,**p)
  result=oracle.capture(row,definition,cls)
  rows.append(dict(profile=key,definition=definition,selection=oracle.selection,info=result['info'],stats=result['stats']))
 print(key,'cases',len(rows),flush=True)
(ROOT.parent.parent/'tests/current_forced_normal_native.json').write_text(json.dumps(dict(buildSha256='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',fixtures=rows),separators=(',',':'))+'\n',encoding='utf8')
print('Done',len(rows),flush=True)
