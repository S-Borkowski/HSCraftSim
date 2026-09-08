"""Capture normal socketable definitions from the current native switch cases.

Only runner storage/string services are replaced; native case instructions and
their stat constants execute directly. The source executable is never launched.
"""
import json
import sys
import struct
import pefile
import capstone
from native_crystal_oracle import CrystalOracle, ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

class SocketDefinitionOracle(CrystalOracle):
    def value(self,address):
        raw=bytes(self.uc.mem_read(address,16))
        if struct.unpack_from('<I',raw,12)[0]&0xffffff==15: return struct.unpack_from('<q',raw)[0]
        return super().value(address)

    def __init__(self,start=0x140bc8ab0,table=0xc20d34,count=144,case_start=0x140bca3a5,stop=0x140c208f3,targets=None):
        super().__init__()
        self.pe=pefile.PE(str(ROOT/'HeroSiegeC6E.exe'),fast_load=True)
        self.ids={}
        for name,address,_ in (line.split('\t') for line in (ROOT/'variable-slots.txt').read_text().splitlines() if line.count('\t')==2):
            number=len(self.ids)+1000
            self.ids[number]=name
            self.uc.mem_write(int(address,16),struct.pack('<i',number))
        self.targets=targets or struct.unpack(f'<{count}I',self.pe.get_data(table,count*4));self.stop=stop
        self.mapping={}
        decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_64);decoder.detail=True
        registers={};constructor=None;stores={}
        def regkey(reg):
            name=decoder.reg_name(reg) or ""
            return 'r'+name[1:] if name.startswith('e') else name[:-1] if name.startswith('r') and name.endswith('d') else name
        def operand_value(op,ins):
            if op.type==capstone.CS_OP_IMM:return op.imm
            if op.type==capstone.CS_OP_REG:return registers.get(regkey(op.reg))
            if op.type==capstone.CS_OP_MEM:
                base=ins.address+ins.size if op.mem.base==capstone.x86.X86_REG_RIP else registers.get(regkey(op.mem.base),0 if not op.mem.base else None)
                return None if base is None or op.mem.index else base+op.mem.disp
        for ins in decoder.disasm(self.pe.get_data(start-0x140000000,case_start-start),start):
            op=ins.operands
            if ins.mnemonic in ('mov','movabs','lea') and op[0].type==capstone.CS_OP_REG:
                registers[regkey(op[0].reg)]=operand_value(op[1],ins)
            elif ins.mnemonic=='xor' and op[0].type==op[1].type==capstone.CS_OP_REG and op[0].reg==op[1].reg:registers[regkey(op[0].reg)]=0
            elif ins.mnemonic=='call' and ins.op_str in ('0x1401c6450','0x140189880'):
                constructor=(registers.get('rcx'),registers.get('rdx'))
                if constructor[0] is not None and constructor[1] is not None:stores[constructor[0]]=constructor[1];stores[constructor[0]+12]=10
            elif ins.mnemonic=='mov' and op[0].type==capstone.CS_OP_MEM and op[0].mem.base==capstone.x86.X86_REG_RIP:
                addr=operand_value(op[0],ins);val=operand_value(op[1],ins)
                if val is not None:stores[addr]=val
        for base in sorted(stores):
            mapping={}
            for i in range(count):
                addr=base+20*i;kind=stores.get(addr+12);value=stores.get(addr);case=stores.get(addr+16,0)
                if kind not in (0,7,10) or value is None or case in mapping or not 0<=case<count:break
                if kind==0:value=struct.unpack('<d',struct.pack('<Q',value))[0]
                mapping[case]=int(value)
            if len(mapping)==count and len(set(mapping.values()))==count:self.mapping=mapping;break
        if len(self.mapping)!=count:
            (ROOT/f'dispatch-stores-{start:x}.json').write_text(json.dumps({hex(k):v for k,v in stores.items()},indent=2))
        assert len(self.mapping)==count,len(self.mapping)
        assert len(set(self.mapping.values()))==count
        self.uc.mem_map(0x600000,0x400000)
        for address in (0x1401895d0,0x1401895e0,0x14018bf30,0x14b5380e0,0x14b4c9cf0):
            self.uc.hook_add(UC_HOOK_CODE,self.service,begin=address,end=address)

    def service(self,uc,address,size,_):
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        result=r8
        if address in (0x1401895d0,0x1401895e0):
            name=self.ids[rdx & 0xffffffff]
            result=0x170000+16*(rdx-1000);self.put(result,rdx)
        elif address==0x14018bf30:
            result=rcx;self.put(result,rdx) # String identity; definitions' numeric stats never use it.
        elif address==0x14b4c9800:
            result=r9;self.put(result,rdx&0xffffffff)
        elif address==0x14b5380e0:
            name=self.ids[int(self.value(r8))]
            args=[self.value(r9),self.value(self.stack64(40))]
            self.calls.append((name,args))
        elif address==0x14b4c6340:
            name=self.ids[int(self.value(self.stack64(40)))];args=self.args(r9,48)
            self.calls.append((name,args));self.put(r8,None)
        elif address==0x14b4c9cf0: pass
        else: return super().service(uc,address,size,_)
        uc.reg_write(UC_X86_REG_RAX,result)
        uc.reg_write(UC_X86_REG_RIP,self.stack64(0))
        uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)

    def capture(self,index):
        self.calls=[];self.arrays={}
        self.uc.mem_write(0x700000,bytes(0x200000))
        self.uc.reg_write(UC_X86_REG_RSP,0x700000)
        self.uc.reg_write(UC_X86_REG_RBP,0x780000)
        try: self.uc.emu_start(0x140000000+self.targets[index],self.stop,count=1000000)
        except Exception:
            print('Stopped at',hex(self.uc.reg_read(UC_X86_REG_RIP)),self.calls[-3:]);raise
        assert self.uc.reg_read(UC_X86_REG_RIP)==self.stop
        return {'b':self.mapping[index],'case':index,'calls':[[name,[self.arrays.get(a,a) for a in args]] for name,args in self.calls]}

if __name__=='__main__':
    if '--from-capture' in sys.argv:
        rows=json.loads((ROOT/'socket-definitions.json').read_text())
    else:
        oracle=SocketDefinitionOracle()
        rows=[oracle.capture(i) for i in range(144)]
        (ROOT/'socket-definitions.json').write_text(json.dumps(rows,indent=2)+'\n')
    rules={'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
           'definitions':{row['b']:{int(args[0]):args[1] for name,args in row['calls'] if name=='SetBaseItemStat'} for row in rows}}
    rules['requiredLevels']={row['b']:int(next(value for name,(key,value) in row['calls'] if name=='itemBaseInfoStruct' and key==1)) for row in rows}
    assert all(isinstance(value,(int,float)) for stats in rules['definitions'].values() for value in stats.values())
    (ROOT.parent.parent/'data/current_socketable_rules.json').write_text(json.dumps(rules,indent=2)+'\n')
    (ROOT.parent.parent/'engine/socketable_rules.js').write_text('// Extracted by native_socket_definitions.py from the current game.\nexport const SOCKETABLE_RULES = '+json.dumps(rules,separators=(',',':'))+';\n')
    print('Captured',len(rows),'current native socketable definitions')
