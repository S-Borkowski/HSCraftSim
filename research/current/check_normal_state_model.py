"""Compare the scalar normal-generation prelude against original native cases."""
import json
from audit_generation_coverage import equipment_rows,stat_definitions,ROOT
from native_item_generation import Cpr

ROWS={k:(c,s,r) for k,c,s,r in equipment_rows() if k.startswith('normal:')}
PREFIX={r['id']:r for r in json.loads((ROOT/'normal-affixes-native.json').read_text())['prefix']}


def replay(profile, definition):
    cls,sub,row=ROWS[profile]
    info={int(a[0]):a[1] for n,a in row['calls'] if n in ('SetBaseItemInfo','itemBaseInfoStruct')}
    tier=int(info[32]);capacity=int(info.get(7,0));rng=Cpr(definition['a']);draws=[]
    def draw(hi):
        value=rng.irandom(hi);draws.append([0,hi,value]);return value
    for k,v in sorted(stat_definitions(row).items()):
        if len(v)==2:draw(v[1]-v[0])
    count=1;white=False;superior=0;prefixes=[];early=0
    if cls in (0,1,2,3,6) and draw(99)<16:
        white=True
        if draw(99)<25:
            for _ in range(3):
                if draw(99)>=25:break
                count+=1;superior+=1
            prefix=(702 if cls==3 else 707)+10*superior+tier
            prefixes.append(prefix)
            for lo,hi,_ in PREFIX[prefix]['draws']:draw(hi-lo)
        for _ in range(capacity):early+=int(draw(99)<6*(tier+1))
    else:
        for chance in (34,27,16,4,3):
            if draw(99)>=chance:break
            count+=1
    return dict(affixCount=count,white=int(white),magic=int(not white),superiorCount=superior,
                earlySockets=early if white else None,prefixes=prefixes,draws=draws)


if __name__=='__main__':
    fixtures=json.loads((ROOT/'normal-state-probe.json').read_text())['fixtures'];errors=[]
    for f in fixtures:
        result=replay(f['profile'],f['definition'])
        for key,value in result.items():
            if value!=f['selection'][key]:errors.append((f['profile'],f['definition']['a'],key,value,f['selection'][key]))
    print('Compared',len(fixtures),'native preludes;',len(errors),'mismatches')
    print(json.dumps(errors[:12],indent=2))
    for target in (4,5,6):
        seeds=[]
        for a in range(1,100000):
            result=replay('normal:3:1:14',{'a':a})
            if result['affixCount']==target:
                seeds.append(a)
                if len(seeds)==2:break
        print('Affix count',target,'seeds',seeds)
