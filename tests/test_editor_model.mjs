import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sim } from '../engine/index.js';
import { replayDynamic, generateModelStats, nativeSocketState } from '../engine/stat_model.js';
import { itemSockets } from '../engine/items.js';
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const profiles = read('../data/item_profiles.json');
const golden = read('./editor_golden.json');
const sim = new Sim({ recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles });
const rows = new Map(sim.catalog.rows.filter(r=>r.kind!=='runeword').map(r=>[`${r.kind}:${r.cls}:${r.sub}:${r.b}`,r]));
const itemFor = (profile,seed) => {
  const row = rows.get(profile);
  if (!row) return null;
  return sim.makeItem(row.cls,row.b,{a:seed,c:row.kind==='unique'?1:0,j:row.sub},{row,isUnique:row.kind==='unique'});
};
let numeric = 0, collisions = 0, identities = 0;
assert.equal(profiles.sourceBuild,golden.sourceBuild);
for (const test of golden.regular) {
  const item = itemFor(test.profile,test.seed);
  if (!item) continue;
  // Preserve the imported fallback's differential coverage. Current base draw
  // order is checked against the current binary in test_base_order.mjs.
  for (const stat of generateModelStats(item,sim.model,{legacyBaseOrder:true}).stats) {
    if (stat.value == null) continue;
    assert.equal(stat.value,test.values[stat.key],`${test.profile}, seed ${test.seed}, stat ${stat.key}`);
    numeric++;
  }
}
for (const test of golden.dynamic) {
  const model = profiles.profiles[test.profile].dynamic;
  const replay = replayDynamic(model,test.seed,profiles.generatedPools);
  assert.equal(replay.finalState,test.state,`${test.profile}: final CPR state`);
  assert.equal(replay.trace.length,test.calls,`${test.profile}: draw count`);
  assert.deepEqual(Object.fromEntries(replay.assignments.map(v=>[v.key,[v.value,v.min,v.max,v.source]])),test.values,`${test.profile}, seed ${test.seed}: values`);
  assert.deepEqual(replay.identities.map(v=>[v.key,v.selectedIdentity,v.fixedValue??null,v.attempts??null]),test.identities,`${test.profile}: identities`);
  const item=itemFor(test.profile,test.seed);
  if (item) {
    const stats=sim.stats(item).stats;
    assert.equal(new Set(stats.map(s=>s.key)).size,stats.length,'One visible line per native stat');
    const definitionKeys=new Set(model.events.filter(e=>e.score!==false).map(e=>e.key));
    collisions+=replay.assignments.filter(s=>s.source.startsWith('generated')&&definitionKeys.has(s.key)).length;
    identities+=replay.identities.length;
  }
}
assert.ok(collisions>0,'Golden seeds exercise generated/definition overwrite');
assert.ok(identities>0,'Golden seeds exercise special identity paths');
for (const test of golden.sockets) {
  const item=itemFor(test.profile,test.seed);
  assert.ok(item,test.profile);
  const sockets=nativeSocketState(item,sim.model,{legacy:true});
  assert.equal(sockets.count,test.count,`${test.profile}, seed ${test.seed}: imported socket fallback`);
  assert.equal(sockets.source,'measured-a-chain');
}
const loaded=itemFor('unique:10:0:31',3);
const grant=sim.stats(loaded).stats.find(s=>s.key===202);
assert.equal(grant.value,2);
assert.equal(grant.displayValue,'Weapon Master');
assert.equal(grant.identity,true);
const harlequinn=sim.stats(itemFor('unique:0:0:0',177289));
assert.equal(harlequinn.stats.find(s=>s.key===201).name,'to All Skills');
assert.equal(harlequinn.stats.find(s=>s.key===284).unit,'%');
assert.equal(sim.statLabel(52),'to Life');
assert.equal(sim.statLabel(53),'Life Increased by');
assert.equal(profiles.semantics[52].valueKind,'flat');
assert.equal(profiles.semantics[53].valueKind,'percent');
assert.ok(!sim.stats(itemFor('unique:7:0:51',123456)).stats.some(s=>[0,1,2].includes(s.key)),'Pool selectors must not become Star Level');
assert.equal(profiles.currentBuildVerified,false);
assert.notEqual(profiles.editorSource.statBuild.toLowerCase(),profiles.editorSource.socketBuild.toLowerCase());
console.log(`PASS Item Editor differential: ${numeric} numeric stats; ${golden.dynamic.length} full dynamic replays; ${golden.sockets.length} socket replays; ${collisions} overwrite cases.`);
console.log('PASS Stat semantics, percent units, named skills, hidden selectors, source-build distinction.');
