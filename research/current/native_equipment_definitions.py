"""Capture current item case definitions using their real dispatch table."""
import json,struct,sys,gc
import capstone,pefile
import collections
import unicorn.x86_const as registers
from native_socket_definitions import SocketDefinitionOracle,ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

class EquipmentOracle(SocketDefinitionOracle):
    def __init__(self,complete=False,**config):
        super().__init__(**config)
        self.complete=complete
        self.start=config['start'];self.case_start=config['case_start']
        directory=self.pe.OPTIONAL_HEADER.DATA_DIRECTORY[3]
        self.functionEnd=next(e for b,e,_ in struct.iter_unpack('<III',self.pe.get_data(directory.VirtualAddress,directory.Size)) if b==self.start-0x140000000)
        if complete:
            decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_64)
            call=next(i for i in decoder.disasm(self.pe.get_data(self.stop-0x140000000,0x1000),self.stop) if i.mnemonic=='call' and i.op_str=='0x144c3a0a0')
            self.stop=call.address+call.size
        self.uc.hook_add(UC_HOOK_CODE,self.service,begin=0x14b4c34d0,end=0x14b4c34d0)
        self.uc.hook_add(UC_HOOK_CODE,self.service,begin=0x140189690,end=0x140189690)
        self.uc.hook_add(UC_HOOK_CODE,self.service,begin=0x14b4daee0,end=0x14b4daee0)
        self.uc.hook_add(UC_HOOK_CODE,self.service,begin=0x144c3a0a0,end=0x144c3a0a0)
        self.write64(0x130110,0x130220)
        self.uc.hook_add(UC_HOOK_CODE,self.service,begin=0x130220,end=0x130220)
        # Shared cleanup can conditionally skip a destructor at the first exit.
        # Stop anywhere in this small verified cleanup block, before the outer
        # definition loop runs again with an artificial frame.
        self.uc.hook_add(UC_HOOK_CODE,lambda uc,*_:uc.emu_stop(),begin=self.stop,end=self.stop+32)
    def service(self,uc,address,size,data):
        if address==0x130220:
            member=uc.reg_read(UC_X86_REG_RDX)&0xffffffff
            result=0x300000+16*(member-1000);self.property_writes[member]=result
            uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
            return
        if self.complete and address==0x14b4c6340:
            name=self.ids[int(self.value(self.stack64(40)))];args=self.args(uc.reg_read(UC_X86_REG_R9),48)
            if name in ('GetBaseItemInfo','GetBaseItemStat'):
                table=self.tables['itemBaseInfoStruct' if name=='GetBaseItemInfo' else 'itemBaseStatStruct']
                value=table.get(int(args[0]),args[1] if len(args)>1 else None);self.put(uc.reg_read(UC_X86_REG_R8),value)
                uc.reg_write(UC_X86_REG_RAX,uc.reg_read(UC_X86_REG_R8));uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
                return
        if address==0x14b4c6210 and self.ids[self.stack64(40)&0xffffffff]=='variable_struct_get':
            args=self.args(uc.reg_read(UC_X86_REG_R9),48);name=self.ids[int(args[0])]
            table=self.tables.setdefault(name,{})
            self.put(uc.reg_read(UC_X86_REG_R8),table.get(int(args[1])))
            uc.reg_write(UC_X86_REG_RAX,uc.reg_read(UC_X86_REG_R8))
            uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
        elif address==0x130200:
            member=uc.reg_read(UC_X86_REG_RDX)&0xffffffff;result=0x170000+16*(member-1000)
            self.put(result,member);uc.reg_write(UC_X86_REG_RAX,result)
            uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
        elif address==0x144c3a0a0:
            if self.complete:return
            # This pass captures base case metadata. Tier stat transforms are
            # deliberately deferred and these rows cannot certify full stats.
            self.deferred.add('LoadTierStats');self.put(uc.reg_read(UC_X86_REG_R8),None)
            uc.reg_write(UC_X86_REG_RAX,uc.reg_read(UC_X86_REG_R8))
            uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
        elif address in (0x14b4c34d0,0x140189690,0x14b4daee0):
            uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
        else:
            before=len(self.calls);result=super().service(uc,address,size,data)
            if len(self.calls)>before:
                name,args=self.calls[-1]
                if len(args)==2:
                    table='itemBaseStatStruct' if name=='SetBaseItemStat' else 'itemBaseInfoStruct' if name=='SetBaseItemInfo' else name
                    self.tables.setdefault(table,{})[int(args[0])]=args[1]
            return result
    def capture(self,index):
        # Some case bodies use the script self's property vtable directly.
        decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_64);decoder.detail=True
        start=self.targets[index];end=min((a for a in self.targets if a>start),default=max(self.functionEnd,self.stop-0x140000000))
        ins=list(decoder.disasm(self.pe.get_data(start,end-start),0x140000000+start))
        slots=[]
        for a,b in zip(ins,ins[1:]):
            if a.mnemonic=='mov' and a.op_str.startswith('rcx, qword ptr [rbp') and b.mnemonic=='mov' and b.op_str=='rax, qword ptr [rcx]':slots.append(a.operands[1].mem.disp)
        self.definition={'b':self.mapping[index],'c':0,'j':0};self.deferred=set();self.calls=[];self.arrays={};self.property_writes={};self.tables={'itemBaseInfoStruct':{27:1,21:1}};self.uc.mem_write(0x700000,bytes(0x200000))
        self.uc.reg_write(UC_X86_REG_RSP,0x700000);self.uc.reg_write(UC_X86_REG_RBP,0x780000)
        self.restore_constants(decoder)
        if self.start==0x140ffdde0:
            # The loop-exit path restores a byte into r12 before the dispatch.
            # Live Axe cases instead retain this RValue constant (native LEA
            # at 0x140ffe5dc); a linear prefix scan includes that dead exit.
            self.uc.reg_write(UC_X86_REG_R12,0x1506b1d80)
        for offset in slots:self.write64(0x780000+offset,0x130000)
        self.uc.emu_start(0x140000000+start,self.stop,count=1000000)
        assert self.stop<=self.uc.reg_read(UC_X86_REG_RIP)<=self.stop+32
        return {'b':self.mapping[index],'case':index,'deferred':sorted(self.deferred),'fields':{self.ids[m]:self.value(p) for m,p in self.property_writes.items()},'calls':[[name,[self.arrays.get(a,a) for a in args]] for name,args in self.calls]}
    def restore_constants(self,decoder):
        state={}
        def name(reg):
            n=decoder.reg_name(reg) or ''
            return 'r'+n[1:] if n.startswith('e') else n[:-1] if n.startswith('r') and n.endswith('d') else n
        for ins in decoder.disasm(self.pe.get_data(self.start-0x140000000,self.case_start-self.start),self.start):
            op=ins.operands
            if not op or op[0].type!=capstone.CS_OP_REG:continue
            dest=name(op[0].reg)
            if ins.mnemonic in ('xor','xorps','xorpd','pxor') and len(op)>1 and op[0].reg==op[1].reg:state[dest]=0
            elif ins.mnemonic.startswith('mov') and len(op)>1:
                value=None
                if op[1].type==capstone.CS_OP_IMM:value=op[1].imm
                elif op[1].type==capstone.CS_OP_REG:value=state.get(name(op[1].reg))
                elif op[1].type==capstone.CS_OP_MEM and op[1].mem.base==capstone.x86.X86_REG_RIP:
                    raw=self.pe.get_data(ins.address+ins.size+op[1].mem.disp-0x140000000,op[1].size);value=int.from_bytes(raw,'little')
                state[dest]=value
            elif ins.mnemonic=='lea' and op[1].type==capstone.CS_OP_MEM:
                m=op[1].mem;base=ins.address+ins.size if m.base==capstone.x86.X86_REG_RIP else state.get(name(m.base))
                state[dest]=None if base is None or m.index else base+m.disp
        for n,value in state.items():
            if value is not None and n in ['rbx','rsi','rdi','r12','r13','r14','r15',*[f'xmm{i}' for i in range(6,16)]]:self.uc.reg_write(getattr(registers,'UC_X86_REG_'+n.upper()),value)

    def apply_tier(self,sub,cls,unique=False):
        """The common tail calls LoadTierStats(subtype, itemType) on the repo self."""
        self.complete=True
        self.tables['itemBaseInfoStruct'].setdefault(27,6 if unique else 1)
        self.definition.update(j=sub,c=int(unique))
        for i,value in enumerate((sub,cls)):
            self.put(0x110000+16*i,value);self.write64(0x111000+8*i,0x110000+16*i)
        rsp=0x3f0008;self.write64(rsp,0x103000);self.write64(rsp+40,0x111000)
        for reg,value in [(UC_X86_REG_RSP,rsp),(UC_X86_REG_RCX,0x130000),(UC_X86_REG_RDX,0),(UC_X86_REG_R8,0x112000),(UC_X86_REG_R9,2)]:self.uc.reg_write(reg,value)
        self.uc.emu_start(0x144c3a0a0,0x103000,count=1000000)
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x103000
        return [[name,[self.arrays.get(a,a) for a in args]] for name,args in self.calls]

def config_for(pe,start,end):
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_64);decoder.detail=True
    # Small item switches compile as JE chains (four or five entries).
    body=list(decoder.disasm(pe.get_data(start,end-start),0x140000000+start))
    for i,ins in enumerate(body):
        if ins.mnemonic=='test' and ins.op_str=='edx, edx':
            for count in (3,4,5):
                chunk=body[i:i+2*count]
                if [x.mnemonic for x in chunk]==['test','je']+['sub','je']*(count-2)+['cmp','jne']:
                    targets=[chunk[j].operands[0].imm-0x140000000 for j in range(1,2*count-2,2)]+[chunk[-1].address+chunk[-1].size-0x140000000]
                    return dict(start=start+0x140000000,count=count,targets=targets,case_start=min(targets)+0x140000000,stop=chunk[-1].operands[0].imm)
    window=[]
    for ins in decoder.disasm(pe.get_data(start,end-start),0x140000000+start):
        window.append(ins);window=window[-12:]
        if ins.mnemonic=='jmp' and ins.operands[0].type==capstone.CS_OP_REG:
            cmp=next(x for x in reversed(window[:-1]) if x.mnemonic=='cmp' and x.operands[-1].type==capstone.CS_OP_IMM)
            bound=next(x for x in reversed(window[:-1]) if x.mnemonic=='ja')
            lookup=next(x for x in reversed(window[:-1]) if x.mnemonic=='mov' and x.operands[-1].type==capstone.CS_OP_MEM and x.operands[-1].mem.scale==4)
            table=lookup.operands[-1].mem.disp;count=cmp.operands[-1].imm+1;targets=struct.unpack(f'<{count}I',pe.get_data(table,4*count))
            # Runtime value-type cleanup also has a 16-way jump table. Item
            # cases start directly after their dispatch, cleanup targets do not.
            if not 0<=min(targets)+0x140000000-(ins.address+ins.size)<=64:continue
            exits=collections.Counter(x.operands[0].imm for x in decoder.disasm(pe.get_data(min(targets),bound.operands[0].imm-0x140000000-min(targets)),0x140000000+min(targets)) if x.mnemonic=='jmp' and x.operands[0].type==capstone.CS_OP_IMM and max(targets)+0x140000000<x.operands[0].imm<end+0x140000000)
            stop=max(exits) if exits else bound.operands[0].imm
            return dict(start=start+0x140000000,table=table,count=count,case_start=ins.address+ins.size,stop=stop)
    raise ValueError('No supported dispatch table')

if __name__=='__main__':
    pe=pefile.PE(str(ROOT/'HeroSiegeC6E.exe'),fast_load=True);directory=pe.OPTIONAL_HEADER.DATA_DIRECTORY[3]
    bounds={b:e for b,e,_ in struct.iter_unpack('<III',pe.get_data(directory.VirtualAddress,directory.Size))}
    routines=json.loads((ROOT/'routines.json').read_text())['routines'];output=ROOT/'equipment-definitions-native.json'
    done=json.loads(output.read_text()) if output.exists() else {};errors={}
    include=sys.argv[1:]
    for name,start in routines.items():
        if not name.startswith(('gml_Script_DefineItemNormal','gml_Script_DefineItemUnique')):continue
        if include and not any(word in name for word in include):continue
        if name in done:continue
        try:
            config=config_for(pe,start,bounds[start]);x=EquipmentOracle(**config)
            rows=[x.capture(i) for i in range(config['count'])]
            done[name]={'config':config,'rows':rows};output.write_text(json.dumps(done,separators=(',',':')))
            print(name,len(rows),flush=True);del x;gc.collect()
        except Exception as error:errors[name]=str(error);print('FAILED',name,repr(error),flush=True)
    (ROOT/'equipment-definition-errors.json').write_text(json.dumps(errors,indent=2))
