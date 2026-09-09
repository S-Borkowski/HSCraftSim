import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=path.join(root,'dist');
const read=relative=>readFile(path.join(root,relative));
const json=async relative=>JSON.parse(await read(relative));
const sources={recipes:'recipes.json',catalog:'items_catalog.json',statNames:'stat_names.json',pools:'stat_pools.json',attributes:'translations/attributes.json',profiles:'item_profiles.json',texts:'current_item_text.json'};
const runtime={};let sourceBytes=0;
for(const [key,name] of Object.entries(sources)){
  let bytes;
  try{bytes=await read(`data/${name}`);}catch(error){
    if(error.code==='ENOENT')throw new Error(`Local data is required: data/${name}. See LOCAL-DATA.md before building a source checkout.`,{cause:error});
    throw error;
  }
  sourceBytes+=bytes.length;runtime[key]=JSON.parse(bytes);
}
// Import diagnostics are local provenance, not part of the simulation model.
delete runtime.profiles.editorSource;
delete runtime.profiles.coverage;
runtime.attributes={entries:Object.fromEntries(Object.entries(runtime.attributes.entries).map(([key,value])=>[key,{en:value.en}]))};
const data=Buffer.from(JSON.stringify(runtime));
const compressed=gzipSync(data,{level:9});
const files=new Map();
const html=await read('ui/index.html');
const styles=[...html.toString().matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
const css=(await Promise.all(styles.map(name=>read(`ui/${name}`)))).map(b=>b.toString()).join('\n');
files.set('ui/app.css',Buffer.from(css));
for(const dir of ['ui','engine'])for(const name of (await readdir(path.join(root,dir))).sort())if(name.endsWith('.js'))files.set(`${dir}/${name}`,await read(`${dir}/${name}`));
files.set('data/runtime.bin',compressed);
files.set('data/runtime.json',data);
const game=new Set(['manifest.json']);
for(const source of [html.toString(),css,...[...files.entries()].filter(([p])=>p.endsWith('.js')).map(([,b])=>b.toString())]){
  for(const match of source.matchAll(/\.\.\/data\/game\/([\w.-]+)/g))game.add(match[1]);
}
for(const name of [...game].sort()){
  if(name==='manifest.json'){const manifest=await json('data/game/manifest.json');delete manifest.gamePath;files.set(`data/game/${name}`,Buffer.from(JSON.stringify(manifest)));}
  else files.set(`data/game/${name}`,await read(`data/game/${name}`));
}
const sprites=new Set(runtime.catalog.map(row=>row.spr).filter(id=>id!=null));
for(const recipe of runtime.recipes.recipes)for(const item of [recipe.result,...recipe.ingredients])if(item.sprite!=null)sprites.add(item.sprite);
for(const id of [...sprites].sort((a,b)=>a-b)){
  if(!Number.isInteger(Number(id)))throw new Error(`Invalid sprite ID: ${id}`);
  files.set(`data/icons/${id}.png`,await read(`data/icons/${id}.png`));
}
const hash=createHash('sha256').update(html);
for(const [name,bytes] of files)hash.update(name).update(bytes);
const revision=hash.digest('hex').slice(0,16);
const prefix=`assets/${revision}`;
// Only remove this script's fixed generated directory after checking its boundary.
if(path.dirname(output)!==root||path.basename(output)!=='dist')throw new Error('Invalid build output path.');
await rm(output,{recursive:true,force:true});
for(const [name,bytes] of files){const target=path.join(output,prefix,name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);}
const index=html.toString()
  .replace('<head>','<head>\n  <base href="./'+prefix+'/ui/">')
  .replace(/<link rel="stylesheet" href="[^"]+">/g,'')
  .replace('</head>','  <link rel="stylesheet" href="app.css">\n</head>')
  .replace('class="brand" href="./"','class="brand" href="../../../"')
  .replace('href="#workshop-view"','href="../../../#workshop-view"')
  .replace('data-module="app.js"','data-module="app.js" data-bundle="../data/runtime.bin"')
  .replace('A local Hero Siege Cube crafting simulator.','An interactive Hero Siege Cube crafting simulator.');
await writeFile(path.join(output,'index.html'),index);
const report={version:(await json('package.json')).version,revision,files:files.size+1,itemImages:sprites.size,sourceDataBytes:sourceBytes,compressedDataBytes:compressed.length,dataReductionPercent:Number((100*(1-compressed.length/sourceBytes)).toFixed(1)),totalBytes:[...files.values()].reduce((n,b)=>n+b.length,Buffer.byteLength(index))};
await writeFile(path.join(output,'build-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
