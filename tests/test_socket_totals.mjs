import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sim } from '../engine/index.js';
import { configureItem, setSocketContent } from '../engine/item_setup.js';
import { itemTooltipHtml } from '../ui/item-tooltip.js';
import { packItem, unpackItem } from '../engine/session.js';
import { SOCKETABLE_RULES } from '../engine/socketable_rules.js';
import { socketContribution } from '../engine/socket_stats.js';
import { SOCKET_ENHANCEMENTS } from '../engine/socket_enhancement_rules.js';
import { captureItem } from '../engine/history.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('data/recipes.json'),catalog:read('data/items_catalog.json'),statNames:read('data/stat_names.json'),pools:read('data/stat_pools.json'),attributes:read('data/translations/attributes.json'),profiles:read('data/item_profiles.json')});
const row=sim.catalog.rows.find(r=>r.name==="St. Jupe's Plate of Command");
const armor=sim.makeItem(row.cls,row.b,{a:123456,c:1},{row});
const value=(item,key)=>sim.stats(item).stats.find(s=>s.key===key)?.value??0;
const gem=sim.catalog.find(15,78,false);
let cases=0;
for (const [id,definition] of Object.entries(SOCKETABLE_RULES.definitions)) {
  const item=sim.makeItem(15,Number(id),{a:123456});
  const actual=Object.fromEntries(sim.stats(item).stats.map(s=>[s.key,s.value]));
  assert.deepEqual(actual,definition,`Current socketable ${id}`);cases++;
}
for (const stars of [0,1,3,5]) for (const corrupted of [false,true]) {
  const base=configureItem(sim,armor,{stars,corrupted,sockets:6});
  let filled=setSocketContent(sim,base,0,gem);
  filled=setSocketContent(sim,filled,1,gem);
  assert.equal(value(filled,201),value(base,201)+2,'Each Angelic Gem adds one talent after star/corruption processing');
  assert.equal(sim.stats(filled).socketsResolved,true);
  assert.equal(value(unpackItem(sim,packItem(filled)),201),value(filled,201),'Session round trip preserves totals');
  const single=setSocketContent(sim,filled,0,null);
  assert.equal(value(single,201),value(base,201)+1);
  assert.deepEqual(sim.stats(setSocketContent(sim,single,1,null)),sim.stats(base),'Removing stones restores original totals');
  assert.match(itemTooltipHtml(sim,filled),/Socket bonuses are included in the totals/);
}
const normal=configureItem(sim,armor,{sockets:6});
const crystal=configureItem(sim,normal,{crystal:1});
const filled=setSocketContent(sim,crystal,0,gem);
assert.equal(value(filled,201),value(crystal,201)+1,'Socket contribution follows Crystal, independently of the existing affix');
assert.ok(sim.stats(crystal).crystalResolved);
assert.deepEqual(sim.stats(unpackItem(sim,packItem(filled))),sim.stats(filled));
const invalid=sim.makeItem(armor.itemType,armor.itemId,{...normal.def,s1:'invalid base64'},{row});
assert.equal(sim.stats(invalid).socketsResolved,false);
assert.match(itemTooltipHtml(sim,invalid),/Some socket effects could not be included/);
assert.equal(socketContribution(15.9),15);
assert.equal(socketContribution(-15.9),-16);
assert.equal(socketContribution(15,1),22);
const levelRow=sim.catalog.find(1,2,true),levelBase=sim.makeItem(1,2,{a:123456,c:1},{row:levelRow});
const low=configureItem(sim,levelBase,{level:25}),high=configureItem(sim,levelBase,{level:100});
const snapshot=captureItem(sim,low);
for(const stat of sim.stats(high).stats.filter(s=>s.characterLevel)) {
  const previous=sim.stats(low).stats.find(s=>s.key===stat.key);
  assert.equal(stat.displayValue,previous.displayValue*4);
  assert.equal(stat.value,previous.value,'Level does not change the rolled coefficient');
}
assert.deepEqual(captureItem(sim,unpackItem(sim,packItem(low))),snapshot);
assert.match(itemTooltipHtml(sim,low),/at level 25/);
assert.throws(()=>configureItem(sim,low,{level:0}),/1–100/);
for(const [key,enhancements] of Object.entries(SOCKET_ENHANCEMENTS)) {
  const [kind,cls,sub,b]=key.split(':'),r=sim.catalog.find(+cls,+b,true,+sub);
  assert.ok(r,key);
  let target=sim.makeItem(+cls,+b,{a:123456,c:1},{row:r});
  const count=Math.min(target.info.maxSockets,6);
  if(!count)continue;
  target=configureItem(sim,target,{sockets:count});
  // El adds 15 flat damage: a 50% boost must floor to 22, per socket.
  const stone=sim.catalog.find(15,1,false),child=sim.stats(sim.makeItem(15,1)).stats;
  for(let i=0;i<count;i++) {
    const inserted=setSocketContent(sim,target,i,stone);
    for(const stat of child.filter(s=>Number.isFinite(s.value)&&s.key>=22))
      assert.equal(value(inserted,stat.key)-value(target,stat.key),socketContribution(stat.value,enhancements[i]),`${key} socket ${i+1}`);
    if(enhancements[i])assert.match(itemTooltipHtml(sim,inserted),/\+50% socket effect/);
  }
}
console.log(`PASS ${cases} current socketable definitions; socket insertion/removal, combined stars/corruption/Crystal, persistence and unresolved payloads.`);
