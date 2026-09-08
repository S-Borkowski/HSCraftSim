"""Capture complete current prefix/suffix tables through native entry points.

This verifies each affix in isolation. It does not certify LoadCommonItems pool
selection, initial RNG state, repository construction or full item generation.
"""
import json
from native_item_generation import ItemGenerationOracle, ROOT


def capture():
    oracle=ItemGenerationOracle()
    output={}
    for name,address,count in [('prefix',0x1458364a0,771),('suffix',0x145c8bec0,623)]:
        rows=[]
        for index in range(count+1):
            result=oracle.capture_item({'calls':[['SetBaseItemInfo',[32,4]]]},
                {'a':123456,'b':14,'c':0,'j':1,'p':0,'r':0},3,
                entry=address,params=[100,101,index])
            if not result['stats']:continue
            stats={int(k):oracle.arrays.get(v,v) for k,v in result['stats'].items()}
            rows.append({'id':index,'stats':stats,'draws':[t[1:] for t in result['trace'] if t[0]=='draw']})
            if index%100==0:print(name,index,flush=True)
        output[name]=rows
        print(name,len(rows),'entries',flush=True)
    (ROOT/'normal-affixes-native.json').write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf8',newline='\n')


if __name__=='__main__':capture()
