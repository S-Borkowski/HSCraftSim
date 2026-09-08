"""Inspect native affix name selection without editing the game or saves."""
import json
from native_normal_state import NormalStateOracle
from audit_generation_coverage import equipment_rows, ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_R9


class NameProbe(NormalStateOracle):
    def __init__(self):
        super().__init__()
        routines=json.loads((ROOT/'routines.json').read_text())['routines']
        for name in ('ReturnPrefixName','ReturnSuffixName'):
            address=0x140000000+routines['gml_Script_'+name]
            self.observe[address]=name
            self.uc.hook_add(UC_HOOK_CODE,self.observe_call,begin=address,end=address)

    def service(self,uc,address,size,data):
        if self.script_hooks.get(address)=='GetLocalized':
            args=self.args(uc.reg_read(UC_X86_REG_R9),40)
            self.trace.append(['localized',[self.strings.get(a,a) for a in args]])
        return super().service(uc,address,size,data)


if __name__=='__main__':
    oracle=NameProbe();records=[]
    for key,cls,sub,row in equipment_rows():
        if key not in ('normal:0:0:10','normal:1:0:10','normal:5:0:0','normal:3:1:0'):continue
        for seed in (1,2,42,57,123456):
            for quality in (1,100,200,1000):
                definition=dict(a=seed,b=row['b'],c=0,j=sub,n=quality)
                result=oracle.capture(row,definition,cls)
                trace=[t for t in result['trace'] if t[0] in ('localized','ReturnPrefixName','ReturnSuffixName','gml_Script_ReturnPrefixStats','gml_Script_ReturnSuffixStats')]
                records.append(dict(profile=key,definition=definition,rarity=result['info'][27],trace=trace))
    (ROOT/'normal-name-probe.json').write_text(json.dumps(records,indent=2),encoding='utf8')
    print('Captured',len(records),'name traces')
    for record in records[:8]:print(json.dumps(record))
