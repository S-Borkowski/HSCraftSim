"""Read-only export of Cube UI and item art from the selected game installation."""
from pathlib import Path
import argparse, hashlib, json, re, shutil, sys
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent / 'game_assets'))
import datawin

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('game', type=Path)
    args = parser.parse_args()
    datawin.GAME = args.game.resolve()
    dw = datawin.DataWin(datawin.GAME / 'data.win')
    out = ROOT / 'data' / 'game'
    out.mkdir(parents=True, exist_ok=True)
    names = [n for n in dw.sprites if n.startswith(('Craft_', 'Inventory_Grid_', 'Inventory_Slot_Background_'))]
    names += [n for n in ['Hud_Button_spr', 'Button_Close_spr', 'Tooltip_Back_Sprite_spr',
        'Hud_Tooltip_Line_spr', 'Inventory_Player_spr', 'Craft_Cube_Idle_spr', 'Satanic_Cube_Open_spr',
        'Menu_Logo_spr', 'Chat_Command_Background_spr', 'Inventory_Tab_spr', 'Hud_Satanic_Zone_spr',
        'Satanic_Crystal_spr', 'Satanic_Dice_spr', 'Blessed_Dice_spr', 'Destiny_Shard_spr'] if n in dw.sprites]
    manifest = {}
    for name in dict.fromkeys(names):
        frames = dw.sprite_frames(name)
        if not frames: continue
        for i, im in enumerate(frames): im.save(out / f'{name}_{i}.png')
        manifest[name] = {'width':frames[0].width, 'height':frames[0].height, 'frames':len(frames)}
        if len(frames) > 1 and name in ('Craft_Cube_Idle_spr','Satanic_Cube_Open_spr','Craft_Icon_spr'):
            w,h = max(f.width for f in frames),max(f.height for f in frames)
            strip = Image.new('RGBA',(w*len(frames),h))
            for i,f in enumerate(frames):strip.paste(f,(i*w,0))
            strip.save(out / f'{name}_strip.png')
            manifest[name]['stripWidth']=w;manifest[name]['stripHeight']=h
    for font in ['Fontin-Regular.ttf','Fontin-Bold.ttf','Fontin-SmallCaps.ttf','Ubuntu-C.ttf']:
        shutil.copy2(datawin.GAME / font, out / font)
    # Refresh only unambiguous class-specific matches; keep previously extracted art otherwise.
    norm = lambda s: re.sub('[^a-z0-9]','',s.lower())
    prefixes = {0:['Helmets_','Helmet_'],1:['Armor_','Armors_','Body_'],2:['Boots_'],3:['Weapon_'],
        4:['Gloves_'],5:['Amulets_'],6:['Shields_'],7:['Rings_'],8:['Belts_'],10:['Charms_'],
        11:[''],12:[''],13:['Tarot_',''],14:[''],15:['Rune_','Runes_','Gem_','Jewel_',''],18:['Potion_','Flask_']}
    rows=json.loads((ROOT/'data/items_catalog.json').read_text(encoding='utf8'))
    iconmap={}
    for row in rows:
        if row.get('spr') is None:continue
        target=norm(row['name']); candidates=[]
        for name in dw.sprites:
            if not name.endswith('_spr'): continue
            for prefix in prefixes.get(row['cls'],[]):
                if not name.startswith(prefix): continue
                tail=name[len(prefix):-4]
                if norm(tail)==target or (row['cls']==3 and '_' in tail and norm(tail.split('_',1)[1])==target):
                    candidates.append(name);break
        if len(candidates)==1:
            name=candidates[0]; frames=dw.sprites[name]['frames']
            if frames:
                im=dw.frame_image(frames[0]); im.save(ROOT/f'data/icons/{row["spr"]}.png')
                iconmap[str(row['id'])]=name
    selected=[n for n in manifest if n.startswith('Craft_') or n in ('Hud_Button_spr','Tooltip_Back_Sprite_spr')]
    sheet=Image.new('RGB',(800, ((len(selected)+1)//2)*260),'#181a20');draw=ImageDraw.Draw(sheet)
    for i,n in enumerate(selected):
        im=Image.open(out/f'{n}_0.png'); im.thumbnail((380,225),Image.Resampling.NEAREST)
        x=(i%2)*400+10;y=(i//2)*260+25;sheet.paste(im,(x,y),im);draw.text((x,y-18),n,fill='#ded5b9')
    sheet.save(ROOT/'research/cube_assets_contact.png')
    record={'gamePath':str(datawin.GAME),'dataWinSha256':hashlib.sha256(dw.raw).hexdigest(),
        'ui':manifest,'refreshedIcons':iconmap,'spriteCount':len(dw.sprites),
        'recipeBuildVerified':False,'recipeSource':'Existing Season 10 static decompilation; executable identity differs.'}
    for name,key in [('Hero_Siege.exe','executableSha256'),('Hero_Siege.exe.aurie_backup','backupExecutableSha256')]:
        if (datawin.GAME/name).exists():
            with (datawin.GAME/name).open('rb') as file:record[key]=hashlib.file_digest(file,'sha256').hexdigest()
    (out/'manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'uiSprites':len(manifest),'refreshedItems':len(iconmap),'output':str(out)}))

if __name__=='__main__':main()
