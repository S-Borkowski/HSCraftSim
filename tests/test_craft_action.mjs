import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {prepareIngredients, craftReadiness, runCraftAction} from '../engine/craft_action.js';
import {packItem, unpackItem, findPosition, transmuteInCube} from '../engine/session.js';
import {lastCraftHtml, craftChanges} from '../ui/last-craft.js';
import {craftOutcome} from '../ui/craft-outcome.js';
import {historyComparisonHtml, recentCraftsHtml} from '../ui/history-view.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),profiles:read('item_profiles.json')});
const recipe=m=>sim.recipes.find(r=>r.mechanic===m);
const row=sim.catalog.rows.find(r=>r.name==="Tayrel's Chestplate");
const make=def=>sim.makeItem(row.cls,row.b,{a:123456,c:1,...def},{row});
const stack=(item,id='target',amount=1,x=0,y=0)=>({id,item,amount,x,y});
const state=(stacks=[])=>({stacks,stash:[],history:[],columns:4,rows:4,rng:42,crafts:0,spent:0,results:0,jewelLevel:3750});
let tests=0;const test=(name,fn)=>{fn();tests++;console.log('PASS '+name);};

test('Ten separately prepared Dice crafts keep ten detached records, with undo and reload',()=>{
  let current=state([stack(make())]);const originals=[];
  const r=recipe('blessed_dice');
  for(let n=1;n<=10;n++) {
    const before=JSON.stringify(current);
    assert.equal(craftReadiness(sim,r,current.stacks).addIngredients,true);
    const prepared=prepareIngredients(sim,r,current.stacks);
    assert.equal(JSON.stringify(current),before,'Preparation must not mutate the previous state');
    current={...current,stacks:prepared.stacks};originals.push(current);
    const supplied=JSON.stringify(current);
    const result=runCraftAction(sim,r,current);
    assert.equal(JSON.stringify(current),supplied,'Craft must not mutate the prepared state');
    assert.equal(result.done,1);assert.equal(result.error,null);
    current=result.state;
    assert.equal(current.history.length,n);assert.equal(current.crafts,n);assert.equal(current.rng,42+n);
    assert.equal(current.history[0].cost.length,1);assert.equal(current.history[0].cost[0].amount,1);
    assert.equal(current.stacks.length,1,'Only the previously placed Dice must be consumed');
    assert.deepEqual(current.history[0].beforeSnapshot.item,packItem(originals.at(-1).stacks[0].item));
  }
  assert.equal(current.stacks[0].versions.length,10);
  assert.deepEqual(current.history.map(h=>h.number),[10,9,8,7,6,5,4,3,2,1]);
  const roundTrip=JSON.parse(JSON.stringify({...current,stacks:current.stacks.map(s=>({...s,item:packItem(s.item)}))}));
  roundTrip.stacks=roundTrip.stacks.map(s=>({...s,item:unpackItem(sim,s.item)}));
  assert.equal(lastCraftHtml(roundTrip.history),lastCraftHtml(current.history));
  assert.match(lastCraftHtml(originals.at(-1).history),/data-last-comparison="9"/,'Undo uses the previous result');
  const last=current.history[0];assert.notDeepEqual(last.afterSnapshot.item.def,last.beforeSnapshot.item.def);
  const frozen=JSON.stringify(last);current.stacks[0].item.def.a=99;
  assert.equal(JSON.stringify(last),frozen);
});

test('Ready recipes consume existing materials without replenishing; no target is fabricated',()=>{
  const r=recipe('blessed_dice'),target=make(),prepared=prepareIngredients(sim,r,[stack(target)]);
  assert.equal(prepared.added,1);assert.equal(craftReadiness(sim,r,prepared.stacks).addIngredients,false);
  assert.equal(runCraftAction(sim,r,state(prepared.stacks)).done,1);
  const missing=state([]),before=JSON.stringify(missing);
  assert.equal(craftReadiness(sim,r,missing.stacks).targetMissing,true);
  const result=runCraftAction(sim,r,missing);
  assert.equal(result.done,0);assert.equal(result.state,missing);assert.equal(JSON.stringify(missing),before);
});

test('Craft refuses missing materials; preparing leaves the target, RNG and History unchanged',()=>{
  const r=recipe('blessed_dice'),initial=state([stack(make())]),before=JSON.stringify(initial);
  const refused=runCraftAction(sim,r,initial);
  assert.equal(refused.done,0);assert.equal(refused.state,initial);
  assert.match(refused.error.message,/missing ingredient/i);
  const supplied={...initial,stacks:prepareIngredients(sim,r,initial.stacks).stacks};
  assert.equal(JSON.stringify(initial),before);
  assert.equal(supplied.stacks.length,2);assert.equal(supplied.stacks[1].amount,1);
  assert.deepEqual(supplied.stacks[0],initial.stacks[0]);
  for(const key of ['history','rng','crafts','spent','results'])assert.deepEqual(supplied[key],initial[key]);
  const crafted=runCraftAction(sim,r,supplied);
  assert.equal(crafted.done,1);assert.equal(crafted.state.history.length,1);
  assert.equal(supplied.stacks[1].amount,1,'The pre-craft Undo state still contains the material');
  const repeat=runCraftAction(sim,r,crafted.state);
  assert.equal(repeat.done,0);assert.equal(repeat.state,crafted.state,'A second craft cannot replenish materials');
});

test('Selected alternative gems and repeated ingredient entries use exact missing quantities',()=>{
  const r=recipe('add_sockets'),item=sim.makeItem(3,14,{a:123456,c:0,j:1,s:0});
  const alternative=r.ingredients[2].alternatives[1];
  const choices=new Map([[`${r.index}:2`,alternative.catalogId]]);
  const suppliedGem=prepareIngredients(sim,r,[stack(item)],{choices});
  assert.ok(suppliedGem.stacks.some(s=>s.item.name===alternative.name));
  const result=runCraftAction(sim,r,state(suppliedGem.stacks));
  assert.equal(result.done,1);assert.ok(result.state.history[0].cost.some(c=>c.name===alternative.name&&c.amount===1));
  const duplicate={...r,ingredients:[{itemType:14,itemId:58,amount:2},{itemType:14,itemId:58,amount:3}]};
  const input=[stack(sim.makeItem(14,58),'supply',1)];const original=JSON.stringify(input);
  const supplied=prepareIngredients(sim,duplicate,input);
  assert.equal(supplied.added,4);assert.equal(supplied.stacks[0].amount,5);assert.equal(JSON.stringify(input),original);
});

test('Corruption, level, target and ingredient-space failures leave the complete state untouched',()=>{
  const corrupted=state([stack(make({r:1}))]);
  const lowLevel={...state(),jewelLevel:0};
  const jewel=sim.recipes.find(r=>r.resultType>=37&&r.resultType<=41);
  const full=state(Array.from({length:16},(_,i)=>stack(sim.makeItem(15,0),`filler-${i}`,1,i%4,Math.floor(i/4))));
  const creation=sim.recipes.find(r=>r.mechanic==='create'&&r.result.itemType===11&&r.result.itemId===14);
  for(const [r,s] of [[recipe('blessed_dice'),corrupted],[jewel,lowLevel],[creation,full]]) {
    const before=JSON.stringify(s);assert.equal(craftReadiness(sim,r,s.stacks,{columns:4,rows:4,config:{jewelLevel:s.jewelLevel}}).ok,false);
    const result=runCraftAction(sim,r,s);
    assert.equal(result.done,0);assert.equal(result.state,s);assert.equal(JSON.stringify(s),before);
  }
});

test('Output placement failure is atomic even with fully supplied ingredients',()=>{
  const r=sim.recipes.find(r=>r.mechanic==='create'&&r.result.itemType===11&&r.result.itemId===23&&r.ingredients.length===1&&r.ingredients[0].itemType===14);
  const input=prepareIngredients(sim,r,[]).stacks;
  for(let i=0;i<15;i++){const item=sim.makeItem(15,0),position=findPosition(input,item);input.push({id:`filler-${i}`,item,amount:1,...position});}
  const full=state(input),before=JSON.stringify(full),result=runCraftAction(sim,r,full);
  assert.equal(result.done,0);assert.match(result.error.message,/result does not fit/);
  assert.equal(result.state,full);assert.equal(JSON.stringify(full),before);
});

test('Batch obeys recipe permissions, uses existing supplies and records partial completion',()=>{
  const r=sim.recipes.find(r=>r.index===60);assert.equal(r.allowMultiCraft,true);
  const stocked=prepareIngredients(sim,r,[],{columns:9,rows:6}).stacks.map(s=>({...s,amount:s.amount*3}));
  const start={...state(stocked),columns:9,rows:6},before=JSON.stringify(start);
  const result=runCraftAction(sim,r,start,{count:10});
  assert.equal(result.done,3);assert.match(result.error.message,/missing ingredient/);
  assert.equal(result.state.history.length,3);assert.equal(result.state.rng,45);
  assert.equal(JSON.stringify(start),before);
  const empty=state();assert.equal(runCraftAction(sim,r,empty,{count:100}).state,empty);
  assert.throws(()=>runCraftAction(sim,recipe('blessed_dice'),state([stack(make())]),{count:10}),/does not support/);
});

test('A single prepared action matches the existing game transaction and RNG exactly',()=>{
  const r=recipe('blessed_dice'),s=state([stack(make())]);
  const supplies=prepareIngredients(sim,r,s.stacks).stacks;
  const expected=transmuteInCube(sim,r,supplies,s.rng);
  const actual=runCraftAction(sim,r,{...s,stacks:supplies});
  assert.deepEqual(actual.state.stacks.map(s=>packItem(s.item)),expected.stacks.map(s=>packItem(s.item)));
  assert.deepEqual(actual.state.history[0].cost,expected.cost);
});

test('Saved-result comparison prioritizes status/sockets/stars, displays deltas, and never recalculates',()=>{
  const a={name:'Test armor',sprite:1,rarity:'Angelic',corrupted:false,crystal:0,stars:0,sockets:{count:1,contents:[null]},stats:[{key:0,name:'Defense',value:100},{key:50,name:'Cast Rate',value:45,unit:'%'},{key:51,name:'Old affix',value:1}]};
  const b={...a,corrupted:true,crystal:1,stars:2,sockets:{count:2,contents:[{name:'Hel'},null]},stats:[{key:0,name:'Defense',value:110},{key:50,name:'Cast Rate',value:60,unit:'%'},{key:52,name:'New affix',value:9}]};
  const entry={number:7,recipeName:'Test craft',itemName:a.name,before:{},after:{},beforeSnapshot:a,afterSnapshot:b};
  const before=JSON.stringify(entry),changes=craftChanges(entry),html=lastCraftHtml([entry]);
  assert.deepEqual(changes.slice(0,4).map(r=>r.key),['corrupted','crystal','sockets','socket-0']);
  assert.ok(changes.find(r=>r.name==='Cast Rate'&&r.before==='45%'&&r.after==='60%'&&r.delta===15));
  assert.equal((html.match(/data-craft-change=/g)||[]).length,5);assert.match(html,/more changes/);
  assert.equal(JSON.stringify(entry),before);
  assert.match(lastCraftHtml([{...entry,afterSnapshot:structuredClone(a)}]),/No changes/);
  assert.match(lastCraftHtml([{...entry,before:null,beforeSnapshot:null}]),/Created/);
  assert.match(lastCraftHtml([{...entry,beforeSnapshot:null}]),/Snapshot unavailable/);
  assert.match(lastCraftHtml([]),/Ready for your first craft/);
  assert.doesNotMatch(lastCraftHtml([{...entry,itemName:'<script>evil</script>'}]),/<script>/);
});

test('Gypsy and Destiny persist all three random outcomes, including the zero-star floor',()=>{
  for(const mechanic of ['gypsys_prophecy','destiny_shard']) {
    const r=recipe(mechanic);
    const target=p=>sim.makeItem(row.cls,row.b,{a:123456,c:1,p},{row,tier:mechanic==='destiny_shard'?4:5});
    for(const [seed,p,expected,afterStars] of [[1,3,'level_up',4],[8,3,'level_down',2],[7,3,'corrupted',0],[8,0,'level_down',0]]) {
      const input=state(prepareIngredients(sim,r,[stack(target(p))]).stacks);input.rng=seed;
      const backup=JSON.stringify(input),result=runCraftAction(sim,r,input);
      assert.equal(result.error,null);assert.equal(result.done,1);
      assert.equal(JSON.stringify(input),backup,'The state for Undo remains unchanged');
      const h=result.state.history[0];assert.equal(h.outcome,expected);
      assert.equal(h.beforeSnapshot.stars,p);assert.equal(h.afterSnapshot.stars,afterStars);
      assert.equal(h.afterSnapshot.corrupted,expected==='corrupted');
      assert.equal(result.state.stacks.length,1);assert.equal(h.cost[0].amount,1);
      assert.equal(result.state.rng,seed+1);
      assert.match(lastCraftHtml([h]),new RegExp(`data-outcome="${expected}"`));
      if(expected==='corrupted') {
        assert.equal(craftReadiness(sim,r,result.state.stacks).ok,false);
        assert.match(craftOutcome(h).label,/Corrupted.*3 → 0/);
      }
      if(expected==='level_down'&&p===0) {
        assert.equal(craftChanges(h).length,0);
        for(const html of [lastCraftHtml([h]),historyComparisonHtml(h,[h]),recentCraftsHtml([h])])assert.match(html,/Star loss roll · Already at 0/);
        assert.match(lastCraftHtml([h]),/No changes/);assert.match(lastCraftHtml([h]),/material was consumed/);
      }
      const restored=JSON.parse(JSON.stringify(h));assert.equal(craftOutcome(restored).label,craftOutcome(h).label);
    }
  }
});

test('Successive real Gypsy transactions and probability trials reach the native outcome rates',()=>{
  const r=recipe('gypsys_prophecy'),prepared=prepareIngredients(sim,r,[stack(make({p:3}))]).stacks;
  let current=state(prepared);current.rng=100000;
  const counts={level_up:0,level_down:0,corrupted:0},n=3000;
  for(let i=0;i<n;i++) {
    // Independent eligible targets avoid conditioning the sample on survival or the five-star cap.
    const result=runCraftAction(sim,r,{...current,stacks:prepared});
    assert.equal(result.error,null);assert.equal(result.done,1);
    current=result.state;counts[current.history[0].outcome]++;
    assert.equal(current.history[0].seed,100000+i);assert.equal(current.rng,100001+i);
  }
  const theory={level_up:.70,level_down:.22,corrupted:.08};
  const analysis=sim.monteCarlo(r,prepared,100000,34931);
  for(const [key,p] of Object.entries(theory)) {
    assert.ok(Math.abs(counts[key]/n-p)<.03,`${key}: ${counts[key]} of ${n}`);
    assert.ok(Math.abs(analysis[key]-p)<.01,`${key}: ${analysis[key]}`);
  }
  console.log('Gypsy real transactions: '+JSON.stringify(counts)+' / '+n+'; 100,000 probability trials: '+JSON.stringify(analysis));
});
console.log(`${tests} atomic craft action and saved result tests passed.`);
