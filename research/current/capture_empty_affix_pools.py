"""Exhausted DS lists: execute the original guards with undefined and zero.

GameMaker documents both possible out-of-range return values. They produce
identical stats and PRNG draws here; neither selects a replacement affix.
"""
import json
from audit_generation_coverage import equipment_rows, ROOT
from native_normal_state import NormalStateOracle
from native_natural_sockets import BUILD


def main():
    oracle=NormalStateOracle()
    row=next(r[3] for r in equipment_rows() if r[0]=='normal:3:1:14')
    fixtures=[]
    for seed in (618,1031,2368):
        for p,r in ((0,0),(5,0),(0,1)):
            definition=dict(a=seed,b=14,c=0,j=1,p=p,r=r)
            versions=[]
            for empty in (None,0):
                oracle.empty_list_value=empty
                result=oracle.capture(row,definition,3)
                values={str(k):oracle.arrays.get(v,v) for k,v in result['stats'].items()}
                trace=[t for t in result['trace'] if t[0] in ('draw','float','choose','seed','gml_Script_ReturnPrefixStats','gml_Script_ReturnSuffixStats')]
                versions.append(dict(profile='normal:3:1:14',definition=definition,values=values,rarity=result['info'][27],requiredLevel=result['info'][1],trace=trace))
            # The suffix caller skips undefined; the prefix caller passes it
            # through. Return*Stats(0/undefined) adds no stats or random draws.
            def meaningful(version):
                return {**version,'trace':[t for t in version['trace'] if not (t[0].startswith('gml_Script_Return') and t[1][2] in (None,0))]}
            assert meaningful(versions[0])==meaningful(versions[1]), 'Ambiguous DS list semantics affect this fixture'
            fixtures.append(versions[0])
    output=dict(buildSha256=BUILD,fixtures=fixtures)
    for target in (ROOT/'empty-affix-pools-native.json', ROOT.parent.parent/'tests/current_empty_affix_pools_native.json'):
        target.write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf8')
    print('PASS',len(fixtures),'empty-pool cases; undefined and zero produce identical results')


if __name__=='__main__':main()
