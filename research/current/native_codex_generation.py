"""Execute current Codex generation with isolated runner data services."""
import json, re, struct, sys
from native_crystal_oracle import CrystalOracle, ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
sys.path.insert(0,str(ROOT.parent.parent))
from engine.cpr import Cpr

class CodexGenerationOracle(CrystalOracle):
    def __init__(self):
        super().__init__()
        self.ids={}
        for name,address,_ in (line.split('\t') for line in (ROOT/'variable-slots.txt').read_text().splitlines() if line.count('\t')==2):
            number=len(self.ids)+1000;self.ids[number]=name;self.uc.mem_write(int(address,16),struct.pack('<i',number))
        self.strings={}
        for rva,name in re.findall(r'^0x([a-fA-F0-9]+) (.*)$',(ROOT/'variable-initializers.txt').read_text(),re.M):
            handle=50000000+len(self.strings);self.strings[handle]=name;self.put(0x140000000+int(rva,16),handle)
        for address in [0x14071db90,0x140721da0,0x14b4c34d0,0x14b4daee0]:self.uc.hook_add(UC_HOOK_CODE,self.service,begin=address,end=address)
    def service(self,uc,address,size,data):
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        result=r8
        if address in (0x14b4c34d0,0x14b4daee0):pass # GC registration/free for fixture-owned memory.
        elif address==0x130200:
            assert self.ids[rdx&0xffffffff]=='zrm';result=0x130300;self.put(result,99)
        elif address==0x14071db90:
            seed=self.args(r9,40)[0];self.rng=Cpr(seed);self.trace.append(['seed',seed]);self.put(r8,None)
        elif address in (0x1407213f0,0x140721da0):
            args=self.args(r9,40);lo,hi=(0,args[0]) if len(args)==1 else args
            value=lo+self.rng.irandom(hi-lo);self.trace.append(['draw',lo,hi,value]);self.put(r8,value)
        elif address==0x14b4c6210:
            name=self.ids[self.stack64(40)&0xffffffff];args=self.args(r9,48)
            if name=='struct_get_from_hash':value=self.definition.get(self.ids[int(args[1])])
            elif name=='variable_struct_get':value=self.objects[args[0]].get(int(args[1]))
            elif name=='is_array':value=args[0] in self.arrays
            elif name=='array_push':self.arrays[args[0]].extend(args[1:]);value=None
            else:return super().service(uc,address,size,data)
            self.put(r8,value)
        elif address==0x14b4c6340:
            name=self.methods[self.value(self.stack64(40))];args=self.args(r9,48)
            if name=='GetItemDef':value=self.definition.get(self.strings[args[0]])
            elif name=='GetItemInfo':value=self.info.get(int(args[0]))
            elif name=='GetItemStat':value=self.current.get(int(args[0]))
            elif name=='SetItemStat':
                self.current[int(args[0])]=args[1];value=None;self.trace.append(['set',*args])
            else:raise ValueError((name,args))
            self.put(r8,value)
        else:return super().service(uc,address,size,data)
        uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
    def generate(self,definition,base=None,infernal=True):
        self.arrays={};self.definition=definition;self.current={};self.info={7:6}
        self.objects={11:{k:self.array(v) if isinstance(v,list) else v for k,v in (base or {}).items()}}
        self.handles={'itemDefinitionStruct':10,'itemBaseStatStruct':11,'GetItemDef':20,'GetItemStat':21,'SetItemStat':22,'GetItemInfo':23}
        self.methods={v:k for k,v in self.handles.items() if v>=20}
        self.rng=Cpr(definition['a']);self.trace=[]
        for i,value in enumerate((100,101,int(infernal))):
            self.put(0x110000+16*i,value);self.write64(0x111000+8*i,0x110000+16*i)
        rsp=0x3f0008;self.write64(rsp,0x103000);self.write64(rsp+40,0x111000)
        for register,value in ((UC_X86_REG_RSP,rsp),(UC_X86_REG_RCX,0),(UC_X86_REG_RDX,0),(UC_X86_REG_R8,0x112000),(UC_X86_REG_R9,3)):self.uc.reg_write(register,value)
        try:self.uc.emu_start(0x1406f7e00,0x103000,count=1000000)
        except Exception:
            print('Stopped at',hex(self.uc.reg_read(UC_X86_REG_RIP)),self.trace[-10:]);raise
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x103000
        return {'stats':self.current,'trace':self.trace}

if __name__=='__main__':
    x=CodexGenerationOracle()
    print(json.dumps(x.generate({'a':123456,'u':1,'v':2,'s':0}),indent=2))
