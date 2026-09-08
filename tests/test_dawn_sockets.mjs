import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {generateModelStats} from '../engine/stat_model.js';
import {applyItemModifiers} from '../engine/item_modifiers.js';
import {configureItem,setSocketContent,socketContents} from '../engine/item_setup.js';
import {transmuteInCube,findPosition,packItem,unpackItem} from '../engine/session.js';
import {captureItem,retainVersion} from '../engine/history.js';
import {historyComparisonHtml} from '../ui/history-view.js';
import {itemTooltipHtml} from '../ui/item-tooltip.js';

const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),profiles:read('item_profiles.json')});
const row=sim.catalog.rows.find(r=>r.name==='The Dawn Bringer');
const make=def=>sim.makeItem(3,18,{c:1,j:3,...def},{row});
const fixtures=JSON.parse(fs.readFileSync(new URL('./current_dawn_sockets_native.json',import.meta.url),'utf8')).fixtures;
assert.equal(fixtures.length,681);
for(const f of fixtures) {
  const item=make(f.definition),generated=applyItemModifiers(item,generateModelStats(item,sim.model));
  assert.equal(item.info.socketCount+(f.definition.q===2?1:0),f.count,JSON.stringify(f.definition));
  assert.equal(sim.sockets(item).count,f.count,JSON.stringify(f.definition));
  assert.equal(sim.sockets(item).source,'current-unique-socket-range');
  for(const [key,value] of Object.entries(f.values))assert.equal(generated.stats.find(s=>s.key===Number(key))?.value,value,`${key}: ${JSON.stringify(f.definition)}`);
  assert.deepEqual(generated.trace.map(t=>[0,t.upper,t.roll]),f.draws);
}

let item=make({a:42});
assert.equal(sim.sockets(item).count,5);
const topaz=sim.catalog.find(15,69,false);
for(let index=0;index<5;index++)item=setSocketContent(sim,item,index,topaz);
const value=(item,key)=>sim.stats(item).stats.find(s=>s.key===key)?.value;
assert.equal(value(item,144),2560);assert.equal(value(item,145),100);
const recipe=sim.recipes.find(r=>r.mechanic==='blessed_dice');
const prepare=item=>{
  const stacks=[{id:'dawn',item,amount:1,x:0,y:0}];
  for(const ing of recipe.ingredients)if(ing.itemId!=null){const material=sim.makeItem(ing.itemType,ing.itemId);stacks.push({id:'dice',item:material,amount:ing.amount,...findPosition(stacks,material,9,6)});}
  return stacks;
};
const history=[];
let counts=[5];
for(let attempt=1;attempt<=20;attempt++) {
  const tx=transmuteInCube(sim,recipe,prepare(item),attempt,{columns:9,rows:6});
  const entry={number:attempt,lineage:'dawn',recipeName:recipe.name,itemName:item.name,beforeSnapshot:captureItem(sim,tx.before),afterSnapshot:captureItem(sim,tx.after)};
  history.unshift(entry);retainVersion(tx.stacks[0],entry);item=tx.after;
  const count=sim.sockets(item).count;counts.push(count);
  assert.equal(value(item,144),count*512);assert.equal(value(item,145),count*20);
  assert.equal(socketContents(sim,item).length,count);
  assert.ok(item.def.s5,'Dice changes the seed, preserving the stored fifth payload');
  if(counts.includes(4)&&count===5)break;
}
assert.ok(counts.includes(4)&&counts.at(-1)===5,'A later Dice can restore the fifth active socket');
const decreased=history.find(h=>h.beforeSnapshot.sockets.count===5&&h.afterSnapshot.sockets.count===4);
assert.ok(decreased);
assert.equal(decreased.beforeSnapshot.sockets.contents.length,5);assert.equal(decreased.afterSnapshot.sockets.contents.length,4);
const comparison=historyComparisonHtml(decreased,history,{changesOnly:true});
assert.match(comparison,/<th>Sockets<\/th><td>5<\/td><td>4<\/td><td[^>]*>-1<\/td>/);
assert.match(comparison,/2560/);assert.match(comparison,/2048/);
const restored=unpackItem(sim,JSON.parse(JSON.stringify(packItem(item))));
assert.equal(sim.sockets(restored).count,5);assert.equal(value(restored,144),2560);
assert.match(itemTooltipHtml(sim,restored),/5 \/ 5 Sockets filled/);
const four=configureItem(sim,restored,{sockets:4});
assert.equal(sim.sockets(four).count,4);assert.equal(Object.hasOwn(four.def,'s'),false);
assert.throws(()=>configureItem(sim,restored,{sockets:3}),/natural range/);
assert.equal(sim.sockets(make({a:42,s:0})).count,5,'A legacy socket seed cannot hide current natural Unique sockets');
assert.equal(sim.sockets(make({a:42,zz:{sockets:2}})).source,'unresolved','Unknown custom socket definitions are not certified');
if(process.argv.includes('--ui-fixture')) {
  let target=make({a:42});
  for(let i=0;i<5;i++)target=setSocketContent(sim,target,i,topaz);
  const stacks=prepare(target);
  let seed=1;
  while(sim.sockets(transmuteInCube(sim,recipe,stacks,seed,{columns:9,rows:6}).after).count!==4)seed++;
  const state={stacks:stacks.map(s=>({...s,item:packItem(s.item)})),stash:[],history:[],columns:9,rows:6,recipe:recipe.index,rng:seed,seedStart:seed,repeatable:true,jewelLevel:3750,sound:false,favorites:[],crafts:0,spent:0,results:0};
  fs.writeFileSync(new URL('./_output/dawn-ui-session.json',import.meta.url),JSON.stringify({schema:2,state}));
}
console.log(`PASS ${fixtures.length} native Dawn Bringer base/socket cases; Dice 5→4→5, active gem totals, history socket delta and save/reload.`);
