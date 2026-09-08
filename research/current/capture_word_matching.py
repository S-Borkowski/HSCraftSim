"""Complete native word matching, including negative and Crystal cases."""
import copy,json
from native_word_matching import WordMatchingOracle,ROOT

def main():
    oracle=WordMatchingOracle();fixtures=[]
    for row in sorted(oracle.rows,key=lambda r:r['b']):
        fields=row['fields'];types=fields['runewordItemType'];types=types if isinstance(types,list) else [types]
        weapons=fields['runewordWeaponType'];weapons=weapons if isinstance(weapons,list) else [weapons or 1]
        runes=fields['runewordRunes'];base={'a':123456,'b':23 if types==[11] else 0,'c':0,'j':weapons[0],
          **{f's{i+1}':dict(a=1,b=b,c=0) for i,b in enumerate(runes)}}
        context=dict(item_type=int(types[0]),handed=int(fields['runewordHanded'] or 1),sockets=len(runes),rarity=1)
        cases=[('match',{},{}),('empty',{'s1':None},{}),('wrong-first',{'s1':dict(a=1,b=0,c=0)},{}),
               ('reversed',{f's{i+1}':dict(a=1,b=b,c=0) for i,b in enumerate(reversed(runes))},{}),
               ('extra-socket',{},dict(sockets=len(runes)+1)),('short-socket',{},dict(sockets=len(runes)-1)),
               ('wrong-family',{},dict(item_type=18)),('corrupted',dict(r=1),{}),
               ('crystal-full',dict(q=2),{}),('crystal-last',dict(q=2),dict(sockets=len(runes)-1))]
        cases += [(f'rarity-{rarity}',{},dict(rarity=rarity)) for rarity in (0,2,3,4,5,6,7,8,9,10)]
        if 3 in types:
            cases += [(f'weapon-{j}-hand-{hand}',dict(j=j),dict(item_type=3,handed=hand)) for j in range(1,18) for hand in (1,2)]
        else:cases += [(f'family-{cls}',{},dict(item_type=int(cls))) for cls in types[1:]]
        for name,patch,overrides in cases:
            definition=copy.deepcopy({**base,**patch});args={**context,**overrides}
            result=oracle.capture_match(definition,**args)
            fixtures.append(dict(sourceWord=row['b'],case=name,definition=definition,**args,result=result['word']))
        if row['b']%10==0:print('Matched',row['b'],'words;',len(fixtures),'cases',flush=True)
    output=dict(buildSha256='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',fixtures=fixtures)
    (ROOT.parent.parent/'tests/current_word_matching_native.json').write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf8')
    print('Finished',len(fixtures),flush=True)

if __name__=='__main__':main()
