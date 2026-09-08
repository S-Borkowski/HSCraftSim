import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {generateModelStats} from '../engine/stat_model.js';
import {applyItemModifiers} from '../engine/item_modifiers.js';
import {CURRENT_NATURAL_SOCKET_RULES as rules} from '../engine/current_natural_socket_rules.js';
import {configureItem} from '../engine/item_setup.js';
import {highRollerStats} from '../engine/high_roller.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),profiles:read('item_profiles.json')});
const fixtures=JSON.parse(fs.readFileSync(new URL('./current_natural_sockets_native.json',import.meta.url),'utf8')).fixtures;
const hidden=new Set([1,2,24,108,110,295,447]);
const failures=[];let checked=0,missingProfile=0;
for(const f of fixtures) {
  const [,cls,sub,id]=f.profile.split(':').map((v,i)=>i?Number(v):v);
  const row=sim.catalog.find(cls,id,true,sub);
  assert.ok(row,`Catalog row ${f.profile}`);
  const item=sim.makeItem(cls,id,f.definition,{row});
  const generated=applyItemModifiers(item,generateModelStats(item,sim.model),sim.model);
  const values=new Map(generated.stats.map(s=>[s.key,s.value]));
  for(const [key,value] of Object.entries(generated.internalStats||{}))values.set(Number(key),value);
  assert.equal(sim.sockets(item).count,f.count,`${f.profile} ${JSON.stringify(f.definition)}`);
  assert.deepEqual(generated.trace.map(t=>[0,t.upper,t.roll]),f.draws,`${f.profile} draw order`);
  for(const [key,expected] of Object.entries(f.values)) {
    if(hidden.has(Number(key)))continue;
    checked++;
    if(values.get(Number(key))!==expected)failures.push({profile:f.profile,def:f.definition,key,actual:values.get(Number(key)),expected});
  }
  for(const [key,value] of values) if(key!==20)assert.equal(value,f.values[key],`Unexpected stale imported property ${f.profile}:${key}`);
  if(!item.profile?.tooltip)missingProfile++;
}
if(failures.length)console.error(JSON.stringify(failures.slice(0,12),null,2));
assert.equal(failures.length,0,`${failures.length} native value mismatches`);
assert.equal(fixtures.length,Object.keys(rules).length*7);
assert.ok(Object.keys(rules).length>600);
const highRollerFixtures=JSON.parse(fs.readFileSync(new URL('./current_high_roller_native.json',import.meta.url),'utf8'));
for(const f of highRollerFixtures)assert.deepEqual(highRollerStats(f.stats,f.repositoryStars).stats,f.result);
const catalogKey=r=>`${r.kind}:${r.cls}:${r.sub??0}:${r.b}`;
for(const [key,rule] of Object.entries(rules)) {
  const row=sim.catalog.rows.find(r=>catalogKey(r)===key),item=sim.makeItem(row.cls,row.b,{a:42,c:1,j:row.sub??0},{row});
  for(const count of new Set(rule.range)) {
    const configured=configureItem(sim,item,{sockets:count});
    assert.equal(sim.sockets(configured).count,count,`${key} starting natural count ${count}`);
    assert.equal(Object.hasOwn(configured.def,'s'),false);
  }
}
console.log(`PASS ${fixtures.length} native socket/base cases for ${Object.keys(rules).length} Unique items; ${checked} values; ${missingProfile} cases without an imported tooltip; all natural setup limits; ${highRollerFixtures.length} High Roller thresholds.`);
