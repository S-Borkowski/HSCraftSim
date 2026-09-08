"""Publish native base draw order only where unchanged definitions were checked."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
native=json.loads((root/'research/current/base-order-native.json').read_text())
profiles=json.loads((root/'data/item_profiles.json').read_text(encoding='utf8'))['profiles']
orders=dict(native['orders'])
for fixture in native['fixtures']:
    key=fixture['profile']
    if len(fixture['draws'])!=len(native['orders'][key]):orders.pop(key,None)
fixtures=[f for f in native['fixtures'] if f['profile'] in orders]
for key,order in orders.items():
    profile=profiles[key]
    assert not profile.get('dynamic')
    ranges={s['statKey']:s for s in profile['tooltip']['stats'] if s['representation']=='range'}
    assert set(order)==set(ranges)-{20}
    for fixture in (f for f in native['fixtures'] if f['profile']==key):
        assert len(fixture['draws'])==len(order),(key,fixture['seed'])
        for stat,draw in zip(order,fixture['draws']):
            assert draw[:2]==[0,ranges[stat]['delta']],(key,stat,draw)
(root/'engine/base_order_rules.js').write_text('// Verified current base order. Generated affixes, sockets and special tails are excluded.\nexport const BASE_ROLL_ORDER = '+json.dumps(orders,separators=(',',':'))+';\n',encoding='utf8',newline='\n')
(root/'tests/current_base_order_native.json').write_text(json.dumps({'buildSha256':native['buildSha256'],'fixtures':fixtures},separators=(',',':'))+'\n',encoding='utf8',newline='\n')
print('Published base draw order for',len(orders),'items and',len(fixtures),'native fixtures;',len(native['orders'])-len(orders),'extra-draw paths deferred.')
