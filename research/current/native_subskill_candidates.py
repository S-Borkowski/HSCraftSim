"""Exhaustively check native GetSubTalentInfo(id, 1, 9) for stat 419."""
import json
from native_item_generation import ItemGenerationOracle,ROOT

if __name__=='__main__':
    x=ItemGenerationOracle();rows=[]
    for candidate in range(2,434):
        x.capture_item({'calls':[]},{'a':1},entry=0x143964a60,params=(candidate,1,9))
        rows.append({'id':candidate,'value':x.value(0x112000)})
    output={'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
            'query':[1,9],'rows':rows,'valid':[r['id'] for r in rows if r['value']>0]}
    (ROOT/'subskill-candidates-native.json').write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf8')
    print('Captured',len(rows),'native subskill candidates;',len(output['valid']),'eligible')
