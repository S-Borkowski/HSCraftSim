import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MECHANICS,DEFAULT_CONFIG} from '../engine/mechanics.js';
import {Sim} from '../engine/index.js';
import {validateCraft,outcomeProbabilities} from '../engine/validation.js';
import {VAULT_TIERS,VAULT_PROBABILITIES,vaultOutcomeName} from '../engine/vaults.js';
import {itemTooltipHtml} from '../ui/item-tooltip.js';
import {itemRarityName} from '../engine/items.js';
import {percentLabel} from '../ui/probability-format.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const native=read('./current_vault_craft_native.json');
assert.equal(native.buildSha256,'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4');
assert.equal(native.fixtures.length,3060);
for(const f of native.fixtures) {
  const pending=[...f.rolls],bounds=[];
  const rng={irandom(max){bounds.push(max);assert.ok(pending.length);return pending.shift();}};
  const result=MECHANICS.random_essence_vault({rng,config:DEFAULT_CONFIG});
  assert.equal(pending.length,0);
  assert.deepEqual(bounds,f.draws.map(d=>d[0]==='choose'?d[1].length-1:d[1]));
  assert.deepEqual(result.create,[{itemType:f.selection[0],itemId:f.selection[2],isUnique:false,amount:1}]);
  assert.equal(f.context.some(c=>c[0]==='AwardTitle'),!f.title);
  assert.equal(f.context.some(c=>c[0]==='update_quest'),f.quest===1);
}
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),
  pools:read('../data/stat_pools.json'),statNames:read('../data/stat_names.json'),profiles:read('../data/item_profiles.json')});
const recipe=sim.recipes.find(r=>r.mechanic==='random_essence_vault');
const metadata=read('../research/current/vault-metadata-native.json');
assert.equal(metadata.rows.length,7);
assert.equal(metadata.buildSha256,native.buildSha256);
assert.deepEqual(Object.values(outcomeProbabilities(recipe)),VAULT_PROBABILITIES);
assert.equal(percentLabel(.0006),'0.06%');
assert.equal(percentLabel(.0108),'1.08%');
assert.equal(percentLabel(.3),'30%');
const stacks=recipe.ingredients.map((i,n)=>({id:String(n),amount:i.amount,item:sim.makeItem(i.itemType,i.itemId)}));
assert.equal(validateCraft(recipe,stacks).ok,true);
assert.equal(validateCraft(recipe,stacks).warning,undefined);
for(let tier=0;tier<7;tier++) {
  const rolls=tier<5?[...Array(tier).fill(0),99,123456]:[0,0,0,0,0,tier-5,123456];
  const out=sim.craft(recipe,stacks,{irandom(){assert.ok(rolls.length);return rolls.shift();}});
  assert.equal(rolls.length,0);assert.equal(out.items.length,1);
  assert.equal(out.items[0].itemId,tier);assert.equal(out.items[0].placeholder,undefined);
  const item=out.items[0],fields=Object.fromEntries(metadata.rows.find(r=>r.b===tier).calls.map(c=>c[1]));
  assert.equal(item.info.tier,fields[32]);
  assert.equal(item.info.width,fields[2]);assert.equal(item.info.height,fields[3]);
  assert.equal(itemRarityName(item),VAULT_TIERS[tier]);
  assert.equal(vaultOutcomeName(item.row),`${VAULT_TIERS[tier]} Essence Vault`);
  assert.ok(itemTooltipHtml(sim,item).includes(`${VAULT_TIERS[tier]} Vault`));
}
const before=JSON.stringify(stacks);
const tally=sim.monteCarlo(recipe,stacks,100000,123456);
const rates=[.5,.3,.14,.048,.0108,.0006,.0006];
for(let tier=0;tier<7;tier++)assert.ok(Math.abs((tally[`item:19:${tier}:0`]??0)-rates[tier])<Math.max(.0003,6*Math.sqrt(rates[tier]*(1-rates[tier])/100000)),`Vault ${tier} distribution`);
assert.equal(JSON.stringify(stacks),before);
console.log('PASS 3060 native Vault branches and quest/title contexts, seven real results and 100,000 distribution trials.');
