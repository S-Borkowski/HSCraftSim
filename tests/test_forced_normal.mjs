import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {normalState} from '../engine/normal_state.js';
import {normalAffixes} from '../engine/normal_affixes.js';
import {configureItem,startingQualityOptions} from '../engine/item_setup.js';
import {captureItem} from '../engine/history.js';
import {packItem,unpackItem,transact} from '../engine/session.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),
  statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const probe=process.argv.includes('--probe');
const source=read(probe?'../research/current/forced-stats-probe.json':'./current_forced_normal_native.json');
if(!probe)assert.equal(source.buildSha256,'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4');
let values=0,failures=[];
for(const f of source.fixtures) {
  const cls=Number(f.profile.split(':')[1]);
  try {
    const item=sim.makeItem(cls,f.definition.b,f.definition),s=normalState(item),g=normalAffixes(item,s);
    assert.equal(item.info.rarity,f.info[27],'rarity');
    assert.equal(item.info.requiredLevel,f.info[1],'level');
    assert.equal(sim.sockets(item).count,f.stats[20]??0,'socket count');
    assert.deepEqual(s.trace.map(t=>[0,t.upper,t.roll]),f.selection.draws,'prelude stream');
    const expected=Object.fromEntries(Object.entries(f.stats).filter(([k])=>+k<10||+k>20));
    assert.deepEqual(Object.fromEntries(g.stats.map(s=>[s.key,s.value])),expected,'full properties');
    values+=Object.keys(expected).length;
  } catch(e){failures.push({profile:f.profile,def:f.definition,reason:e.message});}
}
if(failures.length)console.log(JSON.stringify(failures.slice(0,12),null,2));
assert.equal(failures.length,0,`${failures.length}/${source.fixtures.length} native cases differ`);
if(!probe) {
  assert.equal(source.fixtures.length,2400);
  assert.equal(new Set(source.fixtures.map(f=>f.profile)).size,120);
  const initial=sim.makeItem(3,14,{a:42,c:0,j:1}),frozen=JSON.stringify(captureItem(sim,initial));
  assert.deepEqual(startingQualityOptions(initial).map(([value])=>value),[1,100,200,1000]);
  let item=configureItem(sim,initial,{dropQuality:200});
  assert.equal(item.info.rarity,5);
  const recipe=sim.recipes.find(r=>r.mechanic==='reroll_affixes'),history=[];
  for(let seed=1;seed<=10;seed++) {
    const inputs=recipe.ingredients.map((i,k)=>({id:String(k),amount:i.amount,
      item:i.itemId==null?item:sim.makeItem(i.itemType,Array.isArray(i.itemId)?i.itemId[0]:i.itemId)}));
    const tx=transact(sim,recipe,inputs,seed);
    history.push({before:captureItem(sim,tx.before),after:captureItem(sim,tx.after)});item=tx.after;
    assert.equal(item.info.dropQuality,200);assert.equal(item.info.rarity,5);
  }
  assert.equal(history.length,10);
  assert.ok(new Set(history.map(h=>JSON.stringify(h.after.stats))).size>1);
  assert.equal(JSON.stringify(captureItem(sim,initial)),frozen);
  assert.deepEqual(captureItem(sim,unpackItem(sim,packItem(item))).stats,history.at(-1).after.stats);
  const imported=sim.makeItem(3,14,{a:42,c:0,j:1,zz:{dropQuality:200,sockets:2}});
  const edited=configureItem(sim,imported,{dropQuality:1,sockets:3});
  assert.equal(edited.info.dropQuality,1);assert.equal(sim.sockets(edited).count,3);
  assert.deepEqual(imported.def.zz,{dropQuality:200,sockets:2},'Editing an imported scenario never mutates its source');
}
console.log(`PASS ${source.fixtures.length} native special drop quality/socket cases; ${values} complete properties.`);
