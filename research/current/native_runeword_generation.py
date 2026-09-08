"""Run current LoadRunewords with captured definitions and isolated runner services."""
import json,struct
from native_codex_generation import CodexGenerationOracle,ROOT,Cpr
from unicorn.x86_const import *
from unicorn import UC_HOOK_CODE

class RunewordGenerationOracle(CodexGenerationOracle):
    def __init__(self):
        super().__init__()
        for address in [0x140189690,0x1401898c0,0x140189910,0x14018bf00,0x14018bf30]:self.uc.hook_add(UC_HOOK_CODE,self.service,begin=address,end=address)
    def array(self,values):
        if not self.arrays:self.array_elements={}
        address=0x200000+len(self.arrays)*0x100
        self.arrays[address]=values
        self.uc.mem_write(address,bytes(0x100));self.uc.mem_write(address+0x24,struct.pack('<I',len(values)))
        return address
    def put(self,address,value):
        if value is not None and value in getattr(self,'arrays',{}):self.uc.mem_write(address,struct.pack('<QII',int(value),0,2))
        else:super().put(address,value)
    def value(self,address):
        raw=bytes(self.uc.mem_read(address,16))
        if struct.unpack_from('<I',raw,12)[0]&0xffffff==2:return struct.unpack_from('<Q',raw)[0]
        return super().value(address)
    def service(self,uc,address,size,data):
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        result=r8
        if address==0x140189690:pass # fixture-owned arrays stay alive until capture completes
        elif address in [0x1401897c0,0x1401898c0,0x140189910,0x14018bf00,0x14018bf30]:
            uc.mem_write(rcx,bytes(uc.mem_read(rdx,16)));result=rcx
        elif address==0x14b4c6210:
            name=self.ids[self.stack64(40)&0xffffffff];args=self.args(r9,48)
            # Struct field names are strings. Numeric surrogates retain their
            # string ordering, rather than accidentally sorting them as numbers.
            if name=='variable_struct_get_names':value=self.array(sorted(self.objects[args[0]],key=str))
            elif name=='array_sort':self.arrays[args[0]].sort(key=str);value=None
            elif name=='@@array_get@@':value=self.arrays[args[0]][int(args[1])]
            else:return super().service(uc,address,size,data)
            self.put(r8,value)
        elif address==0x14b4c6340:
            name=self.methods[self.value(self.stack64(40))];args=self.args(r9,48)
            if name in ('GetBaseItemStat','GetBaseItemInfo'):value=(self.base if name=='GetBaseItemStat' else self.baseinfo).get(int(args[0]))
            elif name=='GetItemStat':value=self.current.get(int(args[0]),args[1] if len(args)>1 else None)
            elif name=='SetItemInfo':self.info[int(args[0])]=args[1];value=None
            elif name=='AddStat':self.current[int(args[0])]=self.current.get(int(args[0]),0)+args[1];value=None;self.trace.append(['add',*args])
            else:return super().service(uc,address,size,data)
            self.put(r8,value)
        else:return super().service(uc,address,size,data)
        uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
    def capture(self,row,seed=123456,itemType=3,handed=1,existing=None):
        self.arrays={};self.current=dict(existing or {});self.definition={} if seed is None else {'i':seed};self.trace=[];self.rng=Cpr(seed or 0)
        tables={n:{} for n in ['SetBaseItemStat','itemData2H','itemDataArmor','SetBaseItemInfo']}
        for name,(key,value) in row['calls']:
            if name in tables:tables[name][int(key)]=self.array(value) if isinstance(value,list) else value
        self.base=tables['SetBaseItemStat'];self.baseinfo=tables['SetBaseItemInfo']
        self.info={int(self.value(0x1506cd310)):handed,1:1}
        self.objects={11:self.base,12:tables['itemData2H'],13:tables['itemDataArmor']}
        self.handles={'itemRepoRuneword':101,'itemRepoNormal':102,'itemType':itemType,'itemBaseStatStruct':11,'itemData2H':12,'itemDataArmor':13,
                      **{n:i+20 for i,n in enumerate(['GetItemDef','GetItemInfo','GetItemStat','SetItemStat','SetItemInfo','AddStat','GetBaseItemStat','GetBaseItemInfo'])}}
        self.methods={v:k for k,v in self.handles.items() if 20<=v<100}
        for i,value in enumerate((100,row['b'])):self.put(0x110000+16*i,value);self.write64(0x111000+8*i,0x110000+16*i)
        rsp=0x3f0008;self.write64(rsp,0x103000);self.write64(rsp+40,0x111000)
        for register,value in ((UC_X86_REG_RSP,rsp),(UC_X86_REG_RCX,0),(UC_X86_REG_RDX,0),(UC_X86_REG_R8,0x112000),(UC_X86_REG_R9,2)):self.uc.reg_write(register,value)
        try:self.uc.emu_start(0x1442aa0f0,0x103000,count=1000000)
        except Exception:
            print('Stopped at',hex(self.uc.reg_read(UC_X86_REG_RIP)),self.trace[-6:]);raise
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x103000
        return {'stats':self.current,'info':self.info,'trace':self.trace}

if __name__=='__main__':
    x=RunewordGenerationOracle();rows=json.loads((ROOT/'runeword-definitions-native.json').read_text())
    print(json.dumps(x.capture(rows[0]),indent=2))
