import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {specialStatBonuses} from '../engine/special_stats.js';
import {CURRENT_SPECIAL_RULES} from '../engine/current_special_rules.js';
import {setSocketContent} from '../engine/item_setup.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),profiles:read('item_profiles.json')});
const fixtures=JSON.parse(fs.readFileSync(new URL('./current_special_native.json',import.meta.url),'utf8')).fixtures;
const pipeline=JSON.parse(fs.readFileSync(new URL('./current_special_pipeline_native.json',import.meta.url),'utf8')).fixtures;
for(const f of fixtures) {
  const result=specialStatBonuses(f.definition,CURRENT_SPECIAL_RULES[f.profile],f.initial[20]),values={...f.initial};
  for(const b of result.bonuses)values[b.key]=(values[b.key]??0)+b.value;
  assert.deepEqual(values,f.values,`${f.profile} ${f.case} seed ${f.definition.a}`);
  assert.deepEqual(result.trace.map(t=>[0,t.upper,t.roll]),f.draws);
  const encoded={...f.definition};
  for(let i=1;i<=6;i++)if(encoded[`s${i}`])encoded[`s${i}`]=btoa(JSON.stringify(encoded[`s${i}`]));
  assert.deepEqual(specialStatBonuses(encoded,CURRENT_SPECIAL_RULES[f.profile],f.initial[20]),result,'Stored socket payloads preserve native special effects');
}
const hidden=new Set([0,1,2,3,24,108,110,295,447]);
const failures=[];
for(const f of pipeline) {
  const [,cls,sub,id]=f.profile.split(':').map((v,i)=>i?Number(v):v),row=sim.catalog.find(cls,id,true,sub);
  const item=sim.makeItem(cls,id,f.definition,{row}),generated=sim.stats(item);
  const values=Object.fromEntries(generated.stats.map(s=>[s.key,s.value]));
  for(const [key,expected] of Object.entries(f.values))if(!hidden.has(Number(key))&&values[key]!==expected)
    failures.push({profile:f.profile,definition:f.definition,key,actual:values[key],expected});
  for(const [key,value] of Object.entries(values))if(key!=='20'&&!hidden.has(Number(key))&&f.values[key]===undefined)
    failures.push({profile:f.profile,key,extra:value});
  assert.equal(generated.specialResolved,true);
}
if(failures.length)console.error(JSON.stringify(failures.slice(0,10),null,2));
assert.equal(failures.length,0,`${failures.length} special pipeline mismatches`);
const armor=sim.makeItem(1,35,{a:1,c:1,j:0}),gemRow=sim.catalog.find(15,69,false,0);
const withGem=setSocketContent(sim,armor,0,gemRow),withTwo=setSocketContent(sim,withGem,1,gemRow);
const stat=(item,key)=>sim.stats(item).stats.find(s=>s.key===key)?.value??0;
const gemBonus=stat(sim.makeItem(15,69),146);
assert.equal(stat(withTwo,146),stat(armor,146)+2*gemBonus+30,'Both inserted gems add their ordinary and Gem King bonuses');
assert.equal(sim.stats(withTwo).specialContributions.length,8);
assert.equal(sim.stats(setSocketContent(sim,withTwo,0,null)).specialContributions.length,4);
console.log(`PASS ${fixtures.length} native special bonus cases and ${pipeline.length} complete base/Crystal/special pipelines across all six special equipment definitions.`);
