// HSItemEditor/hs_item_editor_gui.py: final .r-* palette (lines 4002–4003, 4149).
// The editor calls blue rarity Superior; this catalog uses Magic for that tier.
export const RARITY_COLORS = Object.freeze({
  Normal:'#cfcfcf', Common:'#cfcfcf', Superior:'#7db5ff', Magic:'#7db5ff',
  Rare:'#ffd84d', Legendary:'#ff9c40', Mythic:'#5bd6d6',
  Satanic:'#ff6268', Heroic:'#50ddba', Angelic:'#ffe18d',
  Unholy:'#c28cff', Runeword:'#9daeff',
});
export const CATALOG_RARITIES = ['Normal','Common','Magic','Rare','Legendary','Mythic','Satanic','Heroic','Angelic','Unholy'];
export const rarityColor = rarity => RARITY_COLORS[rarity] || RARITY_COLORS.Normal;
export { itemRarityName as itemRarity } from '../engine/items.js';
