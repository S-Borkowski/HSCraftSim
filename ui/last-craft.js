import { compareStats } from '../engine/history.js';
import { playerStatName, playerStatValue } from './item-tooltip.js';
import { rarityColor } from './rarity.js';
import { recentCraftsHtml } from './history-view.js';
import { craftOutcome } from './craft-outcome.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statValue=s=>s?`${playerStatValue(s)}${s.unit||''}`:'—';
const crystal=value=>value===1?'Extra affix':value===2?'Extra socket':value?'Crystal effect':'None';

/** Only frozen snapshots enter this comparison; no live model or RNG is consulted. */
export function craftChanges(entry) {
  const a=entry?.beforeSnapshot,b=entry?.afterSnapshot;
  if(!a||!b)return [];
  const changes=[];
  const add=(key,name,before,after,delta=null)=>{if(before!==after)changes.push({key,name,before:String(before),after:String(after),delta});};
  add('corrupted','Corruption',a.corrupted?'Corrupted':'Clean',b.corrupted?'Corrupted':'Clean');
  add('crystal','Crystal',crystal(a.crystal),crystal(b.crystal));
  add('mirrored','Mirrored',a.mirrored?'Yes':'No',b.mirrored?'Yes':'No');
  const ac=a.sockets?.count,bc=b.sockets?.count;
  add('sockets','Sockets',ac??'Unknown',bc??'Unknown',ac!=null&&bc!=null?bc-ac:null);
  for(let i=0;i<Math.max(a.sockets?.contents?.length||0,b.sockets?.contents?.length||0);i++) {
    const content=s=>s.sockets?.contents?.[i]?.name||(i>=(s.sockets?.count??0)?'No slot':'Empty');
    add(`socket-${i}`,`Socket ${i+1}`,content(a),content(b));
  }
  add('stars','Stars',a.stars??0,b.stars??0,(b.stars??0)-(a.stars??0));
  const stats=compareStats(a,b).filter(r=>r.changed&&(r.after||r.before).key!==20&&(r.after||r.before).name!=='Sockets');
  const primary=r=>/^(Attack Damage|Attacks per Second|Defense)$/i.test((r.after||r.before).name||'');
  stats.sort((a,b)=>Number(primary(b))-Number(primary(a)));
  for(const r of stats)changes.push({key:r.key,name:playerStatName(r.after||r.before),before:statValue(r.before),after:statValue(r.after),delta:r.delta});
  add('name','Item name',a.name,b.name);
  return changes;
}

export function lastCraftHtml(history,{labels={}}={}) {
  const entry=history[0],after=entry?.afterSnapshot,changes=craftChanges(entry);
  const outcome=craftOutcome(entry,labels);
  const available=after&&(!entry.before||entry.beforeSnapshot);
  const status=!entry?'Ready for your first craft':!available?'Snapshot unavailable':!entry.beforeSnapshot?'Created':changes.length?`${changes.length} ${changes.length===1?'change':'changes'}`:'No changes';
  const rows=changes.slice(0,5);
  return `<header class="last-craft-heading"><h2>Last craft</h2>${entry?`<button class="tiny-button last-craft-link" data-last-comparison="${entry.number}" aria-label="View all changes for craft ${entry.number}">View all changes ↗</button>`:''}</header>
    <div class="last-craft-summary" aria-live="polite" aria-atomic="true">${entry?`<div class="last-craft-identity">${after?.sprite!=null?`<img src="../data/icons/${Number(after.sprite)}.png" alt="">`:''}<div><strong class="rarity-name" style="--item-color:${rarityColor(after?.rarity)}">${esc(entry.itemName||after?.name||'Craft result')}</strong><small>${esc(entry.recipeName)} · #${entry.number}</small></div><span class="last-craft-status">${esc(status)}</span></div><div class="last-craft-outcome" data-outcome="${esc(entry.outcome)}">${esc(outcome.label)}</div>`:`<p class="last-craft-empty">${status}</p>`}</div>
    <div class="last-craft-body">${entry?rows.length?`<dl class="craft-differences">${rows.map(r=>`<div data-craft-change="${esc(r.key)}"><dt>${esc(r.name)}</dt><dd><span>${esc(r.before)}</span><span class="difference-arrow" aria-label="to">→</span><strong>${esc(r.after)}</strong>${r.delta?`<small aria-label="${r.delta>0?'Increased':'Decreased'} by ${Math.abs(r.delta)}">${r.delta>0?'↑':'↓'} ${Math.abs(r.delta)}</small>`:''}</dd></div>`).join('')}</dl>${changes.length>5?`<button class="more-changes tiny-button" data-last-comparison="${entry.number}">View ${changes.length-5} more changes ↗</button>`:''}`:`<p class="last-craft-note">${!available?'This older record has no saved comparison.':!entry.beforeSnapshot?'A new item was created in the Cube.':esc(outcome.note||'The saved before and after values are identical. This use is still a separate craft.')}</p>`:'<p class="last-craft-note">Craft an item to see what changed. Your latest result stays here while you browse recipes.</p>'}
    ${history.length?`<details class="last-craft-recent"><summary>Recent crafts <span>${Math.min(10,history.length)}</span></summary>${recentCraftsHtml(history,{labels})}</details>`:''}</div>`;
}
