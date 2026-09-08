"""Execute current Controller Unique-loot construction with captured metadata.

The normal repository has zero entries for this isolated pass. Current Unique
case metadata supplies tier/info41; every supported catalog equipment address
must exist. Native code performs the class/subtype loops and list insertions.
"""
import json
from native_item_generation import ItemGenerationOracle,ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

WEAPONS=['Sword','Dagger','Mace','Axe','Claw','Polearm','Chainsaw','Staff','Cane','Wand','Book','Spellblade','Bow','Gun','Flask','Throwing','Universal']
TYPES={'Helmets':0,'Chests':1,'Boots':2,'Gloves':4,'Amulets':5,'Shields':6,'Rings':7,'Belts':8,'Charms':10,'Flask':18}


def definitions():
    output={}
    for name,data in json.loads((ROOT/'equipment-definitions-native.json').read_text()).items():
        if not name.startswith('gml_Script_DefineItemUnique'):continue
        suffix=name.removeprefix('gml_Script_DefineItemUnique')
        cls,sub=(3,WEAPONS.index(suffix[7:])+1) if suffix.startswith('Weapons') else (TYPES[suffix],0)
        rows={row['b']:{int(args[0]):args[1] for method,args in row['calls'] if method in ('SetBaseItemInfo','itemBaseInfoStruct')} for row in data['rows']}
        assert sorted(rows)==list(range(len(rows))),(name,sorted(rows))
        assert all(32 in info for info in rows.values()),name
        output[cls,sub]=rows
    return output


class UniqueLootOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__()
        self.repositories=definitions();self.properties={}
        self.uc.mem_map(0x600000,0x400000)
        for address in (0x1401895d0,0x1401895e0):self.uc.hook_add(UC_HOOK_CODE,self.service,begin=address,end=address)

    def service(self,uc,address,size,data):
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        result=r8
        if address in (0x1401895d0,0x1401895e0):
            member=rdx&0xffffffff
            if member not in self.properties:
                self.properties[member]=0x300000+16*(member-1000);self.put(self.properties[member],None)
            result=self.properties[member]
        elif self.script_hooks.get(address)=='GetUniqueRepoStruct':
            cls,sub,index=map(int,self.args(r9,40));self.baseinfo=self.repositories[cls,sub][index]
            self.put(r8,101)
        elif address==0x14b4c9800 and self.ids[rdx&0xffffffff] in ('itemAmountUnique','itemAmountNormal'):
            handle=self.handles[self.ids[rdx&0xffffffff]]
            self.put(r9,self.arrays[handle][r8] if r8!=0x80000000 else handle);result=r9
        else:return super().service(uc,address,size,data)
        uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)

    def capture(self):
        # Reuse the fixture data setup through the no-affix native branch.
        self.capture_item({'calls':[]},{'a':1,'b':0,'c':1,'j':0},entry=0x1458364a0,params=[100,101,0])
        counts=[len(self.repositories.get((cls,0),{})) for cls in range(19)]
        counts[3]=self.array([len(self.repositories.get((3,sub),{})) for sub in range(18)])
        normal=[0]*19;normal[3]=self.array([0]*18)
        self.handles.update(itemAmountUnique=self.array(counts),itemAmountNormal=self.array(normal))
        self.trace=[]
        self.uc.mem_write(0x700000,bytes(0x200000))
        self.write64(0x784150,0x130000);self.write64(0x784158,0)
        self.uc.reg_write(UC_X86_REG_RSP,0x700000);self.uc.reg_write(UC_X86_REG_RBP,0x780000);self.uc.reg_write(UC_X86_REG_R13,1)
        # Preserved by the Controller's native LEA at 0x147808b4e.
        assert self.value(0x1506fcba0)==10
        self.uc.reg_write(UC_X86_REG_R15,0x1506fcba0)
        try:self.uc.emu_start(0x147809295,0x14780b258,count=10000000)
        except Exception:
            print('Stopped',hex(self.uc.reg_read(UC_X86_REG_RIP)),self.trace[-10:],flush=True);raise
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x14780b258
        member=next(k for k,v in self.ids.items() if v=='lootListUnique')
        lists=self.arrays[self.value(self.properties[member])]
        return [[self.arrays[value] for value in self.arrays[handle]] for handle in lists]


if __name__=='__main__':
    x=UniqueLootOracle();rows=x.capture()
    (ROOT/'unique-loot-lists-native.json').write_text(json.dumps(rows,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
    print('PASS six native Unique loot lists:',[len(rows) for rows in rows])
