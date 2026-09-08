import json
from collections import deque
from unicorn import UC_HOOK_BLOCK
from native_item_generation import ItemGenerationOracle,ROOT
r=json.loads((ROOT/'equipment-definitions-native.json').read_text())
row=next(x for x in r['gml_Script_DefineItemNormalWeaponsSword']['rows']if x['b']==14)
x=ItemGenerationOracle()
recent=deque(maxlen=20)
x.uc.hook_add(UC_HOOK_BLOCK,lambda uc,a,s,d:recent.append(hex(a)))
try:print(json.dumps(x.capture_item(row,{'a':123456,'b':14,'c':0,'j':1,'s':314159,'q':0},3),indent=2))
finally:print(list(recent))
