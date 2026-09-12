import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {configureItem} from '../engine/item_setup.js';
import {captureItem} from '../engine/history.js';
import {prepareIngredients,runCraftAction} from '../engine/craft_action.js';
import {itemPreviewHtml,previewStack} from '../ui/item-preview.js';
import {itemTooltipHtml,playerStatValue,statRollRange} from '../ui/item-tooltip.js';

const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),profiles:read('item_profiles.json')});
const row=sim.catalog.rows.find(r=>r.name==='The Dawn Bringer');
const item=sim.makeItem(row.cls,row.b,{a:123456,c:1},{row});
const target={id:'target',item,amount:1,x:0,y:0};
const recipe=sim.recipes.find(r=>r.mechanic==='blessed_dice');
let state={stacks:[target],stash:[],history:[],columns:9,rows:6,rng:42,crafts:0,spent:0,results:0};
const initial=JSON.stringify(state);
const original=captureItem(sim,item),frozen=JSON.stringify(original);
const prepared=prepareIngredients(sim,recipe,state.stacks,{columns:9,rows:6});
assert.equal(previewStack(prepared.stacks,null).id,'target','Materials do not replace the equipment preview');
assert.equal(previewStack(prepared.stacks,prepared.stacks[1].id).id,prepared.stacks[1].id,'An explicit material selection is respected');
assert.equal(previewStack([],null),null);
assert.equal(JSON.stringify(state),initial,'Preparing the preview does not mutate inputs');

const numeric=sim.stats(item).stats.find(s=>s.key===28);
assert.ok(statRollRange(numeric),'A known variable affix has a range');
assert.equal(statRollRange({value:5,min:5,max:5}),'','Fixed properties are not shown as random ranges');
for(const s of [{identity:true,value:2,min:1,max:3},{value:null,min:1,max:3},{value:2},{value:2,min:5,max:1},{value:2,min:0,max:Infinity},{itemDisplayCalculated:true,value:400,min:20,max:30}])assert.equal(statRollRange(s),'');
assert.equal(statRollRange({value:50,min:1,max:2,displayMin:30,displayMax:60,unit:'%'}),'30–60%');
const html=itemTooltipHtml(sim,item);
assert.ok(html.includes(`<b>${playerStatValue(numeric)}${numeric.unit||''}</b>`),'Current value remains alongside its range');
assert.ok(html.includes(`[${statRollRange(numeric)}]`));
assert.ok(html.indexOf('hover-primary-stats')<html.indexOf('class="hover-stats"'));
assert.ok(!html.includes('hover-source">Corruption'));

const corrupted=configureItem(sim,item,{corrupted:true});
const corruptBefore=JSON.stringify(corrupted),corruptHtml=itemTooltipHtml(sim,corrupted);
assert.ok(corruptHtml.includes('hover-corruption'),'Actual corruption stat changes are marked');
assert.ok(corruptHtml.includes('hover-source">Corruption'),'Corruption is explained with text as well as color');
assert.equal(JSON.stringify(corrupted),corruptBefore,'Display comparison never edits the item');
assert.equal(itemTooltipHtml(sim,corrupted),corruptHtml,'Repeated display uses the same roll');
assert.equal(JSON.stringify(original),frozen);

let firstRecord;
for(let n=1;n<=10;n++){
  state={...state,stacks:prepareIngredients(sim,recipe,state.stacks,{columns:9,rows:6}).stacks};
  const action=runCraftAction(sim,recipe,state);assert.equal(action.done,1);state=action.state;
  const stack=previewStack(state.stacks,'target');
  const preview=itemPreviewHtml(sim,stack,state.history);
  const current=sim.stats(stack.item).stats.find(s=>s.key===22);
  assert.ok(preview.includes(`<b>${playerStatValue(current)}</b>`),'Preview follows each current damage total');
  assert.ok(preview.includes(`data-last-comparison="${n}"`));
  assert.equal(state.history.length,n);
  if(n===1)firstRecord=JSON.stringify(state.history[0]);
}
assert.equal(JSON.stringify(state.history.at(-1)),firstRecord,'Live preview cannot rewrite earlier crafts');
assert.equal(JSON.stringify(original),frozen);
assert.ok(itemPreviewHtml(sim,null,[]).includes('Browse items'));
const unsafe={...target,item:{...item,name:'<img onerror="bad">'}};
assert.ok(!itemPreviewHtml(sim,unsafe,[]).includes('<img onerror='),'Names are escaped in the live preview');
console.log('PASS live item selection, current values with verified ranges, corruption labels, immutable rendering and ten independent craft records.');
