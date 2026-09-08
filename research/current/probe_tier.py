import json
from unicorn.x86_const import UC_X86_REG_RIP
from unicorn import UC_HOOK_BLOCK
from collections import deque
from native_equipment_definitions import EquipmentOracle,ROOT
data=json.loads((ROOT/'equipment-definitions-native.json').read_text())
config=data['gml_Script_DefineItemNormalWeaponsSword']['config']
x=EquipmentOracle(**config)
recent=deque(maxlen=20)
x.uc.hook_add(UC_HOOK_BLOCK,lambda uc,a,s,d:recent.append(hex(a)) if 0x140000000<=a<0x149000000 else None)
try:
    row=x.capture(15);row['calls']=x.apply_tier(1,3);print(json.dumps(row,indent=2))
finally:print(hex(x.uc.reg_read(UC_X86_REG_RIP)),x.calls[-4:],list(recent))
