import { RUNEWORDS } from '../engine/runewords.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function runewordRecipeHtml(sim,recipe) {
  const word=RUNEWORDS.find(w=>w.id===recipe.wordId),sequence=word?.runes||[recipe.rune];
  return `<section class="codex-guide"><div class="codex-guide-top"><strong>RUNEWORD WORKSHOP</strong><span>${word?sequence.length+' sockets':'Single Rune'}</span></div>
    <ol class="codex-sequence" aria-label="Rune insertion order">${sequence.map((id,i)=>{const row=sim.catalog.find(15,id,false);return `<li data-hover-catalog="${row.id}" tabindex="0"><b>${i+1}</b><img src="../data/icons/${row.spr}.png" alt=""><span>${esc(row.name)}</span></li>`;}).join('')}</ol>
    <p>${word?'Use a matching white base with exactly this many empty sockets. Choose item lists compatible bases.':'Uses the next empty socket. Each insertion is saved separately in History.'}</p>
    <div class="codex-links">${sim.recipes.filter(r=>['add_sockets','empty_sockets','delete_sockets'].includes(r.mechanic)).map(r=>`<button data-recipe="${r.index}">${esc(r.name)}</button>`).join('')}</div>
  </section>`;
}
