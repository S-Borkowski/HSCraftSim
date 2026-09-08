import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sim, UniformRng } from '../engine/index.js';
import { sessionStartSeed } from '../engine/session_random.js';
import { transmuteInCube } from '../engine/session.js';
const read=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n,import.meta.url)));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),profiles:read('item_profiles.json')});
const recipe=sim.recipes.find(r=>r.mechanic==='random_orbs');
const inputs=()=>recipe.ingredients.map((i,x)=>({id:`input-${x}`,item:sim.makeItem(i.itemType,i.itemId),amount:200,x,y:0}));
// The extracted DoCraftResult case 0x16 draws one id 112..129 and sets amount 8.
for(const [draw,expected] of [[0,112],[.999999,129]]){
  const result=sim.craft(recipe,inputs(),new UniformRng(()=>draw));
  assert.equal(result.items.length,1);assert.equal(result.items[0].itemId,expected);assert.equal(result.items[0].amount,8);
}
let stacks=inputs(),seen=new Set();
for(let seed=1;seed<=12;seed++){
  const tx=transmuteInCube(sim,recipe,stacks,seed,{columns:9,rows:6});
  stacks=tx.stacks;seen.add(tx.created[0].itemId);
}
assert.ok(seen.size>=7,'Successive crafts must produce a range of Orb types');
assert.equal(stacks.filter(s=>s.item.itemType===15).reduce((n,s)=>n+s.amount,0),96);
const fixedA=sim.craft(recipe,inputs(),new UniformRng(123)).items;
const fixedB=sim.craft(recipe,inputs(),new UniformRng(123)).items;
assert.deepEqual(fixedA.map(i=>i.def),fixedB.map(i=>i.def),'Explicit seeds preserve reproducible results');
let seedDraw=987650;
const first=sessionStartSeed({rng:1},()=>++seedDraw),second=sessionStartSeed({rng:1},()=>++seedDraw);
assert.notEqual(first,second,'Default sessions request fresh entropy instead of resetting to 1');
assert.equal(sessionStartSeed({repeatable:true,seedStart:37,rng:100},()=>{throw Error('must not draw');}),37);
const tally=sim.monteCarlo(recipe,inputs(),18000,8);
assert.equal(Object.keys(tally).length,18,'Probability view must report all Orb identities, not Created: 100%');
assert.ok(!Object.hasOwn(tally,'created'));
for(const [key,p] of Object.entries(tally)){
  assert.match(key,/^item:15:1(?:1[2-9]|2[0-9]):0$/);
  assert.ok(p>.04&&p<.075,`Unexpected distribution for ${key}: ${p}`);
}
assert.ok(Math.abs(Object.values(tally).reduce((a,b)=>a+b,0)-1)<1e-10);
for(const dir of ['ui','engine'])for(const name of fs.readdirSync(new URL('../'+dir+'/',import.meta.url))){
  if(!/\.(js|html)$/.test(name))continue;
  const source=fs.readFileSync(new URL(`../${dir}/${name}`,import.meta.url),'utf8');
  assert.doesNotMatch(source,/[çğıİöşüÇĞÖŞÜ]|tr-TR|Craft adedi/,`${dir}/${name} must use English UI text`);
}
assert.match(fs.readFileSync(new URL('../ui/index.html',import.meta.url),'utf8'),/<html lang="en">/);
console.log('PASS Random Orb boundaries, varied successive crafts, fresh/repeatable sessions, 18-type distribution and English runtime text.');
