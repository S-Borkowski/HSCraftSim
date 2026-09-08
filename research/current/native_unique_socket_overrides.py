"""Verify legacy socket-seed fields on current Unique generation, offline."""
import json
from audit_generation_coverage import equipment_rows, ROOT
from native_face_of_existence import FaceOracle
from native_natural_sockets import BUILD


def main():
    oracle=FaceOracle();fixtures=[]
    for key,cls,sub,row in equipment_rows():
        if not key.startswith('unique:'):continue
        base=dict(a=123456,b=row['b'],c=1,j=sub,p=0,r=0,q=0)
        for socket_seed in (None,0,314159):
            definition=base if socket_seed is None else {**base,'s':socket_seed}
            oracle.reached_socket=False
            result=oracle.capture_item(row,definition,cls,instruction_limit=80000000)
            assert oracle.reached_socket
            count=result['stats'].get(20,0)
            if socket_seed is None:
                baseline=count;draws=[t for t in result['trace'] if t[0] in ('draw','seed','choose')]
            else:
                assert count==baseline,(key,socket_seed,count,baseline)
                assert [t for t in result['trace'] if t[0] in ('draw','seed','choose')]==draws
            fixtures.append({'profile':key,'definition':definition,'count':count})
        if len(fixtures)%150==0:print('Captured',len(fixtures),'cases',flush=True)
    output={'buildSha256':BUILD,'boundary':'CreateItemNew through natural socket assignment; no allocated player subtalents',
            'fixtures':fixtures}
    (ROOT.parent.parent/'tests/current_unique_socket_overrides_native.json').write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf8')
    print('Verified',len(fixtures),'cases across',len(fixtures)//3,'Unique definitions',flush=True)


if __name__=='__main__':main()
