"""Native weapon pools after the separately decoded weapon bonus stage."""
import json
from capture_equipment_pools import PoolOracle
from audit_generation_coverage import equipment_rows,ROOT
from native_natural_sockets import BUILD
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_RSP

class WeaponPoolOracle(PoolOracle):
 def __init__(self):
  super().__init__();self.uc.hook_add(UC_HOOK_CODE,self.start,begin=0x1440c6f3d,end=0x1440c6f3d)
 def start(self,uc,*_):
  super().pool_start(uc);frame=uc.reg_read(UC_X86_REG_RSP)
  self.put(frame+0x18018,self.archetype)
  self.put(frame+0x18038,self.array([100,200]) if self.bonus else 0)
 def pools(self,row,cls,tier,element,gate,seed):
  self.control=(tier,element,gate);self.in_pool=False;self.stopped=False
  self.capture_item(row,dict(a=seed,b=row['b'],c=0,j=1,p=0,r=0),cls)
  assert self.stopped;return self.events

def main():
 oracle=WeaponPoolOracle();rules={};cases=[]
 row=next(r[3] for r in equipment_rows() if r[0]=='normal:3:1:14')
 for archetype,bonus in [(0,False),(0,True),(1,False),(1,True),(2,False)]:
  oracle.archetype=archetype;oracle.bonus=bonus;previous=[[] for _ in range(5)];groups=[]
  for gate in (100,60,35,6):
   paths=[]
   for element in range(1,6):
    expected=None
    for tier in range(5):
     result=oracle.pools(row,3,tier,element,gate-1,123456 if tier%2 else 57)
     if expected is None:expected=result
     assert result==expected,(archetype,bonus,element,gate,tier,result,expected)
     cases.append(dict(archetype=archetype,bonus=bonus,tier=tier,element=element,gate=gate-1,events=result))
    assert expected[:len(previous[element-1])]==previous[element-1]
    paths.append(expected[len(previous[element-1]):]);previous[element-1]=expected
   groups.append([gate,dict(byElement=paths)])
  rules[f'{archetype}:{int(bonus)}']=groups
  print('Weapon pools',archetype,bonus,len(cases),flush=True)
 (ROOT/'normal-weapon-pools-native.json').write_text(json.dumps(dict(buildSha256=BUILD,rules=rules,cases=cases),separators=(',',':')),encoding='utf8')
 print('Finished',len(cases),flush=True)

if __name__=='__main__':main()
