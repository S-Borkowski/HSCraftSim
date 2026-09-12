// Usage: AGENT_BROWSER_CLI=... node tests/test_edition_browser.mjs LOCAL_URL community|website
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const [base,edition]=process.argv.slice(2),cli=process.env.AGENT_BROWSER_CLI;
assert.ok(cli);assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+\//);assert.ok(['community','website'].includes(edition));
const session=`credits-${edition}-qa`,dir=path.resolve(`tests/_output/editions/${edition}`);
fs.mkdirSync(dir,{recursive:true});let command=0;
function browser(...args){
  const output=path.join(dir,`command-${++command}.log`),fd=fs.openSync(output,'w');
  try{execFileSync(process.execPath,[cli,'--session',session,...args],{stdio:['ignore',fd,fd],timeout:30000});}finally{fs.closeSync(fd);}
  return fs.readFileSync(output,'utf8');
}
function evaluate(code){return JSON.parse(execFileSync(process.execPath,[cli,'--session',session,'eval','--stdin'],{input:code,encoding:'utf8',timeout:30000}).trim());}
const expected=edition==='community'?['https://discord.gg/3wWfYubgb3']:[],checks=[];
try{
  browser('open',base);
  assert.equal(evaluate(`(async()=>{for(let n=0;n<100;n++){if(document.querySelector('#application')?.getAttribute('aria-busy')==='false')return true;await new Promise(r=>setTimeout(r,50));}return false;})()`),true);
  browser('snapshot','-i');
  const saved=evaluate(`localStorage.getItem('hscraftsim.workshop.v2')`);
  for(const [w,h] of [[1920,1080],[1366,768],[1280,720],[1024,768],[390,844]]){
    browser('set','viewport',String(w),String(h));browser('snapshot','-i');
    const page=evaluate(`(()=>{const r=document.querySelector('#about-open').getBoundingClientRect();return {edition:document.body.dataset.edition,creator:document.querySelector('.creator-credit').textContent.trim(),links:[...document.querySelectorAll('.community-footer a')].map(a=>a.href),size:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],button:[r.left,r.top,r.right,r.bottom]};})()`);
    assert.equal(page.edition,edition);assert.equal(page.creator,'Created by Falor');assert.deepEqual(page.links,expected);assert.deepEqual(page.size,[w,h]);
    assert.ok(page.button[0]>=0&&page.button[1]>=0&&page.button[2]<=w&&page.button[3]<=h);
    browser('screenshot',path.join(dir,`footer-${w}.png`));
    browser('click','#about-open');browser('snapshot','-i');
    const about=evaluate(`(()=>{const d=document.querySelector('#about'),r=d.getBoundingClientRect();return {open:d.open,creator:document.querySelector('#creator-name').textContent,cards:d.querySelectorAll('.credit-card').length,links:[...d.querySelectorAll('a')].map(a=>({url:a.href,target:a.target,rel:a.rel})),text:d.textContent,rect:[r.left,r.top,r.right,r.bottom],overflow:d.scrollWidth>d.clientWidth+1};})()`);
    assert.equal(about.open,true);assert.equal(about.creator,'Falor');assert.equal(about.cards,1);assert.doesNotMatch(about.text,/Graxy|Garaxy|Hosted by/i);
    assert.deepEqual(about.links.map(a=>a.url),expected);assert.ok(about.links.every(a=>a.target==='_blank'&&a.rel.includes('noopener')));
    if(edition==='website')assert.doesNotMatch(about.text,/Discord/i);
    assert.ok(about.rect[0]>=0&&about.rect[1]>=0&&about.rect[2]<=w&&about.rect[3]<=h);assert.equal(about.overflow,false);
    browser('screenshot',path.join(dir,`about-${w}.png`));
    browser('press','Escape');assert.equal(evaluate(`document.querySelector('#about').open`),false);
    assert.equal(evaluate(`document.activeElement.id`),'about-open');
    browser('click','#about-open');browser('click','#about [data-close="about"]:not(.icon-button)');
    assert.equal(evaluate(`document.querySelector('#about').open`),false);
    assert.equal(evaluate(`localStorage.getItem('hscraftsim.workshop.v2')`),saved,'Credits navigation must not alter the session');
    checks.push({viewport:[w,h],ok:true});console.log(`PASS ${edition} ${w}x${h}: creator, links, footer, About, close/focus and preserved session`);
  }
  browser('click','#about-open');browser('click','#footer-info');assert.equal(evaluate(`document.querySelector('#help').open`),true);browser('press','Escape');
  assert.equal(browser('errors').trim(),'');
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({ok:true,edition,base,checks},null,2));
}catch(error){browser('screenshot',path.join(dir,'failure.png'));throw error;}finally{browser('close');}
