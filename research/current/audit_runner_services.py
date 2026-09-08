"""Recheck published native fixtures after changes to fixture-owned storage."""
import gc,json
from native_runeword_generation import RunewordGenerationOracle,ROOT
from native_codex_generation import CodexGenerationOracle
from native_crystal_oracle import CrystalOracle


def read(path):return json.loads(path.read_text(encoding='utf8'))


def audit():
    x=RunewordGenerationOracle()
    definitions={r['b']:r for r in read(ROOT/'runeword-definitions-native.json')}
    rows=read(ROOT/'runeword-rolls-native.json')
    for r in rows:
        result=x.capture(definitions[r['b']],r['seed'],r['itemType'],r['handed'])
        assert {str(k):v for k,v in result['stats'].items()}==r['stats'],r
    print('PASS',len(rows),'Runeword fixtures',flush=True)
    del x;gc.collect()
    x=CodexGenerationOracle()
    rows=read(ROOT.parent.parent/'tests/current_codex_modifiers_native.json')['rows']
    for r in rows:
        result=x.generate(r['def'],base={376:[1,10],378:[1,7]})
        assert {str(k):v for k,v in result['stats'].items()}==r['stats'],r
    print('PASS',len(rows),'Codex modifier fixtures',flush=True)
    rows=read(ROOT.parent.parent/'tests/current_codex_sockets_native.json')
    for r in rows:assert x.generate(r['def'],base={376:[1,10],378:[1,7]},infernal=r['infernal'])['stats'].get(20,0)==r['count'],r
    print('PASS',len(rows),'Codex socket fixtures',flush=True)
    del x;gc.collect()
    x=CrystalOracle()
    rows=read(ROOT.parent.parent/'tests/current_crystal_native.json')['rows']
    for r in rows:
        result=x.capture(r['group'],r['selector'],r['subtype'],r['maximum'],r['itemType'],r['unique'],r['rarity'],{r['key']:r['existing']})
        assert result['stats'][r['key']]==r['expected'],r
    print('PASS',len(rows),'Crystal fixtures',flush=True)


if __name__=='__main__':audit()
