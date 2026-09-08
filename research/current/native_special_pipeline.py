"""Capture actual CreateItemNew state through GenerateItemSpecialStats."""
import json
from native_item_generation import ItemGenerationOracle,ROOT
from audit_generation_coverage import equipment_rows
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_RIP,UC_X86_REG_R9

class SpecialPipelineOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__()
        self.uc.hook_add(UC_HOOK_CODE,self.stop,begin=0x1406f5280,end=0x1406f5280)
        self.uc.hook_add(UC_HOOK_CODE,self.start_special,begin=0x140705cc0,end=0x140705cc0)
    def service(self,uc,address,size,data):
        if self.script_hooks.get(address)=='CreateItemInit':return
        super().service(uc,address,size,data)
    def start_special(self,uc,*_):
        self.trace.append(['specialBoundary',self.rng.state,self.args(uc.reg_read(UC_X86_REG_R9),40)])
    def stop(self,uc,*_):
        self.reached=True;uc.reg_write(UC_X86_REG_RIP,0x103000);uc.emu_stop()

if __name__=='__main__':
    x=SpecialPipelineOracle();fixtures=[];errors=[]
    for key,cls,sub,row in equipment_rows():
        if not key.startswith('unique:') or not any(n in ('SetBaseItemDamageTypeStat','SetBaseItemSocketStat') for n,a in row['calls']):continue
        for seed,p,r,q in [(1,0,0,0),(123456,0,0,0),(999999937,0,0,0),(42,5,0,0),(42,0,1,0),(42,0,0,1),(42,0,0,2)]:
            definition={'a':seed,'b':row['b'],'c':1,'j':sub,'p':p,'r':r,'q':q,'ab':54321}
            x.reached=False
            try:
                result=x.capture_item(row,definition,cls);assert x.reached
                fixtures.append({'profile':key,'definition':definition,'values':{k:x.arrays.get(v,v) for k,v in result['stats'].items()},'trace':result['trace']})
            except Exception as error:errors.append({'profile':key,'definition':definition,'error':repr(error)});break
        print('Captured',key,flush=True)
    (ROOT/'special-pipeline-native.json').write_text(json.dumps({'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4','fixtures':fixtures,'errors':errors},separators=(',',':')),encoding='utf8')
    print(len(fixtures),'complete special pipelines;',len(errors),'errors',flush=True)
