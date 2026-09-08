"""Capture original Unique base/generation/socket stages with explicit boundaries."""
import argparse,json
from audit_generation_coverage import equipment_rows,stat_definitions,ROOT
from native_item_generation import ItemGenerationOracle
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_RIP

BUILD='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4'
BOUNDARY=0x1406f2936

class NaturalSocketOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__()
        self.uc.hook_add(UC_HOOK_CODE,self.stop,begin=BOUNDARY,end=BOUNDARY)
    def service(self,uc,address,size,data):
        if self.script_hooks.get(address)=='CreateItemInit': return
        super().service(uc,address,size,data)
    def stop(self,uc,*_):
        self.reached_socket=True
        uc.reg_write(UC_X86_REG_RIP,0x103000);uc.emu_stop()
    def capture(self,row,definition,cls):
        self.reached_socket=False
        result=self.capture_item(row,definition,cls)
        assert self.reached_socket,'Native socket boundary was not reached'
        return result

def candidates():
    profiles=json.loads((ROOT.parent.parent/'data/item_profiles.json').read_text(encoding='utf8'))['profiles']
    for key,cls,sub,row in equipment_rows():
        if not key.startswith('unique:'):continue
        stats=stat_definitions(row)
        if profiles.get(key,{}).get('dynamic'):continue
        if any(name not in ('SetBaseItemStat','itemBaseStatStruct','SetBaseItemInfo','itemBaseInfoStruct') for name,_ in row['calls']):continue
        if '221' in stats:continue
        yield key,cls,sub,row,stats

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--probe',action='store_true');parser.add_argument('--retry',action='store_true');args=parser.parse_args()
    oracle=NaturalSocketOracle();fixtures=[];rules={};excluded=[];seen=set()
    retry=None
    if args.retry:
        previous=json.loads((ROOT/'natural-sockets-native.json').read_text(encoding='utf8'))
        fixtures=previous['fixtures'];rules=previous['rules'];retry={r['profile'] for r in previous['excluded']}
    for key,cls,sub,row,stats in candidates():
        if retry is not None and key not in retry:continue
        shape=str(stats.get('20'))
        if args.probe and shape in seen:continue
        seen.add(shape)
        base={k:v for k,v in stats.items() if k!='20'}
        order=sorted((int(k) for k,v in base.items() if len(v)==2),key=str)
        records=[]
        states=[(1,0,0,0)] if args.probe else [(1,0,0,0),(123456,0,0,0),(999999937,0,0,0),(42,5,0,0),(42,0,1,0),(42,0,0,1),(42,0,0,2)]
        for seed,p,r,q in states:
            definition={'a':seed,'b':row['b'],'c':1,'j':sub,'p':p,'r':r,'q':q}
            try:
                result=oracle.capture(row,definition,cls)
                draws=[t[1:] for t in result['trace'] if t[0]=='draw']
                records.append({'profile':key,'definition':definition,'values':result['stats'],'count':result['stats'].get(20,0),'draws':draws})
                if args.probe:print(json.dumps({'key':key,'range':stats.get('20'),'count':result['stats'].get(20),'bounds':[d[:2] for d in draws],'baseOrder':order,'calls':[t[0] for t in result['trace'] if t[0].startswith('gml_')]}),flush=True)
            except Exception as error:
                excluded.append({'profile':key,'error':repr(error)});break
        if len(records)!=len(states):continue
        rule={'range':stats.get('20',[0]),'base':{'order':order,'stats':base}}
        rules[key]=rule;fixtures.extend(records)
        if len(rules)%50==0:print('Captured',len(rules),'items /',len(fixtures),'cases',flush=True)
    output={'buildSha256':BUILD,'boundary':hex(BOUNDARY),'rules':rules,'fixtures':fixtures,'excluded':excluded}
    path=ROOT/('natural-sockets-probe.json' if args.probe else 'natural-sockets-native.json')
    path.write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
    print('Finished',len(rules),'items /',len(fixtures),'cases;',len(excluded),'excluded',flush=True)

if __name__=='__main__':main()
