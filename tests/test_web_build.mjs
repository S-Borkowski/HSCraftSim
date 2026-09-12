import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { gunzipSync } from 'node:zlib';
import { Sim, loadData } from '../engine/index.js';
import { packItem } from '../engine/session.js';
import { cacheItemStats } from '../ui/stat-cache.js';

const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
const read=async p=>JSON.parse(await readFile(new URL(p,root)));
const report=await read('dist/build-report.json');
const prefix=`assets/${report.revision}/`,runtimePath=`${prefix}data/`;
const packed=JSON.parse(gunzipSync(await readFile(new URL(runtimePath+'runtime.bin',dist))));
assert.deepEqual(packed,await read(`dist/${runtimePath}runtime.json`));
assert.ok(report.compressedDataBytes<report.sourceDataBytes*.2,'Runtime data exceeds the 20% transfer budget');
assert.equal(packed.profiles.editorSource,undefined);
assert.doesNotMatch(JSON.stringify(packed),/[A-Z]:\\\\Users\\\\/,'Public payload must not contain local paths');
const model=await read('data/item_profiles.json');delete model.editorSource;delete model.coverage;
assert.deepEqual(packed.profiles,model,'Packaging must preserve every simulation profile and semantic');
const source=new Sim({recipes:await read('data/recipes.json'),catalog:await read('data/items_catalog.json'),statNames:await read('data/stat_names.json'),pools:await read('data/stat_pools.json'),attributes:await read('data/translations/attributes.json'),profiles:model});
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://test').pathname.replace(/^\/craft\//,'/');
    const p=pathname==='/'?'index.html':pathname.slice(1);
    if(p.includes('..'))throw new Error('Invalid path');
    const bytes=await readFile(new URL(p,dist));
    res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html':'application/octet-stream');
    res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;
let worker;
try{
  for(const mount of ['/','/craft/']){
    const index=await (await fetch(origin+mount)).text();
    const base=new URL(index.match(/<base href="([^"]+)"/)[1],origin+mount);
    for(const match of index.matchAll(/(?:src|href|data-bundle)="([^"]+)"/g)){
      if(match[0].startsWith('href=')&&match[1].startsWith('./assets/'))continue;
      const url=new URL(match[1],base);
      if(url.origin!==new URL(origin).origin){
        assert.equal(url.protocol,'https:','External links must use HTTPS');
        assert.equal(report.edition,'community','Website builds must not contain external community links');
        assert.equal(url.href,'https://discord.gg/3wWfYubgb3','Unexpected external link');
        continue;
      }
      assert.ok(url.pathname.startsWith(mount));
      const response=await fetch(url);assert.equal(response.status,200,`Missing HTML asset: ${url}`);
    }
    const sim=await loadData('',new URL('../data/runtime.bin',base).href);
    assert.deepEqual(sim.recipes,source.recipes);
    assert.deepEqual(sim.texts,await read('data/current_item_text.json'));
    for(const key of Object.keys(source.statNames))assert.equal(sim.statLabel(key),source.statLabel(key));
    for(const row of source.catalog.rows){
      const def={a:123456,j:row.sub,c:row.kind==='unique'?1:0};
      const item=sim.makeItem(row.cls,row.b,def,{row});
      assert.deepEqual(sim.stats(item),source.stats(source.makeItem(row.cls,row.b,def,{row})),`Stats changed for ${row.name}`);
    }
  }
  const bundle=`${origin}/craft/${runtimePath}runtime.bin`;
  const decoder=globalThis.DecompressionStream;
  try{globalThis.DecompressionStream=undefined;assert.equal((await loadData('',bundle)).recipes.length,source.recipes.length);}finally{globalThis.DecompressionStream=decoder;}
  const recipe=source.recipes.find(r=>r.mechanic==='random_orbs');
  const stacks=recipe.ingredients.map((i,x)=>({id:`input-${x}`,item:source.makeItem(i.itemType,i.itemId),amount:20,x,y:0}));
  const before=structuredClone(stacks),expected=source.monteCarlo(recipe,stacks,100000,237);
  worker=new Worker(new URL('analysis-worker-adapter.mjs',import.meta.url));
  const message=once(worker,'message');
  worker.postMessage({id:1,recipeIndex:recipe.index,stacks:stacks.map(s=>({...s,item:packItem(s.item)})),count:100000,seed:237,config:{},bundle});
  const [result]=await message;assert.equal(result.error,undefined);assert.deepEqual(result.values,expected);assert.deepEqual(stacks,before);
  let generations=0;const mock={stats:item=>({value:item.def.a*item.info.tier,call:++generations})};cacheItemStats(mock);
  const item={def:{a:10},info:{tier:1}};const first=mock.stats(item);assert.strictEqual(mock.stats(item),first);
  item.def.a=11;assert.equal(mock.stats(item).value,11);item.info.tier=2;assert.equal(mock.stats(item).value,22);assert.equal(generations,3);
  const assets=await readdir(new URL(prefix,dist));assert.deepEqual(assets.sort(),['data','engine','ui']);
  console.log(`PASS Static root/subfolder assets, compressed/fallback loading, all ${source.catalog.rows.length} item stats, 100,000 worker trials, mutation-safe caching; ${report.dataReductionPercent}% less data.`);
}finally{if(worker)await worker.terminate();server.close();server.closeAllConnections();}
