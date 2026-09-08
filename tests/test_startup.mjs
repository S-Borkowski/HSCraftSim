import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { latestDesktopSession } from '../ui/desktop-storage.js';

// A small DOM fixture verifies the disk-opening guard without executing imports.
const nodes=new Map();
const create=()=>({style:{},children:new Map(),setAttribute(){},querySelector(selector){if(!this.children.has(selector))this.children.set(selector,{textContent:'',remove(){this.removed=true;}});return this.children.get(selector);}});
const document={currentScript:{dataset:{module:'app.js'}},createElement:create,getElementById:id=>nodes.get(id),querySelector:()=>({setAttribute(){}}),body:{append:node=>nodes.set(node.id,node)}};
vm.runInNewContext(readFileSync(new URL('../ui/startup.js',import.meta.url),'utf8'),{document,location:{protocol:'file:'},setTimeout(){throw Error('Direct-file startup must not attempt module loading or wait forever');}});
const notice=nodes.get('startup-notice');
assert.equal(notice.querySelector('h1').textContent,'Open the launcher to start crafting');
assert.match(notice.querySelector('p').textContent,/HSCraftSim\.exe/);
assert.match(notice.querySelector('p').textContent,/Start\.bat/);
assert.equal(notice.querySelector('button').removed,true);
const session=n=>JSON.stringify({schema:2,desktopRevision:n,state:{}});
assert.equal(latestDesktopSession(session(3),session(4)),session(4),'Reload must preserve a newer in-flight local snapshot');
assert.equal(latestDesktopSession(session(5),session(4)),session(5),'Old cached browser origins must not replace the native save');
assert.equal(latestDesktopSession(session(5),null),session(5));
assert.equal(latestDesktopSession(null,session(1)),session(1));
console.log('PASS Direct-file startup message, no module attempt, desktop reload/restart revision selection.');
