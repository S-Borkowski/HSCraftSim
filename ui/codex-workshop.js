import { CODEX_WORDS, CODEX_ZONES, codexState, codexWord } from '../engine/codex.js';
import { itemTooltipHtml } from './item-tooltip.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=row=>`<img src="../data/icons/${row.spr}.png" alt="">`;

export function codexRecipeHtml(sim,recipe,target=null) {
  const word=CODEX_WORDS.find(w=>w.name===recipe.name);
  const sequence=recipe.orbs||[recipe.orb].filter(Boolean);
  const quick=word||recipe.mechanic==='codex_orb';
  return `<section class="codex-guide"><div class="codex-guide-top"><strong>CODEX WORKSHOP</strong><span>${word?'Orb word':recipe.mechanic==='codex_orb'?'Orb socketing':'Codex crafting'}</span></div>
    ${sequence.length?`<ol class="codex-sequence" aria-label="Orb insertion order">${sequence.map((id,i)=>{const row=sim.catalog.find(15,id,false);return `<li data-hover-catalog="${row.id}" tabindex="0"><b>${i+1}</b>${icon(row)}<span>${esc(row.name)}</span></li>`;}).join('')}</ol><p>${word?`Requires exactly <b>${sequence.length} empty sockets</b>. Orb order determines the result.`:'Uses the next empty socket. Each Orb insertion is saved separately in History.'}</p>`:''}
    ${word?`<div class="codex-result"><small>${word.min===word.max?word.min:word.min+'–'+word.max}% ${esc(word.effect)} · reference range</small></div>`:''}
    ${quick&&target?'<button id="codex-edit">Inspect / configure Codex</button>':quick?'<button id="codex-start" class="primary">＋ Add starting Codex</button><small class="codex-setup-note">Simulation setup · supplies a Codex with the required empty sockets. Add ingredients supplies the Orbs.</small>':''}
    <details><summary>Can I guarantee a target zone?</summary><p>Choose a zone in the Codex inspector to plan a starting scenario. No verified game recipe guarantees a chosen zone. Orb words preserve the selected Codex’s zone.</p><p>Orb recipes and current Orb bonuses are included. Infernal tier upgrades, Essence modifiers and Crystal affixes are supported. New Codexes use the game’s seed order for zones, entries, buffs, debuffs and sockets. Saved starting scenarios keep their chosen properties.</p><div class="codex-links">${sim.recipes.filter(r=>['add_sockets','empty_sockets','delete_sockets'].includes(r.mechanic)).map(r=>`<button data-recipe="${r.index}">${esc(r.name)}</button>`).join('')}</div></details>
  </section>`;
}

export function codexInspectorHtml(sim,item,{texts={}}={}) {
  const state=codexState(item),word=codexWord(item);
  return `<div class="codex-inspector">${itemTooltipHtml(sim,item,{texts})}<details class="codex-setup" open><summary>Starting scenario</summary><p>These controls configure a simulation. They do not represent a targeted-zone recipe.</p><label>Target zone<select id="codex-zone">${[...new Set(CODEX_ZONES.map(z=>z.act))].map(act=>`<optgroup label="Act ${act}">${CODEX_ZONES.filter(z=>z.act===act).map(z=>`<option value="${z.id}" ${state.zone===z.id?'selected':''}>${esc(z.name)}</option>`).join('')}</optgroup>`).join('')}</select></label><div class="codex-fields"><label>Entries<input id="codex-entries" type="number" min="1" max="99" value="${state.entries}"></label><label>Base sockets<select id="codex-sockets">${Array.from({length:7},(_,n)=>`<option value="${n}" ${state.baseSockets===n?'selected':''}>${n}</option>`).join('')}</select></label></div><p>Reducing socket count removes Orbs in the removed slots${word?' and may break the Orb word':''}.</p><button id="codex-apply">Apply starting setup</button></details></div>`;
}
