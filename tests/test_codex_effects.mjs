import assert from 'node:assert/strict';
import fs from 'node:fs';
import { codexModifiers, codexSocketCount } from '../engine/codex_effects.js';
const fixtures=JSON.parse(fs.readFileSync(new URL('./current_codex_modifiers_native.json',import.meta.url),'utf8'));
for(const {def,stats} of fixtures.rows){
  const generated=codexModifiers(def,true,{isolated:true});
  const expected=[['buffs',376,377,'codex-native'],['buffs',380,381,'codex-essence'],['debuffs',378,379,'codex-native'],['debuffs',382,383,'codex-essence']]
    .filter(([,key])=>stats[key]>0).map(([kind,key,value,source])=>({kind,id:stats[key],value:stats[value],source}));
  assert.deepEqual(generated.map(({kind,id,value,source})=>({kind,id,value,source})),expected,JSON.stringify(def));
}
assert.deepEqual(codexModifiers({a:123456,u:1,v:2},false),[]);
console.log(`PASS ${fixtures.rows.length} current native Codex effect combinations, duplicate avoidance and Eternity exclusion.`);
const sockets=JSON.parse(fs.readFileSync(new URL('./current_codex_sockets_native.json',import.meta.url),'utf8'));
for(const fixture of sockets)assert.equal(codexSocketCount(fixture.def,fixture.infernal,{isolated:true}),fixture.count,JSON.stringify(fixture));
console.log(`PASS ${sockets.length} native Codex socket cases: natural draws, socket seeds, fixed counts, Crystal cap and explicit zero.`);
