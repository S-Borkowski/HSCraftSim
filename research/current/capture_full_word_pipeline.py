import argparse,json
from native_full_word_pipeline import FullWordOracle,ROOT
from audit_generation_coverage import equipment_rows

parser=argparse.ArgumentParser();parser.add_argument('--only-word',type=int);parser.add_argument('--resume',action='store_true');args=parser.parse_args()
output=ROOT.parent.parent/'tests/current_full_word_pipeline_native.json'
checkpoint=ROOT/'full-word-pipeline-checkpoint.jsonl'
oracle=FullWordOracle();bases=[]
if args.resume:records=[json.loads(line) for line in checkpoint.read_text().splitlines() if line]
else:records=[];checkpoint.write_text('')
signature=lambda key,definition:json.dumps([key,definition],sort_keys=True)
done={signature(r['profile'],r['definition']) for r in records}
for key,cls,sub,row in equipment_rows():
    if not key.startswith('normal:') or cls not in (0,1,2,3,6):continue
    info={int(k):v for n,(k,v) in row['calls'] if n in ('itemBaseInfoStruct','SetBaseItemInfo')}
    bases.append((key,cls,sub,row,info))
for word in oracle.rows:
    if args.only_word and word['b']!=args.only_word:continue
    f=word['fields'];types=f['runewordItemType'];types=types if isinstance(types,list) else [types]
    if types==[11]:continue
    for cls in types:
        for handed in ((1,2) if cls==3 and not f['runewordHanded'] else [f['runewordHanded'] or 1]):
            candidates=[]
            for base in bases:
                key,bcls,sub,row,info=base;weapons=f['runewordWeaponType']
                if bcls!=cls:continue
                if cls==3 and (info.get(21,1)!=handed or (sub not in weapons if isinstance(weapons,list) else weapons>0 and sub!=weapons)):continue
                candidates.append(base)
            if not candidates:continue
            key,_,sub,row,info=max(candidates,key=lambda b:(b[4].get(7,0),-b[4].get(32,0)))
            count=len(f['runewordRunes'])
            states=[dict(a=42,i=1,q=0),dict(a=123456,i=123456,q=1,ab=57),dict(a=57,i=999999937,q=1,ab=123456,p=5),
                    dict(a=548,i=123456,q=1,ab=42,r=1),dict(a=42,q=2),dict(a=42,i=1,q=2,rawSlots=count-1)]
            for state in states:
                slots=state.pop('rawSlots',count)
                definition=dict(b=row['b'],c=0,j=sub,n=1000,zz={'sockets':slots},**state)
                definition.update({f's{i+1}':dict(a=1,b=b,c=0,j=0) for i,b in enumerate(f['runewordRunes'])})
                if signature(key,definition) in done:continue
                result=oracle.capture_pipeline(row,definition,cls)
                record=dict(profile=key,definition=definition,intendedWord=word['b'],**result)
                records.append(record)
                with checkpoint.open('a',encoding='utf8') as saved:saved.write(json.dumps(record,separators=(',',':'))+'\n')
    with (ROOT/'full-word-progress.txt').open('w') as progress:progress.write(f"Word {word['b']}; {len(records)} complete fixtures\n")
    print('Word',word['b'],'/',len(records),'full chains',flush=True)
output.write_text(json.dumps(dict(buildSha256='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',fixtures=records),separators=(',',':'))+'\n',encoding='utf8')
print('Finished',len(records),'full word chains',flush=True)
