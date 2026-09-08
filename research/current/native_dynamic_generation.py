"""Capture current dynamic equipment through the pre-Crystal socket boundary."""
import json
from audit_generation_coverage import equipment_rows,stat_definitions,ROOT
from native_natural_sockets import NaturalSocketOracle,BUILD

if __name__=='__main__':
    profiles=json.loads((ROOT.parent.parent/'data/item_profiles.json').read_text(encoding='utf8'))['profiles']
    x=NaturalSocketOracle();fixtures=[];excluded=[];definitions={}
    for key,cls,sub,row in equipment_rows():
        special=any(name in ('SetBaseItemDamageTypeStat','SetBaseItemSocketStat') for name,_ in row['calls'])
        if not key.startswith('unique:') or not (profiles.get(key,{}).get('dynamic') or '221' in stat_definitions(row) or special):continue
        records=[]
        for seed,p,r,q in [(1,0,0,0),(123456,0,0,0),(999999937,0,0,0),(42,5,0,0),(42,0,1,0),(42,0,0,1),(42,0,0,2)]:
            definition={'a':seed,'b':row['b'],'c':1,'j':sub,'p':p,'r':r,'q':q}
            try:
                result=x.capture(row,definition,cls)
                records.append({'profile':key,'definition':definition,'values':{k:x.arrays.get(v,v) for k,v in result['stats'].items()},'count':result['stats'].get(20,0),'trace':result['trace']})
            except Exception as error:
                excluded.append({'profile':key,'reason':repr(error)});break
        if len(records)==7:
            fixtures.extend(records);definitions[key]=stat_definitions(row)
            print('Captured',key,flush=True)
    (ROOT/'dynamic-generation-native.json').write_text(json.dumps({'buildSha256':BUILD,'definitions':definitions,'fixtures':fixtures,'excluded':excluded},separators=(',',':')),encoding='utf8')
    print('Finished',len(definitions),'items;',len(fixtures),'cases;',len(excluded),'excluded',flush=True)
