import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {captureItem} from '../engine/history.js';
import {packItem,unpackItem,transact} from '../engine/session.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),
  statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const source=read('./current_normal_names_native.json');
assert.equal(source.buildSha256,'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4');
const failures=[];
for(const f of source.fixtures) {
  const item=sim.makeItem(Number(f.profile.split(':')[1]),f.definition.b,f.definition);
  try {
    assert.deepEqual(item.info.affixNameParts,{prefix:f.prefix,suffix:f.suffix});
    assert.equal(item.name,(f.prefix+item.row.name+f.suffix).trim());
    assert.ok(!item.name.includes('undefined'));
  }catch(error){failures.push({profile:f.profile,definition:f.definition,message:error.message,selected:f.selected});}
}
if(failures.length)console.log(JSON.stringify(failures.slice(0,8),null,2));
assert.equal(failures.length,0,`${failures.length}/${source.fixtures.length} names differ`);
let item=sim.makeItem(3,0,{a:1,c:0,j:1,n:200});
assert.equal(item.name,'Accursed Short Sword of Arcanum');
const initial=captureItem(sim,item),frozen=JSON.stringify(initial),history=[];
const recipe=sim.recipes.find(r=>r.mechanic==='reroll_affixes');
for(let seed=1;seed<=10;seed++) {
  const inputs=recipe.ingredients.map((i,k)=>({id:String(k),amount:i.amount,
    item:i.itemId==null?item:sim.makeItem(i.itemType,Array.isArray(i.itemId)?i.itemId[0]:i.itemId)}));
  const tx=transact(sim,recipe,inputs,seed);
  history.push({before:captureItem(sim,tx.before),after:captureItem(sim,tx.after)});item=tx.after;
}
assert.ok(new Set(history.map(h=>h.after.name)).size>1,'Rerolls update the affix name');
assert.equal(JSON.stringify(initial),frozen,'Old history names remain snapshots');
assert.equal(unpackItem(sim,packItem(item)).name,history.at(-1).after.name,'Reload derives the same name');
console.log(`PASS ${source.fixtures.length} complete native normal names; immutable craft names and reload.`);
