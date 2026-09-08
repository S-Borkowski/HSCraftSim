import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyRecipe} from '../engine/mechanics.js';
import {outcomeProbabilities} from '../engine/validation.js';

const fixtures=JSON.parse(fs.readFileSync(new URL('./current_craft_cases_native.json',import.meta.url),'utf8')).fixtures;
assert.equal(fixtures.length,3119);
const frequencies=new Map();
for(const f of fixtures) {
  const target={itemType:f.itemType,info:{rarity:f.rarity},def:{a:123456,p:0,q:0,r:0,...f.definition}};
  // Orb/Codex entry handling is separate; these are native mutation fields only.
  const pending=f.draws.map(d=>[...d]);
  const rng={irandom:upper=>{
    assert.ok(pending.length,`${f.mechanic}: simulator requested an extra random draw`);
    const [nativeUpper,value]=pending.shift();assert.equal(upper,nativeUpper,f.mechanic);return value;
  }};
  const result=applyRecipe({mechanic:f.mechanic},target,rng);
  assert.equal(pending.length,0,`${f.mechanic}: simulator skipped a native random draw`);
  assert.deepEqual(result.edit,f.edits,JSON.stringify(f));
  if(f.mechanic==='gypsys_prophecy'&&f.definition.p===3) {
    frequencies.set(result.outcome,(frequencies.get(result.outcome)||0)+1);
    assert.deepEqual(applyRecipe({mechanic:'destiny_shard'},target,{irandom:()=>f.rolls[0]}).edit,f.edits);
  }
}
assert.deepEqual(Object.fromEntries(frequencies),{corrupted:8,level_down:22,level_up:70});
assert.deepEqual(outcomeProbabilities({mechanic:'gypsys_prophecy'}),{level_up:.70,level_down:.22,corrupted:.08});
console.log(`PASS ${fixtures.length} native crafting mutations and exact RNG consumption; every Dice, Crystal and star threshold covered.`);
