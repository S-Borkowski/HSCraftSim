import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {validateTarget,validateCraft} from '../engine/validation.js';
import {transact} from '../engine/session.js';
import {setSocketContent,socketContents} from '../engine/item_setup.js';

const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const fixtures=read('./current_unique_socket_overrides_native.json').fixtures;
assert.equal(fixtures.length,2868);assert.equal(new Set(fixtures.map(f=>f.profile)).size,956);
for(const f of fixtures) {
  const [,cls,sub,b]=f.profile.split(':');
  const item=sim.makeItem(+cls,+b,f.definition);
  assert.equal(sim.sockets(item).count,f.count,`${f.profile} ${JSON.stringify(f.definition)}`);
}
const gates=read('./current_mallet_gate_native.json').fixtures,mallet=sim.recipes.find(r=>r.mechanic==='delete_sockets');
assert.equal(gates.length,88);
for(const f of gates) {
  const item={itemType:3,itemId:14,isUnique:false,def:{},info:{rarity:f.rarity,socketCount:f.count,maxSockets:7}};
  assert.equal(validateTarget(mallet,item,null).ok,f.allowed,JSON.stringify(f));
}
const inputs=(recipe,item)=>recipe.ingredients.map((i,n)=>({id:String(n),amount:i.amount,item:i.itemId==null?item:sim.makeItem(i.itemType,Array.isArray(i.itemId)?i.itemId[0]:i.itemId)}));
let dawn=sim.makeItem(3,18,{a:42,c:1,j:3,s:0});
const stacks=inputs(mallet,dawn),original=JSON.stringify(stacks);
assert.match(validateCraft(mallet,stacks).reason,/rarity below Satanic/);
assert.throws(()=>transact(sim,mallet,stacks,42),/rarity below Satanic/);
assert.equal(JSON.stringify(stacks),original);
dawn=setSocketContent(sim,dawn,0,sim.catalog.find(15,69,false));
const empty=sim.recipes.find(r=>r.mechanic==='empty_sockets'),tx=transact(sim,empty,inputs(empty,dawn),42);
assert.equal(socketContents(sim,tx.after).filter(Boolean).length,0);
assert.equal(sim.sockets(tx.after).count,5);
assert.equal(socketContents(sim,dawn).filter(Boolean).length,1);
console.log(`PASS ${fixtures.length} native Unique socket overrides and ${gates.length} Mallet gates; rejected crafts consume nothing and Empty Sockets retains natural slots.`);
