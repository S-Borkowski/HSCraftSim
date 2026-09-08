import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {BASE_ROLL_ORDER} from '../engine/base_order_rules.js';
import {generateModelStats} from '../engine/stat_model.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const fixtures=read('./current_base_order_native.json').fixtures;
let values=0,changed=0;
for(const fixture of fixtures) {
  const [,cls,sub,b]=fixture.profile.split(':');
  const item=sim.makeItem(+cls,+b,{a:fixture.seed,c:1,j:+sub,p:0,r:0});
  const generated=sim.stats(item),legacy=generateModelStats(item,sim.model,{legacyBaseOrder:true});
  assert.equal(generated.baseOrderVerified,true);
  for(const stat of generated.stats) {
    if(stat.key===20||!Object.hasOwn(fixture.values,stat.key))continue;
    assert.equal(stat.value,fixture.values[stat.key],`${fixture.profile}, seed ${fixture.seed}, stat ${stat.key}`);
    values++;
    changed+=stat.value!==legacy.stats.find(s=>s.key===stat.key)?.value;
  }
  const draws=generated.trace.filter(e=>e.phase==='definition');
  assert.deepEqual(draws.map(d=>[0,d.upper,d.roll]),fixture.draws,fixture.profile);
  assert.deepEqual(draws.map(d=>d.stat),BASE_ROLL_ORDER[fixture.profile]);
}
assert.equal(Object.keys(BASE_ROLL_ORDER).length,408);
assert.equal(fixtures.length,1224);
assert.ok(changed>1000,'Fixtures must detect the old numeric-order replay.');
console.log(`PASS ${fixtures.length} native base stages / ${values} stat values across 408 Unique items; ${changed} old-order discrepancies corrected.`);
