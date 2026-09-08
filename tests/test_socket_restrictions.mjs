import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {itemSockets} from '../engine/items.js';
import {validateAddSocketsTarget, validateCraft} from '../engine/validation.js';
import {recipeContext} from '../engine/recipe_context.js';
import {packItem, unpackItem, transact} from '../engine/session.js';

const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const native=read('./current_consumable_socket_native.json');
assert.equal(native.buildSha256,'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4');
assert.equal(native.fixtures.length,81);
assert.equal(new Set(native.fixtures.map(f=>f.b)).size,27);
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const recipe=sim.recipes.find(r=>r.mechanic==='add_sockets');
const inputs=(recipe,target)=>recipe.ingredients.map((i,n)=>({id:`input-${n}`,amount:i.amount,x:n,y:0,
  item:i.itemId==null?target:sim.makeItem(i.itemType,Array.isArray(i.itemId)?i.itemId[0]:i.itemId,{c:i.isUnique?1:0})}));
const blocked=new Set(native.fixtures.filter(f=>!f.gateAllowed).map(f=>f.b));
assert.deepEqual([...blocked],[12,14,15,16,17,24,25]);

for(const f of native.fixtures) {
  const item=sim.makeItem(11,f.b,{a:f.seed,c:0,j:0,s:0});
  const restored=unpackItem(sim,JSON.parse(JSON.stringify(packItem(item))));
  for(const candidate of [item,restored]) {
    assert.equal(candidate.info.socketCraftBlocked,!f.gateAllowed,`${candidate.name}, seed ${f.seed}`);
    assert.equal(validateAddSocketsTarget(candidate,0).ok,f.gateAllowed);
    if(!f.gateAllowed) {
      const stacks=inputs(recipe,candidate), before=JSON.stringify(stacks);
      assert.equal(validateCraft(recipe,stacks).reason,'This consumable cannot receive sockets.');
      assert.equal(recipeContext(recipe,stacks).dimmed,true);
      assert.equal(recipeContext(recipe,stacks).ready,false);
      assert.throws(()=>transact(sim,recipe,stacks,42),/cannot receive sockets/);
      assert.equal(JSON.stringify(stacks),before,'Rejected craft must not change the target or consume materials');
    }
  }
}

// Numeric base IDs are shared by item families: do not ban armor/weapons or
// unique items that happen to have one of the seven consumable IDs.
for(const row of sim.catalog.rows.filter(r=>r.kind!=='runeword')) {
  const item=sim.makeItem(row.cls,row.b,{a:1,c:row.kind==='unique'?1:0,j:row.sub??0},{row});
  assert.equal(item.info.socketCraftBlocked,row.kind==='normal'&&row.cls===11&&blocked.has(row.b),row.name);
}

// Both Codices remain usable, including after a session reload. The absent
// flag does not bypass other checks (already socketed, rarity, corruption).
for(const id of [18,23]) {
  const item=unpackItem(sim,packItem(sim.makeItem(11,id,{a:1,c:0,s:0})));
  assert.equal(validateCraft(recipe,inputs(recipe,item)).ok,true,item.name);
  const tx=transact(sim,recipe,inputs(recipe,item),42);
  assert.ok(itemSockets(tx.after).count>0);
  assert.equal(validateCraft(recipe,inputs(recipe,tx.after)).nextMechanic,'delete_sockets');
}

// Recipe-created consumables must get the same restriction as catalog items.
let creationCount=0;
for(const creation of sim.recipes.filter(r=>r.mechanic==='create'&&r.result?.itemType===11&&blocked.has(r.result.itemId))) {
  const tx=transact(sim,creation,inputs(creation),42);
  assert.equal(tx.created.length,1);
  const result=unpackItem(sim,packItem(tx.created[0]));
  assert.equal(result.info.socketCraftBlocked,true,result.name);
  assert.equal(validateCraft(recipe,inputs(recipe,result)).ok,false);
  creationCount++;
}
assert.equal(creationCount,3);
console.log(`PASS ${native.fixtures.length} native consumable socket chains; seven restrictions persist, reject without consuming materials, and apply to ${creationCount} crafted outputs. Both Codices still craft.`);
