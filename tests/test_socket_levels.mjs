import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim} from '../engine/index.js';
import {socketRequiredLevel,socketableRequiredLevel} from '../engine/socket_levels.js';
import {setSocketContent} from '../engine/item_setup.js';
import {captureItem} from '../engine/history.js';
import {packItem,unpackItem,transact} from '../engine/session.js';
import {itemTooltipHtml} from '../ui/item-tooltip.js';

const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const native=read('./current_socket_level_native.json');
assert.equal(native.buildSha256,'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4');
assert.equal(native.fixtures.length,576);
for(const f of native.fixtures) {
  assert.equal(socketableRequiredLevel(f.id),f.childLevel);
  const item={info:{requiredLevel:f.baseLevel},def:{s1:btoa(JSON.stringify({a:1,b:f.id,c:0}))}};
  assert.equal(socketRequiredLevel(item,1),f.requiredLevel,JSON.stringify(f));
  assert.equal(socketRequiredLevel(item,0),f.baseLevel,'Inactive socket payload does not raise the level');
}

const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),
  statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const base=sim.makeItem(3,0,{a:1,c:0,j:1,n:1001});
assert.equal(base.info.rarity,1);
assert.equal(sim.sockets(base).count,1);
assert.ok(base.info.requiredLevel<38);
const high=setSocketContent(sim,base,0,sim.catalog.find(15,33,false));
assert.equal(high.info.runeword,undefined);
assert.equal(high.info.requiredLevel,69,'An incomplete Rune sequence still raises the level');
assert.equal(sim.makeItem(15,33).info.requiredLevel,69);
assert.match(itemTooltipHtml(sim,high),/Level req\. 69/);
const snapshot=captureItem(sim,high);
assert.equal(snapshot.requiredLevel,69);
assert.deepEqual(captureItem(sim,unpackItem(sim,packItem(high))),snapshot);
const gem=setSocketContent(sim,high,0,sim.catalog.find(15,69,false));
assert.equal(gem.info.requiredLevel,38);
assert.match(itemTooltipHtml(sim,gem),/Level req\. 38/);
assert.equal(snapshot.requiredLevel,69,'Later socket edits cannot overwrite History');
assert.equal(setSocketContent(sim,gem,0,null).info.requiredLevel,base.info.requiredLevel);

const inputs=(recipe,item)=>recipe.ingredients.map((i,n)=>({id:String(n),amount:i.amount,
  item:i.itemId==null?item:sim.makeItem(i.itemType,Array.isArray(i.itemId)?i.itemId[0]:i.itemId)}));
const insert=sim.recipes.find(r=>r.mechanic==='socket_rune'&&r.rune===33);
const inserted=transact(sim,insert,inputs(insert,base),42);
assert.equal(inserted.after.info.requiredLevel,69);
const empty=sim.recipes.find(r=>r.mechanic==='empty_sockets');
const cleared=transact(sim,empty,inputs(empty,inserted.after),42);
assert.equal(cleared.after.info.requiredLevel,base.info.requiredLevel);
assert.equal(inserted.after.info.requiredLevel,69);
assert.equal(socketRequiredLevel({info:{requiredLevel:25},def:{s1:'invalid'}},1),25);
console.log(`PASS ${native.fixtures.length} native socket levels; Rune/gem insertion, replacement, removal, craft, tooltip, immutable History and reload.`);
