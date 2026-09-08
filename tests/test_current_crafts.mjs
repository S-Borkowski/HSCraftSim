import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim,UniformRng,applyRecipe} from '../engine/index.js';
import {CRAFT_RULES} from '../engine/craft_rules.js';
import {validateCraft} from '../engine/validation.js';
import {codexModifiers} from '../engine/codex_effects.js';
import {uniqueCraftCandidates} from '../engine/mechanics.js';
const read=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),profiles:read('item_profiles.json')});
const recipe=m=>sim.recipes.find(r=>r.mechanic===m);
const inputs=(r,target)=>r.ingredients.map(i=>({item:i.itemId==null?target:sim.makeItem(i.itemType,Array.isArray(i.itemId)?i.itemId[0]:i.itemId,{}, {isUnique:i.isUnique}),amount:i.amount}));
// Native cases 14–16 reject info40; ordinary Unique selects a tier before an item.
assert.equal(CRAFT_RULES.uniqueCraftExcluded.length,137);
assert.deepEqual(CRAFT_RULES.uniqueCraftByTier.map(p=>p.length),[48,61,79,152,218,203]);
assert.equal(CRAFT_RULES.angelicCraft.length,31);
assert.equal(CRAFT_RULES.unholyCraft.length,17);
for(const [mechanic,rarity] of [['random_unique',null],['random_angelic',7],['random_unholy',10]]) {
  for(const tier of rarity===null?[0,1,2,3,4,5]:[5]) {
  const candidates=uniqueCraftCandidates(sim.uniquePool,rarity,tier);
  assert.ok(candidates.length>0,mechanic);
  assert.equal(candidates.length,rarity===null?CRAFT_RULES.uniqueCraftByTier[tier].length:rarity===7?31:17);
  for(let index=0;index<candidates.length;index++) {
    const draws=rarity===null?[[5,tier],[candidates.length-1,index]]:[[candidates.length-1,index]];
    const [created]=applyRecipe(recipe(mechanic),null,{irandom:n=>{const [upper,value]=draws.shift();assert.equal(n,upper);return value;}},{uniquePool:sim.uniquePool}).create;
    assert.equal(draws.length,0);
    const row=sim.catalog.find(created.itemType,created.itemId,true,created.subtype);
    assert.ok(row,`${mechanic}: unresolved output`);
    assert.equal(row.id,candidates[index].id);
    assert.equal(sim.makeItem(row.cls,row.b,{c:1,j:row.sub}).info.tier,tier);
    assert.ok(!CRAFT_RULES.uniqueCraftExcluded.includes(`${row.cls}:${row.sub??0}:${row.b}`));
    if(rarity===null)assert.ok(!['Angelic','Unholy'].includes(row.rar));
    else assert.equal(row.rar,rarity===7?'Angelic':'Unholy');
  }
  assert.strictEqual(uniqueCraftCandidates(sim.uniquePool,rarity,tier),candidates);
  }
}
const tierRng=new UniformRng(34931),tierCounts=Array(6).fill(0);
for(let i=0;i<60000;i++) {
  const [created]=applyRecipe(recipe('random_unique'),null,tierRng,{uniquePool:sim.uniquePool}).create;
  tierCounts[sim.makeItem(created.itemType,created.itemId,{c:1,j:created.subtype}).info.tier]++;
}
assert.ok(tierCounts.every(count=>Math.abs(count-10000)<400),String(tierCounts));
// Sword #0 and Axe #0 are different outcomes. Analysis must preserve subtype.
const uniqueRecipe=recipe('random_unique');
const distribution=sim.monteCarlo(uniqueRecipe,inputs(uniqueRecipe),100000,472981);
assert.equal(Object.keys(distribution).length,761);
assert.ok(Math.abs(Object.values(distribution).reduce((sum,p)=>sum+p,0)-1)<1e-12);
for(const key of Object.keys(distribution)) {
  const [,cls,b,unique,sub]=key.split(':');
  assert.ok(sim.catalog.find(+cls,+b,unique==='1',+sub),key);
}
// Exclusions apply even when every available candidate is in the requested rarity.
const blocked=sim.uniquePool.filter(r=>CRAFT_RULES.uniqueCraftExcluded.includes(`${r.cls}:${r.sub??0}:${r.b}`));
assert.ok(blocked.length>100);
assert.throws(()=>applyRecipe(recipe('random_unique'),null,{irandom:()=>0},{uniquePool:blocked}),/No eligible items/);
for(const [mechanic,count] of [['random_dungeon_keys',25],['random_relic_unique',9]]) {
  const r=recipe(mechanic),stacks=inputs(r),seen=new Set();
  for(let branch=0;branch<count;branch++) {
    let draw=0;const out=sim.craft(r,stacks,{irandom:n=>draw++===0?branch:123456});
    assert.equal(out.items.length,1);const item=out.items[0];assert.ok(item.row&&!item.placeholder);assert.ok(fs.existsSync(new URL(`../data/icons/${item.row.spr}.png`,import.meta.url)));
    assert.equal(item.amount,mechanic==='random_dungeon_keys'?12:1);seen.add(item.row.id);
  }
  assert.equal(seen.size,count);
}
const upgrade=recipe('upgrade_codex');let codex=sim.makeItem(11,23,{a:123456,p:1,u:2,v:3,simCodex:{zone:'Act_03_03',entries:17,sockets:2}});
for(let tier=2;tier<=20;tier++) {
  const before=structuredClone(codex.def),out=sim.craft(upgrade,inputs(upgrade,codex),new UniformRng(tier));codex=out.target;
  assert.deepEqual(codex.def,{...before,p:tier});assert.equal(sim.stats(codex).stats.find(s=>s.name==='Codex tier').value,tier);
}
assert.equal(validateCraft(upgrade,inputs(upgrade,codex)).ok,false);
assert.equal(validateCraft(upgrade,inputs(upgrade,sim.makeItem(11,18))).ok,false);
const rune=recipe('random_rune');
for(const [draws,expected] of [[[0],1],[[32],33],[[33,5,0],1],[[36,99,32],33],[[33,4,0],200],[[36,0,3],203]]) {
  const queue=[...draws];assert.equal(applyRecipe(rune,null,{irandom:n=>{const v=queue.shift();assert.ok(v<=n);return v;}}).create[0].itemId,expected);assert.equal(queue.length,0);
}
const rng=new UniformRng(5821);let special=0;
for(let i=0;i<100000;i++)if(applyRecipe(rune,null,rng).create[0].itemId>=200)special++;
assert.ok(Math.abs(special/100000-(4/37*.05))<.001);
for(let a=1;a<=100;a++) {
  const target=sim.makeItem(11,23,{a}),natural=codexModifiers(target.def).filter(e=>e.source==='codex-native');
  const out=sim.craft(recipe('essence_of_chaos'),inputs(recipe('essence_of_chaos'),target),new UniformRng(a));
  assert.notEqual(out.target.def.u,natural.find(e=>e.kind==='buffs')?.id||0);
  assert.notEqual(out.target.def.v,natural.find(e=>e.kind==='debuffs')?.id||0);
  assert.equal(validateCraft(recipe('essence_of_chaos'),inputs(recipe('essence_of_chaos'),out.target)).ok,false);
}
assert.equal(CRAFT_RULES.maximumCodexTier,20);
for(const id of [18,23])for(let seed=1;seed<=75;seed++) {
  const base=sim.makeItem(11,id,{a:seed,u:id===23?1:undefined,v:id===23?2:undefined});
  const target=sim.makeItem(11,id,{...base.def,q:1,ab:seed});
  const generated=sim.stats(target),affix=generated.stats.find(s=>s.source==='crystal');
  assert.equal(generated.crystalResolved,true);
  assert.equal(affix.crystal.group,5);
  assert.ok(affix.name&&!affix.name.match(/Stat #|undefined/));
  assert.ok(Number.isFinite(affix.value));
  assert.equal(validateCraft(recipe('satanic_crystal'),inputs(recipe('satanic_crystal'),target)).ok,false);
  const cleared=sim.craft(recipe('remove_satanic_crystal'),inputs(recipe('remove_satanic_crystal'),target),new UniformRng(seed)).target;
  assert.deepEqual(sim.stats(cleared).stats,sim.stats(base).stats);
}
console.log('PASS all 25 key and 9 relic results, Codex tiers 1–20, Rune branch boundaries/distribution and 100 Essence crafts.');
