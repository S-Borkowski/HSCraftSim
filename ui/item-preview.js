import { itemTooltipHtml } from './item-tooltip.js';
import { recentCraftsHtml } from './history-view.js';
import { craftOutcome } from './craft-outcome.js';
import { isEquipment } from '../engine/item_setup.js';
import { isCodex } from '../engine/codex.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Prefer the selected live stack, then equipment. Adding recipe materials must
// not replace the item the player is watching. History remains a separate view.
export function previewStack(stacks,selectedId) {
  return stacks.find(s=>s.id===selectedId)
    ||stacks.find(s=>isEquipment(s.item)||isCodex(s.item))||stacks[0]||null;
}

export function itemPreviewHtml(sim,stack,history,{texts={},labels={}}={}) {
  const entry=history[0];
  const outcome=craftOutcome(entry,labels);
  return `<header class="last-craft-heading"><h2>Item preview</h2><span class="preview-live">LIVE</span><button class="preview-expand tiny-button" data-pane="item">View item</button>${entry?`<button class="tiny-button last-craft-link" data-last-comparison="${entry.number}">Compare last craft ↗</button>`:''}</header>
    <div class="last-craft-summary" role="status" aria-live="polite" aria-atomic="true">${stack?`<span class="preview-current-name">${esc(stack.item.name)}</span>`:''}${entry?`<span class="last-craft-outcome" data-outcome="${esc(entry.outcome)}" title="${esc(outcome.note)}">Last craft #${entry.number} · ${esc(outcome.label)}</span>`:stack?'Current item in the Cube':'Add an item to see its properties.'}</div>
    <div class="item-preview-body">${stack?itemTooltipHtml(sim,stack.item,{texts,amount:stack.amount}):'<div class="preview-empty"><img src="../data/game/Craft_Cube_Idle_spr_0.png" alt=""><h3>Your item, as you craft</h3><p>Select an item in the Cube to keep its stats, roll ranges and sockets in view.</p><button class="primary" id="preview-catalog">Browse items</button></div>'}</div>
    ${history.length?`<details class="last-craft-recent"><summary>Recent crafts <span>${Math.min(10,history.length)}</span></summary><div class="preview-recent-body">${recentCraftsHtml(history,{labels})}</div></details>`:''}`;
}
