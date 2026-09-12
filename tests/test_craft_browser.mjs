// Explicit browser QA against a local server, in an isolated agent-browser session.
// Usage: AGENT_BROWSER_CLI=/path/to/agent-browser.js node tests/test_craft_browser.mjs http://127.0.0.1:17941/ui/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Sim} from '../engine/index.js';
import {packItem,findPosition} from '../engine/session.js';
import {prepareIngredients,runCraftAction} from '../engine/craft_action.js';
const cli=process.env.AGENT_BROWSER_CLI;
assert.ok(cli,'Set AGENT_BROWSER_CLI to the installed CLI JavaScript entry point.');
const base=process.argv[2];assert.ok(/^http:\/\/127\.0\.0\.1:\d+\//.test(base),'Use a local test server.');
const session='craft-workspace-qa';
const dir=path.resolve('tests/_output/craft-workspace');fs.mkdirSync(dir,{recursive:true});
let command=0;
function browser(...args){
  // On Windows the detached browser can inherit pipe handles from its launcher.
  // Regular file descriptors let the CLI exit without waiting for the browser.
  const output=path.join(dir,`command-${++command}.log`),fd=fs.openSync(output,'w');
  try {execFileSync(process.execPath,[cli,'--session',session,...args],{stdio:['ignore',fd,fd],timeout:30000});}
  finally {fs.closeSync(fd);}
  return fs.readFileSync(output,'utf8');
}
function evaluate(code){const out=execFileSync(process.execPath,[cli,'--session',session,'eval','--stdin'],{input:code,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024}).trim();return out?JSON.parse(out):null;}
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),profiles:read('item_profiles.json')});
const STORAGE='hscraftsim.workshop.v2',reports=[];
const saved=()=>evaluate(`JSON.parse(localStorage.getItem('${STORAGE}')).state`);
const recipe=m=>sim.recipes.find(r=>r.mechanic===m);
const row=sim.catalog.rows.find(r=>r.name==="Tayrel's Chestplate");
const armor=()=>sim.makeItem(row.cls,row.b,{a:123456,c:1},{row});
const stack=(item,id='qa-target',amount=1,x=0,y=0)=>({id,item,amount,x,y});
const state=(r,stacks=[])=>({stacks,stash:[],history:[],columns:9,rows:6,recipe:r.index,rng:42,seedStart:42,repeatable:true,jewelLevel:3750,sound:false,favorites:[],crafts:0,spent:0,results:0});
function idle(){assert.equal(evaluate(`(async()=>{for(let n=0;n<100;n++){if(document.querySelector('#application')?.getAttribute('aria-busy')==='false'&&document.querySelector('#transmute')){await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true;}await new Promise(r=>setTimeout(r,25));}return false;})()`),true,'Workshop did not become idle');}
function load(s,packed=false){
  const payload={schema:2,state:packed?s:{...s,stacks:s.stacks.map(s=>({...s,versions:s.versions||[],item:packItem(s.item)}))}};
  evaluate(`localStorage.setItem('${STORAGE}',${JSON.stringify(JSON.stringify(payload))}); true`);
  browser('open',base+'?qa='+Date.now());idle();
}
function check(name,fn){fn();reports.push({name,ok:true});console.log('PASS '+name);}

try {
  browser('open',base);idle();browser('set','viewport','1366','768');
  browser('screenshot',path.join(dir,'startup.png'));
  check('A Crystal craft surfaces its removal recipe; removal and Undo update the suggestion without rerolling',()=>{
    const crystal=recipe('satanic_crystal'),remove=recipe('remove_satanic_crystal');
    const initial=state(crystal,[stack(armor())]);
    let seed=1;
    for(;seed<=50;seed++){
      const supplied=prepareIngredients(sim,crystal,initial.stacks,{columns:9,rows:6}).stacks;
      const result=runCraftAction(sim,crystal,{...initial,stacks:supplied,rng:seed});
      if(result.state.history[0]?.afterSnapshot?.crystal===1)break;
    }
    assert.ok(seed<=50);load({...initial,rng:seed});
    browser('click','#dock-prepare');idle();
    const before=saved();for(const s of before.stacks)s.versions??=[];
    browser('click','#transmute');idle();
    const first=saved();assert.equal(first.history[0].afterSnapshot.crystal,1);
    const firstRecipe=()=>evaluate(`Number(document.querySelector('#recipe-list [data-recipe]').dataset.recipe)`);
    assert.equal(firstRecipe(),remove.index);
    assert.match(evaluate(`document.querySelector('#recipe-list .recipe-group-title').textContent`),/Suggested next step/);
    assert.equal(saved().recipe,crystal.index,'Suggestion must not silently switch the active recipe');
    assert.equal(evaluate(`document.querySelectorAll('#recipe-list [data-recipe="${remove.index}"]').length`),1);
    browser('screenshot',path.join(dir,'crystal-next-step.png'));
    browser('press','Control+z');idle();assert.deepEqual(saved(),before);
    assert.doesNotMatch(evaluate(`document.querySelector('#recipe-list').textContent`),/Suggested next step/);
    browser('click','#transmute');idle();
    assert.deepEqual(saved().history[0].afterSnapshot,first.history[0].afterSnapshot,'Undo and retry must keep the same seeded outcome');
    assert.equal(saved().rng,first.rng);
    browser('dblclick',`.game-recipe[data-recipe="${remove.index}"]`);idle();
    assert.equal(firstRecipe(),remove.index);assert.equal(saved().history.length,1);
    browser('click','#transmute');idle();assert.equal(saved().history[0].afterSnapshot.crystal,0);
    assert.doesNotMatch(evaluate(`document.querySelector('#recipe-list').textContent`),/Suggested next step/);
    browser('press','Control+z');idle();assert.equal(firstRecipe(),remove.index);
    browser('click','#recipes-open');
    assert.equal(evaluate(`Number(document.querySelector('#recipes-dialog [data-recipe]').dataset.recipe)`),remove.index);
    browser('press','Escape');
    const restored=saved();load(restored,true);assert.equal(firstRecipe(),remove.index);
  });
  check('Cleanup suggestions precede other ready recipes, respect filters, and require an eligible target',()=>{
    const remove=recipe('remove_satanic_crystal'),item=armor();item.def.q=2;
    const merge=sim.recipes.find(r=>r.mechanic==='create'&&r.ingredients.length===1&&/Gypsy.*Fragment/i.test(r.ingredients[0].name));
    const ingredient=merge.ingredients[0],fragment=sim.makeItem(ingredient.itemType,ingredient.itemId);
    const base=state(remove,[stack(item)]),position=findPosition(base.stacks,fragment,9,6);
    base.stacks.push(stack(fragment,'fragments',ingredient.amount,position.x,position.y));
    load(base);
    assert.equal(evaluate(`Number(document.querySelector('#recipe-list [data-recipe]').dataset.recipe)`),remove.index);
    assert.equal(evaluate(`document.querySelector('#recipe-list [data-recipe="${merge.index}"]').classList.contains('craft-ready')`),true);
    browser('click','#recipes-ready');
    assert.equal(evaluate(`!!document.querySelector('#recipe-list [data-recipe="${remove.index}"]')`),false,'Ready-only must not include missing supplies');
    browser('click','#recipes-all');browser('fill','#recipe-search','Blessed Dice');
    assert.equal(evaluate(`!!document.querySelector('#recipe-list [data-recipe="${remove.index}"]')`),false,'Suggestions must respect search');
    browser('fill','#recipe-search','');
    browser('click','#favorites');assert.equal(evaluate(`document.querySelectorAll('#recipe-list [data-recipe]').length`),0);
    browser('click','#favorites');
    const before=saved();browser('click','#clear-cube');idle();
    assert.doesNotMatch(evaluate(`document.querySelector('#recipe-list').textContent`),/Suggested next step/);
    browser('press','Control+z');idle();assert.deepEqual(saved(),before);
    item.def.t=1;load(state(remove,[stack(item)]));
    assert.doesNotMatch(evaluate(`document.querySelector('#recipe-list').textContent`),/Suggested next step/,'Mirrored gear cannot be cleaned');
  });
  check('Corruption prioritizes the correct Wisdom, before Crystal removal',()=>{
    for(const [name,mechanic] of [["Harlequinn's Crest",'cleanse_prophet'],['Mask of the Celestial','cleanse_angel']]){
      const row=sim.catalog.rows.find(r=>r.name===name),item=sim.makeItem(row.cls,row.b,{a:123456,c:1,q:1,r:1},{row});
      const wisdom=recipe(mechanic),remove=recipe('remove_satanic_crystal');
      load(state(recipe('satanic_crystal'),[stack(item)]));
      assert.equal(evaluate(`Number(document.querySelector('#recipe-list [data-recipe]').dataset.recipe)`),wisdom.index);
      assert.equal(evaluate(`document.querySelector('#recipe-list [data-recipe="${remove.index}"]').classList.contains('dimmed')`),true);
      browser('dblclick',`.game-recipe[data-recipe="${wisdom.index}"]`);idle();
      browser('click','#transmute');idle();assert.equal(saved().history[0].afterSnapshot.corrupted,false);
      assert.equal(evaluate(`Number(document.querySelector('#recipe-list [data-recipe]').dataset.recipe)`),remove.index);
    }
  });
  check('Recipe double-click fills the Cube without crafting; repeated preparation is a no-op',()=>{
    const r=recipe('blessed_dice');load(state(r,[stack(armor())]));
    browser('fill','#recipe-search','Blessed Dice');
    const before=saved();
    browser('dblclick',`.game-recipe[data-recipe="${r.index}"]`);idle();
    const after=saved();assert.equal(after.stacks.length,2);
    assert.deepEqual(after.stacks[0].item,before.stacks[0].item);
    for(const key of ['history','rng','crafts','spent','results'])assert.deepEqual(after[key],before[key]);
    assert.equal(evaluate(`document.querySelector('#transmute').disabled`),false);
    browser('dblclick',`.game-recipe[data-recipe="${r.index}"]`);idle();
    assert.deepEqual(saved(),after);
    assert.equal(evaluate(`document.querySelector('#last-craft .hover-heading h3').textContent`),row.name);
    browser('press','Control+z');idle();assert.equal(saved().stacks.length,1);
    browser('click','#recipes-open');browser('fill','#recipe-search','Blessed Dice');
    browser('dblclick',`#recipes-dialog .game-recipe[data-recipe="${r.index}"]`);idle();
    assert.equal(evaluate(`document.querySelector('#recipes-dialog').open`),false);
    assert.equal(saved().stacks.length,2);assert.equal(saved().history.length,0);
    browser('press','Control+z');idle();
    browser('click',`.game-recipe[data-recipe="${r.index}"]`);
    browser('press','Shift+Enter');idle();assert.equal(saved().stacks.length,2);assert.equal(saved().crafts,0);
  });
  check('Double-click never supplies missing equipment or bypasses a full Cube',()=>{
    const r=recipe('blessed_dice');load(state(r));browser('fill','#recipe-search','Blessed Dice');
    const empty=saved();browser('dblclick',`.game-recipe[data-recipe="${r.index}"]`);idle();
    assert.deepEqual(saved(),empty,'A recipe cannot invent a target');
    const full=[stack(armor())];
    while(true){const item=sim.makeItem(15,0),p=findPosition(full,item,4,4);if(!p)break;full.push(stack(item,`full-${full.length}`,1,p.x,p.y));}
    load({...state(r,full),columns:4,rows:4});browser('fill','#recipe-search','Blessed Dice');
    const before=saved();browser('dblclick',`.game-recipe[data-recipe="${r.index}"]`);idle();
    assert.deepEqual(saved(),before);
  });
  load(state(recipe('blessed_dice'),[stack(armor())]));
  check('Preparation visibly adds materials without crafting, even on a rapid second click',()=>{
    const before=saved();assert.equal(evaluate(`document.querySelector('#transmute').disabled`),true);
    evaluate(`(()=>{document.querySelector('#dock-prepare').click();document.querySelector('#dock-prepare').click();return true;})()`);
    idle();const prepared=saved();
    assert.equal(prepared.stacks.length,2);
    for(const key of ['id','item','amount','x','y'])assert.deepEqual(prepared.stacks[0][key],before.stacks[0][key]);
    for(const key of ['history','rng','crafts','spent','results'])assert.deepEqual(prepared[key],before[key]);
    assert.equal(evaluate(`document.querySelectorAll('#cube-grid [data-stack]').length`),2);
    assert.equal(evaluate(`document.querySelector('#transmute').disabled`),false);
    assert.equal(evaluate(`document.querySelector('#dock-prepare').disabled`),true);
    browser('screenshot',path.join(dir,'ingredients-before-craft.png'));
    browser('press','Control+z');idle();
    assert.equal(saved().stacks.length,1);assert.deepEqual(saved().stacks[0].item,before.stacks[0].item);
    for(const key of ['history','rng','crafts','spent','results'])assert.deepEqual(saved()[key],before[key]);
    browser('click','#dock-prepare');idle();
  });
  check('Craft uses the placed material once; rapid second click cannot craft again',()=>{
    assert.equal(evaluate(`document.querySelector('#transmute').textContent`),'Craft');
    evaluate(`(()=>{const b=document.querySelector('#transmute');b.click();document.querySelector('#transmute').click();return document.querySelector('#transmute').disabled;})()`);
    idle();assert.equal(saved().crafts,1);assert.equal(saved().history.length,1);
  });
  check('Selecting a Cube item updates its live sheet; Inspect remains a separate editor',()=>{
    const before=saved();
    browser('click','#dock-prepare');idle();
    const material=saved().stacks.find(s=>s.id!=='qa-target');
    evaluate(`document.querySelector('.item-preview-body').scrollTop=200;true`);
    browser('click',`[data-stack="${material.id}"]`);
    assert.equal(evaluate(`document.querySelector('#last-craft .hover-heading h3').textContent`),'Blessed Dice');
    assert.equal(evaluate(`document.querySelector('.item-preview-body').scrollTop`),0);
    assert.equal(evaluate(`document.querySelector('#inspector-dialog').open`),false);
    browser('click','[data-stack="qa-target"]');
    assert.equal(evaluate(`document.querySelector('#last-craft .hover-heading h3').textContent`),row.name);
    browser('press','e');assert.equal(evaluate(`document.querySelector('#inspector-dialog').open`),true);
    browser('press','Escape');browser('press','Control+z');idle();
    assert.deepEqual(saved(),before);
  });
  check('Ten preparation and craft pairs create ten histories with saved differences',()=>{
    for(let n=2;n<=10;n++){
      assert.equal(evaluate(`document.querySelector('#transmute').disabled`),true);
      browser('click','#dock-prepare');idle();assert.equal(saved().crafts,n-1);assert.equal(saved().stacks.length,2);
      browser('click','#transmute');idle();assert.equal(saved().crafts,n);
    }
    assert.equal(saved().history.length,10);assert.equal(saved().stacks[0].versions.length,10);
    assert.equal(saved().stacks.length,1);
    assert.equal(evaluate(`document.querySelector('.last-craft-link').dataset.lastComparison`),'10');
    const latest=saved().history[0].afterSnapshot;
    const primary=latest.stats.find(s=>s.key===154);
    assert.equal(evaluate(`document.querySelector('#last-craft [data-stat-key="154"] b').textContent`),String(Number((primary.displayValue??primary.value).toFixed(2))));
    assert.ok(evaluate(`document.querySelectorAll('#last-craft .hover-roll-range').length`)>0);
    browser('click','#last-craft .last-craft-recent>summary');
    assert.equal(evaluate(`document.querySelectorAll('#last-craft .recent-craft').length`),10);
    browser('click','#last-craft .last-craft-recent>summary');
  });
  const ten=saved();
  check('Undo restores the material before craft; reloading preserves the result and versions',()=>{
    browser('press','Control+z');idle();assert.equal(saved().crafts,9);
    assert.equal(saved().stacks.length,2);assert.equal(evaluate(`document.querySelector('#transmute').disabled`),false);
    assert.equal(evaluate(`document.querySelector('.last-craft-link').dataset.lastComparison`),'9');
    browser('press','Control+z');idle();assert.equal(saved().crafts,9);assert.equal(saved().stacks.length,1);
    load(ten,true);assert.equal(saved().history.length,10);
    assert.equal(evaluate(`document.querySelector('.last-craft-link').dataset.lastComparison`),'10');
  });
  check('Result details open the exact History record with changed-stats filtering',()=>{
    browser('click','.last-craft-link');
    assert.equal(evaluate(`document.querySelector('#comparison-changes').checked`),true);
    assert.equal(evaluate(`document.querySelector('#history-view').dataset.entry`),'10');
    browser('click','[data-view="workshop"]');
  });
  for(const [w,h] of [[1920,1080],[1366,768],[1280,720],[1024,768],[768,1024],[390,844]])for(const grid of [4,9]) {
    browser('set','viewport',String(w),String(h));browser('click',`[data-grid="${grid}"]`);idle();
    check(`${w}x${h}, ${grid===4?'4x4':'9x6'}: viewport, controls and visible result`,()=>{
      const metrics=evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return {viewport:[innerWidth,innerHeight],page:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],button:rect(document.querySelector('#transmute')),result:rect(document.querySelector('.last-craft-summary')),cube:rect(document.querySelector('#cube-grid')),stage:rect(document.querySelector('.cube-stage')),broken:[...document.images].filter(e=>e.offsetWidth&&e.complete&&!e.naturalWidth).map(e=>e.src)};})()`);
      assert.deepEqual(metrics.page,metrics.viewport);
      const prepare=evaluate(`(()=>{const r=document.querySelector('#dock-prepare').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};})()`);
      for(const box of [metrics.button,metrics.result,prepare]){assert.ok(box.width>0&&box.height>0);assert.ok(box.x>=0&&box.right<=w+1&&box.y>=0&&box.bottom<=h+1,JSON.stringify(metrics));}
      assert.ok(prepare.right<=metrics.button.x,'Prepare and Craft must remain separate buttons');
      if(w>=650)assert.ok(Math.abs(prepare.x-metrics.stage.x)<20&&prepare.y>=metrics.stage.bottom,'Craft actions belong directly below the Cube');
      assert.ok(metrics.cube.x>=metrics.stage.x-1&&metrics.cube.right<=metrics.stage.right+1,JSON.stringify(metrics));
      assert.ok(metrics.cube.y>=metrics.stage.y-1&&metrics.cube.bottom<=metrics.stage.bottom+1,JSON.stringify(metrics));
      assert.deepEqual(metrics.broken,[]);
      fs.writeFileSync(path.join(dir,`layout-${w}-${grid}.json`),JSON.stringify(metrics,null,2));
      browser('screenshot',path.join(dir,`layout-${w}-${grid}.png`));
    });
  }
  check('Mobile recipe pane retains the result and main action; hover is bounded and dismisses',()=>{
    browser('click','button[data-pane="recipe"]');idle();
    assert.ok(evaluate(`document.querySelector('#transmute').getBoundingClientRect().bottom<innerHeight`));
    assert.ok(evaluate(`document.querySelector('.last-craft-summary').getBoundingClientRect().height>0`));
    browser('click','.workspace-switch button[data-pane="item"]');idle();
    browser('press','ArrowLeft');assert.equal(evaluate(`document.querySelector('#workshop-view').dataset.pane`),'recipe');
    browser('press','End');assert.equal(evaluate(`document.querySelector('#workshop-view').dataset.pane`),'item');
    assert.ok(evaluate(`document.querySelector('.item-preview-body').getBoundingClientRect().height>100`));
    assert.ok(evaluate(`document.querySelector('#transmute').getBoundingClientRect().bottom<innerHeight`));
    browser('screenshot',path.join(dir,'mobile-item.png'));
    browser('click','button[data-pane="cube"]');idle();
    browser('hover','[data-stack="qa-target"]');
    const tooltip=evaluate(`(()=>{const e=document.querySelector('#tooltip'),r=e.getBoundingClientRect();return {visible:!e.hidden,x:r.x,y:r.y,right:r.right,bottom:r.bottom};})()`);
    assert.equal(tooltip.visible,true);assert.ok(tooltip.x>=0&&tooltip.right<=390&&tooltip.y>=0&&tooltip.bottom<=844);
    browser('hover','.last-craft-heading');assert.equal(evaluate(`document.querySelector('#tooltip').hidden`),true);
  });
  browser('set','viewport','1366','768');
  check('Blocked target stays disabled and does not add materials or change stored state',()=>{
    const item=armor();item.def.r=1;load(state(recipe('blessed_dice'),[stack(item)]));
    const before=saved();assert.equal(evaluate(`document.querySelector('#transmute').disabled`),true);
    assert.equal(evaluate(`document.querySelector('#dock-prepare').disabled`),true);
    assert.match(evaluate(`document.querySelector('#craft-action-reason').textContent`),/corrupted/i);
    assert.deepEqual(saved(),before);
  });
  check('Selected gem appears in the Cube before Craft and the socket result is compared',()=>{
    const r=recipe('add_sockets');load(state(r,[stack(sim.makeItem(3,14,{a:123456,c:0,j:1,s:0}))]));
    const alt=r.ingredients[2].alternatives[1];
    evaluate(`document.querySelector('[data-ingredient-choice="2"][data-choice="${alt.catalogId}"]').scrollIntoView({block:'center'});true`);
    browser('click',`[data-ingredient-choice="2"][data-choice="${alt.catalogId}"]`);
    browser('dblclick',`.game-recipe[data-recipe="${r.index}"]`);idle();
    assert.equal(saved().crafts,0);assert.ok(saved().stacks.some(s=>s.item.rowId===alt.catalogId),'Double-click must respect the selected alternative gem');
    browser('click','#transmute');idle();
    assert.ok(saved().history[0].cost.some(c=>c.name===alt.name));
    assert.match(evaluate(`document.querySelector('#last-craft .hover-sockets').textContent`),new RegExp(`0 / ${saved().history[0].afterSnapshot.sockets.count} Sockets filled`));
    assert.equal(evaluate(`document.querySelector('#transmute').disabled`),true);
    assert.equal(evaluate(`document.activeElement===document.querySelector('.last-craft-link')`),true,'Focus should move to the saved result when a repeat is blocked');
  });
  check('Batch menu is secondary and stops after three stocked crafts, without refilling',()=>{
    const r=sim.recipes.find(r=>r.index===60);
    const supplies=prepareIngredients(sim,r,[],{columns:9,rows:6}).stacks.map(s=>({...s,amount:s.amount*3}));
    load(state(r,supplies));assert.equal(evaluate(`document.querySelector('#transmute').textContent`),'Craft');
    browser('click','#batch-open');browser('click','[data-batch="10"]');idle();
    assert.equal(saved().crafts,3);assert.equal(saved().history.length,3);
    assert.match(evaluate(`document.querySelector('#toast').textContent`),/3 \/ 10 crafts completed/);
    assert.equal(evaluate(`document.querySelector('#transmute').disabled`),true);
    assert.equal(evaluate(`document.querySelector('#dock-prepare').disabled`),false);
  });
  check('Output-space failure preserves the session byte-for-byte',()=>{
    const r=sim.recipes.find(r=>r.mechanic==='create'&&r.result.itemType===11&&r.result.itemId===23&&r.ingredients.length===1&&r.ingredients[0].itemType===14);
    const input=prepareIngredients(sim,r,[]).stacks;
    for(let n=0;n<15;n++){const item=sim.makeItem(15,0),p=findPosition(input,item);input.push({id:`fill-${n}`,item,amount:1,...p});}
    load({...state(r,input),columns:4,rows:4});
    const before=evaluate(`localStorage.getItem('${STORAGE}')`);browser('click','#transmute');idle();
    assert.equal(evaluate(`localStorage.getItem('${STORAGE}')`),before);
    assert.match(evaluate(`document.querySelector('#toast').textContent`),/result does not fit/);
  });
  for(const [rng,stars,outcome,afterStars] of [[1,3,'level_up',4],[8,3,'level_down',2],[7,3,'corrupted',0],[8,0,'level_down',0]]) {
    check(`Gypsy craft: ${outcome}, ${stars} to ${afterStars} stars, visible result and saved history`,()=>{
      const r=recipe('gypsys_prophecy'),item=sim.makeItem(row.cls,row.b,{a:123456,c:1,p:stars},{row});
      load({...state(r,[stack(item)]),rng});
      browser('click','#dock-prepare');idle();assert.equal(saved().history.length,0);
      browser('click','#transmute');idle();
      const entry=saved().history[0];assert.equal(entry.outcome,outcome);
      assert.equal(entry.beforeSnapshot.stars,stars);assert.equal(entry.afterSnapshot.stars,afterStars);
      assert.equal(entry.afterSnapshot.corrupted,outcome==='corrupted');
      assert.equal(evaluate(`document.querySelector('.last-craft-outcome').dataset.outcome`),outcome);
      if(stars===0) {
        assert.match(evaluate(`document.querySelector('#last-craft').textContent`),/Star loss roll · Already at 0/);
        assert.match(evaluate(`document.querySelector('.last-craft-outcome').title`),/material was consumed/);
      }
      if(outcome==='corrupted'){
        assert.equal(evaluate(`document.querySelector('#dock-prepare').disabled`),true);
        assert.ok(evaluate(`document.querySelectorAll('#last-craft .hover-corruption .hover-source').length`)>0);
      }
      browser('screenshot',path.join(dir,`gypsy-${outcome}-${stars}.png`));
      browser('click','.last-craft-link');
      assert.ok(evaluate(`document.querySelector('.comparison-outcome').textContent`).includes('Craft #1:'));
      browser('click','[data-view="workshop"]');
      browser('press','Control+z');idle();assert.equal(saved().history.length,0);assert.equal(saved().stacks.length,2);
      assert.equal(saved().stacks[0].item.def.p,stars);
    });
  }
  check('Recipe browsing keeps the latest result; reset and undo restore it correctly',()=>{
    load(ten,true);browser('fill','#recipe-search','Add Sockets');browser('click','[data-recipe="49"]');idle();
    assert.equal(evaluate(`document.querySelector('.last-craft-link').dataset.lastComparison`),'10');
    browser('click','#reset');idle();assert.match(evaluate(`document.querySelector('#last-craft').textContent`),/Add an item to see its properties/);
    browser('press','Control+z');idle();assert.equal(evaluate(`document.querySelector('.last-craft-link').dataset.lastComparison`),'10');
    browser('press','Tab');assert.equal(evaluate(`document.activeElement===document.body`),false);
  });
  const errors=browser('errors').trim(),consoleOutput=browser('console').trim();
  assert.equal(errors,'');assert.equal(consoleOutput,'');
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({ok:true,checks:reports,errors,console:consoleOutput},null,2));
  console.log(`PASS ${reports.length} browser checks. Screenshots and report: ${dir}`);
} catch(error) {
  browser('screenshot',path.join(dir,'failure.png'));
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({ok:false,checks:reports,error:error.stack},null,2));
  throw error;
} finally {browser('close');}
