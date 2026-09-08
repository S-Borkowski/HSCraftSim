"""Capture all seven current Codex word bonus stages in native LoadRunewords.

The selected word's original definition is supplied; word detection and live
inventory/network actions are not replaced with a claim of full emulation.
"""
import json
from native_runeword_generation import RunewordGenerationOracle,ROOT

def main():
    oracle=RunewordGenerationOracle()
    rows=json.loads((ROOT/'runeword-definitions-native.json').read_text(encoding='utf8'))
    rows=[r for r in rows if r['b'] in (86,87,88,93,94,95,96)]
    fixtures=[];rules={}
    for row in rows:
        numeric=[args for name,args in row['calls'] if name=='itemDataArmor']
        assert len(numeric)==1
        key,bounds=numeric[0]
        rules[row['b']]=dict(key=key,range=bounds if isinstance(bounds,list) else [bounds,bounds])
        for seed in [None,0,*range(1,65),123456,999999937,1000000000]:
            # Existing item/Orb effects must survive the native word stage.
            for existing in [{},{350:3,354:4,355:15,357:15,358:20,363:6}]:
                result=oracle.capture(row,seed=seed,itemType=11,existing=existing)
                fixtures.append(dict(word=row['b'],seed=seed,initial=existing,values=result['stats'],trace=result['trace']))
        print('Word',row['b'],len(fixtures),flush=True)
    output=dict(buildSha256='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',rules=rules,fixtures=fixtures)
    (ROOT.parent.parent/'tests/current_orb_words_native.json').write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf8')
    (ROOT/'orb-words-native.json').write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf8')
    print('Captured',len(fixtures),'native word stages',flush=True)

if __name__=='__main__':main()
