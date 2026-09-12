import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {editionHtml,readEdition} from '../tools/editions.mjs';
const html=await readFile(new URL('../ui/index.html',import.meta.url),'utf8');
if(readEdition(html)==='community'){
  const website=editionHtml(html,'website');
  assert.equal(editionHtml(html,'community'),html,'Community keeps its creator links');
  assert.equal((html.match(/https:\/\/discord\.gg\/3wWfYubgb3/g)||[]).length,2);
  assert.doesNotMatch(html,/Graxy|Garaxy|fDtXAQu5c3|host-name|host-card/i);
  assert.equal(readEdition(website),'website');
  assert.doesNotMatch(website,/Discord|discord\.gg|host-name|host-card/i);
  for(const text of ['Created by <strong>Falor</strong>','id="creator-name">Falor','id="about-open"','id="footer-info"','Game credits'])assert.ok(website.includes(text),text);
  assert.equal(website.slice(website.indexOf('<main'),website.indexOf('<footer class="footer')),html.slice(html.indexOf('<main'),html.indexOf('<footer class="footer')),'Crafting markup is identical');
  assert.throws(()=>editionHtml(html,'unknown'));
  assert.throws(()=>editionHtml(website,'community'),'Cannot accidentally regenerate Community links in a Website checkout');
}else{
  assert.doesNotMatch(html,/Discord|discord\.gg|host-name|host-card/i);
  assert.ok(html.includes('Created by <strong>Falor</strong>'));
}
console.log('PASS edition boundaries: expected links, creator attribution, no host credit, identical crafting UI.');
