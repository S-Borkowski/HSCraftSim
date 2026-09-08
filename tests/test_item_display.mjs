import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim,UniformRng} from '../engine/index.js';
import {applyItemDisplay} from '../engine/item_display.js';
import {captureItem,compareStats} from '../engine/history.js';
import {setSocketContent,configureItem} from '../engine/item_setup.js';
import {itemTooltipHtml,playerStatValue} from '../ui/item-tooltip.js';
import {packItem,unpackItem} from '../engine/session.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const native=read('tests/current_display_native.json');
assert.equal(native.buildSha256,'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4');
for(const f of native.fixtures) {
  const item={itemType:f.item_type,def:{w:f.w,simLevel:f.level},info:{rarity:f.rarity}};
  const generated={stats:Object.entries(f.stats).map(([key,value])=>({key:Number(key),value}))};
  const original=structuredClone(generated),result=applyItemDisplay(item,generated);
  const key={attack:22,speed:23,defense:154}[f.part],stat=result.stats.find(s=>s.key===key);
  assert.ok(Math.abs((stat.displayValue??stat.value)-f.modified)<1e-12,JSON.stringify(f));
  assert.deepEqual(result.stats.map(s=>s.value),original.stats.map(s=>s.value),'Display must never overwrite rolled values');
  assert.deepEqual(generated,original,'Display calculation is immutable');
}
const sim=new Sim({recipes:read('data/recipes.json'),catalog:read('data/items_catalog.json'),statNames:read('data/stat_names.json'),pools:read('data/stat_pools.json'),profiles:read('data/item_profiles.json')});
const make=name=>{const row=sim.catalog.rows.find(r=>r.name===name);assert.ok(row,name);return sim.makeItem(row.cls,row.b,{a:123456,c:row.kind==='unique'?1:0},{row});};
const dawn=make('The Dawn Bringer'),armor=make("St. Jupe's Plate of Command");
const stat=(item,key)=>sim.stats(item).stats.find(s=>s.key===key);
assert.equal(dawn.def.w,1);
assert.equal(armor.def.w,1);
const hidden=sim.makeItem(dawn.itemType,dawn.itemId,{...dawn.def,w:0},{row:dawn.row});
assert.equal(hidden.def.w,0,'An explicit imported identification flag is preserved');
assert.equal(stat(hidden,22).displayValue??stat(hidden,22).value,stat(hidden,22).value);
assert.ok(stat(dawn,22).displayValue>stat(dawn,22).value);
assert.ok(stat(armor,154).displayValue>stat(armor,154).value);
for(const item of [dawn,armor,configureItem(sim,dawn,{stars:5}),configureItem(sim,armor,{crystal:1})]) {
  const restored=unpackItem(sim,packItem(item));
  assert.deepEqual(sim.stats(restored),sim.stats(item),'Display survives persistence');
  const key=item.itemType===3?22:154,current=stat(item,key),markup=itemTooltipHtml(sim,item);
  assert.ok(markup.includes(`<b>${playerStatValue(current)}`),'Tooltip uses calculated item total');
  assert.ok(itemTooltipHtml(sim,item,{preview:true}).includes(`<b>${playerStatValue(current)}`),'Preview does not mislabel a raw base range as final damage');
}
const gem=sim.catalog.find(15,94,false),filled=setSocketContent(sim,armor,0,gem);
assert.equal(stat(filled,154).value,stat(armor,154).value+40,'Flat socket defense reaches the raw item first');
assert.ok(stat(filled,154).displayValue>stat(armor,154).displayValue,'Socket defense is enhanced in the final display');
assert.deepEqual(sim.stats(setSocketContent(sim,filled,0,null)),sim.stats(armor));
const fast=setSocketContent(sim,dawn,0,sim.catalog.find(15,13,false));
assert.equal(stat(fast,23).value,stat(dawn,23).value,'An attack-speed Rune does not alter base APS');
assert.ok(stat(fast,23).displayValue>stat(dawn,23).displayValue);
const old=captureItem(sim,dawn),frozen=JSON.stringify(old),rng=new UniformRng(547),recipe=sim.recipes.find(r=>r.mechanic==='blessed_dice');
assert.ok(recipe);
let current=dawn;
for(let i=0;i<10;i++) {
  const stacks=[{item:current,amount:1},...recipe.ingredients.filter(g=>g.itemId!=null).map(g=>({item:sim.makeItem(g.itemType,g.itemId),amount:g.amount}))];
  current=sim.craft(recipe,stacks,rng).target;
  assert.ok(current);
  const next=captureItem(sim,current),comparison=compareStats(old,next).find(s=>s.before?.key===22);
  assert.equal(comparison.delta,Number(((stat(current,22).displayValue??stat(current,22).value)-(old.stats.find(s=>s.key===22).displayValue)).toFixed(2)));
}
assert.equal(JSON.stringify(old),frozen,'Later dice rolls cannot rewrite a previous total');
// No computed weapon total is applied to a socketable with the same stat key.
const stone=sim.makeItem(15,94);
assert.equal(stat(stone,154).itemDisplayCalculated,undefined);
const empty={stats:[]};
assert.equal(applyItemDisplay(dawn,empty),empty);
const zero={stats:[{key:22,value:0},{key:28,value:500}]};
assert.equal(applyItemDisplay(dawn,zero),zero);
console.log(`PASS ${native.fixtures.length} native item display cases; socket/Crystal/star composition, identified state, tooltip, persistence and immutable dice snapshots.`);
