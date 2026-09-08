"""Native skill tags with controlled effective augment levels.

Only ReturnSubTalentLevel is supplied by the fixture. GetTalentInfo and
GetSubTalentInfo execute original instructions. No game/save is accessed.
"""
import json
from native_item_generation import ItemGenerationOracle, ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *


class PlayerTagOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__()
        self.augment_address=next(a for a,n in self.observe.items() if n=='gml_Script_ReturnSubTalentLevel')
        self.uc.hook_add(UC_HOOK_CODE,self.service,begin=self.augment_address,end=self.augment_address)

    def service(self,uc,address,size,data):
        if address!=getattr(self,'augment_address',None):return super().service(uc,address,size,data)
        args=self.args(uc.reg_read(UC_X86_REG_R9),40)
        assert args[0]==100 and 11<=args[2]<=14,args
        level=self.levels.get(int(args[2]),0)
        self.trace.append(['effectiveAugment',args,level])
        result=uc.reg_read(UC_X86_REG_R8);self.put(result,level)
        uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)

    def tags(self,skill,levels):
        self.levels=levels
        self.capture_item({'calls':[]},{'a':1,'b':0,'c':0},entry=0x143ce3a80,params=(skill,17,None),instruction_limit=1000000)
        result=self.value(0x112000)
        assert result in self.arrays,(skill,result)
        return list(self.arrays[result])


if __name__=='__main__':
    x=PlayerTagOracle();rows=[]
    for skill in range(6,434):
        base=x.tags(skill,{})
        combinations=[base]+[x.tags(skill,{a:1 for a in range(11,15) if mask & (1<<(a-11))}) for mask in range(1,16)]
        rows.append(dict(skill=skill,tagsByMask=combinations))
        if skill%100==0:print('Captured through skill',skill,flush=True)
    (ROOT/'player-skill-tags-native.json').write_text(json.dumps({'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
        'boundary':'Original GetTalentInfo(id,17,local player); effective ReturnSubTalentLevel supplied at 0 or 1; original augment definitions.',
        'fixtures':rows},separators=(',',':'))+'\n',encoding='utf8')
    print('Captured',len(rows)*16,'native player-context tag queries.',flush=True)
