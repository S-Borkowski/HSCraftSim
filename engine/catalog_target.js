import { configureItem, setSocketContent } from './item_setup.js';
import { validateTarget } from './validation.js';
import { isCodex, configureCodex, applyCodexRecipe } from './codex.js';
import { RUNEWORDS } from './runewords.js';
import { ingredientAccepts } from './recipes.js';

/** A clearly labeled starting scenario; eligibility is checked again after editing. */
export function catalogTarget(sim, recipe, ingredient, row, {seed=123456,tier}={}) {
  // Reject other item families before generating stats or searching socket seeds.
  // Tier can be adjusted by the starting preset; rolled rarity is checked below.
  if(!ingredientAccepts({...ingredient,tierRequirement:null,rarityRequirement:null},
    {itemType:row.cls,itemId:row.b,isUnique:row.kind==='unique'}))return null;
  if(['runeword','socket_rune'].includes(recipe.mechanic)&&
    (row.kind!=='normal'||![0,1,2,3,6].includes(row.cls)))return null;
  let item=sim.makeItem(row.cls,row.b,{a:seed,j:row.sub,c:row.kind==='unique'?1:0},{row,isUnique:row.kind==='unique',tier});
  if(['add_sockets','delete_sockets'].includes(recipe.mechanic)&&item.info.rarity>=6)return null;
  const notes=[],patch={};
  if(['runeword','socket_rune'].includes(recipe.mechanic)) {
    // Keep the original roll when it is white. Other rolls use a bounded
    // search for a real white seed, just like the natural socket preset.
    if(item.info.rarity!==1) {
      for(let offset=1;offset<=256;offset++) {
        const candidate=sim.makeItem(row.cls,row.b,{a:(seed+offset-1)%1e9+1,j:row.sub,c:0},{row,tier});
        if(candidate.info.rarity===1){item=candidate;break;}
      }
      if(item.info.rarity!==1)return null;
      notes.push('White base roll · starting scenario');
    }
    patch.sockets=recipe.mechanic==='runeword'?RUNEWORDS.find(w=>w.id===recipe.wordId).runes.length:1;
    notes.push(`${patch.sockets} empty sockets · starting scenario`);
  }
  if(tier===undefined) {
    const minimum=ingredient.tierRequirement;
    if(minimum!=null && minimum!==7 && item.info.tier<minimum) patch.tier=minimum;
    if(recipe.mechanic==='blessed_dice') patch.tier=5;
    if(recipe.mechanic==='destiny_shard' && item.info.tier>4) patch.tier=4;
  }
  if(recipe.mechanic.startsWith('cleanse_')) {patch.corrupted=true;notes.push('Corrupted starting item');}
  if(recipe.mechanic==='remove_satanic_crystal') {patch.crystal=1;notes.push('Crystal affix starting item');}
  if(['add_sockets','delete_sockets','empty_sockets'].includes(recipe.mechanic)) {
    if(!item.info.maxSockets) return null;
    patch.sockets=recipe.mechanic==='add_sockets'?0:Math.max(1,item.info.naturalSocketRange?.[0]??1);
    notes.push(patch.sockets?`${patch.sockets} starting socket${patch.sockets===1?'':'s'}`:'No starting sockets');
  }
  try {
    if(['codex_word','codex_orb'].includes(recipe.mechanic)&&isCodex(item)) {
      const sockets=recipe.orbs?.length||3;
      item=configureCodex(sim,item,{sockets});notes.push(`${sockets} empty sockets · starting scenario`);
    }
    item=configureItem(sim,item,patch);
    if(isCodex(item)&&patch.sockets!==undefined)item=configureCodex(sim,item,{sockets:patch.sockets});
    if(recipe.mechanic==='empty_sockets') {
      if(isCodex(item)) {
        const {edit}=applyCodexRecipe({recipe:{mechanic:'codex_orb',orb:112},target:item,
          rng:{irandom:()=>seed},config:sim.config});
        item=sim.makeItem(item.itemType,item.itemId,{...item.def,...edit},{row:item.row,amount:item.amount});
        notes.push(`${sim.catalog.find(15,112,false).name} Orb inserted`);
      } else {
        item=setSocketContent(sim,item,0,sim.catalog.find(15,1,false));
        notes.push('Ol rune inserted');
      }
    }
    if(!validateTarget(recipe,item,ingredient).ok) return null;
    return {item,notes};
  } catch { return null; }
}
