import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RUNEWORDS,rollRuneword} from '../engine/runewords.js';
import {Sim} from '../engine/index.js';
import {catalogTarget} from '../engine/catalog_target.js';
import {transmuteInCube,findPosition,packItem,unpackItem} from '../engine/session.js';
import {configureItem,setSocketContent} from '../engine/item_setup.js';
import {validateTarget} from '../engine/validation.js';
import {captureItem} from '../engine/history.js';
const fixtures=JSON.parse(fs.readFileSync(new URL('./current_runeword_native.json',import.meta.url),'utf8'));
for(const fixture of fixtures) {
  const word=RUNEWORDS.find(w=>w.id===fixture.b);
  const actual=Object.fromEntries(rollRuneword(word,fixture.seed,fixture.itemType,fixture.handed).map(s=>[s.key,s.value]));
  assert.deepEqual(actual,fixture.stats,`${word.name} (${fixture.itemType}/${fixture.handed}, ${fixture.seed})`);
}
console.log(`PASS ${fixtures.length} current native Runeword rolls across equipment variants.`);
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),profiles:read('item_profiles.json')});
const craft=(item,recipe,seed=123456)=>{
  const stacks=[{id:'weapon',item,amount:1,x:0,y:0}];
  for(const ing of recipe.ingredients.filter(i=>i.itemId!=null)) {
    const material=sim.makeItem(ing.itemType,Array.isArray(ing.itemId)?ing.itemId[0]:ing.itemId),position=findPosition(stacks,material,9,6);
    stacks.push({id:'mat-'+ing.itemId,item:material,amount:ing.amount,...position});
  }
  return transmuteInCube(sim,recipe,stacks,seed,{columns:9,rows:6});
};
for(const recipe of sim.recipes.filter(r=>r.mechanic==='runeword')) {
  const base=sim.catalog.rows.map(row=>catalogTarget(sim,recipe,recipe.ingredients[0],row)).find(Boolean)?.item;
  assert.ok(base,recipe.name);
  const tx=craft(base,recipe),item=tx.after;
  assert.equal(item.name,recipe.name);assert.equal(item.info.rarity,8);assert.equal(item.itemId,base.itemId);
  assert.equal(tx.stacks.length,1);assert.equal(tx.stacks[0].id,'weapon');
  assert.equal(validateTarget(recipe,item).ok,false,'Cannot overwrite a Runeword');
  assert.ok(sim.stats(item).stats.some(s=>s.source==='runeword'),recipe.name);
  const restored=unpackItem(sim,JSON.parse(JSON.stringify(packItem(item))));
  assert.equal(restored.name,recipe.name);assert.deepEqual(sim.stats(restored),sim.stats(item));
}
const recipe=sim.recipes.find(r=>r.name==='Breath of the Damned'),word=RUNEWORDS.find(w=>w.id===recipe.wordId);
let base=sim.catalog.rows.map(row=>catalogTarget(sim,recipe,recipe.ingredients[0],row)).find(Boolean).item;
const original=base,history=[];
for(const id of word.runes) {
  const single=sim.recipes.find(r=>r.mechanic==='socket_rune'&&r.rune===id),tx=craft(base,single);
  history.push({before:captureItem(sim,base),after:captureItem(sim,tx.after)});base=tx.after;
  if(history.length<word.runes.length)assert.equal(base.info.runeword,undefined);
}
assert.equal(base.name,word.name);assert.equal(history.length,6);
const saved=JSON.stringify(history);craft(base,sim.recipes.find(r=>r.mechanic==='empty_sockets'));assert.equal(JSON.stringify(history),saved);
assert.equal(history[0].after.item.def.s2,undefined);assert.equal(history[5].after.item.def.s6,base.def.s6);
let reversed=original;for(const [i,id] of [...word.runes].reverse().entries())reversed=setSocketContent(sim,reversed,i,sim.catalog.find(15,id,false));
assert.equal(reversed.info.runeword,undefined,'Wrong order cannot form the word');
assert.equal(validateTarget(recipe,configureItem(sim,original,{sockets:5})).ok,false);
assert.equal(validateTarget(recipe,configureItem(sim,original,{corrupted:true})).ok,false);
console.log('PASS All 93 Runewords craft on eligible bases, survive serialization, and respect socket order; six individual insertions retain six snapshots.');
