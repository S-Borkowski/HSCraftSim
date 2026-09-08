"""Export native affix name tables and independent full selection fixtures."""
import json
from native_normal_names import NormalNameOracle, ROOT
from audit_generation_coverage import equipment_rows

oracle=NormalNameOracle();project=ROOT.parent.parent
affix_rules=json.loads((project/'engine/normal_affix_rules.js').read_text(encoding='utf8').split(' = ',1)[1].rstrip(';\n'))
affixes=affix_rules['affixes'];reachable=[set(),set()]
for groups in [*affix_rules['pools'].values(),*affix_rules['weapon'].values()]:
    for gate,entries in groups:
        rows=entries if isinstance(entries,list) else [r for values in entries['byElement'] for r in values]
        for side,bases,*fixed in rows:
            for base in bases if isinstance(bases,list) else [bases]:
                reachable[side].update(range(base,base+(1 if fixed and fixed[0] else 5)))
tables=[];keys=[];unused=[]
for side,affix_table in enumerate(affixes):
    names={};namekeys={}
    for index in affix_table:
        key=oracle.affix_key(side,int(index))
        if key not in oracle.english:
            assert int(index) not in reachable[side],('Unlocalized active name',side,index,key)
            unused.append([side,int(index),key]);continue
        names[index]=oracle.english[key]['en'];namekeys[index]=key
    tables.append(names);keys.append(namekeys)
rules=dict(buildSha256='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',prefixes=tables[0],suffixes=tables[1],of=oracle.english['suffix_of']['en'])
(project/'engine/normal_name_rules.js').write_text('// Original ReturnPrefixName/ReturnSuffixName and game English text.\nexport const NORMAL_NAME_RULES = '+json.dumps(rules,separators=(',',':'),ensure_ascii=False)+';\n',encoding='utf8')
(ROOT/'normal-name-keys.json').write_text(json.dumps(dict(keys=keys,unlocalizedUnused=unused),indent=2),encoding='utf8')
print('Exported',sum(map(len,tables)),'names',flush=True)

records=[];seen=set()
for key,cls,sub,row in equipment_rows():
    if not key.startswith('normal:'):continue
    info={int(a[0]):a[1] for n,a in row['calls'] if n in ('SetBaseItemInfo','itemBaseInfoStruct')}
    shape=(cls,sub,info.get(32))
    if shape in seen:continue
    seen.add(shape)
    states=[dict(a=seed,n=n) for seed,n in ((1,1),(42,1),(123456,1),(2,100),(57,200),(1,1000),(42,1006),(1460,6666),(548,6668))]
    states.extend([dict(a=123456,p=5),dict(a=123456,r=1),dict(a=57,zz={'dropQuality':200,'sockets':2})])
    if key in ('normal:3:1:0','normal:5:0:0','normal:7:0:0'):
        states.extend(dict(a=seed,n=200) for seed in range(1,101))
    for state in states:
        definition=dict(b=row['b'],c=0,j=sub,**state)
        parts=oracle.capture_name(row,definition,cls)
        records.append(dict(profile=key,definition=definition,prefix=parts.get(5,''),suffix=parts.get(4,''),
            selected=[[t[0],t[1][0]] for t in oracle.trace if t[0] in ('ReturnPrefixName','ReturnSuffixName')]))
    print(key,'/',len(records),'name fixtures',flush=True)
(project/'tests/current_normal_names_native.json').write_text(json.dumps(dict(buildSha256=rules['buildSha256'],fixtures=records),separators=(',',':'),ensure_ascii=False)+'\n',encoding='utf8')
print('Finished',len(records),'native name fixtures',flush=True)
