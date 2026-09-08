import { recipeCardHtml } from './recipe-card.js';
import { recipeContext } from '../engine/recipe_context.js';
import { loadData, TIER_NAMES, matchRecipe } from '../engine/index.js';
import { ingredientAccepts } from '../engine/recipes.js';
import { validateCraft, validateTarget, validateTargetStack, outcomeProbabilities, EXPERIMENTAL, UNSUPPORTED } from '../engine/validation.js';
import { findPosition, canPlace, canStackItems, packItem, unpackItem } from '../engine/session.js';
import { prepareIngredients, craftReadiness, runCraftAction } from '../engine/craft_action.js';
import { lastCraftHtml } from './last-craft.js';
import { craftOutcome } from './craft-outcome.js';
import { itemTooltipHtml, itemDescription, itemTypeName, playerStatName, playerStatValue, cleanGameText, WEAPON_TYPES } from './item-tooltip.js';
import { freshSeed, sessionStartSeed } from '../engine/session_random.js';
import { cacheItemStats } from './stat-cache.js';
import { desktopStorage, latestDesktopSession } from './desktop-storage.js';
import { filterCatalog, isEquipment, isCorrupted, starLevel, socketContents } from '../engine/item_setup.js';
import { createItemSetup } from './item-setup.js';
import { catalogTarget } from '../engine/catalog_target.js';
import { itemVersions } from '../engine/history.js';
import { historyComparisonHtml, comparisonChoices, savedItemHtml } from './history-view.js';

import { isCodex, configureCodex } from '../engine/codex.js';
import { codexRecipeHtml, codexInspectorHtml } from './codex-workshop.js';
import { runewordRecipeHtml } from './runeword-workshop.js';
import { rarityColor, itemRarity, CATALOG_RARITIES } from './rarity.js';
import { VAULT_TIERS, vaultOutcomeName } from '../engine/vaults.js';
import { percentLabel } from './probability-format.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=n=>Number(n).toLocaleString('en-US');
const types={0:'Helmet',1:'Armor',2:'Boots',3:'Weapon',4:'Gloves',5:'Amulet',6:'Shield',7:'Ring',8:'Belt',10:'Charm',11:'Consumable',12:'Key',13:'Tarot',14:'Material',15:'Rune / Gem',16:'Relic',18:'Potion',19:'Other'};
const groupNames={tarot:'Tarot recipes',codex:'Codex',runewords:'Runewords',equipment:'Equipment',materials:'Materials & merges',runes:'Runes',gems:'Gems & jewels'};
const labels={runeword_created:'Runeword formed',rune_inserted:'Rune inserted',codex_upgraded:'Codex tier +1',codex_word:'Orb word formed',orb_inserted:'Orb inserted',socket:'Extra socket',affix:'Extra affix',corrupted:'Corrupted',edited:'Rerolled',created:'Created',level_up:'Star +1',level_down:'Star −1',destiny_fragment:'Destiny fragment',crystal_fragment:'Crystal fragment'};
const colors={socket:'#c7aa71',affix:'#8aa998',corrupted:'#b9665d',edited:'#93acbf',level_up:'#87b096',level_down:'#c7aa71',destiny_fragment:'#94aaca',crystal_fragment:'#b86c69',created:'#a8bb9a'};
const STORAGE='hscraftsim.workshop.v2';
const initialSeed=freshSeed();
let sim, texts={}, state={stacks:[],stash:[],history:[],columns:9,rows:6,recipe:28,rng:initialSeed,seedStart:initialSeed,repeatable:false,jewelLevel:3750,sound:false,favorites:[],crafts:0,spent:0,results:0};
let inspect=null, selectedStack=null, undoStack=[], busy=false, page=0, favOnly=false, view='workshop', previousItem=null, mcResult=null, mcCount=10000;
let toastTimer, itemSetup, pickerTarget=null;
let pickerRarity='',pickerPoolKey='',pickerPool=[],pickerRarities=[];
let pickerCandidates=new Map(),historySelected=null,compareLeft=null,compareRight=null,changesOnly=false;
let desktopApi=null,saveQueue=Promise.resolve(),saveRevision=0;
let tooltipAnchor=null;
const ingredientChoices=new Map();
let readyOnly=false;
let recipeListKey='',recipeCubeKey='',analysisWorker=null,analysisId=0,analysisPending=false;
const recipeSearchText=new Map();
const bundlePath=document.querySelector('script[data-bundle]')?.dataset.bundle;
const bundleUrl=bundlePath?new URL(bundlePath,document.baseURI).href:null;
const drawerHomes={'recipes-dialog':['.recipe-panel','#recipes-home'],'inspector-dialog':['.inspector','#inspector-home'],'inventory-dialog':['.stash-panel','#inventory-home']};
function openDrawer(id){hideTooltip();if(id==='recipes-dialog'&&view==='workshop'&&innerWidth>=900){$('#recipe-search').focus();return;}const [panel]=drawerHomes[id],dialog=$(`#${id}`);dialog.append($(panel));dialog.showModal();if(id==='recipes-dialog')$('#recipe-search').focus();}
function restoreDrawer(id){const entry=drawerHomes[id];if(entry){const [panel,home]=entry;if($(panel).parentElement===$(`#${id}`))$(home).after($(panel));}hideTooltip();}
function closeDialog(id){$(`#${id}`).close();restoreDrawer(id);}
for(const id of Object.keys(drawerHomes))$(`#${id}`).addEventListener('close',()=>restoreDrawer(id));
function closeDrawers(){for(const id of Object.keys(drawerHomes))if($(`#${id}`).open)closeDialog(id);}
function selectRecipe(index){if(busy)return;cancelAnalysis();state.recipe=index;mcResult=null;closeDrawers();showView('workshop');if(innerWidth<650)setWorkshopPane('recipe');render();save();}
function setWorkshopPane(pane){$('#workshop-view').dataset.pane=pane;$$('[data-pane]').filter(b=>b.matches('button')).forEach(b=>b.setAttribute('aria-selected',b.dataset.pane===pane));requestAnimationFrame(fitCube);}
function fitCube(){const stage=$('.cube-stage');if(!stage.clientWidth||!stage.clientHeight)return;const large=state.columns===9;const scale=Math.max(.1,Math.min(1.65,(stage.clientWidth-26)/(large?381.6:237),(stage.clientHeight-(getComputedStyle($('#cube-hint')).display==='none'?4:60))/(large?266.4:237)));$('#cube-grid').style.setProperty('--grid-scale',scale.toFixed(4));}
new ResizeObserver(fitCube).observe($('.cube-stage'));
function cancelAnalysis(){analysisId++;analysisWorker?.terminate();analysisWorker=null;analysisPending=false;}
function analysisSignature(){return JSON.stringify([state.recipe,state.rng,state.jewelLevel,state.stacks.map(s=>[s.amount,packItem(s.item)])]);}
function runAnalysis(){
  if(busy||analysisPending)return;
  const count=Number($('#mc-count').value),seed=state.rng,id=++analysisId,signature=analysisSignature();
  analysisPending=true;renderAnalysis();
  try{
    analysisWorker ||= new Worker(new URL('../engine/analysis-worker.js',import.meta.url),{type:'module'});
    analysisWorker.onmessage=({data})=>{if(data.id!==analysisId)return;analysisPending=false;if(signature!==analysisSignature()){if(view==='analysis')renderAnalysis();return;}if(data.error)toast(data.error,true);else mcResult={count,seed,values:data.values};if(view==='analysis')renderAnalysis();};
    analysisWorker.onerror=()=>{cancelAnalysis();toast('The simulation could not run. Please try again.',true);if(view==='analysis')renderAnalysis();};
    analysisWorker.postMessage({id,recipeIndex:state.recipe,stacks:snapshot().stacks,count,seed,config:{jewelLevel:state.jewelLevel},bundle:bundleUrl});
  }catch(error){cancelAnalysis();toast(error.message,true);renderAnalysis();}
}
function outcomeLabel(key){if(!key.startsWith('item:'))return labels[key]||key;const [,type,id,unique,subtype]=key.split(':');return vaultOutcomeName(sim.catalog.find(Number(type),Number(id),unique==='1',subtype==null?undefined:Number(subtype)))||'Unknown item';}
function outcomeColor(key){return key.startsWith('item:19:')?rarityColor(VAULT_TIERS[Number(key.split(':')[2])]):colors[key]||colors.created;}
function openCommands(){closeDrawers();$('#command-search').value='';renderCommands();$('#command-menu').showModal();$('#command-search').focus();}
function renderCommands(){
  const q=$('#command-search').value.trim().toLowerCase();
  const actions=[['workshop','Workshop','1'],['analysis','Probabilities','2'],['history','Craft history','3'],['catalog','Item catalog','I'],['recipes','Recipe browser','R'],['inspector','Item inspector','E'],['inventory','Inventory',''],['settings','Settings',''],['help','Help & data status','']].filter(([,name])=>!q||name.toLowerCase().includes(q));
  const score=r=>r.name.toLowerCase()===q?4:r.name.toLowerCase().startsWith(q)?3:r.name.toLowerCase().includes(q)?2:1;
  const recipes=sim.recipes.filter(r=>!q||`${r.name} ${subtitle(r)}`.toLowerCase().includes(q)).sort((a,b)=>q?score(b)-score(a):Number(b.index===state.recipe)-Number(a.index===state.recipe)).slice(0,q?10:4);
  $('#command-results').innerHTML=(actions.length?'<div class="command-section">JUMP TO</div>'+actions.map(([id,name,key])=>`<button class="command-result" data-command="${id}"><span><strong>${name}</strong></span>${key?`<kbd>${key}</kbd>`:''}</button>`).join(''):'')+(recipes.length?'<div class="command-section">RECIPES</div>'+recipes.map(r=>`<button class="command-result" data-command-recipe="${r.index}">${imageFor(recipeSprite(r))}<span><strong>${esc(r.name)}</strong><small>${esc(subtitle(r))}</small></span><span aria-hidden="true">↗</span></button>`).join(''):'')||'<div class="empty-state">No matches. Try an item or recipe name.</div>';
}
function runCommand(id){$('#command-menu').close();if(['workshop','analysis','history'].includes(id))showView(id);else if(id==='catalog')openPicker();else if(['recipes','inspector','inventory'].includes(id))openDrawer(`${id}-dialog`);else $(`#${id}`).showModal();}
const uid=()=>crypto.randomUUID();
const icon=(row,cls='')=>row?.spr!=null?`<img class="${cls}" src="../data/icons/${Number(row.spr)}.png" alt="" loading="lazy" decoding="async">`:`<img class="${cls}" src="../data/game/Craft_Icon_spr_0.png" alt="">`;
const imageFor=(spr,cls='')=>spr!=null?`<img class="${cls}" src="../data/icons/${Number(spr)}.png" alt="" loading="lazy" decoding="async">`:icon(null,cls);
const recipe=()=>sim.recipes.find(r=>r.index===state.recipe);
function category(r){if(r.category==='runewords')return 'runewords';if(r.category==='codex'||['upgrade_codex','essence_of_chaos','random_orbs'].includes(r.mechanic)||(r.result.itemType===11&&[18,23].includes(r.result.itemId)))return'codex';if(r.ingredients.some(i=>i.itemId==null))return'equipment';if(r.ingredients.some(i=>i.itemType===13))return'tarot';if(r.resultType>=37&&r.resultType<=41)return'gems';if(r.ingredients.every(i=>i.itemType===15))return /_rune$/.test(r.result.key||'')?'runes':'gems';return'materials';}
function recipeSprite(r){if(['codex_word','codex_orb'].includes(r.mechanic))return sim.catalog.find(11,23,false).spr;return r.result.sprite??r.ingredients.find(i=>i.itemType===14&&i.sprite)?.sprite??r.ingredients.find(i=>i.sprite)?.sprite;}
function subtitle(r){if(UNSUPPORTED[r.mechanic])return'Data unavailable';if(category(r)==='equipment')return'Modify an item';return r.ingredients.map(i=>`${i.amount}× ${i.name||types[i.itemType]||'item'}`).join(' · ');}
function toast(message,error=false){clearTimeout(toastTimer);const t=$('#toast');t.textContent=message;t.className=`toast show${error?' error':''}`;if(!t.matches(':popover-open'))t.showPopover();toastTimer=setTimeout(()=>{t.classList.remove('show');if(t.matches(':popover-open'))t.hidePopover();},4200);}
const clone=v=>structuredClone(v);
function snapshot(){return{...state,stacks:state.stacks.map(s=>({...s,item:packItem(s.item)})),stash:state.stash.map(s=>({...s,item:packItem(s.item)}))};}
function restore(saved){
  if(!saved||![4,9].includes(saved.columns)||!Array.isArray(saved.stacks)||saved.stacks.length>100||!Array.isArray(saved.stash)||saved.stash.length>5000)throw new Error('Invalid session file.');
  const rows=saved.columns===4?4:6;
  const unpack=s=>{
    if(!s.item||!Number.isInteger(s.amount)||s.amount<1||s.amount>1000000)throw new Error('Invalid item quantity.');
    const item=unpackItem(sim,s.item);
    if(!Number.isFinite(item.def.a)||item.def.a<1||item.def.a>1e9)throw new Error('Invalid item seed.');
    if(!Number.isInteger(item.info.tier)||item.info.tier<0||item.info.tier>6)throw new Error('Invalid tier.');
    return{...s,id:typeof s.id==='string'?s.id:uid(),item,versions:Array.isArray(s.versions)?s.versions.slice(0,10):[]};
  };
  const stacks=saved.stacks.map(unpack), stash=saved.stash.map(unpack);
  for(const s of stacks)if(!canPlace(stacks,s.item,s.x,s.y,saved.columns,rows,s.id))throw new Error('The session contains overlapping or out-of-bounds items.');
  state={...state,...saved,stacks,stash,rows,history:Array.isArray(saved.history)?saved.history.slice(0,100):[],favorites:Array.isArray(saved.favorites)?saved.favorites:[],rng:Math.max(1,Number(saved.rng)||1),jewelLevel:Math.max(0,Math.min(3750,Number(saved.jewelLevel)||0))};
  inspect=state.stacks.find(s=>s.item.itemType<=10)?.item||state.stacks[0]?.item||null;
  selectedStack=state.stacks.find(s=>s.item===inspect)?.id||null;previousItem=null;
}
function save(){
  const payload=JSON.stringify({schema:2,state:snapshot(),desktopRevision:desktopApi?++saveRevision:undefined});
  try{localStorage.setItem(STORAGE,payload);}catch{if(!desktopApi)toast('Browser storage is full. Export your session to save it.',true);}
  if(desktopApi)saveQueue=saveQueue.then(()=>desktopApi.save_session(payload)).then(result=>{if(!result.ok)throw new Error(result.error);}).catch(error=>toast(`Could not save your session: ${error.message}`,true));
}
function checkpoint(){undoStack.push(clone(snapshot()));if(undoStack.length>30)undoStack.shift();}
function undo(){if(busy||!undoStack.length)return;restore(undoStack.pop());mcResult=null;render();save();toast('Last action undone.');}
function buildItem(row,{seed=123456,tier,amount=1}={}){return sim.makeItem(row.cls,row.b,{a:seed,j:row.sub,c:row.kind==='unique'?1:0},{row,isUnique:row.kind==='unique',tier,amount});}
function add(item,amount=1,destination=state.stacks){
  const same=destination.find(s=>canStackItems(s.item,item));
  if(same){same.amount+=amount;return same;}
  const pos=findPosition(destination,item,state.columns,state.rows);
  if(!pos)throw new Error('The Cube is full. Switch to 9 × 6 or move an item to inventory.');
  const s={id:uid(),item,amount,...pos};destination.push(s);return s;
}
function addCatalog(row,options={}){if(busy)return;try{checkpoint();const s=add(buildItem(row,options),options.amount||1);inspect=s.item;selectedStack=s.id;previousItem=null;mcResult=null;render();save();toast(`${row.name} added to the Cube.`);}catch(e){undoStack.pop();toast(e.message,true);}}
function inspectItem(item,id=null){inspect=item;selectedStack=id;previousItem=null;renderInspector();renderCube();if(!$('#inspector-dialog').open){if($('#inventory-dialog').open)closeDialog('inventory-dialog');openDrawer('inspector-dialog');}}
function moveInspected(remove=false){
  if(busy||!inspect)return;
  const inCube=state.stacks.find(s=>s.item===inspect),inStash=state.stash.find(s=>s.item===inspect),s=inCube||inStash;
  if(!s)return;
  const position=!remove&&inStash?findPosition(state.stacks,s.item,state.columns,state.rows):null;
  if(inStash&&!remove&&!position)return toast('The Cube is full. Make room or switch to 9 × 6.',true);
  checkpoint();
  if(inCube){state.stacks=state.stacks.filter(t=>t.id!==s.id);if(!remove)state.stash.push(s);selectedStack=null;}
  else{state.stash=state.stash.filter(t=>t.id!==s.id);if(!remove){state.stacks.push({...s,...position});selectedStack=s.id;}}
  if(remove){inspect=null;selectedStack=null;}
  previousItem=null;render();save();toast(remove?'Item removed.':inCube?'Moved to inventory.':'Moved to Cube.');
}
function fillStarter(){
  const row=sim.catalog.rows.find(r=>r.name==="Harlequinn's Crest")||sim.catalog.rows.find(r=>r.kind==='unique'&&r.cls===0);
  const s=add(buildItem(row,{tier:5}));inspect=s.item;selectedStack=s.id;
  add(buildItem(sim.catalog.find(14,58,false)),1);
}
function renderRecipes(){
  const q=$('#recipe-search').value.toLowerCase().trim(),cat=$('#recipe-category').value;
  const key=JSON.stringify([q,cat,favOnly,state.favorites,readyOnly,state.jewelLevel,state.stacks.map(s=>[s.amount,packItem(s.item)])]);
  if(key===recipeListKey){$$('#recipe-list [data-recipe]').forEach(b=>{const active=Number(b.dataset.recipe)===state.recipe;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});return;}
  recipeListKey=key;
  const cubeKey=JSON.stringify(state.stacks.map(s=>[s.amount,packItem(s.item)])),cubeChanged=cubeKey!==recipeCubeKey;
  recipeCubeKey=cubeKey;
  const filtered=sim.recipes.filter(r=>(cat==='all'||category(r)===cat)&&(!favOnly||state.favorites.includes(r.index))&&(!q||recipeSearchText.get(r.index).includes(q)));
  const contexts=new Map(filtered.map(r=>[r.index,recipeContext(r,state.stacks,{...sim.config,jewelLevel:state.jewelLevel})]));
  const visible=readyOnly?filtered.filter(r=>contexts.get(r.index).ready):filtered;
  $('#recipe-count').textContent=visible.length;
  const groups=Object.entries(groupNames).map(([k,title])=>{
    const priority=[28,29,30,49,48,50,44,40,41,42,16,43];
    const rows=visible.filter(r=>category(r)===k).sort((a,b)=>{
      if(k==='codex'){const order=r=>UNSUPPORTED[r.mechanic]?3:r.mechanic==='codex_word'?0:r.mechanic==='codex_orb'?2:1;return order(a)-order(b);}
      if(k!=='equipment')return 0;
      const ai=priority.indexOf(a.index),bi=priority.indexOf(b.index);
      return (ai<0?999:ai)-(bi<0?999:bi);
    });return {title,rows};
  });
  const ordered=groups.flatMap(g=>g.rows);
  const sections=state.stacks.length?['Ready to craft','For items in your Cube','Other recipes'].map((title,rank)=>({title,rows:ordered.filter(r=>contexts.get(r.index).rank===rank)})):groups;
  $('#recipe-list').innerHTML=sections.filter(g=>g.rows.length).map(({title,rows})=>`<div class="recipe-group-title">${title} <span>${rows.length}</span></div>`+rows.map(r=>recipeCardHtml(r,{selected:r.index===state.recipe,favorite:state.favorites.includes(r.index),unavailable:!!UNSUPPORTED[r.mechanic],summary:subtitle(r),context:contexts.get(r.index)})).join('')).join('')||'<div class="empty-state">No recipes found. Try a different search or category.</div>';
  if(cubeChanged)$('#recipe-list').scrollTop=0;
}
function renderCube(){
  const grid=$('#cube-grid');grid.classList.toggle('large',state.columns===9);
  const cell=state.columns===9?38.4:48,pad=state.columns===9?18:22.5;
  grid.innerHTML=Array.from({length:state.columns*state.rows},(_,i)=>`<button class="grid-cell" data-cell="${i}" style="left:${pad+(i%state.columns)*cell}px;top:${pad+Math.floor(i/state.columns)*cell}px" aria-label="Empty Cube cell ${i+1}" tabindex="-1"></button>`).join('')+
    state.stacks.map(s=>`<button class="grid-item ${s.item.isUnique?'unique':''} ${isCorrupted(s.item)?'corrupted':''} ${s.id===selectedStack?'selected':''}" data-stack="${s.id}" data-tip="${esc(s.item.name)}" draggable="true" style="left:${pad+s.x*cell}px;top:${pad+s.y*cell}px;width:${s.item.info.width*cell}px;height:${s.item.info.height*cell}px" aria-label="${esc(s.item.name)}, ${s.amount} ${s.amount===1?'item':'items'}">${icon(s.item.row)}${s.amount>1?`<span class="amount">${format(s.amount)}</span>`:''}</button>`).join('');
  const used=state.stacks.reduce((n,s)=>n+s.item.info.width*s.item.info.height,0);
  $('#slot-count').textContent=`${used} / ${state.columns*state.rows}`;
  $('#cube-status').textContent=state.stacks.length?`${state.stacks.length} ${state.stacks.length===1?'item':'items'} · ${state.columns*state.rows-used} free cells`:'Cube is empty';
  $$('[data-grid]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.grid)===state.columns);b.setAttribute('aria-pressed',Number(b.dataset.grid)===state.columns);});
  fitCube();
}
function ingredientRow(ing,index){
  const isTarget=ing.itemId==null,candidates=state.stacks.filter(s=>s.amount>0&&ingredientAccepts(ing,s.item));
  const eligible=isTarget?candidates.filter(s=>validateTargetStack(recipe(),s,ing).ok):candidates;
  const count=eligible.reduce((n,s)=>n+s.amount,0),selected=eligible[0]||candidates[0];
  const invalid=isTarget&&selected&&!validateTargetStack(recipe(),selected,ing).ok;
  const alternatives=ing.alternatives||[],choice=ingredientChoices.get(`${state.recipe}:${index}`)??alternatives[0]?.catalogId;
  const row=selected?.item.row||sim.catalog.rows.find(r=>r.id===(alternatives.length?choice:ing.catalogId));
  return `<div class="ingredient-group"><div class="ingredient-row ${invalid?'target-invalid':''}" ${selected?`data-hover-stack="${selected.id}" tabindex="0"`:row?`data-hover-catalog="${row.id}" tabindex="0"`:''}>${icon(row)}<span>${esc(isTarget?(selected?.item.name||(ing.isUnique?'Unique item':'Eligible item')):ing.name)}${ing.tierRequirement!=null&&ing.tierRequirement!==7?` <small>(${TIER_NAMES[ing.tierRequirement]})</small>`:''}</span>${isTarget&&!selected?`<button class="pick-target" data-target="${index}">Choose item</button>`:''}<span class="need ${!invalid&&count>=ing.amount?'enough':''}">${invalid?'Not eligible':`${count>=ing.amount?'✓ ':''}${format(Math.min(count,ing.amount))} / ${format(ing.amount)}`}</span></div>${alternatives.length?`<div class="ingredient-alternatives" role="group" aria-label="Accepted gems"><small>Choose any one</small>${alternatives.map(a=>`<button data-ingredient-choice="${index}" data-choice="${a.catalogId}" data-hover-catalog="${a.catalogId}" aria-pressed="${choice===a.catalogId}" aria-label="${esc(a.name)} — use this gem">${imageFor(a.sprite)}<span>${esc(a.name)}</span></button>`).join('')}</div>`:''}</div>`;
}
function renderDetail(){
  const r=recipe(),v=validateCraft(r,state.stacks,{jewelLevel:state.jewelLevel}),target=v.target||matchRecipe(r,state.stacks,(item,ing,stack)=>validateTargetStack(r,stack,ing).ok).target;
  const action=craftReadiness(sim,r,state.stacks,craftOptions());
  const blocked=!v.ok&&!v.missing,nextRecipe=v.nextMechanic?sim.recipes.find(candidate=>candidate.mechanic===v.nextMechanic&&validateTarget(candidate,v.target).ok):null;
  const status=v.ok?'● Ready to craft':v.unsupported?'Data unavailable':v.targetInvalid?'Item not eligible':v.missing?'Ingredients needed':'Requirements not met';
  const probs=outcomeProbabilities(r,target);
  $('#recipe-detail').innerHTML=`<div class="detail-header">${imageFor(recipeSprite(r))}<div><small>${groupNames[category(r)]}</small><h2>${esc(r.name)}</h2></div><button class="favorite-toggle" id="favorite-toggle" aria-label="${state.favorites.includes(r.index)?'Remove from favorites':'Add to favorites'}">${state.favorites.includes(r.index)?'★':'☆'}</button></div>
    <div class="recipe-body"><p class="detail-description">${esc(r.mechanic==='blessed_dice'?"Reroll an SS-tier item's stats without corrupting it. Natural socket counts can also change, affecting the bonuses from socketed stones.":texts[r.descriptionKey]||r.description||'Combine the ingredients in the Cube.')}</p>
    ${blocked?`<div class="craft-blocker" role="status"><strong>Cannot transmute</strong><p id="craft-block-reason">${esc(v.reason)}</p>${nextRecipe?`<button data-recipe="${nextRecipe.index}">Use ${esc(nextRecipe.name)} ↗</button><small>Empty Sockets removes gems and runes; it keeps the socket slots.</small>`:''}</div>`:''}
    <div class="ingredients">${r.ingredients.map(ingredientRow).join('')}</div>
    ${['gypsys_prophecy','destiny_shard'].includes(r.mechanic)?'<p class="star-roll-help">Each craft rolls independently. At 0 stars, a star-loss roll leaves the item at 0. Corruption resets its stars to 0.</p>':''}
    ${r.result.catalogId!=null&&['create','jewel_tier'].includes(r.mechanic)?`<div class="recipe-output" data-hover-catalog="${r.result.catalogId}" data-preview="true" tabindex="0"><span>RESULT</span>${imageFor(r.result.sprite)}<strong>${format(r.result.amount||1)} × ${esc(r.result.name)}</strong><small>Appears in the Cube</small></div>`:''}
    <div class="detail-tools"><span class="ready ${blocked?'blocked':''}">${status}</span></div>
    ${category(r)==='codex'?codexRecipeHtml(sim,r,state.stacks.find(s=>isCodex(s.item))?.item):''}
    ${category(r)==='runewords'?runewordRecipeHtml(sim,r):''}
    ${probs?`<div class="probability-strip">${Object.entries(probs).map(([k,p])=>`<span style="width:${p*100}%;background:${outcomeColor(k)}"></span>`).join('')}</div><div class="probability-labels">${Object.entries(probs).map(([k,p])=>`<span><i style="background:${outcomeColor(k)}"></i>${esc(outcomeLabel(k))} <b>${percentLabel(p)}</b></span>`).join('')}</div>`:''}
    <div class="craft-actions" aria-label="Craft controls"><div class="craft-dock-info"><strong>${esc(r.name)}</strong><small id="craft-action-reason" class="${!action.ok?'blocked':''}">${esc(!action.ok?action.reason:action.addIngredients?'Add missing ingredients to the Cube first.':'Ingredients ready · Press Craft to combine')}</small></div><button id="dock-prepare" aria-describedby="craft-action-reason" ${!action.ok||!action.addIngredients||busy?'disabled':''}>＋ Add ingredients</button><button class="transmute" id="transmute" aria-label="${busy?'Crafting':'Craft selected recipe'}" aria-describedby="craft-action-reason" ${!v.ok||busy?'disabled':''}>${busy?'Crafting…':'Craft'}</button><button id="batch-open" aria-haspopup="dialog" ${!r.allowMultiCraft||busy?'disabled':''} title="${r.allowMultiCraft?'Craft with materials already in the Cube':'This recipe only supports single crafts'}">Batch craft <span aria-hidden="true">▾</span></button></div>
    ${r.mechanic==='random_orbs'?`<details class="outcome-pool"><summary>8 × one random Orb · 18 possible types</summary><p>Each craft selects a type again and produces 8 copies. Repeated types are possible.</p><div class="pool-grid">${Array.from({length:18},(_,i)=>sim.catalog.find(15,112+i,false)).map(row=>`<div class="pool-item" data-hover-catalog="${row.id}" tabindex="0">${icon(row)}<span>${esc(row.name)}</span></div>`).join('')}</div><p>Explore the distribution in <button class="tiny-button" data-view="analysis">Probabilities ↗</button></p></details>`:''}
    ${v.warning?`<p class="validation-message">${esc(v.warning)}</p>`:''}</div>`;
  $('#craft-dock').replaceChildren($('#recipe-detail .craft-actions'));
}
function craftOptions(){return {columns:state.columns,rows:state.rows,choices:ingredientChoices,config:{...sim.config,jewelLevel:state.jewelLevel}};}
let lastCraftKey=null;
function renderLastCraft(){
  const key=state.history;
  if(key===lastCraftKey)return;
  const open=$('.last-craft-recent')?.open||false;
  $('#last-craft').innerHTML=lastCraftHtml(state.history,{labels});
  if(open&&$('.last-craft-recent'))$('.last-craft-recent').open=true;
  lastCraftKey=key;
}
function renderInspector(){
  const it=inspect;
  $('#item-action-dock').replaceChildren();
  const stack=[...state.stacks,...state.stash].find(s=>s.item===it);
  $('#inspector-content').classList.toggle('inline-item-editor',!!it&&isEquipment(it)&&!!stack);
  if(it&&isCodex(it)&&stack){
    $('#inspector-content').innerHTML=codexInspectorHtml(sim,it,{texts});
    $('#item-action-dock').innerHTML=`<div class="inspector-actions"><button id="item-versions" ${!stack.versions?.length?'disabled':''}>Compare versions${stack.versions?.length?' · '+stack.versions.length:''}</button><button id="move-inspected">${state.stacks.includes(stack)?'Move to inventory':'Move to Cube'}</button><button id="remove-inspected">Remove</button></div>`;
    return;
  }
  if(it&&isEquipment(it)&&stack){
    itemSetup.mount($('#inspector-content'),it,item=>{if(busy)return false;checkpoint();previousItem=stack.item;stack.item=item;inspect=item;selectedStack=state.stacks.includes(stack)?stack.id:null;mcResult=null;render();save();},{key:stack.id});
    $('#item-action-dock').innerHTML=`<div class="inspector-actions"><button id="item-versions" ${!stack.versions?.length?'disabled':''}>Compare versions${stack.versions?.length?' · '+stack.versions.length:''}</button><button id="move-inspected">${state.stacks.includes(stack)?'Move to inventory':'Move to Cube'}</button><button id="remove-inspected" class="remove-item">Remove</button></div>`;
    return;
  }
  if(!it){$('#inspector-content').innerHTML='<div class="empty-state"><img src="../data/game/Craft_Cube_Idle_spr_0.png" alt=""><h3>Inspect an item</h3><p>Select an item in the Cube or inventory.</p><button id="inspector-picker">Open catalog</button></div>';return;}
  const generated=sim.stats(it),d=it.def,sockets=sim.sockets(it),count=sockets.count,contents=socketContents(sim,it);
  const description=itemDescription(it,texts),equipment=it.itemType<=10||it.itemType===18;
  const statId=s=>s.key!=null?`key:${s.key}`:`name:${s.name}`;
  const old=new Map((previousItem?sim.stats(previousItem).stats:[]).map(s=>[statId(s),s]));
  const visibleStats=generated.stats.filter(s=>s.key!==20&&s.name!=='Sockets');
  const rolled=visibleStats.filter(s=>typeof s.value==='number'&&!s.identity&&s.min!==undefined&&s.max>s.min);
  const maxed=rolled.filter(s=>s.value===s.max).length;
  const flags=[isCorrupted(it)?'<span class="flag">CORRUPTED</span>':'',d.q===1?'<span class="flag good">+ Crystal affix</span>':'',sockets.bonus?'<span class="flag good">+ Crystal socket</span>':'',d.t?'<span class="flag">MIRRORED</span>':'',equipment?`<span class="flag">${starLevel(it)} / 5 stars</span>`:''].join('');
  $('#inspector-content').innerHTML=`<div class="item-hero">${equipment?`<span class="tier-badge">${TIER_NAMES[it.info.tier]||'D'}</span>`:''}${icon(it.row,'hero-item-img')}<h3 class="rarity-name" style="--item-color:${rarityColor(itemRarity(it))}">${esc(it.name)}</h3>${equipment?`<div class="rarity rarity-name" style="--item-color:${rarityColor(itemRarity(it))}">${esc(itemRarity(it))}</div>`:''}<span class="type">${itemTypeName(it)} · ${it.info.width} × ${it.info.height}</span><div class="item-flags">${flags}</div>${equipment?`<div class="item-stars" aria-label="${starLevel(it)} stars">${'★'.repeat(starLevel(it))}${'☆'.repeat(5-starLevel(it))}</div>`:''}</div><div class="stat-divider"></div>
    ${visibleStats.length?`<div class="roll-summary"><span>ITEM STATS</span><span>${rolled.length?`${maxed} / ${rolled.length} perfect rolls`:'Current values'}</span></div>`:''}
    <div class="item-stats">${visibleStats.map(s=>{
      const name=playerStatName(s),prev=old.get(statId(s)),delta=!s.identity&&prev&&typeof s.value==='number'&&typeof prev.value==='number'?s.value-prev.value:0;
      const value=s.displayValue??s.value,formatted=playerStatValue(s);
      const range=s.min!==undefined&&!s.identity;
      return`<div class="stat-row ${s.identity?'identity-stat':''} ${s.source?.startsWith('generated')?'generated-stat':''}" data-stat-key="${s.key??''}" title="${esc(s.description||'')}"><span class="stat-name">${esc(name)}</span><span class="stat-value">${esc(formatted)}${value==null?'':s.unit||''}${delta?`<span class="delta ${delta<0?'negative':''}">${delta>0?'+':''}${Number(delta.toFixed(2))}</span>`:''}${range?`<span class="stat-range">[${s.min} – ${s.max}]</span>`:''}</span></div>`;
    }).join('')}</div>
    ${count?`<div class="socket-row" aria-label="${count} sockets">${Array.from({length:Math.min(count,12)},(_,i)=>`<span class="socket ${d.q===2&&i===count-1?'crystal':''}">${contents[i]?.row?icon(contents[i].row):''}</span>`).join('')}</div>`:''}
    ${count==null&&sockets.capacity?`<div class="socket-caption">Socket count unresolved · capacity ${sockets.capacity}${sockets.bonus?' · +1 Crystal socket':''}</div>`:''}
    ${count!=null&&sockets.source==='measured-a-chain'?'<div class="socket-caption">Item Editor socket model · from item seed</div>':''}
    ${sockets.source==='legacy-cube-override'?'<div class="socket-caption">Socket result uses the earlier Cube model.</div>':''}
    ${equipment||visibleStats.length?`<div class="item-controls"><label>SEED <input id="inspect-seed" aria-label="Item roll seed" type="number" min="1" max="1000000000" step="1" value="${d.a}" ${!selectedStack?'disabled':''}></label>${equipment?`<label>Tier <select id="inspect-tier" aria-label="Selected item tier" ${!selectedStack?'disabled':''}>${TIER_NAMES.map((n,i)=>`<option value="${i}" ${i===it.info.tier?'selected':''}>${n}</option>`).join('')}</select></label>`:''}</div>`:''}
    ${description.explanation?`<p class="inspector-description">${esc(description.explanation)}</p>`:''}
    ${description.lore&&description.lore!==description.explanation?`<p class="inspector-lore">${esc(description.lore)}</p>`:''}
    ${generated.catalogNotes?.length?`<details class="stat-reference"><summary>Catalog reference · ${generated.catalogNotes.length} entries</summary><p>These entries are references, not applied rolls.</p>${generated.catalogNotes.map(s=>`<div><span>${esc(playerStatName(s))}</span><span>${esc(s.template)}</span></div>`).join('')}</details>`:''}
    ${(generated.warnings||[]).map(w=>`<div class="stat-note">${esc(w)}</div>`).join('')}
    ${equipment?`<div class="stat-note">${generated.baseRangesVerified?'Base values, stars and corruption have been checked against the current game.':'Stars and corruption follow the current game; base values use the imported item model.'}${it.info.naturalSocketRange&&sockets.source!=='legacy-cube-override'?' Natural socket rolls also use the current game rules.':''} Item attack, attack speed and defense include their current bonuses. Player combat effects are not fully modeled.</div>`:''}
    ${d.q===1?`<div class="stat-note">${generated.crystalResolved?'The rolled Crystal affix is included in these stats.':'The Crystal affix could not be calculated for this item.'}</div>`:''}
    ${contents.some(Boolean)?`<div class="stat-note">${generated.socketsResolved?'Socket bonuses are included in these stats.':'Some socket effects could not be included in the totals.'}</div>`:''}
    ${state.stacks.some(s=>s.item===it)||state.stash.some(s=>s.item===it)?`<div class="inspector-actions">${equipment?'<button id="configure-inspected" class="configure-item">Configure item · stars, corruption, sockets</button>':''}<button id="move-inspected">${state.stacks.some(s=>s.item===it)?'Move to inventory':'Move to Cube'}</button><button id="remove-inspected" class="remove-item">Remove</button></div>`:''}`;
  const actions=$('#inspector-content .inspector-actions');if(actions)$('#item-action-dock').append(actions);
}
function renderStash(){
  $('#stash-count').textContent=state.stash.length;
  $('#stash').innerHTML=state.stash.length?state.stash.map(s=>`<button class="stash-item" data-stash="${s.id}" draggable="true" aria-label="${esc(s.item.name)}, ${s.amount} ${s.amount===1?'item':'items'}">${icon(s.item.row)}${s.amount>1?`<span>${format(s.amount)}</span>`:''}</button>`).join(''):'<div class="stash-empty"><img src="../data/game/Craft_Icon_spr_0.png" alt=""><span>Move items here to free up the Cube. Crafted items appear in the Cube.</span></div>';
}
function renderAnalysis(){
  const r=recipe(),target=matchRecipe(r,state.stacks,(item,ing,stack)=>validateTargetStack(r,stack,ing).ok).target||inspect,probs=outcomeProbabilities(r,target),valid=validateCraft(r,state.stacks,{jewelLevel:state.jewelLevel});
  $('#analysis-view').innerHTML=`<div class="eyebrow">OUTCOME ANALYSIS</div><h2>Probabilities</h2><p class="intro">${esc(r.name)}: independent trials on the same starting item. Your Cube is unchanged.</p><div class="analysis-card"><h3>${esc(r.name)}</h3>${probs?Object.entries(probs).map(([k,p])=>`<div class="probability-row"><div class="label"><span>${esc(outcomeLabel(k))}</span><b>${percentLabel(p)}</b></div><div class="track"><div class="fill" style="width:${p*100}%;background:${outcomeColor(k)}"></div></div></div>`).join(''):'<p class="intro">Run a simulation to explore this recipe’s result distribution.</p>'}${probs?`<small>${r.mechanic==='dust_to_fragments'?'Thresholds from the earlier Cube analysis.':'Thresholds verified against the supplied game build.'}</small>`:''}</div><div class="mc-controls"><select id="mc-count" aria-label="Simulation trials">${[10000,100000,1000].map(n=>`<option value="${n}" ${mcCount===n?'selected':''}>${format(n)} trials</option>`).join('')}</select><button id="monte-carlo" class="primary" ${!valid.ok||busy||analysisPending?'disabled':''}>${analysisPending?'Calculating…':'Run simulation'}</button></div>${!valid.ok?`<p class="validation-message">${esc(valid.missing?'Add the recipe ingredients to the Cube first.':valid.reason)}</p>`:''}<div id="mc-results">${mcResult?`<p class="intro">${format(mcResult.count)} independent trials · RNG seed ${mcResult.seed}</p><table class="mc-table"><thead><tr><th>Result</th><th>Observed rate</th></tr></thead><tbody>${Object.entries(mcResult.values).sort((a,b)=>b[1]-a[1]).map(([k,p])=>`<tr><td>${esc(outcomeLabel(k))}</td><td>${(p*100).toFixed(2)}%</td></tr>`).join('')}</tbody></table>`:''}</div>${EXPERIMENTAL[r.mechanic]?`<p class="stat-note">${EXPERIMENTAL[r.mechanic]}</p>`:''}`;
}
function renderHistory(){
  const entry=selectedHistory(),versions=entry?itemVersions(entry,[...state.stacks,...state.stash],state.history):[];
  const listScroll=$('.journal-list')?.scrollTop||0,listLeft=$('.journal-list')?.scrollLeft||0;
  const detailScroll=$('#history-view').dataset.entry===String(entry?.number)?$('.journal-detail')?.scrollTop||0:0;
  $('#history-view').innerHTML=`<div class="journal-heading"><div class="eyebrow">CRAFT JOURNAL</div><h2>Craft history</h2><p>Compare saved stats, stars and sockets across the last 10 crafts of each item.</p></div>${entry?`<div class="journal-layout"><div class="journal-list" aria-label="Recent crafts">${state.history.map((h,i)=>`<button class="journal-entry" data-journal="${h.number}" aria-pressed="${h.number===entry.number}"><span class="history-top"><strong>${esc(h.recipeName)}</strong><span>#${h.number}</span></span><span class="journal-item-name rarity-name" style="--item-color:${rarityColor(h.afterSnapshot?.rarity)}">${esc(h.itemName||'Craft result')}</span><small>${esc(craftOutcome(h,labels).label)} · ${esc(h.time)}</small></button>`).join('')}</div><div class="journal-detail"><details class="journal-recipe"><summary>${esc(entry.recipeName)} · #${entry.number} · Craft details</summary><small>${esc(entry.time)}${entry.seed?' · RNG '+esc(entry.seed):''}</small><div class="cost-chips">${(entry.cost||[]).map(c=>`<span>${imageFor(c.sprite)}${format(c.amount)}× ${esc(c.name)}</span>`).join('')}</div></details>${historyComparisonHtml(entry,versions,{left:compareLeft,right:compareRight,changesOnly})}</div></div>`:'<div class="empty-state"><img src="../data/game/Craft_Cube_Idle_spr_0.png" alt=""><h3>No crafts yet</h3><p>Craft an item to start its version history.</p></div>'}`;
  $('#history-view').dataset.entry=String(entry?.number);
  if($('.journal-list')){$('.journal-list').scrollTop=listScroll;$('.journal-list').scrollLeft=listLeft;}
  if($('.journal-detail'))$('.journal-detail').scrollTop=detailScroll;
}
function selectedHistory(){return state.history.find(h=>h.number===historySelected)||[...state.stacks,...state.stash].flatMap(s=>s.versions||[]).find(h=>h.number===historySelected)||state.history[0];}
function selectHistory(number){historySelected=number;compareLeft=null;compareRight=null;closeDrawers();showView('history');}
function render(){
  hideTooltip();
  sim.config.jewelLevel=state.jewelLevel;
  renderRecipes();renderCube();renderDetail();renderLastCraft();renderInspector();renderStash();
  if(view==='analysis')renderAnalysis();if(view==='history')renderHistory();
  $('#undo').disabled=busy||!undoStack.length;$('#history-count').textContent=state.history.length;
  $('#session-crafts').textContent=format(state.crafts);$('#session-spent').textContent=format(state.spent);$('#session-results').textContent=format(state.results);
  $('#outcome-seed').value=state.rng;$('#jewel-level').value=state.jewelLevel;$('#sound-enabled').checked=state.sound;$('#fixed-seed').checked=!!state.repeatable;
  $('#active-recipe-name').textContent=recipe().name;$('#inventory-badge').textContent=state.stash.length;
}
function showView(next){hideTooltip();view=next;for(const v of ['workshop','analysis','history'])$(`#${v}-view`).hidden=v!==next;$$('.nav-button[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===next);if(b.dataset.view===next)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});if(next==='analysis')renderAnalysis();if(next==='history')renderHistory();}
function openPicker(target){closeDrawers();pickerTarget=target||null;pickerRarity='';pickerPoolKey='';$('#item-search').value='';$('#item-type').value='';$('#item-tier').value='auto';if(target)$('#item-type').value=Array.isArray(target.itemType)?'':target.itemType??'';page=0;renderPicker();$('#picker').showModal();$('#item-search').focus();}
function renderPicker(){
  const q=$('#item-search').value,rarity=pickerRarity,type=$('#item-type').value;
  const tier=$('#item-tier').value,seed=Number($('#item-seed').value)||123456;
  const poolKey=JSON.stringify([q,type,tier,seed]);
  if(poolKey!==pickerPoolKey){
    pickerCandidates=new Map();
    pickerPool=filterCatalog(sim.catalog.rows,{query:q,type}).filter(row=>{const options={seed,tier:tier==='auto'?undefined:Number(tier)};const candidate=pickerTarget?catalogTarget(sim,recipe(),pickerTarget,row,options):{item:sim.makeItem(row.cls,row.b,{a:seed,j:row.sub,c:row.kind==='unique'?1:0},{row,tier:options.tier}),notes:[]};if(candidate)pickerCandidates.set(row.id,candidate);return !!candidate;});
    pickerPoolKey=poolKey;
  }
  pickerRarities=CATALOG_RARITIES.filter(r=>r!=='Common');
  const candidateRarity=row=>itemRarity(pickerCandidates.get(row.id)?.item);
  const counts=new Map();for(const row of pickerPool){const value=candidateRarity(row);counts.set(value,(counts.get(value)||0)+1);}
  const rows=rarity?pickerPool.filter(row=>candidateRarity(row)===rarity):pickerPool;
  $('#picker-scope').hidden=!pickerTarget;
  $('#picker-scope-name').textContent=pickerTarget?`Compatible with ${recipe().name}`:'';
  $('#rarity-filters').innerHTML=['',...pickerRarities].map(r=>{const count=r?counts.get(r)||0:pickerPool.length;return`<button class="rarity-filter" data-rarity="${r}" style="--item-color:${rarityColor(r)}" aria-pressed="${r===rarity}" aria-label="${r||'All rarities'}, ${format(count)} matching items" ${r&&count===0&&r!==rarity?'disabled':''}><i aria-hidden="true"></i><span>${r||'All items'}</span><small aria-hidden="true">${format(count)}</small></button>`;}).join('');
  $('#picker-reset').hidden=!q&&!rarity&&type==='';
  const pages=Math.max(1,Math.ceil(rows.length/60));page=Math.min(page,pages-1);
  $('#picker-count').textContent=`${format(rows.length)} items`;$('#item-page').textContent=`${page+1} / ${pages}`;$('#item-prev').disabled=page===0;$('#item-next').disabled=page===pages-1;
  $('#item-list').innerHTML=rows.slice(page*60,(page+1)*60).map(r=>{const candidate=pickerCandidates.get(r.id);return`<button class="catalog-item ${r.kind==='unique'?'unique':''}" style="--item-color:${rarityColor(candidateRarity(r))}" data-catalog="${r.id}" aria-label="${esc(r.name)} — ${isEquipment({itemType:r.cls})?'set up item':'add to Cube'}">${icon(r)}<span><strong>${esc(r.name)}</strong><small>${r.cls===3?WEAPON_TYPES[r.sub]||'Weapon':types[r.cls]} · <span class="catalog-rarity">${esc(candidateRarity(r))}</span>${candidate?' · '+TIER_NAMES[candidate.item.info.tier]:''}</small>${candidate?.notes.length?`<small class="catalog-preset">${esc(candidate.notes.join(' · '))}</small>`:''}<em>${r.w} × ${r.h}</em></span></button>`;}).join('')||'<div class="empty-state">No compatible items match these filters. Try another rarity or tier.</div>';
}
function prepare(){
  if(busy)return;
  try {
    const action=craftReadiness(sim,recipe(),state.stacks,craftOptions());
    if(!action.ok)return toast(action.reason,true);
    const prepared=prepareIngredients(sim,recipe(),state.stacks,craftOptions());
    if(!prepared.added)return toast('All required ingredients are already in the Cube.');
    checkpoint();state.stacks=prepared.stacks;mcResult=null;render();save();
    toast(`${format(prepared.added)} ${prepared.added===1?'ingredient':'ingredients'} added to the Cube. Press Craft when ready.`);
    $('#transmute')?.focus({preventScroll:true});
  } catch(error) {toast(error.message,true);}
}
function openBatch(){
  if(busy||!recipe().allowMultiCraft)return;
  const valid=validateCraft(recipe(),state.stacks,{jewelLevel:state.jewelLevel});
  $('#batch-description').textContent=`${recipe().name}. Uses only materials already in the Cube. Stops when supplies run out.`;
  $('#batch-reason').textContent=valid.ok?'Each completed craft creates a separate History record.':valid.reason;
  $$('#batch-menu [data-batch]').forEach(button=>button.disabled=!valid.ok);
  $('#batch-menu').showModal();
}
function setCraftBusy(on){
  busy=on;$('#application').classList.toggle('crafting',on);$('#application').setAttribute('aria-busy',String(on));
  if(on) {
    renderDetail();
    for(const control of $$('button,input,select,textarea'))if(!control.disabled){control.dataset.craftLocked='true';control.disabled=true;}
  } else {
    for(const control of $$('[data-craft-locked]')){control.disabled=false;delete control.dataset.craftLocked;}
  }
}
function playSound(){if(!state.sound)return;try{const ctx=new AudioContext();for(let i=0;i<3;i++){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime([130.81,196,261.63][i],ctx.currentTime+i*.1);g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.055,ctx.currentTime+.03+i*.1);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.65);o.connect(g).connect(ctx.destination);o.start();o.stop(ctx.currentTime+.7);}setTimeout(()=>ctx.close(),850);}catch{}}
async function craft(count=1){
  if(busy)return;
  const r=recipe(),valid=validateCraft(r,state.stacks,{jewelLevel:state.jewelLevel});
  if(!valid.ok)return toast(valid.reason,true);
  const backup=clone(snapshot());
  hideTooltip();setCraftBusy(true);playSound();
  await new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?0:180));
  let result;
  try {
    result=runCraftAction(sim,r,state,{count});
    if(result.done) {
      undoStack.push(backup);if(undoStack.length>30)undoStack.shift();
      state=result.state;inspect=result.lastItem;selectedStack=state.stacks.find(s=>s.item===inspect)?.id||null;
      previousItem=result.lastBefore;mcResult=null;
    }
  } catch(error) {result={done:0,error};}
  finally {setCraftBusy(false);render();}
  if(!result.done)toast(result.error?.message||'Craft could not be completed.',true);
  else {
    save();const entry=state.history[0];
    toast(`${count>1?`${result.done} / ${count} crafts completed · `:''}${craftOutcome(entry,labels).label}${inspect?' · '+inspect.name:''}${result.error?` · ${result.error.message}`:''}`,entry.outcome==='corrupted');
  }
  const focus=$(count>1?'#batch-open':'#transmute');
  (focus?.disabled?$('#last-craft .last-craft-link'):focus)?.focus({preventScroll:true});
}
function exportSession(){const blob=new Blob([JSON.stringify({schema:2,state:snapshot()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`HSCraftSim-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

// Lock input while a craft is pending, including shortcuts and queued synthetic events.
for(const type of ['click','input','change','keydown','drop','contextmenu'])document.addEventListener(type,e=>{if(busy){e.preventDefault();e.stopImmediatePropagation();}},true);

document.addEventListener('click',e=>{
  const el=e.target.closest('button');if(!el||!sim)return;
  hideTooltip();
  if(el.dataset.commandRecipe!==undefined){$('#command-menu').close();selectRecipe(Number(el.dataset.commandRecipe));return;}
  if(el.dataset.command){runCommand(el.dataset.command);return;}
  if(el.dataset.ingredientChoice!==undefined){ingredientChoices.set(`${state.recipe}:${el.dataset.ingredientChoice}`,Number(el.dataset.choice));renderDetail();return;}
  if(el.dataset.close){closeDialog(el.dataset.close);return;}
  if(el.dataset.view){showView(el.dataset.view);return;}
  if(el.dataset.batch){const count=Number(el.dataset.batch);$('#batch-menu').close();craft(count);return;}
  if(el.dataset.lastComparison){changesOnly=true;selectHistory(Number(el.dataset.lastComparison));return;}
  if(el.dataset.journal!==undefined){selectHistory(Number(el.dataset.journal));return;}
  if(el.dataset.restoreVersion){
    const entry=selectedHistory(),choices=comparisonChoices(itemVersions(entry,[...state.stacks,...state.stash],state.history));
    const saved=choices.find(c=>c.id===el.dataset.restoreVersion)?.snapshot;
    if(saved&&!busy){try{checkpoint();const s=add(unpackItem(sim,saved.item));inspect=s.item;selectedStack=s.id;previousItem=null;render();save();toast('Saved item copied to the Cube.');}catch(error){undoStack.pop();toast(error.message,true);}}return;
  }
  if(el.dataset.pane){setWorkshopPane(el.dataset.pane);return;}
  if(el.dataset.recipe!==undefined){selectRecipe(Number(el.dataset.recipe));return;}
  if(el.dataset.stack){const s=state.stacks.find(s=>s.id===el.dataset.stack);if(s)inspectItem(s.item,s.id);return;}
  if(el.dataset.stash){const s=state.stash.find(s=>s.id===el.dataset.stash);if(s)inspectItem(s.item);return;}
  if(el.dataset.target!==undefined){openPicker(recipe().ingredients[Number(el.dataset.target)]);return;}
  if(el.dataset.material){const row=sim.catalog.find(14,Number(el.dataset.material),false);if(row)addCatalog(row);return;}
  if(el.dataset.rarity!==undefined){pickerRarity=el.dataset.rarity;page=0;renderPicker();$$('#rarity-filters [data-rarity]').find(b=>b.dataset.rarity===pickerRarity)?.focus({preventScroll:true});return;}
  if(el.id==='picker-reset'){pickerRarity='';$('#item-search').value='';$('#item-type').value='';page=0;renderPicker();$('#item-search').focus();return;}
  if(el.dataset.catalog!==undefined){
    const row=sim.catalog.byId.get(Number(el.dataset.catalog));
    const amount=Number($('#item-amount').value),seed=Number($('#item-seed').value),tier=$('#item-tier').value;
    if(!Number.isInteger(amount)||amount<1||amount>10000||!Number.isInteger(seed)||seed<1||seed>1e9)return toast('Quantity must be 1–10,000 and seed must be 1–1,000,000,000.',true);
    if((row.cls<=10||row.cls===18||isCodex({itemType:row.cls,itemId:row.b}))&&amount>1)return toast('Add equipment and Codices one item at a time.',true);
    const options={amount,seed,tier:tier==='auto'?undefined:Number(tier)};
    const scopedRecipe=pickerTarget?recipe():null,ingredient=pickerTarget,candidate=pickerTarget?catalogTarget(sim,scopedRecipe,ingredient,row,options):null;
    if(pickerTarget&&!candidate)return toast('This item no longer matches the recipe settings.',true);
    if(isEquipment({itemType:row.cls})){hideTooltip();$('#picker').close();itemSetup.open(candidate?.item||buildItem(row,options),item=>{if(busy)return false;try{checkpoint();const stack=add(item,amount);inspect=stack.item;selectedStack=stack.id;previousItem=null;mcResult=null;render();save();toast(`${row.name} added to the Cube.`);}catch(error){undoStack.pop();toast(error.message,true);return false;}},{notes:candidate?.notes,validate:scopedRecipe?item=>validateTarget(scopedRecipe,item,ingredient):undefined,pane:scopedRecipe?.mechanic==='empty_sockets'?'sockets':'properties'});}
    else if(candidate){try{$('#picker').close();checkpoint();const stack=add(candidate.item,amount);inspect=stack.item;selectedStack=stack.id;render();save();toast(`${row.name} added to the Cube.`);}catch(error){undoStack.pop();toast(error.message,true);}}
    else addCatalog(row,options);return;
  }
  if(el.dataset.replay!==undefined){const h=state.history[Number(el.dataset.replay)];if(h?.before){try{checkpoint();const item=unpackItem(sim,h.before),s=add(item);inspect=s.item;selectedStack=s.id;render();save();toast('Starting item added to the Cube.');}catch(err){undoStack.pop();toast(err.message,true);}}return;}
  if(el.dataset.grid){if(busy)return;const columns=Number(el.dataset.grid),rows=columns===4?4:6;if(columns===state.columns)return;const next=[];for(const s of state.stacks){const p=findPosition(next,s.item,columns,rows);if(!p)return toast('These items do not fit in the smaller Cube. Move some to inventory first.',true);next.push({...s,...p});}checkpoint();state.columns=columns;state.rows=rows;state.stacks=next;render();save();return;}
  const actions={
    'codex-open':()=>{favOnly=false;readyOnly=false;$('#favorites').classList.remove('active');$('#favorites').setAttribute('aria-pressed','false');$('#recipe-search').value='';$('#recipe-category').value='codex';selectRecipe(sim.recipes.find(r=>r.mechanic==='codex_word'&&r.orbs.length===3).index);renderReadyFilter();},
    'codex-start':()=>{if(busy)return;try{checkpoint();const item=configureCodex(sim,sim.makeItem(11,23,{a:freshSeed()%1000000000||1}),{sockets:recipe().orbs?.length||3}),s=add(item);inspect=s.item;selectedStack=s.id;previousItem=null;render();save();toast('Starting Codex added. Choose its target zone in the inspector.');}catch(error){undoStack.pop();toast(error.message,true);}},
    'codex-edit':()=>{const s=state.stacks.find(s=>isCodex(s.item));if(s)inspectItem(s.item,s.id);},
    'codex-apply':()=>{if(busy||!isCodex(inspect))return;try{const next=configureCodex(sim,inspect,{zone:$('#codex-zone').value,entries:Number($('#codex-entries').value),sockets:Number($('#codex-sockets').value)});const stack=[...state.stacks,...state.stash].find(s=>s.item===inspect);if(!stack)return;checkpoint();previousItem=stack.item;stack.item=next;inspect=next;mcResult=null;render();save();toast('Starting scenario updated. No crafting materials used.');}catch(error){toast(error.message,true);}},
    'header-catalog':()=>openPicker(),'command-open':openCommands,
    'recipes-open':()=>openDrawer('recipes-dialog'),'inspector-open':()=>openDrawer('inspector-dialog'),'inventory-open':()=>openDrawer('inventory-dialog'),
    'item-versions':()=>{const stack=[...state.stacks,...state.stash].find(s=>s.item===inspect);if(stack?.versions?.length)selectHistory(stack.versions[0].number);},'move-inspected':()=>moveInspected(),'remove-inspected':()=>moveInspected(true),
    'picker-show-all':()=>{pickerTarget=null;pickerPoolKey='';page=0;renderPicker();},
    'recipes-all':()=>{readyOnly=false;renderReadyFilter();},'recipes-ready':()=>{readyOnly=true;renderReadyFilter();},
    'randomize-seed':()=>{if(busy)return;state.rng=freshSeed();state.seedStart=state.rng;mcResult=null;render();save();toast('Fresh random seed selected.');},
    'open-picker':()=>openPicker(),'open-picker-inline':()=>openPicker(),'inspector-picker':()=>openPicker(),
    'settings-open':()=>$('#settings').showModal(),'help-open':()=>$('#help').showModal(),'data-info':()=>$('#help').showModal(),'footer-info':()=>$('#help').showModal(),
    'prepare':prepare,'dock-prepare':prepare,'transmute':()=>craft(),'batch-open':openBatch,'undo':undo,'export-session':exportSession,'import-session':()=>$('#session-file').click(),
    'clear-cube':()=>{if(busy)return;checkpoint();state.stacks=[];inspect=null;selectedStack=null;previousItem=null;render();save();},
    'reset':()=>{if(busy)return;checkpoint();state.stacks=[];state.stash=[];state.history=[];state.crafts=0;state.spent=0;state.results=0;state.rng=sessionStartSeed(state);state.seedStart=state.rng;inspect=null;previousItem=null;selectedStack=null;mcResult=null;render();save();toast('New session started. Use Undo to restore your previous session.');},
    'favorites':()=>{favOnly=!favOnly;$('#favorites').classList.toggle('active',favOnly);$('#favorites').setAttribute('aria-pressed',favOnly);renderRecipes();},
    'favorite-toggle':()=>{state.favorites=state.favorites.includes(state.recipe)?state.favorites.filter(i=>i!==state.recipe):[...state.favorites,state.recipe];renderRecipes();renderDetail();save();},
    'item-prev':()=>{page--;renderPicker();$('#item-list').scrollTop=0;},'item-next':()=>{page++;renderPicker();$('#item-list').scrollTop=0;},
    'monte-carlo':runAnalysis
  };actions[el.id]?.();
});
document.addEventListener('input',e=>{
  if(e.target.id==='command-search')renderCommands();
  if(e.target.id==='recipe-search')renderRecipes();
  if(e.target.id==='item-search'){page=0;renderPicker();}
});
document.addEventListener('change',e=>{
  const id=e.target.id;
  if(id==='mc-count')mcCount=Number(e.target.value);
  if(id==='fixed-seed'){state.repeatable=e.target.checked;state.seedStart=state.rng;save();}
  if(id==='recipe-category')renderRecipes();
  if(['item-type','item-tier','item-seed'].includes(id)){page=0;renderPicker();}
  if(id==='comparison-before'){compareLeft=e.target.value;compareRight=$('#comparison-after').value;renderHistory();}
  if(id==='comparison-after'){compareRight=e.target.value;compareLeft=$('#comparison-before').value;renderHistory();}
  if(id==='comparison-changes'){changesOnly=e.target.checked;compareLeft=$('#comparison-before').value;compareRight=$('#comparison-after').value;renderHistory();}
  if(['inspect-tier','inspect-seed'].includes(id)&&selectedStack&&!busy){
    const n=Number(e.target.value),isSeed=id==='inspect-seed';
    if(!Number.isInteger(n)||n<(isSeed?1:0)||n>(isSeed?1e9:6)){e.target.value=isSeed?inspect.def.a:inspect.info.tier;return toast('Invalid value.',true);}
    const s=state.stacks.find(s=>s.id===selectedStack);
    if(s){checkpoint();previousItem=s.item;s.item=sim.makeItem(s.item.itemType,s.item.itemId,{...s.item.def,...(isSeed?{a:n}:{})},{row:s.item.row,isUnique:s.item.isUnique,tier:isSeed?s.item.info.tier:n,amount:s.item.amount});inspect=s.item;mcResult=null;render();save();}
  }
  if(id==='outcome-seed'){const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=4294967295){state.rng=n;state.seedStart=n;mcResult=null;save();}else{e.target.value=state.rng;toast('RNG seed must be 1–4,294,967,295.',true);}}
  if(id==='jewel-level'){state.jewelLevel=Math.max(0,Math.min(3750,Math.floor(Number(e.target.value)||0)));render();save();}
  if(id==='sound-enabled'){state.sound=e.target.checked;save();}
});
document.addEventListener('contextmenu',e=>{const el=e.target.closest('[data-stack]');if(!el||busy)return;e.preventDefault();checkpoint();state.stacks=state.stacks.filter(s=>s.id!==el.dataset.stack);if(selectedStack===el.dataset.stack){inspect=null;selectedStack=null;previousItem=null;}render();save();hideTooltip();});
function renderReadyFilter(){for(const [id,on] of [['recipes-all',!readyOnly],['recipes-ready',readyOnly]]){$(`#${id}`).classList.toggle('active',on);$(`#${id}`).setAttribute('aria-pressed',on);}renderRecipes();}
document.addEventListener('keydown',e=>{
  if(!sim)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!$('#command-menu').open&&!$('dialog[open]'))openCommands();return;}
  if($('#command-menu').open){
    if(e.key==='Escape'){e.preventDefault();closeDialog('command-menu');return;}
    const choices=$$('.command-result'),index=choices.indexOf(document.activeElement);
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();choices[(index+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length]?.focus();}
    if(e.key==='Enter'&&e.target.id==='command-search'){e.preventDefault();choices[0]?.click();}
    return;
  }
  if(e.key==='Escape'){hideTooltip();const open=$$('dialog[open]').at(-1);if(open){e.preventDefault();closeDialog(open.id);}return;}
  if(e.target.matches('input,select,textarea')||$('dialog[open]'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return;}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const key=e.key.toLowerCase();
  if(key==='/'||key==='r'){e.preventDefault();openDrawer('recipes-dialog');}
  if(key==='i'){e.preventDefault();openPicker();}
  if(key==='e'){e.preventDefault();openDrawer('inspector-dialog');}
  if(['1','2','3'].includes(key)){e.preventDefault();showView(['workshop','analysis','history'][Number(key)-1]);}
});
for(const dialog of $$('dialog'))dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
document.addEventListener('dragstart',e=>{const el=e.target.closest('[data-stack],[data-stash]');if(!el||busy){e.preventDefault();return;}e.dataTransfer.setData('application/hscraftsim',JSON.stringify({source:el.dataset.stack?'cube':'stash',id:el.dataset.stack||el.dataset.stash}));e.dataTransfer.effectAllowed='move';hideTooltip();});
$('#cube-grid').addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/hscraftsim')){e.preventDefault();e.dataTransfer.dropEffect='move';}});
$('#cube-grid').addEventListener('drop',e=>{
  e.preventDefault();if(busy)return;try{
    const data=JSON.parse(e.dataTransfer.getData('application/hscraftsim')),from=data.source==='cube'?state.stacks:state.stash,s=from.find(s=>s.id===data.id);if(!s)return;
    const rect=$('#cube-grid').getBoundingClientRect(),base=state.columns===9?381.6:237,ratio=rect.width/base,pad=state.columns===9?18:22.5,cell=state.columns===9?38.4:48;
    const x=Math.floor(((e.clientX-rect.left)/ratio-pad)/cell),y=Math.floor(((e.clientY-rect.top)/ratio-pad)/cell);
    if(!canPlace(state.stacks,s.item,x,y,state.columns,state.rows,data.source==='cube'?s.id:null))return toast('The item does not fit here.',true);
    checkpoint();if(data.source==='cube'){s.x=x;s.y=y;}else{state.stash=state.stash.filter(t=>t.id!==s.id);state.stacks.push({...s,x,y});}
    inspect=s.item;selectedStack=s.id;render();save();
  }catch{toast('Could not move the item.',true);}
});
$('#stash').addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/hscraftsim'))e.preventDefault();});
$('#stash').addEventListener('drop',e=>{e.preventDefault();if(busy)return;try{const data=JSON.parse(e.dataTransfer.getData('application/hscraftsim'));if(data.source!=='cube')return;const s=state.stacks.find(s=>s.id===data.id);if(!s)return;checkpoint();state.stacks=state.stacks.filter(t=>t.id!==s.id);state.stash.push(s);selectedStack=null;render();save();}catch{toast('Could not move the item.',true);}});
const hoverSelector='[data-stack],[data-stash],[data-catalog],[data-material],[data-hover-catalog],[data-hover-stack],[data-history-item]';
function hideTooltip(){
  tooltipAnchor?.removeAttribute('aria-describedby');tooltipAnchor=null;
  const t=$('#tooltip');if(t.matches(':popover-open'))t.hidePopover();t.hidden=true;
}
function tooltipItem(el){
  if(el.dataset.historyItem!==undefined){const entry=state.history[Number(el.dataset.historyItem)];return entry?.afterSnapshot?{snapshot:entry.afterSnapshot}:null;}
  const stackId=el.dataset.stack||el.dataset.hoverStack,stashId=el.dataset.stash;
  if(stackId||stashId){const s=(stashId?state.stash:state.stacks).find(s=>s.id===(stashId||stackId));return s?{item:s.item,amount:s.amount}:null;}
  const catalogId=el.dataset.catalog??el.dataset.hoverCatalog;
  const row=catalogId!==undefined?sim.catalog.byId.get(Number(catalogId)):sim.catalog.find(14,Number(el.dataset.material),false);
  if(!row)return null;
  if(el.dataset.catalog!==undefined&&pickerCandidates.has(row.id))return {item:pickerCandidates.get(row.id).item,amount:Number($('#item-amount').value)||1};
  const inPicker=el.dataset.catalog!==undefined,seed=Number($('#item-seed').value),tier=$('#item-tier').value;
  return {item:buildItem(row,{seed:inPicker&&Number.isInteger(seed)&&seed>=1&&seed<=1e9?seed:123456,tier:inPicker&&tier!=='auto'?Number(tier):undefined}),amount:inPicker?Number($('#item-amount').value)||1:1,preview:el.dataset.preview==='true'};
}
function positionTooltip(){
  if(!tooltipAnchor?.isConnected)return hideTooltip();
  const t=$('#tooltip'),r=tooltipAnchor.getBoundingClientRect(),gap=12;
  t.style.maxHeight=`${innerHeight-gap*2}px`;
  let x,y;
  if(r.right+gap+t.offsetWidth<=innerWidth-gap){x=r.right+gap;y=Math.max(gap,Math.min(r.top,innerHeight-t.offsetHeight-gap));}
  else if(r.left-gap-t.offsetWidth>=gap){x=r.left-gap-t.offsetWidth;y=Math.max(gap,Math.min(r.top,innerHeight-t.offsetHeight-gap));}
  else{
    // Never place the card over its source: that would steal the item's click.
    const above=r.top-gap*2,below=innerHeight-r.bottom-gap*2,useBelow=below>=t.offsetHeight||below>=above;
    t.style.maxHeight=`${Math.max(40,useBelow?below:above)}px`;
    x=Math.max(gap,Math.min(r.left,innerWidth-t.offsetWidth-gap));
    y=useBelow?r.bottom+gap:Math.max(gap,r.top-t.offsetHeight-gap);
  }
  t.style.left=`${x}px`;t.style.top=`${y}px`;
}
function showItemTooltip(el){
  if(!sim||busy||tooltipAnchor===el)return;
  const details=tooltipItem(el);if(!details)return;
  hideTooltip();tooltipAnchor=el;const t=$('#tooltip');
  t.innerHTML=details.snapshot?savedItemHtml(details.snapshot):itemTooltipHtml(sim,details.item,{...details,texts});t.hidden=false;
  if(t.showPopover)t.showPopover();el.setAttribute('aria-describedby','tooltip');positionTooltip();
}
document.addEventListener('pointerover',e=>{const el=e.target.closest(hoverSelector);if(el)showItemTooltip(el);else hideTooltip();});
document.addEventListener('pointerout',e=>{
  if(!tooltipAnchor)return;const next=e.relatedTarget;
  if(next instanceof Node&&tooltipAnchor.contains(next))return;
  hideTooltip();
});
document.addEventListener('focusin',e=>{const el=e.target.closest(hoverSelector);if(el)showItemTooltip(el);});
document.addEventListener('focusout',hideTooltip);
document.addEventListener('scroll',hideTooltip,true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTooltip();});
window.addEventListener('resize',hideTooltip);
window.addEventListener('blur',hideTooltip);
$('#session-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10000000)throw new Error('The session file is too large.');const data=JSON.parse(await f.text());if(data.schema!==2)throw new Error('This session version is not supported.');const old=clone(snapshot());try{restore(data.state);}catch(err){restore(old);throw err;}undoStack.push(old);render();save();$('#settings').close();toast('Session imported.');}catch(err){toast(err.message,true);}e.target.value='';});
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement&&!e.target.dataset.fallback){e.target.dataset.fallback='1';e.target.src='../data/game/Craft_Icon_spr_0.png';}},true);

try{
  sim=await loadData('../data/',bundleUrl);texts=sim.texts;cacheItemStats(sim);
  itemSetup=createItemSetup(sim,texts,{onInteraction:hideTooltip,onRecipe:mechanic=>{const r=sim.recipes.find(r=>r.mechanic===mechanic);if(r)selectRecipe(r.index);}});
  for(const r of sim.recipes)recipeSearchText.set(r.index,`${r.name} ${r.description} ${r.ingredients.map(i=>`${i.name} ${(i.alternatives||[]).map(a=>a.name).join(' ')}`).join(' ')}`.toLowerCase());
  $('#item-type').innerHTML='<option value="">All types</option>'+Object.entries(types).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');
  $('#catalog-count').textContent=`${format(filterCatalog(sim.catalog.rows).length)} items`;
  $('#material-tray').innerHTML=[58,43,67,64,63,65,62,70].map(id=>{const row=sim.catalog.find(14,id,false);return`<button class="material-button" data-material="${id}" data-tip="${esc(row?.name)}" aria-label="${esc(row?.name)} — add to Cube">${icon(row)}</button>`;}).join('');
  desktopApi=await desktopStorage();
  const cached=localStorage.getItem(STORAGE);
  const saved=desktopApi?latestDesktopSession(await desktopApi.load_session(),cached):cached;
  if(saved){try{const parsed=JSON.parse(saved);if(parsed.schema!==2)throw new Error();restore(parsed.state);if(desktopApi)saveRevision=Math.max(0,Number(parsed.desktopRevision)||0);}catch{fillStarter();toast('Could not load the saved session. A new session has been started.',true);}}
  else fillStarter();
  render();$('#application').setAttribute('aria-busy','false');
  if(desktopApi)save();
}catch(e){$('#recipe-list').innerHTML=`<div class="empty-state">Could not load application data.<p>${esc(e.message)}</p><p>Reload the page to try again.</p></div>`;console.error(e);throw e;}
