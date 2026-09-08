import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {normalState} from '../engine/normal_state.js';
import {generateModelStats} from '../engine/stat_model.js';
import {modifyDefinitionValue} from '../engine/item_modifiers.js';
import {configureItem} from '../engine/item_setup.js';
import {captureItem} from '../engine/history.js';
import {transact,packItem,unpackItem} from '../engine/session.js';
import {itemTooltipHtml} from '../ui/item-tooltip.js';
import {itemRarity} from '../ui/rarity.js';

const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const probe=process.argv.includes('--probe');
const fixtures=read(probe?'../research/current/normal-state-probe.json':'./current_normal_state_native.json').fixtures;
assert.equal(fixtures.length,probe?720:5082);
let values=0;
for(const f of fixtures) {
  const [,cls,sub,b]=f.profile.split(':').map((v,i)=>i?Number(v):v);
  const item=sim.makeItem(cls,b,f.definition),label=`${f.profile} ${JSON.stringify(f.definition)}`;
  assert.ok(item.info.normalStateVerified,label);
  assert.equal(item.info.rarity,f.rarity,label+' rarity');
  assert.equal(item.info.requiredLevel,f.requiredLevel,label+' level');
  assert.equal(sim.sockets(item).count,f.sockets,label+' sockets');
  assert.equal(sim.sockets(item).bonus,0,label+' no Crystal socket on normal generation');
  const generated=generateModelStats(item,sim.model);
  const base=normalState(item).stats.map(s=>({...s,value:modifyDefinitionValue(s.key,s.value,{stars:Number(item.def.p)||0,corrupted:Boolean(item.def.r),tier:item.info.tier})}));
  for(const [key,value] of Object.entries(probe?(f.baseValues??{}):f.baseValues)) {
    if([1,2,24,108,110,295,447].includes(Number(key)))continue;
    assert.equal(base.find(s=>s.key===Number(key))?.value,value,label+' pre-affix base stat '+key);values++;
  }
  assert.equal(generated.normalAffixesResolved,true);
  if(f.selection) {
    const state=normalState(item);
    assert.deepEqual(state.trace.map(t=>[0,t.upper,t.roll]),f.selection.draws,label+' prelude draws');
    for(const key of ['affixCount','superiorCount','earlySockets'])if(f.selection[key]!=null)assert.equal(state[key],f.selection[key],label+' '+key);
    assert.equal(state.white,Boolean(f.selection.white),label+' white');
  }
}
if(!probe) {
  const make=a=>sim.makeItem(3,14,{a,c:0,j:1});
  const initial=make(57),snapshot=captureItem(sim,initial),frozen=JSON.stringify(snapshot);
  assert.equal(itemRarity(initial),'Mythic');assert.equal(snapshot.rarity,'Mythic');
  assert.equal(snapshot.requiredLevel,67);assert.equal(snapshot.unresolved,false);
  assert.match(itemTooltipHtml(sim,initial),/Mythic/);
  assert.match(itemTooltipHtml(sim,initial),/Level req\. 67/);
  assert.doesNotMatch(itemTooltipHtml(sim,initial),/Affix values are not yet included/);
  assert.throws(()=>configureItem(sim,initial,{crystal:2}),/cannot receive a Crystal socket/);
  const recipe=sim.recipes.find(r=>r.mechanic==='reroll_affixes');
  const inputs=item=>recipe.ingredients.map((i,n)=>({id:String(n),amount:i.amount,item:i.itemId==null?item:sim.makeItem(i.itemType,Array.isArray(i.itemId)?i.itemId[0]:i.itemId)}));
  const history=[],rarities=new Set(),sockets=new Set();
  let item=initial;
  for(let seed=1;seed<=20;seed++) {
    const tx=transact(sim,recipe,inputs(item),seed);
    history.push({before:captureItem(sim,tx.before),after:captureItem(sim,tx.after)});
    item=tx.after;rarities.add(item.info.rarity);sockets.add(sim.sockets(item).count);
  }
  assert.equal(history.length,20);assert.ok(rarities.size>1);assert.ok(sockets.size>1);
  assert.equal(JSON.stringify(snapshot),frozen,'Later crafts never rewrite earlier properties');
  const fixed=configureItem(sim,initial,{sockets:2});
  for(let seed=1;seed<=10;seed++)assert.equal(sim.sockets(transact(sim,recipe,inputs(fixed),seed).after).count,2);
  const restored=unpackItem(sim,JSON.parse(JSON.stringify(packItem(item))));
  assert.equal(itemRarity(restored),itemRarity(item));assert.equal(sim.sockets(restored).count,sim.sockets(item).count);
  for(const def of [{n:2},{n:100},{zz:{}}])assert.ok(normalState(sim.makeItem(3,14,{a:1,c:0,j:1,...def})),'Special generation uses the current normal state model');
}
console.log(`PASS ${fixtures.length} native normal rarity, level and socket cases; ${values} base values${probe?'':'; Toolkit rerolls, fixed sockets, tooltip and immutable history'}.`);
