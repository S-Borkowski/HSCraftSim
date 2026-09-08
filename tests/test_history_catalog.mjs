import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sim } from '../engine/index.js';
import { packItem, unpackItem, transmuteInCube, findPosition } from '../engine/session.js';
import { configureItem, setSocketContent, filterCatalog, filterSocketables, socketFamily } from '../engine/item_setup.js';
import { catalogTarget } from '../engine/catalog_target.js';
import { validateTarget, UNSUPPORTED } from '../engine/validation.js';
import { captureItem, retainVersion, itemVersions, compareStats } from '../engine/history.js';
import { savedItemHtml, historyComparisonHtml, recentCraftsHtml } from '../ui/history-view.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('recipes.json'),catalog:read('items_catalog.json'),statNames:read('stat_names.json'),pools:read('stat_pools.json'),attributes:read('translations/attributes.json'),profiles:read('item_profiles.json')});
const row=sim.catalog.rows.find(r=>r.name==="Tayrel's Chestplate");
const make=()=>sim.makeItem(row.cls,row.b,{a:123456,c:1},{row});
const recipe=m=>sim.recipes.find(r=>r.mechanic===m);
let tests=0;const test=(name,fn)=>{fn();tests++;console.log('PASS '+name);};

test('Craft snapshots are detached from items, stat caches, restored copies and model changes',()=>{
  let item=configureItem(sim,make(),{stars:3,sockets:6,crystal:1});
  item=setSocketContent(sim,item,0,sim.catalog.find(15,78,false));
  const saved=captureItem(sim,item),original=JSON.stringify(saved),packed=packItem(item);
  item.def.a=99;item.def.s1='changed';assert.notEqual(packed.def.a,99);
  const restored=unpackItem(sim,saved.item);restored.def.a=88;
  const stats=sim.stats(restored);if(stats.stats[0])stats.stats[0].value=987654;
  const old=sim.stats;sim.stats=()=>{throw new Error('History must never recalculate stats');};
  assert.match(savedItemHtml(saved),/SAVED AT CRAFT TIME/);assert.match(savedItemHtml(saved),/Angelic Gem/);
  assert.match(historyComparisonHtml({number:1,recipeName:'Dice'},[{number:1,recipeName:'Dice',beforeSnapshot:saved,afterSnapshot:saved}]),/Compare from/);
  sim.stats=old;assert.equal(JSON.stringify(saved),original);
});
test('Twelve real crafts retain ten per-item versions through serialization and later crafts',()=>{
  const r=recipe('blessed_dice');let stacks=[{id:'armor-a',item:make(),amount:1,x:0,y:0}],history=[];
  for(let n=1;n<=12;n++){
    for(const i of r.ingredients)if(i.itemId!=null){const item=sim.makeItem(i.itemType,i.itemId);stacks.push({id:'mat-'+n,item,amount:i.amount,...findPosition(stacks,item)});}
    const tx=transmuteInCube(sim,r,stacks,n);stacks=tx.stacks;
    const entry={number:n,lineage:'armor-a',recipeName:r.name,beforeSnapshot:captureItem(sim,tx.before),afterSnapshot:captureItem(sim,tx.after)};
    history.unshift(entry);retainVersion(stacks[0],entry);
  }
  assert.equal(stacks[0].versions.length,10);assert.deepEqual(stacks[0].versions.map(v=>v.number),[12,11,10,9,8,7,6,5,4,3]);
  assert.equal(history.length,12,'Every material use creates a separate journal entry');
  const cards=recentCraftsHtml(history);
  assert.deepEqual([...cards.matchAll(/data-journal="(\d+)"/g)].map(m=>Number(m[1])),[12,11,10,9,8,7,6,5,4,3]);
  assert.equal((cards.match(/data-history-item=/g)||[]).length,10);
  assert.ok(new Set(stacks[0].versions.map(v=>JSON.stringify(v.afterSnapshot.stats))).size>1);
  const saved=JSON.parse(JSON.stringify(stacks.map(s=>({...s,item:packItem(s.item)}))));
  const stash=saved.map(s=>({...s,item:unpackItem(sim,s.item)}));
  const unrelated=Array.from({length:100},(_,n)=>({number:13+n,lineage:'armor-b',afterSnapshot:captureItem(sim,make())}));
  const versions=itemVersions(stash[0].versions[0],stash,unrelated);
  assert.equal(versions.length,10);assert.ok(versions.every(v=>v.lineage==='armor-a'));
  assert.equal(itemVersions(unrelated[0],stash,unrelated).length,10);
  assert.ok(itemVersions(history.at(-1),stash,history).some(v=>v.number===1),'An older selected craft remains viewable');
  assert.equal(stash[0].versions[0].afterSnapshot.item.def.a,stacks[0].item.def.a);
});
test('Ten identical rolls remain ten visible actions, including across different recipes',()=>{
  const saved=captureItem(sim,make());
  const history=Array.from({length:10},(_,i)=>({number:10-i,lineage:'same-item',recipeName:i%2?'Blessed Dice':'Satanic Dice',itemName:make().name,afterSnapshot:saved,cost:[{name:'Blessed Dice',amount:1}],outcome:'edited'}));
  const html=recentCraftsHtml(history,{labels:{edited:'Rerolled'}});
  assert.equal((html.match(/<li>/g)||[]).length,10);
  assert.ok(html.includes('Craft #1</strong>')&&html.includes('Craft #10</strong>'));
  assert.match(html,/Satanic Dice/);assert.match(html,/Blessed Dice/);
  assert.equal(recentCraftsHtml([]),'');
  const hostile=recentCraftsHtml([{number:1,recipeName:'<script>',itemName:'<img onerror="x">',cost:[]}]);
  assert.doesNotMatch(hostile,/<script>|<img onerror=/);assert.match(hostile,/&lt;script&gt;/);
});
test('Comparison handles displayed percentages, added/removed affixes and text changes',()=>{
  const before={stats:[{key:1,value:150,displayValue:1.5,unit:'%'},{key:2,value:10},{key:3,value:'Old skill',identity:true}]};
  const after={stats:[{key:1,value:175,displayValue:1.75,unit:'%'},{key:4,value:20},{key:3,value:'New skill',identity:true}]};
  const rows=compareStats(before,after);assert.equal(rows[0].delta,.25);assert.equal(rows[1].after,undefined);assert.equal(rows.find(r=>r.after?.key===4).before,undefined);assert.equal(rows[2].changed,true);assert.equal(rows[2].delta,null);
  assert.match(savedItemHtml(null),/Stats were not saved/);
});
test('Catalog uses recipe conditions, keeps SS defaults and rejects incompatible explicit tiers',()=>{
  const blessed=recipe('blessed_dice'),ing=blessed.ingredients[0];
  const pick=catalogTarget(sim,blessed,ing,row);assert.equal(pick.item.info.tier,5);
  assert.equal(catalogTarget(sim,blessed,ing,row,{tier:4}),null);
  const gypsy=recipe('gypsys_prophecy');assert.equal(catalogTarget(sim,gypsy,gypsy.ingredients[0],row,{tier:4}),null);
  const destiny=recipe('destiny_shard');assert.equal(catalogTarget(sim,destiny,destiny.ingredients[0],row).item.info.tier,4);
  const prophet=recipe('cleanse_prophet'),angel=recipe('cleanse_angel');
  assert.equal(catalogTarget(sim,prophet,prophet.ingredients[0],row),null);
  const corrupt=catalogTarget(sim,angel,angel.ingredients[0],row);assert.ok(corrupt.item.def.r);assert.match(corrupt.notes.join(' '),/Corrupted/);
  assert.equal(validateTarget(angel,configureItem(sim,corrupt.item,{corrupted:false})).ok,false);
});
test('Every shown recipe candidate passes the same target rules as actual crafting',()=>{
  let total=0;
  for(const r of sim.recipes){const ing=r.ingredients.find(i=>i.itemId==null);if(!ing)continue;let count=0;
    for(const row of filterCatalog(sim.catalog.rows)){
      const candidate=catalogTarget(sim,r,ing,row);if(!candidate)continue;
      assert.equal(validateTarget(r,candidate.item,ing).ok,true,`${r.name}: ${row.name}`);count++;
    }
    if(!UNSUPPORTED[r.mechanic])assert.ok(count>0,r.name);total+=count;
  }
  console.log(`  ${total} valid recipe/item combinations checked`);
});

test('Empty Sockets catalog presets place an Orb in Codices',()=>{
  const empty=recipe('empty_sockets'),ingredient=empty.ingredients.find(i=>i.itemId==null);
  for(const id of [18,23]) {
    const candidate=catalogTarget(sim,empty,ingredient,sim.catalog.find(11,id,false));
    assert.ok(candidate);
    const socket=JSON.parse(atob(candidate.item.def.s1));
    assert.equal(socket.b,112);
    assert.equal(candidate.item.def.i,123456,'Catalog presets supply their own repeatable socket seed');
    assert.match(candidate.notes.join(' '),/Orb inserted/);
    assert.throws(()=>setSocketContent(sim,candidate.item,0,sim.catalog.find(15,1,false)),/Codex crafting/);
  }
});
test('Visual socket tabs partition named socketables and search without admitting Orbs',()=>{
  const families=['runes','gems','jewels'],all=families.flatMap(family=>filterSocketables(sim.catalog.rows,{family}));
  assert.equal(all.length,new Set(all.map(r=>r.id)).size);assert.ok(all.every(r=>!(r.b>=112&&r.b<=129)));
  for(const family of families)assert.ok(filterSocketables(sim.catalog.rows,{family}).length>0);
  assert.equal(filterSocketables(sim.catalog.rows,{family:'gems',query:'angelic gem'})[0].name,'Angelic Gem');
  assert.equal(socketFamily(sim.catalog.find(15,1,false)),'runes');assert.equal(socketFamily(sim.catalog.find(15,82,false)),'jewels');
  assert.equal(filterSocketables(sim.catalog.rows,{family:'runes',query:'angelic'}).length,0);
});
console.log(`${tests} history, catalog and socket browser tests passed.`);
