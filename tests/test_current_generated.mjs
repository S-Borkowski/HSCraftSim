import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {generateModelStats} from '../engine/stat_model.js';
import {applyItemModifiers} from '../engine/item_modifiers.js';
import {CURRENT_GENERATED_RULES} from '../engine/current_generated_rules.js';
import {configureItem} from '../engine/item_setup.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),profiles:read('item_profiles.json')});
const fixtures=JSON.parse(fs.readFileSync(new URL('./current_generated_native.json',import.meta.url),'utf8')).fixtures;
const hidden=new Set([1,2,24,108,110,295,447]);
const failures=[];let valuesChecked=0;
for(const f of fixtures) {
  const [,cls,sub,id]=f.profile.split(':').map((v,i)=>i?Number(v):v);
  const row=sim.catalog.find(cls,id,true,sub),item=sim.makeItem(cls,id,f.definition,{row});
  const generated=applyItemModifiers(item,generateModelStats(item,sim.model),sim.model);
  const values={...Object.fromEntries(generated.stats.map(s=>[s.key,s.value])),...generated.internalStats};
  assert.equal(sim.sockets(item).count,f.count,`${f.profile} socket count ${JSON.stringify(f.definition)}`);
  const trace=generated.trace.map(t=>[0,t.upper,t.roll]);
  if(JSON.stringify(trace)!==JSON.stringify(f.draws))failures.push({profile:f.profile,definition:f.definition,trace,expected:f.draws});
  for(const [key,value] of Object.entries(f.values)) {
    if(hidden.has(Number(key)))continue;
    valuesChecked++;
    if(JSON.stringify(values[key])!==JSON.stringify(value))failures.push({profile:f.profile,definition:f.definition,key,actual:values[key],expected:value});
  }
  for(const [key,value] of Object.entries(values))if(key!=='20'&&!hidden.has(Number(key))&&f.values[key]===undefined)
    failures.push({profile:f.profile,key,extra:value});
}
if(failures.length) {
  fs.writeFileSync(new URL('./_output/current-generated-failures.json',import.meta.url),JSON.stringify(failures,null,2));
  console.error(JSON.stringify(failures.slice(0,8).map(f=>f.trace?{...f,trace:f.trace.slice(0,10),expected:f.expected.slice(0,10)}:f),null,2));
}
assert.equal(failures.length,0,`${failures.length} current generated mismatches`);
for(const [key,rule] of Object.entries(CURRENT_GENERATED_RULES)) {
  const [,cls,sub,id]=key.split(':').map((v,i)=>i?Number(v):v),row=sim.catalog.find(cls,id,true,sub);
  const item=sim.makeItem(cls,id,{a:42,c:1,j:sub},{row});
  for(const count of new Set(rule.range))assert.equal(sim.sockets(configureItem(sim,item,{sockets:count})).count,count);
}
console.log(`PASS ${fixtures.length} current native generated cases for ${Object.keys(CURRENT_GENERATED_RULES).length} items; ${valuesChecked} values, all draw sequences and natural setup bounds.`);
