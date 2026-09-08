from native_normal_state import NormalStateOracle
from audit_generation_coverage import equipment_rows
oracle=NormalStateOracle();key,cls,sub,row=next(r for r in equipment_rows() if r[0]=='normal:3:1:14')
for n in [1,100,200,666,1000,1001,6666,6668]:
 r=oracle.capture(row,dict(a=42,b=14,c=0,j=1,n=n),3)
 print(n,{k:v for k,v in r['info'].items() if k in [1,7,27,28,29,32,50]}, [(t[0],t[1]) for t in r['trace'] if t[0]=='gml_Script_ReturnPrefixStats'])
