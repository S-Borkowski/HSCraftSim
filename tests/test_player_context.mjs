import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CURRENT_GENERATED_RULES} from '../engine/current_generated_rules.js';
import {validateAddSocketsTarget} from '../engine/validation.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const tags=read('../research/current/player-skill-tags-native.json');
const baseline=read('../research/current/face-of-existence-native.json');
const restrictions=read('./current_socket_restriction_native.json');
for(const f of [tags,baseline,restrictions])assert.equal(f.buildSha256,'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4');
assert.equal(tags.fixtures.length,428);
assert.equal(new Set(tags.fixtures.map(f=>f.skill)).size,428);
const candidates=CURRENT_GENERATED_RULES['unique:0:0:88'].faceCandidates;
assert.deepEqual(candidates,baseline.candidates);
assert.equal(candidates.length,39);
for(let mask=0;mask<16;mask++) {
  for(const f of tags.fixtures)assert.equal(f.tagsByMask.length,16);
  assert.deepEqual(tags.fixtures.filter(f=>f.tagsByMask[mask].includes(12)).map(f=>f.skill),candidates,`Face pool with augment mask ${mask}`);
}
// The native context must actually affect other tags; a stub returning the
// unallocated definition for every query would give a false pass above.
assert.ok(tags.fixtures.filter(f=>f.tagsByMask.some(t=>JSON.stringify(t)!==JSON.stringify(f.tagsByMask[0]))).length>100);
assert.equal(restrictions.fixtures.length,40);
for(const f of restrictions.fixtures) {
  const item={itemType:3,def:{},info:{rarity:1,socketCraftBlocked:f.resolved}};
  assert.equal(validateAddSocketsTarget(item,0).ok,f.allowed,JSON.stringify(f));
}
const absent=restrictions.fixtures.find(f=>!f.present&&f.fallback===null);
assert.equal(absent.resolved,-1);assert.equal(absent.allowed,true);
console.log('PASS 6848 native player-context queries: Face pool remains 39 skills; 40 native socket restriction/default cases.');
