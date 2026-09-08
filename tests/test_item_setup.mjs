import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sim, applyRecipe } from '../engine/index.js';
import { configureItem, filterCatalog, isCorrupted, starLevel, socketContents, setSocketContent, rollNaturalSockets } from '../engine/item_setup.js';
import { packItem, unpackItem, transmuteInCube, findPosition } from '../engine/session.js';
import { validateCraft } from '../engine/validation.js';
import { itemTooltipHtml } from '../ui/item-tooltip.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),attributes:read('translations/attributes.json'),profiles:read('item_profiles.json')});
const make=name=>{const row=sim.catalog.rows.find(r=>r.name===name);return sim.makeItem(row.cls,row.b,{a:123456,c:row.kind==='unique'?1:0},{row});};
const recipe=m=>sim.recipes.find(r=>r.mechanic===m);
const armor=make("St. Jupe's Plate of Command"),gem=sim.catalog.find(15,78,false);
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};

test('Angelic rarity and multiword armor search expose both source chestplates',()=>{
  const names=["St. Jupe's Plate of Command","Tayrel's Chestplate"].sort();
  assert.deepEqual(filterCatalog(sim.catalog.rows,{rarity:'Angelic',type:'1'}).map(r=>r.name).sort(),names);
  assert.deepEqual(filterCatalog(sim.catalog.rows,{query:'angelic armor'}).map(r=>r.name).sort(),names);
  assert.equal(filterCatalog(sim.catalog.rows,{rarity:'Angelic'}).length,37);
  assert.equal(filterCatalog(sim.catalog.rows).length,1932);
  assert.ok(filterCatalog(sim.catalog.rows).every(r=>!/^\?\d/.test(r.name)));
  assert.equal(filterCatalog(sim.catalog.rows,{query:'angelic armour',rarity:'Satanic'}).length,0);
});
test('Setup copies items, keeps stars distinct from tier and survives session round trip',()=>{
  const before=JSON.stringify(packItem(armor));let item=configureItem(sim,armor,{stars:4,sockets:6});
  item=setSocketContent(sim,item,1,gem);
  assert.equal(JSON.stringify(packItem(armor)),before);assert.equal(item.info.tier,5);assert.equal(starLevel(item),4);
  const restored=unpackItem(sim,JSON.parse(JSON.stringify(packItem(item))));
  assert.equal(starLevel(restored),4);assert.equal(sim.sockets(restored).count,6);assert.equal(socketContents(sim,restored)[1].name,'Angelic Gem');
  assert.equal(JSON.parse(atob(restored.def.s2)).b,78);
});
test('Default equipment w=1 is not corruption; cleanse only clears r',()=>{
  const item=sim.makeItem(armor.itemType,armor.itemId,{...armor.def,w:1},{row:armor.row});assert.equal(isCorrupted(item),false);
  const bad=configureItem(sim,item,{stars:3,corrupted:true});assert.equal(starLevel(bad),0);assert.equal(isCorrupted(bad),true);
  const r=recipe('cleanse_angel'),stacks=[{id:'armor',item:bad,amount:1,x:0,y:0}];
  for(const i of r.ingredients)if(i.itemId!=null){const material=sim.makeItem(i.itemType,Array.isArray(i.itemId)?i.itemId[0]:i.itemId);stacks.push({id:'mat'+stacks.length,item:material,amount:i.amount,...findPosition(stacks,material,4,4)});}
  const tx=transmuteInCube(sim,r,stacks,1,{columns:4,rows:4});const out=tx.stacks.find(s=>s.id==='armor').item;
  assert.equal(out.def.w,1);assert.equal(isCorrupted(out),false);
  assert.equal(validateCraft(recipe('cleanse_prophet'),stacks).ok,false);
});
test('Star success adds one, downgrade subtracts one, corruption clears stars, max is gated',()=>{
  const r=recipe('gypsys_prophecy'),item=configureItem(sim,armor,{stars:3});
  assert.deepEqual(applyRecipe(r,item,{irandom:()=>30}).edit,{p:4});
  assert.deepEqual(applyRecipe(r,item,{irandom:()=>8}).edit,{p:2});
  assert.deepEqual(applyRecipe(r,item,{irandom:()=>0}).edit,{p:0,r:1});
  assert.equal(applyRecipe(r,configureItem(sim,armor,{stars:0}),{irandom:()=>8}).edit.p,0);
  const max=configureItem(sim,armor,{stars:5}),stacks=[{item:max,amount:1}];
  for(const i of r.ingredients)if(i.itemId!=null)stacks.push({item:sim.makeItem(i.itemType,i.itemId),amount:i.amount});
  assert.match(validateCraft(r,stacks).reason,/maximum 5 stars/);
});
test('Socket counts, contents, Crystal capacity and natural rerolls remain consistent',()=>{
  const normal=sim.makeItem(1,2,{a:123456,c:0});
  for(let n=0;n<=normal.info.maxSockets;n++)assert.equal(sim.sockets(configureItem(sim,normal,{sockets:n})).count,n);
  assert.deepEqual(armor.info.naturalSocketRange,[6,6]);
  assert.throws(()=>configureItem(sim,armor,{sockets:2}),/natural range/);
  assert.equal(sim.sockets(configureItem(sim,armor,{crystal:2})).count,6);
  assert.throws(()=>configureItem(sim,normal,{crystal:2}),/cannot receive a Crystal socket/);
  let item=configureItem(sim,make('The Dawn Bringer'),{sockets:4,crystal:2});assert.equal(sim.sockets(item).count,5);
  item=setSocketContent(sim,item,4,gem);assert.equal(socketContents(sim,item)[4].name,'Angelic Gem');
  item=configureItem(sim,item,{crystal:0});assert.equal(sim.sockets(item).count,4);assert.equal(item.def.s5,undefined);
  assert.throws(()=>configureItem(sim,armor,{sockets:7}));assert.throws(()=>setSocketContent(sim,item,4,gem));
  assert.throws(()=>setSocketContent(sim,item,0,sim.catalog.find(15,112,false)));
  const natural=rollNaturalSockets(sim,make("Tayrel's Chestplate"),6);assert.equal(sim.sockets(natural).count,6);assert.equal(Object.hasOwn(natural.def,'s'),false);assert.notEqual(natural.def.a,armor.def.a);
});
test('Empty Sockets consumes the recipe, removes real payloads and keeps the socket count',()=>{
  let item=configureItem(sim,armor,{sockets:6,stars:2});item=setSocketContent(sim,item,0,gem);item=setSocketContent(sim,item,2,gem);
  const r=recipe('empty_sockets'),stacks=[{id:'armor',item,amount:1,x:0,y:0}];
  for(const i of r.ingredients)if(i.itemId!=null){const material=sim.makeItem(i.itemType,Array.isArray(i.itemId)?i.itemId[0]:i.itemId);stacks.push({id:'mat'+stacks.length,item:material,amount:i.amount,...findPosition(stacks,material,4,4)});}
  const tx=transmuteInCube(sim,r,stacks,1,{columns:4,rows:4});const out=tx.stacks.find(s=>s.id==='armor').item;
  assert.equal(tx.cost.length,2);assert.deepEqual(socketContents(sim,out),Array(6).fill(null));assert.equal(sim.sockets(out).count,6);assert.equal(starLevel(out),2);
  assert.equal(socketContents(sim,item).filter(Boolean).length,2,'Original is available for Undo');
});
test('Hover shows calculated star stats and filled socket names',()=>{
  const item=setSocketContent(sim,configureItem(sim,armor,{stars:3}),0,gem),html=itemTooltipHtml(sim,item);
  assert.match(html,/3 stars/);assert.match(html,/Angelic Gem/);assert.match(html,/1 \/ 6 Sockets filled/);assert.doesNotMatch(html,/Star stat scaling is not yet calculated/);
  const base=sim.stats(armor).stats.find(s=>s.key===154).value;
  assert.equal(sim.stats(item).stats.find(s=>s.key===154).value,Math.floor(base+base*12*0.01));
  assert.doesNotMatch(itemTooltipHtml(sim,sim.makeItem(1,2,{...armor.def,w:1},{row:armor.row})),/>Corrupted</);
});
console.log(`${passed} item setup tests passed.`);
