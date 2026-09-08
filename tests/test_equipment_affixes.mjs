import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {normalState} from '../engine/normal_state.js';
import {normalAffixes,rollNormalAffix} from '../engine/normal_affixes.js';
import {Cpr} from '../engine/cpr.js';
import {captureItem,compareStats} from '../engine/history.js';
import {transact,packItem,unpackItem} from '../engine/session.js';
import {itemTooltipHtml} from '../ui/item-tooltip.js';

const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const build='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4';
const full=read('./current_equipment_affixes_native.json'),modifiers=read('./current_equipment_modifiers_native.json'),complex=read('./current_complex_affixes_native.json'),emptyPools=read('./current_empty_affix_pools_native.json');
for(const source of [full,modifiers,complex,emptyPools])assert.equal(source.buildSha256,build);
assert.equal(emptyPools.fixtures.length,9);
assert.ok(emptyPools.fixtures.some(f=>f.trace.some(t=>t[0]==='draw'&&t[2]===-1)));
assert.equal(full.fixtures.length,1848);assert.equal(modifiers.fixtures.length,880);assert.equal(complex.fixtures.length,462);
assert.equal(new Set(full.fixtures.map(f=>f.profile)).size,308);
const nativeDraws=trace=>trace.filter(t=>['draw','choose','float'].includes(t[0])).map(t=>t[0]==='choose'?[1,t[2]]:t[0]==='float'?[0,0]:[t[2],t[3]]);
let values=0,superiors=0;
for(const f of [...full.fixtures,...modifiers.fixtures,...emptyPools.fixtures]) {
  const cls=+f.profile.split(':')[1],item=sim.makeItem(cls,f.definition.b,f.definition),state=normalState(item),g=normalAffixes(item,state);
  const label=`${f.profile} ${JSON.stringify(f.definition)}`;
  const expected=Object.fromEntries(Object.entries(f.values).filter(([k])=>+k>20||+k<10));
  assert.deepEqual(Object.fromEntries(g.stats.map(s=>[s.key,s.value])),expected,label+' complete properties');
  assert.deepEqual(g.trace.map(t=>[t.upper,t.roll]),nativeDraws(f.trace).slice(0,g.trace.length),label+' random stream');
  assert.deepEqual(g.affixes.map(a=>[a.side,a.id]),f.trace.filter(t=>t[0].startsWith('gml_Script_Return')&&t[1][2]>0).map(t=>[t[0].includes('Prefix')?'prefix':'suffix',t[1][2]]),label+' affix identities');
  assert.equal(item.info.rarity,f.rarity);assert.equal(item.info.requiredLevel,f.requiredLevel);assert.equal(sim.sockets(item).count,f.values[20]??0,label+' sockets');
  const visible=sim.stats(item);assert.equal(visible.normalAffixesResolved,true);assert.equal(visible.modifiersResolved,true);
  for(const [key,value] of Object.entries(expected))if(![1,2,24,108,110,295,447].includes(+key))assert.equal(visible.stats.find(s=>s.key===+key)?.value,value,label+' displayed value '+key);
  values+=Object.keys(expected).length;superiors+=state.superiorPrefix!=null?1:0;
}
assert.ok(superiors>50,'Coverage includes superior values and subsequent affixes');
for(const f of complex.fixtures) {
  const rng=new Cpr(f.definition.a),stats=new Map(Object.entries(f.existing).map(([key,value])=>[+key,{key:+key,value}])),trace=[];
  rollNormalAffix({def:f.definition,info:{tier:f.tier}},f.side,f.id,stats,upper=>{const roll=rng.irandom(upper);trace.push([upper,roll]);return roll;});
  const expected=Object.fromEntries(Object.entries(f.values).filter(([k])=>+k>=20)),label=`${f.side}:${f.id} ${JSON.stringify(f.definition)} prior ${JSON.stringify(f.existing)}`;
  assert.deepEqual(Object.fromEntries([...stats].map(([key,s])=>[key,s.value])),expected,label);
  assert.deepEqual(trace,nativeDraws(f.trace),label+' RNG');
}
// Real Toolkit transactions on weapons and armor retain every prior version.
const recipe=sim.recipes.find(r=>r.mechanic==='reroll_affixes');
for(const [cls,b,sub] of [[3,14,1],[1,4,0],[6,3,0]]) {
  let item=sim.makeItem(cls,b,{a:57,c:0,j:sub}),history=[];
  const first=captureItem(sim,item),frozen=JSON.stringify(first);
  for(let n=1;n<=10;n++) {
    const stacks=recipe.ingredients.map((i,k)=>({id:String(k),amount:i.amount,item:i.itemId==null?item:sim.makeItem(i.itemType,Array.isArray(i.itemId)?i.itemId[0]:i.itemId)}));
    const tx=transact(sim,recipe,stacks,n);history.push({before:captureItem(sim,item),after:captureItem(sim,tx.after)});item=tx.after;
  }
  assert.equal(history.length,10);assert.ok(history.every(h=>!h.after.unresolved));
  assert.ok(history.some(h=>compareStats(h.before,h.after).some(s=>s.changed)));
  assert.equal(JSON.stringify(first),frozen);assert.deepEqual(captureItem(sim,unpackItem(sim,packItem(item))).stats,history.at(-1).after.stats);
  assert.doesNotMatch(itemTooltipHtml(sim,item),/Affix values are not yet included|NaN|undefined/);
}
console.log(`PASS 2,737 full native equipment generations / ${values} properties / ${superiors} superior cases; 462 complex affix cases; weapon, armor and shield history.`);
