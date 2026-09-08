import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sim, UniformRng, socketCount, applyRecipe } from '../engine/index.js';
import { parseStatRanges } from '../engine/items.js';
import { ingredientAccepts, matchRecipe } from '../engine/recipes.js';
import { validateCraft, outcomeProbabilities, UNSUPPORTED } from '../engine/validation.js';
import { transact, findPosition, canPlace, packItem, unpackItem } from '../engine/session.js';
import { setSocketContent } from '../engine/item_setup.js';
import { captureItem, retainVersion } from '../engine/history.js';

const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),attributes:read('translations/attributes.json'),profiles:read('item_profiles.json')});
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const recipe=m=>sim.recipes.find(r=>r.mechanic===m);
const unique=(c=0,b=0,sub=0,def={})=>sim.makeItem(c,b,{a:123456,c:1,j:sub,...def},{isUnique:true,tier:5});
const stack=(item,amount=1,id='x',x=0,y=0)=>({id,item,amount,x,y});
const material=(id,amount=1)=>stack(sim.makeItem(14,id),amount,'material'+id,2,0);

test('Weapon subtype is part of item identity',()=>{
 const rows=sim.catalog.rows.filter(r=>r.kind==='unique'&&r.cls===3&&r.b===0);
 assert.ok(rows.length>3);
 for(const row of rows){const item=sim.makeItem(3,0,{a:1,c:1,j:row.sub},{isUnique:true});assert.equal(item.name,row.name);assert.equal(unpackItem(sim,packItem(item)).row.id,row.id);}
});
test('Percent ranges and text values never become NaN',()=>{
 const ranges=parseStatRanges({stats:[['Damage','350-480%'],['Critical','15%'],['Identity','+'],['Negative','-10--5']]});
 assert.equal(ranges[0].max,480);assert.equal(ranges[0].unit,'%');assert.equal(ranges[1].min,15);assert.equal(ranges[2].text,'+');assert.equal(ranges[3].min,-10);
 for(const row of sim.catalog.rows.filter(r=>r.kind!=='runeword')){const item=sim.makeItem(row.cls,row.b,{a:42,j:row.sub,c:row.kind==='unique'?1:0},{row,isUnique:row.kind==='unique'});for(const s of sim.stats(item).stats)if(typeof s.value==='number')assert.ok(Number.isFinite(s.value),row.name);}
});
test('Crystal wildcard accepts unique equipment',()=>{
 const it=unique(),r=recipe('satanic_crystal');assert.ok(ingredientAccepts(r.ingredients[0],it));assert.ok(validateCraft(r,[stack(it),material(58)]).ok);
});
test('Current base draws supersede the old catalog perfect-seed profile',()=>{
 const native=JSON.parse(fs.readFileSync(new URL('./current_base_ranges_native.json',import.meta.url),'utf8'));
 const fixture=native.fixtures.find(f=>f.profile==='unique:0:0:0'&&f.seed===123456&&!f.stars&&!f.corrupted);
 const generated=sim.stats(unique(0,0,0,{a:fixture.seed}));
 assert.equal(generated.baseRangesVerified,true);
 for(const stat of generated.stats)if(stat.key!==20&&Object.hasOwn(fixture.values,stat.key))assert.equal(stat.value,fixture.values[stat.key],stat.name);
 assert.deepEqual(generated.trace.filter(e=>e.phase==='definition').map(e=>[0,e.upper,e.roll]),fixture.draws);
});
test('Crystal exact boundary outcomes and charm exception',()=>{
 const r=recipe('satanic_crystal'),it=unique();
 for(const [roll,outcome] of [[0,'socket'],[7,'socket'],[8,'affix'],[37,'affix'],[38,'corrupted'],[99,'corrupted']]){let n=0;assert.equal(applyRecipe(r,it,{irandom:()=>n++?roll:123}).outcome,outcome);}
 assert.deepEqual(outcomeProbabilities(r,unique(10,0)),{affix:.38,corrupted:.62});
});
test('Crystal transaction consumes only material and retains original input',()=>{
 const item=unique(),inputs=[stack(item),material(58,2)],original=JSON.stringify(inputs),tx=transact(sim,recipe('satanic_crystal'),inputs,5);
 assert.equal(JSON.stringify(inputs),original);assert.equal(tx.stacks.length,2);assert.equal(tx.stacks[1].amount,1);assert.equal(tx.stacks[0].item.def.r,1);assert.equal(tx.cost.length,1);assert.equal(tx.cost[0].amount,1);assert.equal(tx.after.row.id,item.row.id);
});
test('Corrupted item rejects repeat crafts without consuming materials',()=>{
 const it=unique(0,0,0,{r:1});assert.equal(validateCraft(recipe('satanic_dice'),[stack(it),material(43)]).ok,false);
 const inputs=[stack(it),material(43)],copy=JSON.stringify(inputs);assert.throws(()=>transact(sim,recipe('satanic_dice'),inputs,1));assert.equal(JSON.stringify(inputs),copy);
});
test('Dice corruption preserves the item roll and frozen history through persistence',()=>{
 const item=unique(),inputs=[stack(item),material(43,2)],before=captureItem(sim,item);
 const original=JSON.stringify(inputs),tx=transact(sim,recipe('satanic_dice'),inputs,1);
 assert.equal(JSON.stringify(inputs),original);
 assert.deepEqual(tx.after.def,{...item.def,r:1});
 assert.equal(tx.stacks[1].amount,1);assert.equal(tx.cost[0].amount,1);
 const after=captureItem(sim,tx.after),entry={number:1,lineage:'x',recipeName:'Satanic Dice',beforeSnapshot:before,afterSnapshot:after};
 retainVersion(tx.stacks[0],entry);
 const stored=JSON.parse(JSON.stringify({...tx.stacks[0],item:packItem(tx.after)}));
 assert.deepEqual(stored.versions[0].beforeSnapshot,before);assert.deepEqual(stored.versions[0].afterSnapshot,after);
 assert.equal(unpackItem(sim,stored.item).def.a,123456);assert.equal(before.corrupted,false);assert.equal(after.corrupted,true);
 assert.notDeepEqual(before.stats,after.stats,'Corruption changes stats even when its seed stays unchanged');
 const frozen=JSON.stringify(stored.versions);tx.after.def.a=777;
 assert.equal(JSON.stringify(stored.versions),frozen);
});
test('Prophet cleanse resets corruption and consumes Wisdom',()=>{
 const tx=transact(sim,recipe('cleanse_prophet'),[stack(unique(0,0,0,{r:1})),material(62)],5);assert.equal(tx.after.def.r,0);assert.equal(tx.stacks.length,1);
});
test('Cleanse and crystal validation reject no-op crafts',()=>{
 assert.equal(validateCraft(recipe('cleanse_prophet'),[stack(unique()),material(62)]).ok,false);
 assert.equal(validateCraft(recipe('satanic_crystal'),[stack(unique(0,0,0,{q:1})),material(58)]).ok,false);
});
test('Rune merge consumes 3 Ol and produces exactly one Old',()=>{
 const r=sim.recipes.find(r=>r.result.itemType===15&&r.result.itemId===2),ol=sim.makeItem(15,1),inputs=[stack(ol,7)];
 const tx=transact(sim,r,inputs,9);assert.equal(tx.stacks[0].amount,4);assert.equal(tx.created.length,1);assert.equal(tx.created[0].name,'Old');assert.equal(tx.created[0].amount,1);
 const second=transact(sim,r,tx.stacks,10);assert.equal(second.stacks[0].amount,1);assert.throws(()=>transact(sim,r,second.stacks,11));
});
test('One stack can satisfy two separate ingredient entries',()=>{
 const ol=sim.makeItem(15,1),r={ingredients:[{itemType:15,itemId:1,isUnique:false,amount:2},{itemType:15,itemId:1,isUnique:false,amount:3}]};
 assert.ok(matchRecipe(r,[stack(ol,5)]).ok);assert.equal(matchRecipe(r,[stack(ol,4)]).ok,false);
});
test('Ingredients can span stacks without double consumption',()=>{
 const r=sim.recipes.find(r=>r.result.itemType===15&&r.result.itemId===2),ol=sim.makeItem(15,1);
 const tx=transact(sim,r,[stack(ol,1,'a'),stack(ol,3,'b',1,0)],1);assert.equal(tx.stacks.length,1);assert.equal(tx.stacks[0].amount,1);
});
test('Jewelcrafting level gate is enforced',()=>{
 const r=recipe('jewel_tier'),inputs=r.ingredients.map((ing,i)=>stack(sim.makeItem(ing.itemType,ing.itemId),ing.amount,''+i));
 assert.equal(validateCraft(r,inputs,{jewelLevel:0}).ok,false);assert.ok(validateCraft(r,inputs,{jewelLevel:3750}).ok);
});
test('Grid respects footprints, collisions and boundaries',()=>{
 const helmet=unique(),s=stack(helmet,1,'a');assert.deepEqual(findPosition([s],helmet),{x:2,y:0});assert.equal(canPlace([s],helmet,1,1),false);assert.equal(canPlace([],helmet,3,0),false);assert.equal(canPlace([s],helmet,0,0,4,4,'a'),true);
 const full=[stack(helmet,1,'a',0,0),stack(helmet,1,'b',2,0),stack(helmet,1,'c',0,2),stack(helmet,1,'d',2,2)];assert.equal(findPosition(full,helmet),null);
});
test('Previously missing result pools are now supported',()=>{
 assert.equal(Object.keys(UNSUPPORTED).length,0);
 for(const m of Object.keys(UNSUPPORTED))assert.equal(validateCraft(recipe(m),[]).unsupported,true);
});
test('Simulation rejects missing ingredients instead of reporting fabricated odds',()=>{
 assert.throws(()=>sim.monteCarlo(recipe('satanic_crystal'),[],1000,1));
 assert.throws(()=>sim.monteCarlo(recipe('satanic_crystal'),[stack(unique()),material(58)],0,1));
});
test('Normal socket override preserves weapon identity and requires known current count',()=>{
 const item=sim.makeItem(3,0,{a:123456,c:0,j:2});assert.ok(item.info.maxSockets>0);
 const r=recipe('add_sockets'),inputs=r.ingredients.map((ing,i)=>ing.itemId==null?stack(item):stack(sim.makeItem(ing.itemType,Array.isArray(ing.itemId)?ing.itemId[0]:ing.itemId),ing.amount,''+i));
 assert.equal(validateCraft(r,inputs).ok,false,'Unknown native socket count cannot be treated as zero');
 item.def.s=0;
 const tx=transact(sim,r,inputs,8);assert.equal(tx.after.def.j,2);assert.ok(socketCount(tx.after.def,tx.after.info.maxSockets)>0);
});

test('Sockets cannot be added twice; emptying keeps slots and deleting allows a new roll',()=>{
 const add=recipe('add_sockets'),empty=recipe('empty_sockets'),remove=recipe('delete_sockets');
 const inputs=(r,item)=>r.ingredients.map((ing,i)=>ing.itemId==null?stack(item):stack(sim.makeItem(ing.itemType,Array.isArray(ing.itemId)?ing.itemId[0]:ing.itemId),ing.amount,'ingredient-'+i));
 const base=sim.makeItem(3,0,{a:123456,c:0,j:2,s:0}),first=transact(sim,add,inputs(add,base),8).after;
 const blockedInputs=inputs(add,first),before=JSON.stringify(blockedInputs),blocked=validateCraft(add,blockedInputs);
 assert.equal(blocked.ok,false);assert.equal(blocked.targetInvalid,true);assert.equal(blocked.nextMechanic,'delete_sockets');
 assert.equal(validateCraft(add,[stack(first)]).reason,blocked.reason,'Item eligibility must be explained even before adding materials');
 assert.match(blocked.reason,/already has \d+ sockets?\. Add Sockets requires 0 sockets/);
 assert.throws(()=>transact(sim,add,blockedInputs,9),/requires 0 sockets/);
 assert.equal(JSON.stringify(blockedInputs),before,'Rejected repeat must not consume anything');
 const occupied=setSocketContent(sim,first,0,sim.catalog.find(15,1,false));
 const emptied=transact(sim,empty,inputs(empty,occupied),10).after;
 assert.equal(socketCount(emptied.def,emptied.info.maxSockets),socketCount(first.def,first.info.maxSockets));
 assert.equal(validateCraft(add,inputs(add,emptied)).ok,false);
 const cleared=transact(sim,remove,inputs(remove,emptied),11).after;
 assert.equal(socketCount(cleared.def,cleared.info.maxSockets),0);
 assert.equal(validateCraft(add,inputs(add,cleared)).ok,true);
 assert.ok(socketCount(transact(sim,add,inputs(add,cleared),12).after.def,cleared.info.maxSockets)>0);
});
test('Every direct recipe result and concrete ingredient resolves',()=>{
 for(const r of sim.recipes)for(const ing of [...r.ingredients,r.result])if(typeof ing.itemType==='number'&&typeof ing.itemId==='number')assert.ok(sim.catalog.find(ing.itemType,ing.itemId,ing.isUnique),`${r.name}: ${ing.itemType}#${ing.itemId}`);
});
console.log(`\n${passed} workshop tests passed.`);
