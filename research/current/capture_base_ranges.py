"""Capture changed base ranges with the same stat identities as imported profiles.

The stop boundary excludes generated affixes, natural sockets and special tails.
"""
import json
from capture_base_order import BaseOrderOracle,candidates,ROOT


def main():
    oracle=BaseOrderOracle();definitions={};fixtures=[];excluded=[]
    for key,cls,sub,row,stats in candidates(allow_changed=True):
        ranges={k:v for k,v in stats.items() if len(v)==2 and k!=20}
        order=sorted(ranges,key=str);records=[];failed=False
        for seed in [1,123456,999999937]:
            for stars,corrupted in [(0,0),(5,0),(0,1)]:
                try:result=oracle.capture_item(row,{'a':seed,'b':row['b'],'c':1,'j':sub,'p':stars,'r':corrupted},cls)
                except Exception as error:
                    print('Deferred',key,type(error).__name__,flush=True);failed=True;break
                draws=[t[1:] for t in result['trace'] if t[0]=='draw']
                if len(draws)!=len(order) or any(draw[:2]!=[0,ranges[k][1]-ranges[k][0]] for k,draw in zip(order,draws)):
                    failed=True;break
                records.append({'profile':key,'seed':seed,'stars':stars,'corrupted':corrupted,'values':result['stats'],'draws':draws})
            if failed:break
        if len(records)!=9:excluded.append(key);continue
        definitions[key]={'order':order,'stats':{k:v for k,v in stats.items() if k!=20}}
        fixtures.extend(records)
        if len(definitions)%50==0:print('Verified current base definitions:',len(definitions),flush=True)
    data={'source':'Native CreateItemNew base stage only; generated/socket/special stages excluded.',
          'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
          'definitions':definitions,'fixtures':fixtures,'excluded':excluded}
    (ROOT/'base-ranges-native.json').write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
    print('Captured',len(fixtures),'current base stages across',len(definitions),'items; deferred',excluded,flush=True)


if __name__=='__main__':main()
