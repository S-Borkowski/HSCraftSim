import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {activeRuneword,applyRunewordRecipe,RUNEWORDS} from '../engine/runewords.js';
import {codexWord} from '../engine/codex.js';
import {Cpr} from '../engine/cpr.js';
import {configureItem} from '../engine/item_setup.js';
import {catalogTarget} from '../engine/catalog_target.js';
import {validateTarget} from '../engine/validation.js';

const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const fixtures=read('./current_word_matching_native.json');
assert.equal(fixtures.buildSha256,'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4');
assert.equal(fixtures.fixtures.length,3496);
let codexCases=0,equipmentCases=0;
for(const f of fixtures.fixtures) {
  const def={...f.definition};
  for(let i=1;i<=7;i++)if(def['s'+i])def['s'+i]=btoa(JSON.stringify(def['s'+i]));
  let result=0;
  if(f.item_type===11) {
    // The native fixture supplies GetItemStat(20) after Codex generation;
    // a setup count with q removed represents precisely that same boundary.
    if(f.rarity!==1)continue; // The app does not create non-white Codices.
    delete def.q;
    def.simCodex={socketSource:'setup',baseSockets:f.sockets};
    result=codexWord({itemType:11,itemId:23,isUnique:false,def})?.rw??0;
    codexCases++;
  } else {
    result=activeRuneword({itemType:f.item_type,row:{kind:'normal'},isUnique:false,
      def,info:{rarity:f.rarity,handed:f.handed}},f.sockets)?.id??0;
    equipmentCases++;
  }
  assert.equal(result,f.result,`word ${f.sourceWord} ${f.case}`);
}
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),
  statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const white=sim.makeItem(3,14,{a:123456,c:0,j:1}),mythic=sim.makeItem(3,14,{a:57,c:0,j:1});
assert.equal(mythic.info.rarity,5);
const recipe=sim.recipes.find(r=>r.name==='Breath of the Damned');
const withRunes=(item)=>{
  const prepared=configureItem(sim,item,{sockets:6});
  const {edit}=applyRunewordRecipe({recipe,target:prepared,rng:new Cpr(42),config:sim.config});
  return sim.makeItem(3,14,{...prepared.def,...edit});
};
assert.equal(withRunes(white).info.runeword.id,recipe.wordId);
assert.equal(withRunes(mythic).info.runeword,undefined,'A matching sequence on Mythic equipment stays Mythic');
assert.match(validateTarget(recipe,configureItem(sim,mythic,{sockets:6})).reason,/white/);
const preset=catalogTarget(sim,recipe,recipe.ingredients[0],white.row,{seed:57});
assert.equal(preset.item.info.rarity,1);assert.notEqual(preset.item.def.a,57);
assert.ok(preset.notes.some(n=>n.includes('White base')));

// The shortcut must consume one seed per Rune, matching single insertions.
for(const word of RUNEWORDS) {
  const recipe={mechanic:'runeword',wordId:word.id},target={def:{}};
  const combined=applyRunewordRecipe({recipe,target,rng:new Cpr(548),config:sim.config}).edit;
  const rng=new Cpr(548);
  for(const rune of word.runes)Object.assign(target.def,applyRunewordRecipe({recipe:{mechanic:'socket_rune',rune},target,rng,config:sim.config}).edit);
  assert.deepEqual(combined,target.def,word.name+' shortcut uses the complete insertion stream');
}
console.log(`PASS ${equipmentCases} native equipment matches, ${codexCases} native Codex matches, white-base eligibility and 93 shortcut streams.`);
