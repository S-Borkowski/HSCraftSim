"""Original normal generation through its natural-socket boundary, isolated memory."""
import argparse,json
from audit_generation_coverage import equipment_rows,ROOT
from native_normal_state import NormalStateOracle

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--types',default='5,7');parser.add_argument('--seeds',type=int,default=16);parser.add_argument('--modifiers',action='store_true')
    args=parser.parse_args();types=set(map(int,args.types.split(',')));oracle=NormalStateOracle();records=[]
    for key,cls,sub,row in equipment_rows():
        if not key.startswith('normal:') or cls not in types:continue
        states=[dict(a=seed) for seed in list(range(1,args.seeds+1))+[57,548,123456,999999937]]
        if args.modifiers:states += [dict(a=seed,p=p,r=r) for seed in (42,57,548,123456) for p,r in ((1,0),(5,0),(0,1))]
        for state in states:
            definition=dict(b=row['b'],c=0,j=sub,p=0,r=0,**{'a':state['a']});definition.update(state)
            result=oracle.capture(row,definition,cls)
            values={str(k):oracle.arrays.get(v,v) for k,v in result['stats'].items()}
            calls=[t for t in result['trace'] if t[0] in ('draw','float','choose','seed','gml_Script_ReturnPrefixStats','gml_Script_ReturnSuffixStats')]
            records.append(dict(profile=key,definition=definition,values=values,rarity=result['info'][27],requiredLevel=result['info'][1],trace=calls))
        print('Captured',key,len(records),flush=True)
    name='normal-affix-cases-'+''.join(map(str,sorted(types)))+'.json'
    (ROOT/name).write_text(json.dumps({'fixtures':records},separators=(',',':')),encoding='utf8')
    print('Finished',len(records),flush=True)

if __name__=='__main__':main()
