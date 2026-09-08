"""Capture normal rarity/socket boundaries for the current executable.

Affix values are recorded separately and are not certified by the state model.
All repository objects and runner storage belong to this isolated emulator.
"""
import argparse, json
from collections import Counter
from audit_generation_coverage import equipment_rows, ROOT
from native_natural_sockets import NaturalSocketOracle, BUILD
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_RSP

FIELDS = {'tier':0x17db8, 'requiredLevel':0x17e58, 'affixCount':0x17e68,
          'magic':0x17e78, 'white':0x17e88, 'whiteChance':0x17e98,
          'forcedRarity':0x17ea8, 'special':0x17eb8, 'specialCharm':0x17ec8,
          'superiorCount':0x17ed8, 'earlySockets':0x17f48}


class NormalStateOracle(NaturalSocketOracle):
    def __init__(self):
        super().__init__()
        self.uc.hook_add(UC_HOOK_CODE,self.phase,begin=0x1440c3a4d,end=0x1440c3a4d)

    def observe_call(self, uc, address, size, data):
        super().observe_call(uc,address,size,data)
        if self.observe[address]=='gml_Script_LoadCommonItems':
            self.base_values=dict(self.current)

    def phase(self, uc, *_):
        frame=uc.reg_read(UC_X86_REG_RSP)
        self.selection={}
        for key,offset in FIELDS.items():
            kind=int.from_bytes(uc.mem_read(frame+offset+12,4),'little')&0xffffff
            self.selection[key]=None if kind==0xffffff else self.value(frame+offset)
        self.selection['draws']=[t[1:] for t in self.trace if t[0]=='draw']
        self.selection['prefixes']=[t[1][2] for t in self.trace if t[0]=='gml_Script_ReturnPrefixStats']

    def capture_state(self, row, definition, cls):
        self.selection=None
        result=self.capture(row,definition,cls)
        assert self.selection is not None
        return {'selection':self.selection,'rarity':result['info'][27],
                'baseValues':self.base_values,
                'requiredLevel':result['info'][1], 'sockets':result['stats'].get(20,0),
                'draws':[t[1:] for t in result['trace'] if t[0] in ('draw','seed')],
                'socketTrace':[t for t in result['trace'] if t[0]=='seed' or (t[0]=='set' and t[1]==20)]}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--probe',action='store_true');args=parser.parse_args()
    oracle=NormalStateOracle();records=[];shapes=set()
    for key,cls,sub,row in equipment_rows():
        if not key.startswith('normal:'):continue
        info={int(a[0]):a[1] for n,a in row['calls'] if n in ('SetBaseItemInfo','itemBaseInfoStruct')}
        if args.probe and (cls,sub,info.get(32)) in shapes:continue
        shapes.add((cls,sub,info.get(32)))
        states=[dict(a=seed) for seed in ([1,2,3,4,42,123456] if args.probe else [1,2,6,57,548,1460,4018,123456,999999937])]
        if not args.probe:states += [dict(a=42,p=5),dict(a=42,r=1),dict(a=123456,q=2),dict(a=123456,q=2,s=0),dict(a=123456,q=2,s=314159)]
        for state in states:
            definition={'b':row['b'],'c':0,'j':sub,'p':0,'r':0,**state}
            result=oracle.capture_state(row,definition,cls)
            records.append({'profile':key,'definition':definition,**result})
        if args.probe or len(records)%140==0:print('Captured',key,'/',len(records),'cases',flush=True)
    name='normal-state-probe.json' if args.probe else 'normal-state-native.json'
    (ROOT/name).write_text(json.dumps({'buildSha256':BUILD,'fixtures':records},separators=(',',':')),encoding='utf8')
    if not args.probe:
        compact=[{k:v for k,v in record.items() if k not in ('draws','socketTrace','selection')} for record in records]
        (ROOT.parent.parent/'tests/current_normal_state_native.json').write_text(json.dumps({'buildSha256':BUILD,
            'boundary':'Current normal base stage, rarity and socket counts; full affix values are excluded',
            'fixtures':compact},separators=(',',':'))+'\n',encoding='utf8')
    print('Finished',len(records),Counter(r['rarity'] for r in records),flush=True)


if __name__=='__main__':main()
