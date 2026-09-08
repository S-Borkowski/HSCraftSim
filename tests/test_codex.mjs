import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sim } from '../engine/index.js';
import { CODEX_WORDS, CODEX_ZONES, configureCodex, codexOrbs, codexWord, codexState, isCodex } from '../engine/codex.js';
import { validateCraft } from '../engine/validation.js';
import { transmuteInCube, packItem, unpackItem, canStackItems } from '../engine/session.js';
import { captureItem, retainVersion, itemVersions, compareStats } from '../engine/history.js';
import { itemTooltipHtml } from '../ui/item-tooltip.js';
import { codexRecipeHtml, codexInspectorHtml } from '../ui/codex-workshop.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),profiles:read('item_profiles.json')});
const base=(count,id=23)=>configureCodex(sim,sim.makeItem(11,id,{a:123456}),{sockets:count,zone:'Act_03_03',entries:17});
const stack=item=>({id:'codex',item,amount:1,x:0,y:0});
const ingredients=recipe=>recipe.ingredients.slice(1).map((i,n)=>({id:'mat-'+n,item:sim.makeItem(i.itemType,Array.isArray(i.itemId)?i.itemId[0]:i.itemId),amount:i.amount,x:2+n%2,y:Math.floor(n/2)}));
const craft=(recipe,item)=>transmuteInCube(sim,recipe,[stack(item),...ingredients(recipe)],42);

assert.equal(CODEX_WORDS.length,7);assert.equal(CODEX_ZONES.length,45);
assert.equal(sim.recipes.filter(r=>r.mechanic==='codex_word'||r.mechanic==='codex_orb').length,25);
for(const word of CODEX_WORDS)for(const type of [18,23]) {
  const recipe=sim.recipes.find(r=>r.name===word.name&&r.mechanic==='codex_word'),before=base(word.orbs.length,type);
  const frozen=JSON.stringify(before),tx=craft(recipe,before),after=tx.after;
  assert.equal(JSON.stringify(before),frozen);assert.equal(after.name,word.name);
  assert.deepEqual(codexOrbs(after),word.orbs);assert.equal(codexState(after).zone,'Act_03_03');assert.equal(codexState(after).entries,17);
  assert.equal(tx.stacks.length,1);assert.equal(tx.cost.reduce((n,c)=>n+c.amount,0),word.orbs.length);assert.equal(tx.stacks[0].id,'codex');
  assert.deepEqual(packItem(unpackItem(sim,packItem(after))),packItem(after));assert.equal(unpackItem(sim,packItem(after)).name,word.name);
  const stats=sim.stats(after).stats;assert.ok(stats.some(s=>s.name===word.effect));
  assert.ok(!validateCraft(recipe,[stack(after),...ingredients(recipe)]).ok);
  assert.match(codexRecipeHtml(sim,recipe),/Orb insertion order/);
}
console.log('PASS Seven Orb words on both Codex bases: exact order, duplicate material cost, named results, unchanged zone and persistence.');

const word=CODEX_WORDS.find(w=>w.rw===93);let item=base(3),s=stack(item),journal=[];
for(let i=0;i<3;i++) {
  const recipe=sim.recipes.find(r=>r.mechanic==='codex_orb'&&r.orb===word.orbs[i]);
  const before=captureItem(sim,item),tx=transmuteInCube(sim,recipe,[s,...ingredients(recipe)],i+1);item=tx.after;s=tx.stacks[0];
  const entry={number:i+1,lineage:s.id,recipeName:recipe.name,beforeSnapshot:before,afterSnapshot:captureItem(sim,item)};
  journal.unshift(entry);retainVersion(s,entry);
  assert.equal(codexOrbs(item).filter(Boolean).length,i+1);
}
assert.equal(item.name,word.name);assert.equal(s.versions.length,3);assert.equal(itemVersions(journal[0],[s],journal).length,3);
assert.equal(journal[2].afterSnapshot.sockets.contents.filter(Boolean).length,1);
assert.equal(journal[0].afterSnapshot.sockets.contents.filter(Boolean).length,3);
assert.ok(compareStats(journal[2].afterSnapshot,journal[0].afterSnapshot).some(s=>s.changed));
assert.match(itemTooltipHtml(sim,item),/Mos&#39;Arathim Desert/);assert.match(itemTooltipHtml(sim,item),/Attack Damage/);
assert.doesNotMatch(itemTooltipHtml(sim,item),/Unresolved property|Stat #|undefined|NaN/);
assert.match(codexInspectorHtml(sim,item),/Starting scenario/);
console.log('PASS Individual socket insertions create three detached before/after versions with named zone and bonus changes.');

const recipe=sim.recipes.find(r=>r.mechanic==='codex_word'&&r.orbs.length===3);
for(const invalid of [base(0),base(4),sim.makeItem(0,0),item])assert.throws(()=>craft(recipe,invalid));
const missing=[stack(base(3)),...ingredients(recipe).slice(0,2)],before=JSON.stringify(missing);
assert.throws(()=>transmuteInCube(sim,recipe,missing,1));assert.equal(JSON.stringify(missing),before);
assert.equal(canStackItems(base(3),base(3)),false);
assert.throws(()=>configureCodex(sim,item,{sockets:7}));assert.throws(()=>configureCodex(sim,item,{zone:'fake-zone'}));
const wrong=base(3);word.orbs.toReversed().forEach((b,i)=>wrong.def[`s${i+1}`]=btoa(JSON.stringify({a:1,b,c:0,j:0})));assert.equal(codexWord(wrong),null);
const doubled=[{...stack(base(3)),amount:2},...ingredients(recipe)];assert.equal(validateCraft(recipe,doubled).ok,false);
console.log('PASS Wrong counts, filled sockets, wrong order, missing Orbs, invalid setup and stacked targets are guarded without material loss.');

const empty=sim.recipes.find(r=>r.mechanic==='empty_sockets');item=craft(empty,item).after;
assert.equal(codexWord(item),null);assert.equal(codexOrbs(item).filter(Boolean).length,0);assert.equal(codexState(item).sockets,3);
const mallet=sim.recipes.find(r=>r.mechanic==='delete_sockets');item=craft(mallet,item).after;assert.equal(codexState(item).sockets,0);
const add=sim.recipes.find(r=>r.mechanic==='add_sockets');item=craft(add,item).after;assert.ok(codexState(item).sockets>=1);assert.throws(()=>craft(add,item));
for(const [page,result] of [[61,18],[69,23]]){
  const merge=sim.recipes.find(r=>r.mechanic==='create'&&r.ingredients.length===1&&r.ingredients[0].itemType===14&&r.ingredients[0].itemId===page);
  const tx=transmuteInCube(sim,merge,[{id:'pages',item:sim.makeItem(14,page),amount:5,x:0,y:0}],3);
  assert.equal(tx.stacks.length,1);assert.equal(tx.created[0].itemId,result);assert.ok(isCodex(tx.created[0]));assert.ok(CODEX_ZONES.some(z=>z.id===codexState(tx.created[0]).zone));
}
const doom=sim.stats(sim.makeItem(15,127)).stats[0];assert.equal(doom.value,1);assert.equal(doom.name,'Legion respawn chance');assert.equal(doom.unit,'%');
const brute=sim.stats(sim.makeItem(15,120)).stats[0];assert.equal(brute.value,20);assert.equal(brute.name,'Attack Damage');
console.log('PASS Empty/reset/add socket cycle, both page merges and current named Orb values.');
