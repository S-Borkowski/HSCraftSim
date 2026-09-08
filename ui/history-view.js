import { compareStats } from '../engine/history.js';
import { TIER_NAMES } from '../engine/items.js';
import { rarityColor } from './rarity.js';
import { playerStatName, playerStatValue } from './item-tooltip.js';
import { craftOutcome } from './craft-outcome.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=s=>s?`${esc(playerStatValue(s))}${esc(s.unit||'')}`:'—';

/** Keep actions separate even when the item, recipe, seed or resulting stats match. */
export function recentCraftsHtml(history,{labels={}}={}) {
  const entries=history.slice(0,10);
  if(!entries.length)return '';
  return `<section class="recent-crafts" aria-label="Recent craft operations"><header><h3>Recent crafts <span>${entries.length}</span></h3><button class="tiny-button" data-view="history">Full history ↗</button></header><p>Each material use is a separate craft. Select a record to compare its before and after stats.</p><ol class="recent-craft-list">${entries.map((h,index)=>{
    const sprite=h.afterSnapshot?.sprite??h.cost?.[0]?.sprite;
    const name=h.itemName||h.afterSnapshot?.name||'Craft result';
    const outcome=craftOutcome(h,labels).label;
    const cost=(h.cost||[]).map(c=>`${c.amount} × ${c.name}`).join(' · ');
    return `<li><button class="recent-craft" data-journal="${h.number}" data-history-item="${index}" aria-label="Craft ${h.number}: ${esc(h.recipeName)} on ${esc(name)} — compare stats"><span class="recent-craft-top"><strong>Craft #${h.number}</strong><time>${esc(h.time)}</time></span><span class="recent-craft-item">${sprite!=null?`<img src="../data/icons/${Number(sprite)}.png" alt="" loading="lazy" decoding="async">`:''}<span><strong class="rarity-name" style="--item-color:${rarityColor(h.afterSnapshot?.rarity)}">${esc(name)}</strong><small>${esc(cost||h.recipeName)}</small></span></span><span class="recent-craft-bottom"><span>${esc(outcome)}</span><span>Compare stats ↗</span></span></button></li>`;
  }).join('')}</ol></section>`;
}

export function comparisonChoices(versions) {
  return versions.flatMap(v=>['after','before'].filter(side=>v[`${side}Snapshot`]).map(side=>({id:`${v.number}:${side}`,snapshot:v[`${side}Snapshot`],label:`#${v.number} · ${side==='after'?'After':'Before'} ${v.recipeName}`})));
}
function details(s) {
  if(!s)return '<p class="history-unavailable">Stats were not saved for this older entry. New crafts capture exact values.</p>';
  const flags=[s.corrupted?'Corrupted':'Uncorrupted',s.crystal===1?'Crystal affix':s.crystal===2?'Crystal socket':'No Crystal',s.mirrored?'Mirrored':''].filter(Boolean);
  return `<div class="snapshot-heading">${s.sprite!=null?`<img src="../data/icons/${Number(s.sprite)}.png" alt="">`:''}<div><strong class="rarity-name" style="--item-color:${rarityColor(s.rarity)}">${esc(s.name)}</strong><small>${esc(s.rarity)}${s.equipment!==false?` · ${esc(TIER_NAMES[s.tier])} · ${s.stars} / 5 stars`:``}</small></div></div>${s.equipment!==false?`<p class="snapshot-flags">${flags.map(esc).join(' · ')}</p>`:``}<p class="snapshot-seed">Item seed ${esc(s.item.def.a)} · ${s.sockets.count??'?'} sockets</p><details class="snapshot-stones"><summary>${s.sockets.contents.filter(Boolean).length} / ${s.sockets.count??'?'} sockets filled</summary>${s.sockets.contents.map((stone,i)=>`<span>${stone?.sprite!=null?`<img src="../data/icons/${Number(stone.sprite)}.png" alt="">`:''}${i+1}. ${esc(stone?.name||'Empty')}</span>`).join('')}</details>${s.unresolved?'<p class="history-unavailable">This saved calculation has unresolved effects.</p>':''}`;
}
export function savedItemHtml(snapshot) {
  return `<article class="game-item-card saved-item"><small class="saved-label">SAVED AT CRAFT TIME</small>${details(snapshot)}<div class="hover-stats">${(snapshot?.stats||[]).filter(s=>s.key!==20&&s.name!=='Sockets').map(s=>`<div class="hover-stat"><span>${esc(playerStatName(s))}</span><b>${value(s)}</b></div>`).join('')}</div></article>`;
}
function comparisonSnapshot(snapshot) {
  if(!snapshot)return snapshot;
  const stats=(snapshot.stats||[]).filter(s=>s.key!==20&&s.name!=='Sockets');
  if(Number.isInteger(snapshot.sockets?.count))stats.push({key:20,name:'Sockets',value:snapshot.sockets.count});
  return {...snapshot,stats};
}
export function historyComparisonHtml(entry,versions,{left,right,changesOnly=false}={}) {
  const outcome=craftOutcome(entry);
  const choices=comparisonChoices(versions);
  const a=choices.find(c=>c.id===left)||choices.find(c=>c.id===`${entry.number}:before`);
  const b=choices.find(c=>c.id===right)||choices.find(c=>c.id===`${entry.number}:after`);
  const rows=compareStats(comparisonSnapshot(a?.snapshot),comparisonSnapshot(b?.snapshot));
  const options=selected=>`<option value="" ${!selected?'selected':''} disabled>Snapshot unavailable</option>`+choices.map(c=>`<option value="${c.id}" ${c.id===selected?.id?'selected':''}>${esc(c.label)}</option>`).join('');
  return `<div class="comparison-title"><div><div class="eyebrow">ITEM VERSIONS</div><h3 class="rarity-name" style="--item-color:${rarityColor(entry.afterSnapshot?.rarity)}">${esc(entry.itemName||entry.afterSnapshot?.name||'Craft result')}</h3></div><span class="saved-label">${versions.length} / 10 crafts</span></div><p class="comparison-outcome">Craft #${entry.number}: ${esc(outcome.label)}${outcome.note?`<br>${esc(outcome.note)}`:""}</p><p class="comparison-intro">Values saved at craft time. Choose any two versions of this item.</p><div class="comparison-pickers"><label>Compare from<select id="comparison-before">${options(a)}</select></label><label>Compare to<select id="comparison-after">${options(b)}</select></label></div><div class="snapshot-pair"><section aria-label="Earlier item version">${details(a?.snapshot)}</section><section aria-label="Later item version">${details(b?.snapshot)}</section></div>
    <div class="comparison-tools"><label><input id="comparison-changes" type="checkbox" ${changesOnly?'checked':''}> Changed stats only</label><span>${rows.filter(r=>r.changed).length} changed</span></div>
    ${a&&b?`<table class="comparison-table"><thead><tr><th>Stat</th><th>From</th><th>To</th><th>Change</th></tr></thead><tbody>${rows.filter(r=>!changesOnly||r.changed).map(r=>`<tr class="${r.changed?'stat-changed':''}" data-comparison-stat="${esc(r.key)}"><th>${esc(playerStatName(r.after||r.before))}</th><td>${value(r.before)}</td><td>${value(r.after)}</td><td class="${r.delta>0?'delta-positive':r.delta<0?'delta-negative':''}">${r.delta!=null?(r.delta>0?'+':'')+r.delta:!r.before?'Added':!r.after?'Removed':r.changed?'Changed':'—'}</td></tr>`).join('')||'<tr><td colspan="4">No stat changes between these versions.</td></tr>'}</tbody></table>`:b?savedItemHtml(b.snapshot):''}
    <div class="comparison-footer">${b?`<button data-restore-version="${b.id}">Add a copy of “To” to Cube</button>`:''}<small>Last 10 crafts are kept with each item. Starting setup edits leave saved craft values unchanged.</small></div>`;
}
