"""Add the three fragments present in extracted recipes but absent in the old catalog."""
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).parent/'game_assets'))
import datawin
datawin.GAME=Path(sys.argv[1])
dw=datawin.DataWin(datawin.GAME/'data.win')
catalog=json.loads((ROOT/'data/items_catalog.json').read_text(encoding='utf8'))
recipes=json.loads((ROOT/'data/recipes.json').read_text(encoding='utf8'))
entries=[(71,'Satanic_Dice_Fragment_spr','material_satanic_dice_fragment','Dice Fragment'),
    (72,'Gypsys_Prophecy_Fragment_spr','material_gypsys_prophecy_fragment','Gypsy’s Fragment'),
    (73,'Blacksmiths_Mallet_Fragment_spr','material_blacksmiths_mallet_fragment','Mallet Fragment')]
for item_id,name,key,label in entries:
    if name not in dw.sprites:raise ValueError(f'Sprite missing: {name}')
    sprite=40000+list(dw.sprites).index(name)
    dw.sprite_frames(name)[0].save(ROOT/f'data/icons/{sprite}.png')
    row=next((r for r in catalog if r['kind']=='normal' and r['cls']==14 and r['b']==item_id),None)
    if row is None:
        row={'id':max(r['id'] for r in catalog)+1,'kind':'normal','cls':14,'sub':0,'b':item_id,'key':key,'name':label,'rar':'Normal','w':1,'h':1,'spr':sprite,'stats':[],'source':'Current game translation/sprite; id from extracted recipe.'}
        catalog.append(row)
    for recipe in recipes['recipes']:
        for ing in recipe['ingredients']:
            if ing['itemType']==14 and ing['itemId']==item_id:
                ing.update(name=label,key=key,sprite=sprite,w=1,h=1,catalogId=row['id'])
(ROOT/'data/items_catalog.json').write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf8')
(ROOT/'data/recipes.json').write_text(json.dumps(recipes,ensure_ascii=False,indent=1),encoding='utf8')
manifest_path=ROOT/'data/game/manifest.json'
if manifest_path.exists():
    manifest=json.loads(manifest_path.read_text(encoding='utf8'))
    manifest.update(additionalFragmentIcons=3,catalogCount=len(catalog))
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print('All three fragment ingredients now resolve to named items with current game art.')
