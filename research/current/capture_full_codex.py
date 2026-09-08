"""Full native CreateItemNew Codex chains, with exact room-reference identities.

Fixture room references use their room index as a lossless handle. The native
array selector still runs unchanged; no 64-bit asset reference passes through
a Python double. Room names are read from the supplied data.win ROOM table.
"""
import copy,json,struct
from pathlib import Path
from native_natural_sockets import NaturalSocketOracle,BUILD
from audit_generation_coverage import ROOT

def room_names():
 raw=Path(r'C:\Users\falor\Downloads\testhero siege\Hero-Siege-AnkerGames (1)\HeroSiege\bin\data.win').read_bytes()
 u32=lambda p:struct.unpack_from('<I',raw,p)[0]
 pos=8
 while raw[pos:pos+4]!=b'ROOM':pos+=8+u32(pos+4)
 pos+=8;names=[]
 for i in range(u32(pos)):
  p=u32(pos+4+4*i);s=u32(p);names.append(raw[s:s+u32(s-4)].decode('utf8'))
 return names

def main():
 names=room_names();rows=json.loads((ROOT/'codex-definitions.json').read_text(encoding='utf8'));oracle=NaturalSocketOracle();fixtures=[];zones=None
 for original in rows:
  row=copy.deepcopy(original)
  for name,args in row['calls']:
   if name=='SetBaseItemStat' and args[0]==347:
    args[1]=[int(ref)&0xffffffff for ref in args[1]]
    native_zones=[dict(room=index,id=names[index]) for index in args[1]]
    if zones is None:zones=native_zones
    assert native_zones==zones
  states=[dict(a=seed) for seed in list(range(1,49))+[57,548,123456,999999937]]
  states += [dict(a=seed,**patch) for seed in (1,57,123456) for patch in [dict(u=1,v=2),dict(u=5,v=7),dict(s=0),dict(s=314159),dict(n=1001),dict(n=1004),dict(n=1006),dict(q=2),dict(s=0,q=2),dict(p=5),dict(r=1)]]
  for state in states:
   definition={'b':row['b'],'c':0,'j':0,'p':0,'r':0,**state}
   result=oracle.capture(row,definition,11)
   values={str(k):oracle.arrays.get(v,v) for k,v in result['stats'].items()}
   trace=[t for t in result['trace'] if t[0] in ('draw','seed')]
   fixtures.append(dict(definition=definition,values=values,zone=names[int(values['347'])],trace=trace))
  print('Full Codex',row['b'],len(fixtures),flush=True)
 output=dict(buildSha256=BUILD,roomReferenceHandles='data.win ROOM indices',zones=zones,fixtures=fixtures)
 (ROOT/'full-codex-native.json').write_text(json.dumps(output,separators=(',',':')),encoding='utf8')
 (ROOT.parent.parent/'tests/current_full_codex_native.json').write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf8')
 print('Finished',len(fixtures),flush=True)

if __name__=='__main__':main()
