"""Add the editor's Season 10 catalog additions with current-game item art."""
from pathlib import Path
import argparse
import ast
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--editor', type=Path, default=ROOT.parent/'_release_work/HSItemEditor-v2.7.2')
parser.add_argument('--game', type=Path)
args = parser.parse_args()
manifest_path = ROOT/'data/game/manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf8'))
game = args.game or Path(manifest['gamePath'])
source = args.editor/'hs_item_editor_gui.py'
# Read the literal metadata only. Never launch/import the editor's GUI or save code.
tree = ast.parse(source.read_text(encoding='utf8'))
entries = next(ast.literal_eval(node.value) for node in tree.body if isinstance(node, ast.Assign)
               and any(isinstance(target, ast.Name) and target.id == 'S10_UNIQUE_ADDITIONS' for target in node.targets))
catalog_path = ROOT/'data/items_catalog.json'
catalog = json.loads(catalog_path.read_text(encoding='utf8'))
sys.path.insert(0, str(Path(__file__).parent/'game_assets'))
import datawin
datawin.GAME = game.resolve()
dw = datawin.DataWin(datawin.GAME/'data.win')
norm = lambda name: re.sub('[^a-z0-9]', '', name.lower())
prefixes = {0:'Helmet',1:'Armor',2:'Boots',3:'Weapon',4:'Gloves',5:'Amulet',6:'Shields',7:'Rings',10:'Charms',18:'Potions'}
mapping = {}
pending = []
for cls, sub, base, key, name, width, height in entries:
    candidates = [n for n in dw.sprites if n.startswith(prefixes[cls]+'_')
                  and n.endswith('_spr') and norm(n[:-4]).endswith(norm(name))]
    if len(candidates) != 1:
        raise ValueError(f'{name}: ambiguous or missing current-game art: {candidates}')
    sprite_name = candidates[0]
    sprite_id = 80000 + list(dw.sprites).index(sprite_name)
    row = next((r for r in catalog if r['kind']=='unique' and (r['cls'],r['sub'],r['b'])==(cls,sub,base)), None)
    if row is None:
        row = {'id':max(r['id'] for r in catalog)+1,'kind':'unique','cls':cls,'sub':sub,'b':base,
               'key':key,'name':name,'rar':'Heroic','w':width,'h':height,'stats':[],
               'source':'Item Editor S10_UNIQUE_ADDITIONS; dimensions are editor packing bounds.'}
        catalog.append(row)
    row['spr'] = sprite_id
    mapping[str(row['id'])] = sprite_name
    pending.append((sprite_id,sprite_name))
# Resolve every name before writing, so an ambiguity cannot half-update the catalog.
for sprite_id,sprite_name in pending:
    dw.sprite_frames(sprite_name)[0].save(ROOT/f'data/icons/{sprite_id}.png')
catalog_path.write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf8')
manifest['editorAdditionalIcons'] = mapping
manifest['editorItemMetadataSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
manifest['catalogCount'] = len(catalog)
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print(f'{len(mapping)} editor items with current-game icons; {len(catalog)} catalog rows.')
