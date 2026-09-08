"""Native jewelry pool paths with controlled locals, independently checked across tiers.
Only fixture-owned stack values change; original code remains read-only.
"""
import json
from native_natural_sockets import NaturalSocketOracle,BUILD
from audit_generation_coverage import equipment_rows,ROOT
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_RSP,UC_X86_REG_R9,UC_X86_REG_RIP

ENTRIES={7:0x144170f09,5:0x1441817c3}
GATES={7:[100,60,35,10],5:[100,60,28,13]}
class PoolOracle(NaturalSocketOracle):
 def __init__(self):
  super().__init__()
  for address in ENTRIES.values():self.uc.hook_add(UC_HOOK_CODE,self.pool_start,begin=address,end=address)
 def pool_start(self,uc,*_):
  frame=uc.reg_read(UC_X86_REG_RSP);tier,element,gate=self.control
  self.width=2 if tier==4 else 1 if tier in (2,3) else 0
  for offset,value in [(0x17db8,tier),(0x17fc8,self.width),(0x17ff8,element),(0x18008,gate)]:self.put(frame+offset,value)
  self.owners={self.value(frame+0x17fa8):0,self.value(frame+0x17fb8):1}
  self.events=[];self.new_draw=False;self.in_pool=True
 def service(self,uc,address,size,data):
  if getattr(self,'in_pool',False):
   if self.script_hooks.get(address)=='cpr_choose':
    self.in_pool=False;self.stopped=True;uc.reg_write(UC_X86_REG_RIP,0x103000);uc.emu_stop();return
   if address==0x14b4c6210 and self.ids[self.stack64(40)&0xffffffff]=='ds_list_add':
    args=self.args(uc.reg_read(UC_X86_REG_R9),48);side=self.owners[args[0]]
    assert len(args)==2
    if self.new_draw:
     assert self.trace[-1][0]=='draw',self.trace[-3:]
     _,lo,hi,roll=self.trace[-1];assert lo==0 and hi==self.control[0]-self.width
     self.events.append([side,int(args[1]-roll-self.width)])
    else:self.events.append([side,int(args[1]),'fixed'])
    self.new_draw=False
   if address in (0x1407213f0,0x140721da0):self.new_draw=True
  return super().service(uc,address,size,data)
 def pools(self,row,cls,tier,element,gate,seed):
  self.control=(tier,element,gate);self.in_pool=False;self.stopped=False
  self.capture_item(row,dict(a=seed,b=row['b'],c=0,j=0,p=0,r=0),cls)
  assert self.stopped
  return self.events

def main():
 oracle=PoolOracle();rules={};cases=[]
 for cls in (7,5):
  row=next(r[3] for r in equipment_rows() if r[0]==f'normal:{cls}:0:0')
  groups=[];previous=[[] for _ in range(5)]
  for gate in GATES[cls]:
   paths=[]
   for element in range(1,6):
    expected=None
    for tier in (0,1,2,3,4):
     result=oracle.pools(row,cls,tier,element,gate-1,123456 if tier%2 else 57)
     if expected is None:expected=result
     assert result==expected,(cls,element,gate,tier,result,expected)
     cases.append(dict(type=cls,tier=tier,element=element,gate=gate-1,events=result))
    assert expected[:len(previous[element-1])]==previous[element-1]
    paths.append(expected[len(previous[element-1]):]);previous[element-1]=expected
   assert len({len(p) for p in paths})==1
   entries=[]
   for parts in zip(*paths):
    assert len({(p[0],len(p)) for p in parts})==1
    sides,bases=parts[0][0],[p[1] for p in parts]
    entries.append([sides,bases[0] if len(set(bases))==1 else bases,*parts[0][2:]])
   groups.append([gate,entries])
   print('Pool',cls,'gate',gate,'added',len(entries),flush=True)
  rules[str(cls)]=groups
 (ROOT/'normal-jewelry-pools-native.json').write_text(json.dumps(dict(buildSha256=BUILD,rules=rules,cases=cases),separators=(',',':')),encoding='utf8')
 print('Finished',len(cases),flush=True)
if __name__=='__main__':main()
