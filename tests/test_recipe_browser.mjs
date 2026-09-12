// Run against a local source or production server with AGENT_BROWSER_CLI set.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const cli=process.env.AGENT_BROWSER_CLI,base=process.argv[2];
assert.ok(cli,'Set AGENT_BROWSER_CLI to the installed CLI JavaScript entry point.');
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+\//);
const session='recipe-navigation-qa',dir=path.resolve('tests/_output/recipe-navigation');
fs.mkdirSync(dir,{recursive:true});
let command=0;
function browser(...args){
  const log=path.join(dir,`command-${++command}.log`),fd=fs.openSync(log,'w');
  try{execFileSync(process.execPath,[cli,'--session',session,...args],{stdio:['ignore',fd,fd],timeout:30000});}
  finally{fs.closeSync(fd);}
  return fs.readFileSync(log,'utf8');
}
function evaluate(code){return JSON.parse(execFileSync(process.execPath,[cli,'--session',session,'eval','--stdin'],{input:code,encoding:'utf8',timeout:30000}).trim());}
const saved=()=>evaluate(`(()=>{const s=JSON.parse(localStorage.getItem('hscraftsim.workshop.v2')).state;return Object.fromEntries(['stacks','stash','history','rng','crafts','spent','results'].map(k=>[k,s[k]]));})()`);
function opened(w,h){
  const state=evaluate(`(()=>{const d=document.querySelector('#recipes-dialog'),r=d.getBoundingClientRect(),list=document.querySelector('#recipe-list');return {open:d.open,focus:document.activeElement.id,inside:d.contains(list),items:list.querySelectorAll('[data-recipe]').length,rect:[r.left,r.top,r.right,r.bottom],overflow:d.scrollWidth>d.clientWidth+1};})()`);
  assert.equal(state.open,true,'Recipes must visibly open a dialog, including on desktop');
  assert.equal(state.focus,'recipe-search');assert.equal(state.inside,true);assert.ok(state.items>0);
  assert.ok(state.rect[0]>=0&&state.rect[1]>=0&&state.rect[2]<=w+1&&state.rect[3]<=h+1);
  assert.equal(state.overflow,false);
}
function closed(){
  assert.deepEqual(evaluate(`({open:document.querySelector('#recipes-dialog').open,restored:document.querySelector('.recipe-panel').parentElement.classList.contains('workspace')})`),{open:false,restored:true});
}
const checks=[];
try{
  browser('open',base);
  assert.equal(evaluate(`(async()=>{for(let n=0;n<100;n++){if(document.querySelector('#application')?.getAttribute('aria-busy')==='false')return true;await new Promise(r=>setTimeout(r,50));}return false;})()`),true);
  browser('snapshot','-i');browser('click','[data-grid="4"]');
  const before=saved();
  for(const [w,h] of [[1920,1080],[1366,768],[1280,720],[1024,768],[390,844]]){
    browser('set','viewport',String(w),String(h));browser('snapshot','-i');
    browser('click','#recipes-open');opened(w,h);browser('snapshot','-i');
    browser('screenshot',path.join(dir,`recipes-${w}.png`));
    browser('press','Escape');closed();assert.equal(evaluate('document.activeElement.id'),'recipes-open');
    for(const key of ['r','/']){
      browser('press',key);opened(w,h);browser('click','[data-close="recipes-dialog"]');closed();
    }
    browser('click','#recipes-open');browser('fill','#recipe-search','Satanic Dice');browser('snapshot','-i');
    const choice=evaluate(`(()=>{const b=document.querySelector('#recipe-list [data-recipe]');return {id:b.dataset.recipe,name:b.querySelector('strong').textContent};})()`);
    assert.match(choice.name,/Satanic Dice/i);
    browser('click',`#recipe-list [data-recipe="${choice.id}"]`);
    assert.equal(evaluate(`document.querySelector('#recipes-dialog').open`),true,'Single click keeps the tile available for double-click preparation');
    browser('click','#recipe-use');closed();
    assert.equal(evaluate(`document.querySelector('#active-recipe-name').textContent`),choice.name);
    browser('click','#recipes-open');browser('fill','#recipe-search','');browser('press','Escape');closed();
    assert.deepEqual(saved(),before,'Browsing and selecting recipes must preserve items, RNG and History');
    checks.push({viewport:[w,h],ok:true});console.log(`PASS ${w}x${h}: Recipes, R, /, search, selection, Escape, close button and unchanged craft state`);
  }
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({ok:true,base,checks},null,2)+'\n');
}finally{browser('close');}
