"""Inspect the Face of Existence skill pool with an empty player subtalent map."""
import json
from native_natural_sockets import NaturalSocketOracle,ROOT,BUILD
from audit_generation_coverage import equipment_rows
from unicorn.x86_const import UC_X86_REG_R9
from unicorn.x86_const import UC_X86_REG_R8,UC_X86_REG_RAX,UC_X86_REG_RIP,UC_X86_REG_RSP
from unicorn import UC_HOOK_CODE

class FaceOracle(NaturalSocketOracle):
    def __init__(self):
        super().__init__();self.talent_cache={};self.pending=None
        self.uc.hook_add(UC_HOOK_CODE,self.lookup,begin=0x143ce3a80,end=0x143ce3a80)
        self.uc.hook_add(UC_HOOK_CODE,self.lookup_result,begin=0x1406f0b2f,end=0x1406f0b2f)
    def lookup(self,uc,*_):
        key=tuple(self.args(uc.reg_read(UC_X86_REG_R9),40))
        assert key[1:]==(17,None),'Cache is limited to the original Face skill-tag query'
        if key not in self.talent_cache:self.pending=key;return
        self.pending=None;r8=uc.reg_read(UC_X86_REG_R8);self.put(r8,self.array(list(self.talent_cache[key])))
        uc.reg_write(UC_X86_REG_RAX,r8);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
    def lookup_result(self,uc,*_):
        if self.pending is not None:
            self.talent_cache[self.pending]=list(self.arrays[self.value(uc.reg_read(UC_X86_REG_RAX))]);self.pending=None
    def service(self,uc,address,size,data):
        if address==0x14b4c6210:
            name=self.ids[self.stack64(40)&0xffffffff]
            if name in ('ds_list_find_value','ds_list_size'):
                args=self.args(uc.reg_read(UC_X86_REG_R9),48)
                self.trace.append(['pool',list(self.arrays[args[0]])])
        return super().service(uc,address,size,data)

if __name__=='__main__':
    key,cls,sub,row=next(r for r in equipment_rows() if r[0]=='unique:0:0:88')
    x=FaceOracle();definition={'a':42,'b':88,'c':1,'j':0}
    result=x.capture_item(row,definition,cls,instruction_limit=80000000)
    assert x.reached_socket
    candidates=next(t[1] for t in result['trace'] if t[0]=='pool')
    fixtures=[]
    for seed,p,r,q in [(1,0,0,0),(123456,0,0,0),(999999937,0,0,0),(42,5,0,0),(42,0,1,0),(42,0,0,1),(42,0,0,2)]:
        definition={'a':seed,'b':88,'c':1,'j':0,'p':p,'r':r,'q':q}
        captured=x.capture_item(row,definition,cls,instruction_limit=80000000)
        assert next(t[1] for t in captured['trace'] if t[0]=='pool')==candidates
        fixtures.append({'profile':key,'definition':definition,'values':captured['stats'],'count':captured['stats'].get(20,0),'draws':[t[1:] for t in captured['trace'] if t[0]=='draw']})
    output={'buildSha256':BUILD,'playerContext':'No allocated subtalents','profile':key,'coldDefinition':{'a':42,'b':88,'c':1,'j':0},'coldResult':result,
            'candidates':candidates,'cachedLookups':len(x.talent_cache),'fixtures':fixtures}
    (ROOT/'face-of-existence-native.json').write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf8')
    print('Captured Face of Existence:',len(candidates),'eligible abilities;',len(fixtures),'native cases;',len(x.talent_cache),'native tag-query results cached',flush=True)
