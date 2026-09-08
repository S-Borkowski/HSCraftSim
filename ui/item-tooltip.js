import { isCodex } from '../engine/codex.js';
import { TIER_NAMES } from '../engine/items.js';
import { isCorrupted, starLevel, socketContents } from '../engine/item_setup.js';
import { socketContribution } from '../engine/socket_stats.js';
import { rarityColor, itemRarity } from './rarity.js';
import { vaultTier } from '../engine/vaults.js';

export const ITEM_TYPES = {0:'Helmet',1:'Armor',2:'Boots',3:'Weapon',4:'Gloves',5:'Amulet',6:'Shield',7:'Ring',8:'Belt',10:'Charm',11:'Consumable',12:'Key',13:'Tarot',14:'Material',15:'Rune / Gem',16:'Relic',18:'Potion',19:'Other'};
export const WEAPON_TYPES = {1:'Sword',2:'Dagger',3:'Mace',4:'Axe',5:'Claw',6:'Polearm',7:'Chainsaw',8:'Staff',9:'Cane',10:'Wand',11:'Book',12:'Spellblade',13:'Bow',14:'Gun',15:'Flask',16:'Throwing',17:'Universal'};
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const cleanGameText = text => String(text || '').replace(/[´’]/g,"'").replace(/#/g,'\n').trim();
export const itemTypeName = item => vaultTier(item) ? `${vaultTier(item)} Vault` : isCodex(item) ? 'Codex' : item.itemType === 15 && item.itemId >= 112 && item.itemId <= 129 ? 'Orb' : item.itemType === 3 ? WEAPON_TYPES[item.def.j] || 'Weapon' : ITEM_TYPES[item.itemType] || 'Item';
export function itemDescription(item, texts) {
  const key = item.row?.key;
  return { explanation: cleanGameText(texts[`explanation_${key}`] || texts[`craft_${key}`]), lore: cleanGameText(texts[`lore_${key}`]) };
}
export function playerStatName(stat) {
  return /^(?:stat[_ ]?#?\d+|unknown)$/i.test(stat.name || '') ? 'Unresolved property' : cleanGameText(stat.name).replace('(Based on Level)',stat.characterLevel?`(at level ${stat.characterLevel})`:'(per level)');
}
export function playerStatValue(stat) {
  const value = stat.displayValue ?? stat.value;
  if (value == null) return '—';
  if (/^(?:Skill|Class) #\d+$/.test(String(value))) return String(value).startsWith('Skill') ? 'Unresolved skill' : 'Unresolved class';
  return typeof value === 'number' ? String(Number(value.toFixed(2))) : cleanGameText(value);
}

/** Player tooltip: actual rolled item values, explanations, lore, sockets. */
export function itemTooltipHtml(sim, item, { texts = {}, amount = 1, preview = false } = {}) {
  const generated = sim.stats(item), sockets = sim.sockets(item), def = item.def;
  const stats = generated.stats.filter(s => s.key !== 20 && s.name !== 'Sockets');
  const seen = new Set(), rows = [];
  for (const stat of stats) {
    if (seen.has(stat.key ?? stat.name)) continue;
    const family = (stat.linkedKeys || []).map(key => stats.find(s => s.key === key)).filter(Boolean);
    const skill = family.find(s => s.valueKind === 'skill_id');
    if (skill && family.length > 1) {
      const level = family.find(s => s.valueKind === 'skill_level');
      const chance = family.find(s => s.valueKind === 'chance_percent');
      const effectName = playerStatName(skill).replace(/:\s*(Skill|Talent)$/,'');
      rows.push(`<div class="hover-effect"><span>${esc(effectName)}</span><strong>${chance?`${esc(playerStatValue(chance))}% · `:''}${level?`Lv. ${esc(playerStatValue(level))} `:''}${esc(playerStatValue(skill))}</strong></div>`);
      family.forEach(s => seen.add(s.key));
      continue;
    }
    seen.add(stat.key ?? stat.name);
    const range = preview && stat.min != null && !stat.identity && !stat.itemDisplayCalculated;
    const value = range ? `${stat.displayMin??stat.min}–${stat.displayMax??stat.max}` : playerStatValue(stat);
    rows.push(`<div class="hover-stat ${stat.source?.startsWith('generated')?'hover-generated':''}"><span>${esc(playerStatName(stat))}</span><b>${esc(value)}${value==='—'?'':esc(stat.unit || '')}</b></div>`);
  }
  const description = itemDescription(item,texts);
  const rarity = itemRarity(item), equipment = item.itemType <= 10 || item.itemType === 18;
  const contents=socketContents(sim,item);
  const enhancements=contents.map((_,i)=>item.info.socketEnhancements?.[i]??0);
  const socketLabel=i=>`Socket ${i+1}${enhancements[i]?` · +${enhancements[i]*50}% socket effect`:''}`;
  const requiredLevel=item.info.requiredLevel??item.row?.lvl??0;
  const flags = [isCorrupted(item)?'Corrupted':'',def.t?'Mirrored':'',def.q===1?'Crystal affix':'',sockets.bonus?'+1 Crystal socket':''].filter(Boolean);
  const footer = [generated.normalAffixesResolved===false?'Affix values are not yet included in these properties.':'',generated.modifiersResolved===false?'Star and corruption effects are unresolved for this item.':'',generated.crystalResolved===false?'The Crystal effect is unresolved for this item.':'',generated.socketsResolved===false?'Some socket effects could not be included in the totals.':'',generated.socketsResolved===true?'Socket bonuses are included in the totals.':'',generated.unresolved?.length?'Some property values are not yet calculated.':''].filter(Boolean).join(' ');
  return `<article class="game-item-card" style="--item-color:${rarityColor(rarity)}">
    <header class="hover-heading">${item.row?.spr!=null?`<img src="../data/icons/${Number(item.row.spr)}.png" alt="">`:''}<div><h3>${esc(cleanGameText(item.name))}</h3><p>${esc(itemTypeName(item))}${equipment?` · <span class="rarity-name">${esc(rarity)}</span>`:''}${amount>1?` · ${amount.toLocaleString('en-US')} items`:''}</p></div>${equipment?`<span class="hover-tier">${TIER_NAMES[item.info.tier] || ''}</span>`:''}</header>
    ${flags.length?`<div class="hover-flags">${flags.map(f=>`<span>${esc(f)}</span>`).join('')}</div>`:''}
    ${equipment?`<div class="item-stars" aria-label="${starLevel(item)} stars">${'★'.repeat(starLevel(item))}${'☆'.repeat(5-starLevel(item))}<small> ${starLevel(item)} / 5 · ${requiredLevel?`Level req. ${requiredLevel}`:''}</small></div>`:''}
    ${rows.length?`<div class="hover-stats">${rows.join('')}</div>`:''}
    ${sockets.count>0?`<div class="hover-sockets"><span>${contents.filter(Boolean).length} / ${sockets.count} Sockets filled</span><div>${contents.map((s,i)=>s?.row?`<img class="${enhancements[i]?'enhanced-socket':''}" src="../data/icons/${s.row.spr}.png" alt="${esc(`${socketLabel(i)}: ${s.name}`)}">`:`<i class="${enhancements[i]?'enhanced-socket':''}" aria-label="${esc(socketLabel(i))}"></i>`).join('')}</div></div>${contents.some(Boolean)||enhancements.some(Boolean)?`<div class="hover-socket-list">${contents.map((s,i)=>s||enhancements[i]?`<div>${esc(socketLabel(i))} · <b>${esc(s?.name||'Empty')}</b>${!s||s.unknown?'':`<br>${sim.stats(s).stats.filter(stat=>!stat.identity).map(stat=>`${esc(playerStatName(stat))}: ${esc(playerStatValue({...stat,displayValue:typeof stat.value==='number'?(equipment?socketContribution(stat.value,enhancements[i]):stat.value):stat.displayValue}))}${esc(stat.unit||'')}`).join(' · ')}`}</div>`:'').join('')}</div>`:''}`:''}
    ${description.explanation?`<p class="hover-description">${esc(description.explanation)}</p>`:''}
    ${description.lore&&description.lore!==description.explanation?`<p class="hover-lore">${esc(description.lore)}</p>`:''}
    ${!rows.length&&!description.explanation&&!description.lore?'<p class="hover-description">An item used in Cube recipes.</p>':''}
    ${preview&&rows.length?'<small class="hover-note">Possible stat ranges for this configuration</small>':''}
    ${isCodex(item)?`<small class="hover-note">${esc(generated.warnings.join(' '))}</small>`:''}
    ${footer?`<small class="hover-note">${esc(footer)}</small>`:''}
  </article>`;
}
