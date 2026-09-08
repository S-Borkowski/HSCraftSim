import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sim } from '../engine/index.js';
import { Cpr } from '../engine/cpr.js';
import { normalState } from '../engine/normal_state.js';
import { normalAffixes, rollNormalAffix } from '../engine/normal_affixes.js';
import { captureItem, retainVersion, compareStats } from '../engine/history.js';
import { packItem, unpackItem, transmuteInCube, findPosition } from '../engine/session.js';
import { itemTooltipHtml } from '../ui/item-tooltip.js';
import { recentCraftsHtml } from '../ui/history-view.js';

const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),
  statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const build='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4';
const full=read('./current_jewelry_generation_native.json'),single=read('./current_jewelry_affixes_native.json');
assert.equal(full.buildSha256,build);assert.equal(single.buildSha256,build);
assert.equal(full.fixtures.length,1980);assert.equal(single.fixtures.length,3962);
assert.equal(new Set(full.fixtures.map(f=>f.profile)).size,55);
assert.equal(new Set(single.fixtures.map(f=>`${f.side}:${f.id}`)).size,566);
const nativeValues=f=>Object.fromEntries(Object.entries(f.values).filter(([k])=>+k<10||+k>=20));
const draws=trace=>trace.filter(t=>['draw','choose','float'].includes(t[0]))
  .map(t=>t[0]==='choose'?[1,t[2]]:t[0]==='float'?[0,0]:[t[2],t[3]]);
let values=0;
for(const f of full.fixtures) {
  const [,cls,sub,b]=f.profile.split(':'),item=sim.makeItem(+cls,+b,f.definition);
  const generated=normalAffixes(item,normalState(item)),label=`${f.profile} ${JSON.stringify(f.definition)}`;
  assert.deepEqual(Object.fromEntries(generated.stats.map(s=>[s.key,s.value])),nativeValues(f),label+' values');
  values+=Object.keys(nativeValues(f)).length;
  // Stop at the selected-affix boundary: the following eight random draws
  // belong to GenerateItemRandomStats, with no active slots on these bases.
  assert.deepEqual(generated.trace.map(t=>[t.upper,t.roll]),draws(f.trace).slice(0,generated.trace.length),label+' RNG');
  assert.deepEqual(generated.affixes.map(a=>[a.side,a.id]),f.trace.filter(t=>t[0].startsWith('gml_Script_Return'))
    .map(t=>[t[0].includes('Prefix')?'prefix':'suffix',t[1][2]]),label+' affix identities');
  const visible=sim.stats(item);
  assert.equal(visible.normalAffixesResolved,true);
  for(const [key,value] of Object.entries(nativeValues(f)))assert.equal(visible.stats.find(s=>s.key===+key)?.value,value,label+' final property '+key);
  assert.equal(item.info.rarity,f.rarity);assert.equal(item.info.requiredLevel,f.requiredLevel);
}
for(const f of single.fixtures) {
  const item={def:f.definition,info:{tier:f.tier}},rng=new Cpr(f.definition.a),trace=[];
  const stats=new Map(Object.entries(f.existing).map(([k,v])=>[+k,{key:+k,value:v}]));
  const affix=rollNormalAffix(item,f.side,f.id,stats,(upper)=>{const roll=rng.irandom(upper);trace.push([upper,roll]);return roll;});
  const label=`${f.side}:${f.id} ${JSON.stringify(f.definition)} tier ${f.tier} prior ${JSON.stringify(f.existing)}`;
  assert.deepEqual(Object.fromEntries([...stats].map(([key,s])=>[key,s.value])),nativeValues(f),label);
  assert.deepEqual([affix.min,affix.max],f.values[10].slice(1,3),label+' ranges');
  assert.deepEqual(trace,draws(f.trace),label+' RNG');
}

// Exercise the actual Cube transaction, stat display, retained item versions
// and save/reload path. The same ring remains a distinct record on every use.
const recipe=sim.recipes.find(r=>r.mechanic==='reroll_affixes');
let stacks=[{id:'ring',item:sim.makeItem(7,4,{a:57,c:0,j:0}),amount:1,x:0,y:0}];
const history=[],first=captureItem(sim,stacks[0].item),frozen=JSON.stringify(first);
for(let number=1;number<=12;number++) {
  for(const ingredient of recipe.ingredients)if(ingredient.itemId!=null) {
    const item=sim.makeItem(ingredient.itemType,Array.isArray(ingredient.itemId)?ingredient.itemId[0]:ingredient.itemId);
    stacks.push({id:`material-${number}`,item,amount:ingredient.amount,...findPosition(stacks,item)});
  }
  const tx=transmuteInCube(sim,recipe,stacks,number);stacks=tx.stacks;
  const entry={number,lineage:'ring',recipeName:recipe.name,
    beforeSnapshot:captureItem(sim,tx.before),afterSnapshot:captureItem(sim,tx.after)};
  assert.equal(entry.afterSnapshot.unresolved,false);
  history.unshift(entry);retainVersion(stacks[0],entry);
}
assert.equal(history.length,12);assert.equal(stacks[0].versions.length,10);
assert.equal((recentCraftsHtml(history).match(/data-journal=/g)||[]).length,10);
assert.ok(new Set(history.map(h=>JSON.stringify(h.afterSnapshot.stats))).size>8);
assert.ok(history.some(h=>compareStats(h.beforeSnapshot,h.afterSnapshot).some(s=>s.changed)));
assert.equal(JSON.stringify(first),frozen);
const restored=unpackItem(sim,JSON.parse(JSON.stringify(packItem(stacks[0].item))));
assert.deepEqual(captureItem(sim,restored).stats,history[0].afterSnapshot.stats);
assert.doesNotMatch(itemTooltipHtml(sim,restored),/Affix values are not yet included|Unresolved property/);
assert.ok(normalAffixes(sim.makeItem(3,14,{a:1,c:0,j:1}),normalState(sim.makeItem(3,14,{a:1,c:0,j:1}))));
console.log(`PASS ${full.fixtures.length} native jewelry generations / ${values} values; ${single.fixtures.length} affix range/modifier cases; Toolkit history and reload.`);
