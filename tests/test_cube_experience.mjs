import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sim } from '../engine/index.js';
import { describeIngredient } from '../engine/recipes.js';
import { transmuteInCube, canPlace, canStackItems } from '../engine/session.js';
import { itemTooltipHtml, itemTypeName, playerStatName } from '../ui/item-tooltip.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),profiles:read('item_profiles.json')});
const texts=read('current_item_text.json');
const mat=(id,amount,x=0,y=0)=>({id:`material-${id}`,item:sim.makeItem(14,id),amount,x,y});
let sequence=0,passed=0;
const grid={columns:4,rows:4,idFactory:()=>`output-${++sequence}`};
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};

test('Every fragment merge creates its actual result inside the vacated Cube cell',()=>{
 for(const [inputId,resultId,amount] of [[71,43,20],[72,63,20],[73,65,20],[66,64,40],[60,58,500]]){
  const recipe=sim.recipes.find(r=>r.mechanic==='create'&&r.ingredients.length===1&&r.ingredients[0].itemType===14&&r.ingredients[0].itemId===inputId);
  const input=[mat(inputId,amount,2,1)],before=JSON.stringify(input);
  const tx=transmuteInCube(sim,recipe,input,1,grid);
  assert.equal(JSON.stringify(input),before,'Transaction must not mutate input');
  assert.equal(tx.stacks.length,1);assert.equal(tx.stacks[0].item.itemId,resultId);
  assert.equal(tx.stacks[0].amount,1);assert.deepEqual([tx.stacks[0].x,tx.stacks[0].y],[2,1]);
  assert.equal(tx.resultStacks[0],tx.stacks[0]);assert.equal(tx.cost[0].amount,amount);
  assert.equal(recipe.result.name,tx.stacks[0].item.name);
 }
});
test('Repeated Gypsy merges retain remainder and accumulate only Prophecies',()=>{
 const recipe=sim.recipes.find(r=>r.index===19);let stacks=[mat(72,65)];
 for(let i=0;i<3;i++)stacks=transmuteInCube(sim,recipe,stacks,i+1,grid).stacks;
 assert.equal(stacks.length,2);assert.equal(stacks.find(s=>s.item.itemId===72).amount,5);
 assert.equal(stacks.find(s=>s.item.itemId===63).amount,3);
 assert.throws(()=>transmuteInCube(sim,recipe,stacks,4,grid));
 for(const s of stacks)assert.ok(canPlace(stacks,s.item,s.x,s.y,4,4,s.id));
});
test('Rune results remain in Cube and can feed the next recipe',()=>{
 const ol=sim.makeItem(15,1),merge=sim.recipes.find(r=>r.index===60);
 let stacks=[{id:'rune',item:ol,amount:9,x:0,y:0}];
 for(let i=0;i<3;i++)stacks=transmuteInCube(sim,merge,stacks,i+1,grid).stacks;
 assert.equal(stacks.length,1);assert.equal(stacks[0].item.name,'Old');assert.equal(stacks[0].amount,3);
 const tor=transmuteInCube(sim,sim.recipes.find(r=>r.index===61),stacks,9,grid);
 assert.equal(tor.stacks[0].item.name,'Tor');assert.equal(tor.stacks[0].amount,1);
});
test('A full Cube rejects output placement before consuming anything',()=>{
 const stacks=Array.from({length:16},(_,i)=>({...mat(72,i===0?21:1,i%4,Math.floor(i/4)),id:`slot-${i}`}));
 const recipe={...sim.recipes.find(r=>r.index===19),result:{itemType:0,itemId:0,isUnique:true,amount:1}};
 const before=JSON.stringify(stacks);
 assert.throws(()=>transmuteInCube(sim,recipe,stacks,1,grid),/does not fit in the Cube/);
 assert.equal(JSON.stringify(stacks),before);
});
test('Different jewel rolls cannot be collapsed into a single result stack',()=>{
 const row=sim.catalog.rows.find(r=>/Exan Jewel/.test(r.name));
 const a=sim.makeItem(row.cls,row.b,{a:1},{row}),b=sim.makeItem(row.cls,row.b,{a:2},{row});
 assert.equal(canStackItems(a,b),false);
});
test('All alternatives have names and original icons; no ingredient IDs are printed',()=>{
 for(const r of sim.recipes)for(const ing of r.ingredients){
  assert.ok(!/#\d/.test(describeIngredient(ing)),r.name);
  if(ing.itemId!=null)assert.ok(ing.name,r.name);
  for(const a of ing.alternatives||[]){assert.ok(a.name);assert.ok(fs.existsSync(new URL(`../data/icons/${a.sprite}.png`,import.meta.url)));}
 }
 for(const index of [48,49]){
  const choice=sim.recipes.find(r=>r.index===index).ingredients.find(i=>i.alternatives);
  assert.equal(choice.name,'Any Perfect gem');
  assert.deepEqual(choice.alternatives.map(a=>a.name),['Perfect Amethyst','Perfect Emerald','Perfect Ruby','Perfect Sapphire','Perfect Topaz','Perfect Diamond','Perfect Skull']);
 }
});
test('Hover card displays rolled stats and item explanation instead of click instructions',()=>{
 const helmet=sim.makeItem(0,0,{a:177289,c:1},{isUnique:true,tier:5});
 const html=itemTooltipHtml(sim,helmet,{texts});
 assert.match(html,/Harlequinn/);assert.match(html,/to All Skills/);
 const defense=sim.stats(helmet).stats.find(s=>s.name==='Defense');
 assert.ok(Number.isFinite(defense.value));assert.ok(html.includes(`<b>${defense.value}</b>`));
 assert.doesNotMatch(html,/Click to inspect|SEED|Stat #|undefined|NaN/);
 const fragment=itemTooltipHtml(sim,sim.makeItem(14,72),{texts,amount:20});
 assert.match(fragment,/Merge 20/);assert.match(fragment,/Prophecy/);assert.match(fragment,/crystal ball/);assert.match(fragment,/20 items/);
 const dice=itemTooltipHtml(sim,sim.makeItem(10,31,{a:3,c:1},{isUnique:true}),{texts});
 assert.match(dice,/Weapon Master/);assert.match(dice,/Lv\. 12/);assert.doesNotMatch(dice,/Skill #/);
});
test('Tooltip text is escaped and weapon types use Item Editor names',()=>{
 const item=sim.makeItem(0,0,{a:1,c:1},{isUnique:true});
 const html=itemTooltipHtml(sim,{...item,name:'<img src=x onerror=alert(1)>'},{texts:{['lore_'+item.row.key]:'<script>alert(1)</script>'}});
 assert.doesNotMatch(html,/<script>|<img src=x/);assert.match(html,/&lt;script&gt;/);
 assert.equal(itemTypeName({itemType:3,def:{j:11}}),'Book');
 assert.equal(playerStatName({name:'Stat #777'}),'Unresolved property');
});
console.log(`\n${passed} Cube experience tests passed.`);
