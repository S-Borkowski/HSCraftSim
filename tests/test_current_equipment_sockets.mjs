import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {itemSockets, socketCount} from '../engine/items.js';
import {validateAddSocketsTarget, validateCraft} from '../engine/validation.js';
import {recipeContext} from '../engine/recipe_context.js';
import {transact} from '../engine/session.js';

const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const counts=read('./current_equipment_sockets_native.json').fixtures;
assert.equal(counts.length,1911);
assert.equal(new Set(counts.map(f=>f.profile)).size,273);
for(const f of counts) {
  const [,cls,sub,b]=f.profile.split(':');
  const item=sim.makeItem(+cls,+b,{a:123456,c:0,j:+sub,q:0,s:f.seed});
  assert.ok(item.row,f.profile);
  const actual=itemSockets(item);
  assert.equal(item.info.rarity,f.rarity,f.profile);
  assert.equal(actual.capacity,f.capacity,f.profile);
  assert.equal(actual.count,f.count,`${f.profile}, socket seed ${f.seed}`);
  assert.equal(socketCount(item.def,f.capacity),f.count);
  assert.equal(actual.source,'current-normal-socket-override');
}

const gates=read('./current_add_sockets_gate_native.json').fixtures;
assert.equal(gates.length,1848);
assert.equal(gates.filter(f=>f.allowed).length,72);
for(const f of gates) {
  const item={itemType:f.itemType,info:{rarity:f.rarity,socketCraftBlocked:f.restricted},def:f.seed==null?{}:{s:f.seed}};
  assert.equal(validateAddSocketsTarget(item,f.count).ok,f.allowed,JSON.stringify(f));
}

// Compare the real crafting path and UI eligibility, not just the isolated rule.
const recipe=sim.recipes.find(r=>r.mechanic==='add_sockets');
const inputs=item=>recipe.ingredients.map((i,n)=>({id:'input-'+n,amount:i.amount,x:n,y:0,
  item:i.itemId==null?item:sim.makeItem(i.itemType,Array.isArray(i.itemId)?i.itemId[0]:i.itemId)}));
for(const rarity of ['Satanic','Angelic','Heroic','Unholy']) {
  const row=sim.catalog.rows.find(r=>r.kind==='unique'&&r.cls===1&&r.rar===rarity);
  assert.ok(row,rarity);
  const item=sim.makeItem(row.cls,row.b,{a:123456,c:1,j:row.sub,s:0},{row});
  const stacks=inputs(item),before=JSON.stringify(stacks);
  assert.match(validateCraft(recipe,stacks).reason,/rarity below Satanic/);
  assert.equal(recipeContext(recipe,stacks).dimmed,true);
  assert.throws(()=>transact(sim,recipe,stacks,42),/rarity below Satanic/);
  assert.equal(JSON.stringify(stacks),before,'Rejection must not consume materials or modify the item');
}
const base=sim.makeItem(3,14,{a:123456,c:0,j:1,s:0});
assert.equal(recipeContext(recipe,inputs(base)).rank,0);
for(const seed of [1,2,42,123456]) {
  const tx=transact(sim,recipe,inputs(base),seed);
  const result=itemSockets(tx.after);
  assert.ok(result.count>=1&&result.count<=6);
  assert.equal(result.source,'current-normal-socket-override');
  assert.equal(tx.after.row.id,base.row.id);
  assert.equal(tx.after.def.a,base.def.a);
  assert.equal(validateCraft(recipe,inputs(tx.after)).nextMechanic,'delete_sockets');
}
console.log(`PASS ${counts.length} native equipment socket results and ${gates.length} native eligibility decisions; integration rejects invalid rarities without consuming ingredients.`);
