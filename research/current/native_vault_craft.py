"""Native Vault craft selection with controlled draws and quest/title storage.

Runs case 23 until the original repository lookup. Quest/title calls are
recorded, never forwarded to the user's game or saves.
"""
import json
from native_craft_cases import CraftCaseOracle, ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *


class VaultCraftOracle(CraftCaseOracle):
    def __init__(self):
        super().__init__()
        routines=json.loads((ROOT/'routines.json').read_text())['routines']
        self.context_calls={0x140000000+routines['gml_Script_'+name]:name
            for name in ('AwardTitle','quest_exists','IsQuestCompleted','update_quest')}
        for address in (*self.context_calls,0x14b51a290):
            self.uc.hook_add(UC_HOOK_CODE,self.service,begin=address,end=address)

    def service(self,uc,address,size,data):
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        result=r8
        if address in self.context_calls:
            name=self.context_calls[address];args=self.args(r9,40)
            self.context_trace.append([name,args])
            value=self.quest!=0 if name=='quest_exists' else self.quest==2 if name=='IsQuestCompleted' else None
            self.put(r8,value)
        elif address==0x14b4c9800 and self.ids[rdx&0xffffffff]=='tUlckd':
            assert r8==2
            result=r9;self.put(result,self.title)
        elif self.script_hooks.get(address)=='GetNormalRepoStruct' and self.active_case==23:
            self.selected=self.args(r9,40)
            self.completed='repository';uc.reg_write(UC_X86_REG_RIP,0x103000);uc.emu_stop();return
        elif address==0x14b51a290:
            values=[self.value(int.from_bytes(uc.mem_read(r8+8*i,8),'little')) for i in range(rdx)]
            assert values==[0,1],values
            choice=self.rolls.pop(0);assert choice in (0,1)
            self.trace.append(['choose',values,choice]);result=rcx;self.put(result,values[choice])
        else:return super().service(uc,address,size,data)
        uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)

    def capture_vault(self,rolls,quest=0,title=True):
        self.quest=quest;self.title=title;self.context_trace=[];self.selected=None
        result=self.capture(23,rolls)
        assert self.selected is not None
        assert not result['unusedRolls'],result
        return dict(selection=self.selected,draws=[t for t in result['draws'] if t[0] in ('irandom','choose')],context=self.context_trace)


if __name__=='__main__':
    oracle=VaultCraftOracle();fixtures=[]
    for quest in (0,1,2):
        for title in (False,True):
            for stage,threshold in enumerate((50,40,30,20,10)):
                for value in range(100):
                    for choice in ((0,1) if stage==4 and value<threshold else (None,)):
                        rolls=[0]*stage+[value]
                        if value<threshold:
                            rolls += [99] if stage<4 else [choice]
                        result=oracle.capture_vault(rolls,quest,title)
                        fixtures.append(dict(rolls=rolls,quest=quest,title=title,**result))
    (ROOT.parent.parent/'tests/current_vault_craft_native.json').write_text(json.dumps({
        'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
        'source':'Native DoCraftResult case 23 to repository lookup; controlled random and quest/title services.',
        'fixtures':fixtures},separators=(',',':'))+'\n',encoding='utf8')
    print('Captured',len(fixtures),'Vault selections across all thresholds and six quest/title contexts.',flush=True)
