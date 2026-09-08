import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Sim,generateStats} from '../engine/index.js';
import {applyItemModifiers} from '../engine/item_modifiers.js';
import {applyCrystal} from '../engine/crystal.js';
import {applyRuneword,runewordRequiredLevel} from '../engine/runewords.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const sim=new Sim({recipes:read('../data/recipes.json'),catalog:read('../data/items_catalog.json'),
  statNames:read('../data/stat_names.json'),pools:read('../data/stat_pools.json'),profiles:read('../data/item_profiles.json')});
const checkpoint=process.argv.includes('--checkpoint');
const source=checkpoint?{buildSha256:'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4',
  fixtures:fs.readFileSync(new URL('../research/current/full-word-pipeline-checkpoint.jsonl',import.meta.url),'utf8')
    .split('\n').slice(0,-1).filter(Boolean).map(line=>JSON.parse(line))}:read('./current_full_word_pipeline_native.json');
assert.equal(source.buildSha256,'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4');
const hidden=new Set([21,24,108,110,221,295,447]);
const visible=key=>+key>=20&&!hidden.has(+key);
const failures=[];let values=0;
for(const f of source.fixtures) {
  const definition=structuredClone(f.definition);
  for(let i=1;i<=6;i++)if(definition['s'+i])definition['s'+i]=btoa(JSON.stringify(definition['s'+i]));
  const item=sim.makeItem(Number(f.profile.split(':')[1]),definition.b,definition);
  try {
    assert.equal(item.info.runeword?.id??0,f.word,'word recognition');
    // This native capture ends before socket contributions. The complete item
    // now also raises the level for socketed gems/Rune sequences without a word.
    const beforeSockets={...item,info:{...item.info,requiredLevel:item.info.baseRequiredLevel}};
    assert.equal(f.word?runewordRequiredLevel(beforeSockets,item.info.socketCount):item.info.baseRequiredLevel,f.info[1],'required level before socket contributions');
    const base=generateStats(item,sim.pools,sim.statNames,null,sim.model);
    const result=applyRuneword(item,applyCrystal(item,applyItemModifiers(item,base,sim.model),sim.model),sim.model);
    const actual=Object.fromEntries(result.stats.filter(s=>visible(s.key)).map(s=>[s.key,s.value]));
    const expected=Object.fromEntries(Object.entries(f.stats).filter(([key])=>visible(key)));
    assert.deepEqual(actual,expected,'combined base, stars/corruption, Crystal and word values');
    values+=Object.keys(expected).length;
  } catch(error){failures.push({profile:f.profile,definition:f.definition,message:error.message});}
}
if(failures.length)console.log(JSON.stringify(failures.slice(0,5),null,2));
assert.equal(failures.length,0,`${failures.length}/${source.fixtures.length} full word chains differ`);
if(!checkpoint&&!process.argv.includes('--partial'))assert.equal(new Set(source.fixtures.map(f=>f.intendedWord)).size,93);
console.log(`PASS ${source.fixtures.length} complete native Crystal/Runeword chains; ${values} combined properties and required levels.`);
