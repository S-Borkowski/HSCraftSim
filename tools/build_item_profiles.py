"""Reduce the existing, build-bound research into offline simulation data."""
from pathlib import Path
import json,csv
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent
read=lambda p:json.loads(p.read_text(encoding='utf8'))
definitions=read(SOURCE/'_research/item_roll_profiles_all_438b.json')['profiles']
proofs=read(SOURCE/'HSItemEditor/hs_perfect_roll_profiles.json')['profiles']
runtime=read(ROOT/'research/iteminfo_dump_runtime.json')['items']
infos={v.get('28'):v for v in runtime.values() if isinstance(v.get('28'),str)}
result={}
for key,p in definitions.items():
    proof=proofs.get(key,{})
    model=proof.get('chains',{}).get('a',{}).get('model',{})
    info=infos.get(p.get('key'),{})
    result[key]={'stats':[{k:s[k] for k in ('key','representation','values','minimum','maximum','delta') if k in s} for s in p['stats']],
        'events':p.get('events',[]),'poolSlots':model.get('poolSlots',{}),
        'maxSockets':proof.get('maxSockets'), 'tier':info.get('32'),'rarity':info.get('27'),
        'perfectSeed':proof.get('fieldSeeds',{}).get('a')}
(ROOT/'data/item_profiles.json').write_text(json.dumps({'sourceBuild':'438BF4848688C5BE52AC15F26F02B46DA620D90587C28E766A9CEA190F3A7DE4','profiles':result},ensure_ascii=False),encoding='utf8')
print(f'{len(result)} item profiles exported; build-specific, not attested against current executable.')
