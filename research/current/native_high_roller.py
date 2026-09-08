"""Capture the original High Roller threshold/bonus stage independently."""
import json
from native_item_generation import ItemGenerationOracle,ROOT
from unicorn import UC_HOOK_CODE

class HighRollerOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__()
        self.entry=0x140000000+json.loads((ROOT/'routines.json').read_text())['routines']['gml_Script_GenerateItemHighRoller']
        self.uc.hook_add(UC_HOOK_CODE,self.prepare,begin=self.entry,end=self.entry)
    def prepare(self,*_):
        self.current.update(self.input_stats)
        self.baseDefinition['p']=self.repository_stars
    def capture(self,stats,stars=0):
        self.input_stats=stats;self.repository_stars=stars
        return self.capture_item({'calls':[['SetBaseItemInfo',[27,6]]]}, {'a':1,'b':79,'c':1,'j':0},0,entry=self.entry,params=[100,101])

def main():
    oracle=HighRollerOracle();fixtures=[]
    for stars in range(6):
        for total in [0,1,776,777,778,800,815,816,817,890,970,971,972,1000]:
            stats={154:1,51:1,129:1,101:1,52:total-6,173:1,25:1,201:2,161:3,282:4}
            result=oracle.capture(stats,stars)
            fixtures.append({'stats':stats,'repositoryStars':stars,'result':result['stats']})
    (ROOT.parent.parent/'tests/current_high_roller_native.json').write_text(json.dumps(fixtures,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
    print('Captured',len(fixtures),'original High Roller stages')
    print(json.dumps([r for r in fixtures if r['repositoryStars']==0 and r['result'].get(345) in (776,777,778)],indent=2))

if __name__=='__main__':main()
