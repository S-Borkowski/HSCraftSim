"""Extract current Runeword case constants without launching the game."""
import json
from native_socket_definitions import SocketDefinitionOracle, ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

class RunewordDefinitionsOracle(SocketDefinitionOracle):
    def __init__(self):
        super().__init__(start=0x140cba2c0,table=0xd20edc,count=100,case_start=0x140cbe608,stop=0x140d1e130)
        self.uc.hook_add(UC_HOOK_CODE,self.service,begin=0x14b4c34d0,end=0x14b4c34d0)
    def service(self,uc,address,size,data):
        if address==0x14b4c34d0: # Runner GC root registration, no effect on constants.
            uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
        else:return super().service(uc,address,size,data)
    def capture(self,index):
        self.uc.mem_write(0x170000,bytes(16*len(self.ids)))
        result=super().capture(index)
        result['fields']={name:self.arrays.get(self.value(0x170000+16*(number-1000)),self.value(0x170000+16*(number-1000))) for number,name in self.ids.items() if name.startswith('runeword')}
        return result

if __name__=='__main__':
    oracle=RunewordDefinitionsOracle()
    rows=[oracle.capture(i) for i in range(100)]
    (ROOT/'runeword-definitions-native.json').write_text(json.dumps(rows,indent=2)+'\n')
    print('Captured',len(rows),'current Runeword definitions')
    print(json.dumps(rows[0],indent=2))
