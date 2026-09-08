"""Inspect native talent-map population; never access a live game or save."""
import argparse,json,struct
from native_item_generation import ItemGenerationOracle,ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

class TalentMapOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__(load_talents=False)
        self.uc.mem_map(0x500000,0x800000)
        self.references={};self.properties={};self.with_frames={};self.talents={};self.template={}
        self.next_object=0x500000
        self.write64(0x130110,0x130220)
        for address in (0x130220,0x14b4c69e0,0x14b4c7120,0x14b4c66a0,0x1401f8a90,0x14b4c67d0,0x14b4c70d0):
            self.uc.hook_add(UC_HOOK_CODE,self.service,begin=address,end=address)
        self.uc.hook_add(UC_HOOK_CODE,self.constructor_entry,begin=0x141301120,end=0x141301120)
    def constructor_entry(self,uc,*_):
        uc.reg_write(UC_X86_REG_RCX,0x500000);self.write64(0x500000,0x130100)
    def array(self,values):
        if not self.arrays:self.array_elements={};self.array_payloads={};self.next_array_payload=0x3000000
        address=0x600000+len(self.arrays)*0x100
        assert address+0x100<=0x900000,'Talent array arena exhausted'
        self.arrays[address]=values;self.uc.mem_write(address,bytes(0x100))
        self.uc.mem_write(address+0x24,struct.pack('<I',len(values)))
        self.sync_array(address)
        return address
    def property(self,owner,member):
        pair=(owner,member)
        if pair not in self.properties:
            pointer=0x900000+16*len(self.properties);self.properties[pair]=pointer;self.put(pointer,None)
        return self.properties[pair]
    def value(self,address):
        raw=bytes(self.uc.mem_read(address,16))
        kind=struct.unpack_from('<I',raw,12)[0]&0xffffff
        if kind==15:
            value=struct.unpack_from('<Q',raw)[0]
            self.references[value]=raw.hex()
            return value
        return super().value(address)
    def service(self,uc,address,size,data):
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        result=r8
        if address==0x130220 or (address==0x130200 and 0x500000<=rcx<0x900000):
            result=self.property(rcx,rdx&0xffffffff)
        elif address in (0x14b4c67d0,0x14b4c70d0):result=0 # constructor type registration only
        elif address==0x14b4c69e0:
            self.with_frames[rcx]=(rdx,self.stack_value(rdx),r8,self.stack_value(r8))
            self.write64(rdx,int(self.value(r9)));result=1
        elif address==0x14b4c7120:result=0
        elif address==0x14b4c66a0:
            a,b,c,d=self.with_frames.pop(rcx);self.write64(a,b);self.write64(c,d)
        elif address==0x1401f8a90:pass # with-frame cleanup; storage is fixture-owned
        elif address==0x14b4c9800 and r8==0x80000000 and (int(self.value(rcx)),rdx&0xffffffff) in self.properties:
            result=r9;uc.mem_write(result,bytes(uc.mem_read(self.property(int(self.value(rcx)),rdx&0xffffffff),16)))
        else:
            return self.builtin_or_parent(uc,address,size,data)
        uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
    def stack_value(self,pointer):return struct.unpack('<Q',self.uc.mem_read(pointer,8))[0]
    def builtin_or_parent(self,uc,address,size,data):
        if address==0x14b4c6210:
            name=self.ids[self.stack64(40)&0xffffffff]
            args=self.args(uc.reg_read(UC_X86_REG_R9),48)
            self.trace.append(['builtin',hex(self.stack64(0)),name,args])
            if name=='@@NewGMLObject@@':
                assert len(args)==1 and self.ids[int(args[0])&0xffffff]=='gml_Script_s_TalentInfo'
                self.next_object+=0x100;value=self.next_object;self.write64(value,0x130100)
                for member,raw in self.template.items():
                    pointer=self.property(value,member)
                    if isinstance(raw,list):self.put(pointer,self.array(list(raw)))
                    else:uc.mem_write(pointer,raw)
            elif name=='ds_map_set':self.talents[int(args[1])]=int(args[2]);value=None
            elif name=='ds_map_create':value=100
            elif name=='ds_map_clear':self.talents={};value=None
            else:return super().service(uc,address,size,data)
            r8=uc.reg_read(UC_X86_REG_R8);self.put(r8,value);uc.reg_write(UC_X86_REG_RAX,r8)
            uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
            return
        return super().service(uc,address,size,data)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--all',action='store_true');args=parser.parse_args()
    x=TalentMapOracle();rows={};errors={}
    try:
        x.capture_item({'calls':[]},{'a':1},entry=0x141301120,params=())
        x.template={m:list(x.arrays[x.value(p)]) if x.value(p) in x.arrays else bytes(x.uc.mem_read(p,16)) for (o,m),p in x.properties.items() if o==0x500000}
        routines=json.loads((ROOT/'routines.json').read_text())['routines']
        selected={n:0x140000000+a for n,a in routines.items() if n.startswith('gml_Script_PopulateTalentStructMap') and (args.all or n.endswith('Amazon'))}
        # The main routine also invokes the class population functions. Capture
        # it alone in all mode to preserve actual initialization order.
        if args.all:selected={'gml_Script_PopulateTalentStructMap':0x141302700}
        for name,entry in selected.items():
            try:
                x.capture_item({'calls':[]},{'a':1},entry=entry,params=(),instruction_limit=20000000)
                print(name,':',len(x.talents),'talents;',len(x.template),'default fields',flush=True)
            except Exception as error:errors[name]=repr(error);raise
    finally:
        rows={key:{x.ids[m]:x.arrays.get(x.value(p),x.strings.get(x.value(p),x.value(p))) for (o,m),p in x.properties.items() if o==owner} for key,owner in x.talents.items()}
        (ROOT/('talent-map-native.json' if args.all else 'talent-map-probe.json')).write_text(json.dumps({'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4','errors':errors,'trace':x.trace,'references':x.references,'talents':rows},indent=2),encoding='utf8')
