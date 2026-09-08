import json
from probe_common_generation import CommonOracle
from audit_generation_coverage import equipment_rows,ROOT
oracle=CommonOracle();out=[]
key,cls,sub,row=next(r for r in equipment_rows() if r[0]=='normal:3:1:14')
for n,a in [(1,1),(666,1),(1000,1),(1001,1),(6666,42)]:
 d=dict(a=a,b=14,c=0,j=1,n=n);r=oracle.capture(row,d,3);out.append(dict(definition=d,**r))
(ROOT/'forced-pool-probe.json').write_text(json.dumps(out,separators=(',',':')),encoding='utf8')
