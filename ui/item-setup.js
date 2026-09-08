import { configureItem, starLevel, isCorrupted, socketContents, setSocketContent, rollNaturalSockets, filterSocketables, startingQualityOptions } from '../engine/item_setup.js';
import { TIER_NAMES } from '../engine/items.js';
import { itemTooltipHtml } from './item-tooltip.js';
import { rarityColor, itemRarity } from './rarity.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sprite=row=>`<img src="../data/icons/${Number(row.spr)}.png" alt="" loading="lazy" decoding="async">`;
const SOCKET_DRAG='application/hscraftsim-socket';

export function createItemSetup(sim,texts,{onRecipe,onInteraction}={}) {
  const dialog=document.createElement('dialog');
  dialog.id='item-setup';dialog.className='item-setup-dialog';dialog.setAttribute('aria-label','Starting item');
  document.body.append(dialog);
  function editor(root,inline) {
    let draft,commit,validate=()=>({ok:true}),key=null,activeSocket=0,socketSearch='',family='runes',pane='properties',notes=[],drag=null,suppressClickUntil=0;
    const error=e=>{root.querySelector('[data-setup-status]').textContent=e.message;};
    const valid=()=>validate(draft);
    function save() {
      const check=valid();if(!check.ok){error(new Error(check.reason));return false;}
      if(commit(draft)===false)return false;
      if(!inline)dialog.close();return true;
    }
    function cards() {
      const rows=filterSocketables(sim.catalog.rows,{family,query:socketSearch});
      root.querySelector('[data-stone-count]').textContent=`${rows.length} ${rows.length===1?family.slice(0,-1):family}`;
      root.querySelector('[data-stone-list]').innerHTML=rows.map(r=>`<button class="socket-card" data-stone="${r.id}" data-hover-catalog="${r.id}" draggable="true" aria-label="Insert ${esc(r.name)} into socket ${activeSocket+1}">${sprite(r)}<span>${esc(r.name)}</span></button>`).join('')||'<p class="socket-empty">No matches in this tab.</p>';
    }
    function render() {
      const scroll=root.querySelector('.setup-controls')?.scrollTop||0,previewScroll=root.querySelector('.setup-preview')?.scrollTop||0;
      const advancedOpen=root.querySelector('details')?.open;
      const focused=root.contains(document.activeElement)?document.activeElement:null;
      const focusField=focused?.dataset.setupField,focusStars=focused?.dataset.stars;
      const sockets=sim.sockets(draft),contents=socketContents(sim,draft),stars=starLevel(draft),corrupted=isCorrupted(draft),check=valid();
      const naturalRange=draft.info.naturalSocketRange;
      const socketChoices=naturalRange?Array.from({length:naturalRange[1]-naturalRange[0]+1},(_,i)=>i+naturalRange[0]):Array.from({length:draft.info.maxSockets+1},(_,i)=>i);
      const socketOverride=!naturalRange&&Object.hasOwn(draft.def,'s');
      activeSocket=Math.min(activeSocket,Math.max(0,(sockets.count??0)-1));
      const upgrade=draft.info.tier>=5?'gypsys_prophecy':'destiny_shard';
      root.innerHTML=`${!inline?`<div class="dialog-heading"><div><div class="eyebrow">STARTING ITEM</div><h2 class="rarity-name" style="--item-color:${rarityColor(itemRarity(draft))}">${esc(draft.name)}</h2><small>Set up your item, then add it to the Cube.</small></div><button class="icon-button" data-setup-close aria-label="Close item setup">×</button></div>`:''}
      <div class="setup-layout"><div class="setup-column">
        <div class="setup-tabs" role="group" aria-label="Item controls"><button data-setup-pane="properties" aria-pressed="${pane==='properties'}">Stars & corruption</button><button data-setup-pane="sockets" aria-pressed="${pane==='sockets'}">Sockets · ${sockets.count??'?'}</button></div>
        <div class="setup-controls">
        ${notes.length?`<p class="setup-preset">Recipe starting setup: ${esc(notes.join(' · '))}.</p>`:''}
        <div ${pane!=='properties'?'hidden':''}>
          ${draft.info.normalStateVerified?`<section class="setup-section"><label>Starting quality<select data-setup-field="dropQuality">${startingQualityOptions(draft).map(([value,label])=>`<option value="${value}" ${draft.info.dropQuality===value?'selected':''}>${label}</option>`).join('')}</select></label><p>Stats and natural sockets follow this drop quality. Your current roll is ${esc(itemRarity(draft))}.</p></section>`:''}
          <section class="setup-section"><h3>Star level <strong>${stars} / 5</strong></h3><div class="star-buttons" role="group" aria-label="Star level"><button data-stars="0" aria-label="0 stars" aria-pressed="${stars===0}">0</button>${[1,2,3,4,5].map(n=>`<button data-stars="${n}" aria-label="${n} stars" aria-pressed="${n===stars}" class="${n<=stars?'lit':''}" ${corrupted?'disabled':''}>★</button>`).join('')}</div><button class="setup-recipe-link" data-setup-recipe="${upgrade}">Open ${upgrade==='gypsys_prophecy'?"Gypsy's Prophecy":'Destiny Shard'} recipe ↗</button></section>
          <section class="setup-section"><h3>Corruption & Crystal</h3><label class="setup-toggle"><input data-setup-field="corrupted" type="checkbox" ${corrupted?'checked':''}> Corrupted</label><label>Crystal effect<select data-setup-field="crystal"><option value="0" ${!draft.def.q?'selected':''}>None</option><option value="1" ${draft.def.q===1?'selected':''}>Extra affix</option>${draft.info.maxSockets&&draft.itemType!==10&&!draft.info.normalStateVerified?`<option value="2" ${draft.def.q===2?'selected':''}>Extra socket</option>`:''}</select></label>${corrupted?`<button class="setup-recipe-link" data-setup-recipe="${[7,10].includes(draft.info.rarity)?'cleanse_angel':'cleanse_prophet'}">Open ${[7,10].includes(draft.info.rarity)?"Angel's Wisdom":"Prophet's Wisdom"} recipe ↗</button>`:''}</section>
          <details class="setup-section"><summary>Advanced · level, seed & tier</summary><label>Character level<input data-setup-field="level" type="number" min="1" max="100" value="${draft.def.simLevel??100}"></label><p>Used for properties based on character level. Saved with this item for history comparisons.</p><label>Item seed<input data-setup-field="seed" type="number" min="1" max="1000000000" value="${draft.def.a}"></label><label>Item tier<select data-setup-field="tier">${TIER_NAMES.map((n,i)=>`<option value="${i}" ${draft.info.tier===i?'selected':''}>${n}</option>`).join('')}</select></label><p>Tier (D–SSS) and stars (0–5) are separate.</p></details>
        </div>
        <section class="setup-section socket-workbench" ${pane!=='sockets'?'hidden':''}>
          <h3>Sockets <strong>${contents.filter(Boolean).length} / ${sockets.count??'?'} filled</strong></h3>
          <label>Starting base sockets<select data-setup-field="sockets"><option value="auto" ${!socketOverride?'selected':''}>Natural roll${draft.info.socketCount!=null?` (${draft.info.socketCount})`:' (unresolved)'}</option>${socketChoices.map(n=>`<option value="${n}" ${socketOverride&&!naturalRange&&sockets.count-sockets.bonus===n?'selected':''}>${n} socket${n===1?'':'s'}</option>`).join('')}</select></label>
          ${sockets.bonus?'<p>+1 Crystal socket</p>':''}
          ${sockets.count?`<div class="setup-sockets" role="group" aria-label="Item sockets">${contents.map((item,i)=>`<button data-socket-index="${i}" class="${i===activeSocket?'active':''} ${draft.info.socketEnhancements?.[i]?'enhanced-socket':''}" aria-label="Socket ${i+1}${draft.info.socketEnhancements?.[i]?` · +${draft.info.socketEnhancements[i]*50}% socket effect`:''}: ${esc(item?.name||'Empty')}" aria-pressed="${i===activeSocket}">${item?.row?sprite(item.row):'◇'}<small>${i+1}</small></button>`).join('')}</div><p class="socket-instruction">${draft.info.socketEnhancements?.[activeSocket]?`This socket adds ${draft.info.socketEnhancements[activeSocket]*50}% to the stone’s numeric effects. `:''}Click a stone to fill socket ${activeSocket+1}, or drag it onto a socket.</p>
          <div class="socket-family-tabs" role="group" aria-label="Socketable types">${['runes','gems','jewels'].map(f=>`<button data-socket-family="${f}" aria-pressed="${f===family}">${f[0].toUpperCase()+f.slice(1)}</button>`).join('')}</div>
          <label class="stone-search"><input type="search" data-stone-search aria-label="Find a rune, gem or jewel" placeholder="Search ${family}…" value="${esc(socketSearch)}"></label><small data-stone-count></small><div class="socket-card-grid" data-stone-list></div>
          <div class="setup-socket-actions"><button data-empty-socket ${!contents[activeSocket]?'disabled':''}>Clear socket ${activeSocket+1}</button><button data-setup-recipe="empty_sockets">Empty Sockets recipe ↗</button></div>`:'<p>Select a socket count above to insert stones.</p>'}
          <details><summary>Socket roll options</summary>${draft.profile?.socketChain||naturalRange?'<button data-natural-roll>Reroll for this socket count</button>':''}<p>${naturalRange?`Natural range: ${naturalRange[0]}–${naturalRange[1]} sockets. Choosing a count rerolls the item's stats. Dice can change the count again.`:draft.info.normalStateVerified?'Natural sockets follow the item roll. Choosing a fixed count sets a separate socket roll, which Tinkerer’s Toolkit preserves.':'Natural socket generation is not verified for this item.'}</p></details>
        </section>
        <p class="setup-hint">These controls set your starting scenario. Use Transmute to craft with ingredients.</p>
      </div></div><div class="setup-preview" aria-label="Item stats">${itemTooltipHtml(sim,draft,{texts})}</div></div>
      <div class="setup-status ${!inline?'dialog-bottom':''}"><span data-setup-status role="status">${!check.ok?esc(check.reason):inline?'Saved automatically · Undo is available':'Preview · Add when ready'}</span>${!inline?`<div><button data-setup-close>Cancel</button><button class="primary" data-setup-save ${!check.ok?'disabled':''}>Add to Cube</button></div>`:''}</div>`;
      if(sockets.count&&pane==='sockets')cards();
      root.querySelector('.setup-controls').scrollTop=scroll;root.querySelector('.setup-preview').scrollTop=previewScroll;
      if(advancedOpen)root.querySelector('details').open=true;
      if(focusField)root.querySelector(`[data-setup-field="${focusField}"]`)?.focus({preventScroll:true});
      else if(focusStars!==undefined)root.querySelector(`[data-stars="${focusStars}"]`)?.focus({preventScroll:true});
    }
    function apply(next) {const old=draft;draft=next;if(inline){if(commit(next)===false){draft=old;render();}}else render();}
    const insert=(id,index=activeSocket)=>{const row=sim.catalog.byId.get(Number(id));if(!row)throw new Error('Choose a stone from the list.');activeSocket=index;apply(setSocketContent(sim,draft,index,row));};
    root.addEventListener('click',e=>{
      const button=e.target.closest('button');if(!button)return;
      if(Date.now()<suppressClickUntil){e.preventDefault();e.stopPropagation();return;}
      try {
        if(button.hasAttribute('data-setup-close')){dialog.close();return;}
        if(button.hasAttribute('data-setup-save')){save();return;}
        if(button.dataset.stars!==undefined)apply(configureItem(sim,draft,{stars:Number(button.dataset.stars)}));
        if(button.dataset.setupPane){pane=button.dataset.setupPane;render();root.querySelector('.setup-controls').scrollTop=0;root.querySelector(`[data-setup-pane="${pane}"]`).focus({preventScroll:true});}
        if(button.dataset.socketFamily){family=button.dataset.socketFamily;render();root.querySelector(`[data-socket-family="${family}"]`).focus({preventScroll:true});}
        if(button.dataset.socketIndex!==undefined){activeSocket=Number(button.dataset.socketIndex);render();}
        if(button.dataset.stone!==undefined)insert(button.dataset.stone);
        if(button.hasAttribute('data-empty-socket'))apply(setSocketContent(sim,draft,activeSocket,null));
        if(button.hasAttribute('data-natural-roll'))apply(rollNaturalSockets(sim,draft,(sim.sockets(draft).count??0)-sim.sockets(draft).bonus));
        if(button.dataset.setupRecipe){if(inline||save())onRecipe?.(button.dataset.setupRecipe);}
      }catch(e){error(e);}
    });
    root.addEventListener('change',e=>{const field=e.target.dataset.setupField;if(!field)return;try{apply(configureItem(sim,draft,{[field]:field==='corrupted'?e.target.checked:e.target.value==='auto'?'auto':Number(e.target.value)}));}catch(e){error(e);}});
    root.addEventListener('input',e=>{if(e.target.hasAttribute('data-stone-search')){socketSearch=e.target.value;cards();}});
    // Pointer capture keeps dragging consistent for mouse, pen and touch.
    root.addEventListener('pointerdown',e=>{const stone=e.target.closest('[data-stone]');if(!stone||e.button!==0)return;drag={id:stone.dataset.stone,x:e.clientX,y:e.clientY,pointer:e.pointerId,moved:false};onInteraction?.();});
    root.addEventListener('pointermove',e=>{
      if(!drag||drag.pointer!==e.pointerId)return;
      if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6){drag.moved=true;root.setPointerCapture(e.pointerId);root.classList.add('socket-dragging');}
      if(!drag.moved)return;
      const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-socket-index]');
      for(const socket of root.querySelectorAll('[data-socket-index]'))socket.classList.toggle('drop-ready',socket===target);
    });
    function endDrag(e,cancel=false){
      if(!drag||drag.pointer!==e.pointerId)return;const pending=drag;drag=null;
      if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);
      root.classList.remove('socket-dragging');root.querySelectorAll('.drop-ready').forEach(s=>s.classList.remove('drop-ready'));
      if(!pending.moved)return;suppressClickUntil=Date.now()+400;
      const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-socket-index]');
      if(!cancel&&target&&root.contains(target)){try{insert(pending.id,Number(target.dataset.socketIndex));}catch(errorValue){error(errorValue);}}
    }
    root.addEventListener('pointerup',e=>endDrag(e));root.addEventListener('pointercancel',e=>endDrag(e,true));
    root.addEventListener('dragstart',e=>{if(e.target.closest('[data-stone]')){e.preventDefault();e.stopPropagation();}});
    root.addEventListener('dragover',e=>{const socket=e.target.closest('[data-socket-index]');if(socket&&e.dataTransfer.types.includes(SOCKET_DRAG)){e.preventDefault();e.dataTransfer.dropEffect='copy';socket.classList.add('drop-ready');}});
    root.addEventListener('dragleave',e=>{e.target.closest('[data-socket-index]')?.classList.remove('drop-ready');});
    root.addEventListener('drop',e=>{const socket=e.target.closest('[data-socket-index]');if(!socket||!e.dataTransfer.types.includes(SOCKET_DRAG))return;e.preventDefault();e.stopPropagation();try{insert(e.dataTransfer.getData(SOCKET_DRAG),Number(socket.dataset.socketIndex));}catch(e){error(e);}});
    return {load(item,onSave,options={}){if(key!==options.key){pane=options.pane||'properties';family='runes';socketSearch='';activeSocket=0;}key=options.key;draft=item;commit=onSave;validate=options.validate||(()=>({ok:true}));notes=options.notes||[];render();}};
  }
  const modal=editor(dialog,false);let mounted=null,host=null;
  return {
    open(item,onSave,options={}){modal.load(configureItem(sim,item,{}),onSave,{...options,key:Symbol()});dialog.showModal();},
    mount(root,item,onChange,options={}){if(host!==root){host=root;mounted=editor(root,true);}mounted.load(item,onChange,options);}
  };
}
