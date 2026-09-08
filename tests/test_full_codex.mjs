import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {codexState,CODEX_ZONES,configureCodex} from '../engine/codex.js';
import {codexGenerationState} from '../engine/codex_effects.js';
import {packItem,unpackItem} from '../engine/session.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const source=read('./current_full_codex_native.json');assert.equal(source.fixtures.length,170);
assert.equal(source.buildSha256,'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4');
assert.deepEqual(CODEX_ZONES.map(z=>z.id),source.zones.map(z=>z.id));
for(const f of source.fixtures) {
  const def=f.definition,item=sim.makeItem(11,def.b,def),state=codexState(item),g=codexGenerationState(def,def.b===23),label=JSON.stringify(def);
  assert.equal(state.zone,f.zone,label+' zone');assert.equal(state.entries,f.values[348],label+' entries');
  assert.equal(g.variant,f.values[375],label+' variant');assert.equal(g.packSize,f.values[349],label+' pack size');
  const expected=[['buffs',376,377,'codex-native'],['buffs',380,381,'codex-essence'],['debuffs',378,379,'codex-native'],['debuffs',382,383,'codex-essence']]
    .filter(([,k])=>f.values[k]>0).map(([kind,k,v,source])=>({kind,id:f.values[k],value:f.values[v],source}));
  assert.deepEqual(g.effects.map(({kind,id,value,source})=>({kind,id,value,source})),expected,label+' effects');
  assert.equal(state.sockets,f.values[20],label+' socket chain');assert.equal(sim.sockets(item).count,f.values[20]);
  assert.deepEqual(codexState(unpackItem(sim,packItem(item))),state,label+' reload');
}
const initial=sim.makeItem(11,23,{a:123456}),rerolled=sim.makeItem(11,23,{...initial.def,a:57}),fresh=sim.makeItem(11,23,{a:57});
assert.deepEqual(codexState(rerolled),codexState(fresh),'Native fields follow a changed seed');
const configured=configureCodex(sim,initial,{zone:'Act_01_01',entries:19,sockets:3});
const configuredReroll=sim.makeItem(11,23,{...configured.def,a:57});
assert.equal(codexState(configuredReroll).zone,'Act_01_01');assert.equal(codexState(configuredReroll).entries,19);
const legacy=sim.makeItem(11,23,{a:123456,simCodex:{zone:'Act_02_03',entries:17,zoneSource:'simulated',sockets:4}});
assert.equal(codexState(legacy).zone,'Act_02_03');assert.equal(codexState(legacy).entries,17);assert.equal(codexState(legacy).sockets,4);
assert.ok(sim.stats(legacy).warnings.some(w=>w.includes('saved Codex')));
console.log('PASS 170 full native Codex chains: 45 room identities, entries, buff/debuff values, both socket capacities, overrides, corruption and saved scenarios.');
