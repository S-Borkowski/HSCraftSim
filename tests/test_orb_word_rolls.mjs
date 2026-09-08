import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim,UniformRng} from '../engine/index.js';
import {CODEX_WORDS,codexStats,configureCodex,applyCodexRecipe,codexWord} from '../engine/codex.js';
import {packItem,unpackItem} from '../engine/session.js';
import {captureItem} from '../engine/history.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const native=read('tests/current_orb_words_native.json');
assert.equal(native.buildSha256,'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4');
const sim=new Sim({recipes:read('data/recipes.json'),catalog:read('data/items_catalog.json'),statNames:read('data/stat_names.json'),pools:read('data/stat_pools.json'),profiles:read('data/item_profiles.json')});
for(const f of native.fixtures) {
  const word=CODEX_WORDS.find(w=>w.rw===f.word),rule=native.rules[f.word];
  assert.deepEqual([word.min,word.max],rule.range);
  for(const base of [18,23]) {
    let item=configureCodex(sim,sim.makeItem(11,base,{a:987654321,...(f.seed==null?{}:{i:f.seed})}),{sockets:word.orbs.length});
    const def={...item.def};word.orbs.forEach((b,i)=>{def[`s${i+1}`]=btoa(JSON.stringify({a:1,b,c:0,j:0}));});
    item=sim.makeItem(11,base,def);
    assert.equal(codexStats(item).stats.find(s=>s.name===word.effect).value,f.values[rule.key],`${word.name}, i=${f.seed}, base=${base}`);
  }
  // Native bonus stage preserves each existing Orb stat without rerolling it.
  for(const [key,value] of Object.entries(f.initial))assert.equal(f.values[key],value);
}
const word=CODEX_WORDS.find(w=>w.rw===93),recipe=sim.recipes.find(r=>r.mechanic==='codex_word'&&r.name===word.name);
const base=configureCodex(sim,sim.makeItem(11,23,{a:123456}),{sockets:word.orbs.length,zone:'Act_03_03',entries:17});
const nativeSeeds=read('tests/current_socket_word_seed_native.json');
for(const f of nativeSeeds) {
  let calls=0;
  const edit=applyCodexRecipe({recipe:{mechanic:'codex_orb',orb:word.orbs[0]},target:base,config:sim.config,rng:{irandom:upper=>{assert.equal(upper,1e9);calls++;return f.roll;}}}).edit;
  assert.equal(edit.i,f.definition.i);assert.equal(calls,1);
  assert.equal(f.definition.a,123456);assert.equal(f.definition.u,3);assert.equal(f.definition.v,5);
}
const samples=new Set();
for(let seed=1;seed<=40;seed++) {
  const fullRng=new UniformRng(seed),singleRng=new UniformRng(seed);
  const shortcut=applyCodexRecipe({recipe,target:base,rng:fullRng,config:sim.config});
  let item=base;
  const versions=[];
  for(const orb of word.orbs) {
    const edit=applyCodexRecipe({recipe:{mechanic:'codex_orb',orb},target:item,rng:singleRng,config:sim.config}).edit;
    item=sim.makeItem(11,23,{...item.def,...edit});versions.push(captureItem(sim,item));
  }
  assert.equal(item.def.i,shortcut.edit.i,'Shortcut and individual insertions consume the same seed draws');
  assert.equal(item.def.a,base.def.a,'Socket insertion preserves the item generation seed');
  assert.equal(item.def.simCodex.zone,base.def.simCodex.zone);
  assert.equal(item.def.simCodex.entries,17);
  const frozen=JSON.stringify(versions);
  const combined=sim.makeItem(11,23,{...base.def,...shortcut.edit});
  assert.deepEqual(sim.stats(combined),sim.stats(item));
  assert.equal(codexWord(combined).name,word.name);
  assert.deepEqual(sim.stats(unpackItem(sim,packItem(item))),sim.stats(item));
  const bonus=sim.stats(item).stats.find(s=>s.name===word.effect);samples.add(bonus.value);
  const changedBase=sim.makeItem(11,23,{...item.def,a:1});
  assert.equal(sim.stats(changedBase).stats.find(s=>s.name===word.effect).value,bonus.value,'Orb-word roll depends on i, not a');
  applyCodexRecipe({recipe,target:base,rng:fullRng,config:sim.config});
  assert.equal(JSON.stringify(versions),frozen);
  assert.equal(versions.length,3);
}
assert.ok(samples.size>=8,'Successive insertions produce varied word bonuses');
console.log(`PASS ${native.fixtures.length} native Orb-word bonus stages on both Codex bases, ${nativeSeeds.length} native socket seed writes, complete/individual insertion equivalence, independent seeds and history.`);
