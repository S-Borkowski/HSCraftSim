"""Append current native key definitions without changing existing catalog IDs."""
import json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).parent/'game_assets'))
import datawin
datawin.GAME=Path(sys.argv[1])
dw=datawin.DataWin(datawin.GAME/'data.win')
catalog=json.loads((ROOT/'data/items_catalog.json').read_text(encoding='utf8'))
text=json.loads((ROOT/'data/translations/item.json').read_text(encoding='utf8'))['entries']
for case,item_id in [(33,36),(34,37),(35,38),(36,39),(37,40),(41,41),(42,42),(43,43)]:
    native=(ROOT/f'research/current/CraftCaseKey{case}.named.c').read_text()
    key=re.search(r'/\*string:(keys_\w+)\*/',native)[1]
    sprite_index=int(re.search(r',0x(100[0-9a-f]+),1\)',native)[1],16)&0xffffff
    sprite_name=list(dw.sprites)[sprite_index]
    sprite=40000+sprite_index
    dw.sprite_frames(sprite_name)[0].save(ROOT/f'data/icons/{sprite}.png')
    name=text[key]['en']
    row=next((r for r in catalog if r['kind']=='normal' and r['cls']==12 and r['b']==item_id),None)
    if row is None:
        row={'id':max(r['id'] for r in catalog)+1,'kind':'normal','cls':12,'sub':0,'b':item_id,'stats':[]}
        catalog.append(row)
    row.update(key=key,name=name,rar='Normal',w=1,h=1,spr=sprite,source='Current native DefineItemNormalKey; original game sprite.')
    print(item_id,name,sprite_name)
(ROOT/'data/items_catalog.json').write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf8')
path=ROOT/'data/game/manifest.json'
manifest=json.loads(path.read_text(encoding='utf8'));manifest['catalogCount']=len(catalog)
path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
