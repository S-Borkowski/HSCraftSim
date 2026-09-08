"""Export original UI frames without changing the game installation."""
from pathlib import Path
import argparse
import json
import sys
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent / 'game_assets'))
import datawin

NAMES = [
    'Name_Text_Border_spr', 'Name_Text_Border_Highlight_spr', 'Name_Text_Border_Chosen_spr',
    'Quest_Text_Border_spr', 'Quest_Text_Border_Black_spr', 'Quest_Text_Border_Dark_spr',
    'Quest_Text_Border_Metal_Light_spr', 'Quest_Text_Border_Metal_Lighter_spr',
    'Hud_Button_spr', 'Menu_Button_spr', 'Menu_Button_Small_Blue_spr',
    'Inventory_Tab_Button_spr', 'Inventory_Tab_Button_Solid_spr',
    'Inventory_Tab_Square_Button_spr', 'Scroll_Bar_Button_Full_spr',
    'Slider_Button_spr', 'Button_Close_spr', 'Talent_Tree_Frame_Background_Nineslice_spr'
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('game', type=Path)
    args = parser.parse_args()
    datawin.GAME = args.game.resolve()
    game = datawin.DataWin(datawin.GAME / 'data.win')
    output = ROOT / 'data/game'
    manifest_path = output / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    sheet = Image.new('RGB', (1000, ((len(NAMES)+2)//3)*180), '#141110')
    draw = ImageDraw.Draw(sheet)
    for index, name in enumerate(NAMES):
        frames = game.sprite_frames(name)
        for frame, image in enumerate(frames):
            image.save(output / f'{name}_{frame}.png')
        manifest['ui'][name] = {'width':frames[0].width, 'height':frames[0].height, 'frames':len(frames)}
        x, y = index%3*333+8, index//3*180+35
        preview = frames[0].copy()
        scale = min(2, 310/preview.width, 130/preview.height)
        preview = preview.resize((max(1,round(preview.width*scale)),max(1,round(preview.height*scale))), Image.Resampling.NEAREST)
        sheet.paste(preview, (x,y), preview)
        draw.text((x,y-28), name.replace('_spr',''), fill='#e0c78d')
        draw.text((x,y-14), f'{frames[0].size}, {len(frames)} frames', fill='#a69886')
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    sheet.save(ROOT / 'research/workshop_skin_contact.png')
    print('Exported', len(NAMES), 'original UI sprites.')

if __name__ == '__main__':
    main()
