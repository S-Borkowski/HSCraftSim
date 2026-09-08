import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {BASE_STAT_RULES} from '../engine/base_stat_rules.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const fixtures=read('./current_base_ranges_native.json').fixtures;
let values=0;
for(const fixture of fixtures) {
  const [,cls,sub,b]=fixture.profile.split(':');
  const item=sim.makeItem(+cls,+b,{a:fixture.seed,c:1,j:+sub,p:fixture.stars,r:fixture.corrupted});
  const generated=sim.stats(item);
  assert.equal(generated.baseRangesVerified,true);
  const visibleKeys=new Set(generated.stats.map(s=>s.key));
  for(const key of Object.keys(fixture.values).map(Number)) {
    if(![20,24,108,110,295,447].includes(key))assert.ok(visibleKeys.has(key),`${fixture.profile}: missing native base stat ${key}`);
  }
  for(const stat of generated.stats) {
    if(stat.key===20||!Object.hasOwn(fixture.values,stat.key))continue;
    assert.equal(stat.value,fixture.values[stat.key],`${fixture.profile}, seed ${fixture.seed}, stars ${fixture.stars}, corruption ${fixture.corrupted}, stat ${stat.key}`);
    values++;
  }
  const draws=generated.trace.filter(e=>e.phase==='definition');
  assert.deepEqual(draws.map(d=>[0,d.upper,d.roll]),fixture.draws,fixture.profile);
  assert.deepEqual(draws.map(d=>d.stat),BASE_STAT_RULES[fixture.profile].order);
}
assert.ok(Object.keys(BASE_STAT_RULES).length>600);
assert.equal(fixtures.length,9*Object.keys(BASE_STAT_RULES).length);
assert.equal(values,37791);
console.log(`PASS ${fixtures.length} native base stages / ${values} values, including five stars and corruption, across ${Object.keys(BASE_STAT_RULES).length} Unique items.`);
