"""Publish only complete, checked static native generation/socket captures."""
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from engine.cpr import Cpr

def main():
    native=json.loads((ROOT/'research/current/natural-sockets-native.json').read_text(encoding='utf8'))
    grouped={key:[] for key in native['rules']}
    for fixture in native['fixtures']:grouped[fixture['profile']].append(fixture)
    rules={};fixtures=[];deferred=[]
    for key,rule in native['rules'].items():
        base=rule['base'];socket=rule['range'];rows=grouped[key]
        late=[k for k in base['order'] if k==21]
        base={**base,'order':[k for k in base['order'] if k not in late]}
        if any(len(v) not in (1,2) or not all(isinstance(n,(int,float)) for n in v) for v in base['stats'].values()):
            deferred.append({'profile':key,'reason':'Non-scalar/range base definition'});continue
        upper=socket[1]-socket[0] if len(socket)==2 else 1
        bounds=[base['stats'][str(k)][1]-base['stats'][str(k)][0] for k in base['order']]+[2,4]*4+[base['stats'][str(k)][1]-base['stats'][str(k)][0] for k in late]+[upper]
        valid=True
        for f in rows:
            rng=Cpr(f['definition']['a']);draws=[[0,b,rng.irandom(b)] for b in bounds]
            count=min(6,socket[0]+(draws[-1][2] if len(socket)==2 else 0)+(1 if f['definition'].get('q')==2 else 0))
            if f['draws']!=draws or f['count']!=count:
                deferred.append({'profile':key,'reason':'Additional generation branches','definition':f['definition'],'expectedBounds':bounds,'actualBounds':[d[1] for d in f['draws']]});valid=False;break
        if not valid:continue
        assert len(rows)==7
        rules[key]={'base':base,'range':socket if len(socket)==2 else socket*2,'socketDrawUpper':upper,'socketRandom':len(socket)==2,'lateOrder':late}
        fixtures.extend(rows)
    (ROOT/'engine/current_natural_socket_rules.js').write_text(
        '// Original CreateItemNew through socket assignment. Later effects are separate.\n'
        '// Supplied binary SHA256 '+native['buildSha256']+'\n'
        'export const CURRENT_NATURAL_SOCKET_RULES = '+json.dumps(rules,separators=(',',':'))+';\n',encoding='utf8',newline='\n')
    (ROOT/'tests/current_natural_sockets_native.json').write_text(json.dumps({'buildSha256':native['buildSha256'],'boundary':native['boundary'],'fixtures':fixtures},separators=(',',':'))+'\n',encoding='utf8',newline='\n')
    (ROOT/'research/current/natural-sockets-deferred.json').write_text(json.dumps({'capture':native['excluded'],'validation':deferred},indent=2),encoding='utf8')
    print('Published',len(rules),'current static definitions and',len(fixtures),'native cases;',len(deferred),'additional paths deferred.')

if __name__=='__main__':main()
