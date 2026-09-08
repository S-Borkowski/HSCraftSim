import { matchRecipe, ingredientAccepts } from './recipes.js';
import { itemSockets } from './items.js';
import { isCorrupted, hasSocketContents, starLevel } from './item_setup.js';
import { isCodex, codexRecipeValid } from './codex.js';
import { CRAFT_RULES } from './craft_rules.js';
import { runewordRecipeValid } from './runewords.js';
import { VAULT_PROBABILITIES } from './vaults.js';

export const EXPERIMENTAL = {};
export const UNSUPPORTED = {};

/** Native DoCraftResult eligibility block (current_add_sockets_gate_native.json).
 * info50 comes from native consumable metadata (socket_restriction_rules.js).
 * Ingredient matching and global corruption/mirror guards run separately.
 */
export function validateAddSocketsTarget(t, count) {
  if (t.info.rarity >= 6) return {ok:false,reason:'Add Sockets requires rarity below Satanic. Satanic, Angelic, Runeword, Heroic and Unholy items cannot use this recipe.'};
  if (t.info.socketCraftBlocked === true || t.info.socketCraftBlocked === 1) return {ok:false,reason:t.itemType===11?'This consumable cannot receive sockets.':'This item has a socket crafting restriction.'};
  if (count > 0 || Number(t.def.s) > 0) return {
    ok:false,reason:`This item already has ${count > 0 ? count + (count === 1 ? ' socket' : ' sockets') : 'sockets'}. Add Sockets requires 0 sockets.`,
    nextMechanic:'delete_sockets'
  };
  if (![0,1,2,3,6,11].includes(t.itemType)) return {ok:false,reason:'Add Sockets supports helmets, armor, boots, weapons, shields and Codices.'};
  return {ok:true};
}

/** A Codex modification operates on one item, never on a multi-item stack. */
export function validateTargetStack(recipe,stack,ingredient) {
  if (isCodex(stack.item) && stack.amount !== 1) return {ok:false,reason:'Add Codex targets one at a time; this stack contains multiple Codices.'};
  return validateTarget(recipe,stack.item,ingredient);
}

function recipeWarning(recipe,target) {
  return EXPERIMENTAL[recipe.mechanic];
}

export function validateCraft(recipe, stacks, config = {}) {
  if (!recipe) return { ok: false, reason: 'Select a recipe.' };
  if (UNSUPPORTED[recipe.mechanic]) return { ok: false, reason: UNSUPPORTED[recipe.mechanic], unsupported: true };
  const m = matchRecipe(recipe, stacks, (item,ingredient,stack)=>validateTargetStack(recipe,stack,ingredient).ok);
  if (!m.ok) {
    // Explain an invalid selected item before asking the user to add materials.
    const ingredient = recipe.ingredients.find(i => i.itemId == null);
    const candidates = ingredient ? stacks.filter(s => s.amount > 0 && ingredientAccepts(ingredient,s.item)) : [];
    const stack = candidates.find(s=>validateTargetStack(recipe,s,ingredient).ok)||candidates[0];
    if (stack) {
      const valid = validateTargetStack(recipe,stack,ingredient);
      if (!valid.ok) return { ...valid, target:stack.item, targetInvalid: true };
    }
    return { ...m, missing: true };
  }
  const t = m.target;
  if (recipe.resultType >= 37 && recipe.resultType <= 41 && Number(config.jewelLevel ?? 3750) < (recipe.resultType - 36) * 750)
    return { ok: false, reason: `Required Jewelcrafting level: ${(recipe.resultType - 36) * 750}.` };
  if (!t) return { ...m, warning: recipeWarning(recipe,t) };
  const valid = validateTarget(recipe,t);
  return valid.ok ? { ...m, warning: recipeWarning(recipe,t) } : { ...valid, target: t, targetInvalid: true };
}

/** Shared target rules for the Cube, catalog and starting-item editor. */
export function validateTarget(recipe,t,ingredient=recipe?.ingredients.find(i=>i.itemId==null)) {
  const fail = reason => ({ ok: false, reason });
  if (!recipe || !t) return fail('Choose a target item.');
  if (UNSUPPORTED[recipe.mechanic]) return fail(UNSUPPORTED[recipe.mechanic]);
  if (ingredient && !ingredientAccepts(ingredient,t)) return fail('This item does not meet the recipe’s type, rarity or minimum tier requirement.');
  const mech = recipe.mechanic;
  const d = t.def, rarity = t.info.rarity;
  const cleanse = mech === 'cleanse_prophet' || mech === 'cleanse_angel';
  if (d.t) return fail('Mirrored items cannot be modified again.');
  if (isCorrupted(t) && !cleanse) return fail('This item is corrupted. Cleanse it with the appropriate Wisdom first.');
  if(['codex_word','codex_orb'].includes(mech))return codexRecipeValid(recipe,t);
  if(['runeword','socket_rune'].includes(mech))return runewordRecipeValid(recipe,t,itemSockets(t).count);
  if(mech==='upgrade_codex') {
    if(!isCodex(t)||t.itemId!==23)return fail('Upgrade requires an Infernal Codex.');
    if((Number(d.p)||1)>=CRAFT_RULES.maximumCodexTier)return fail(`This Codex has reached the maximum tier (${CRAFT_RULES.maximumCodexTier}).`);
  }
  if(isCodex(t)&&!['add_sockets','delete_sockets','empty_sockets','essence_of_chaos','upgrade_codex','satanic_crystal','remove_satanic_crystal'].includes(mech))return fail('This modification is not yet verified for Codices. Orb socketing and socket recipes are available in Codex crafting.');
  if (cleanse) {
    if (!isCorrupted(t)) return fail('This item is not corrupted.');
    if (mech === 'cleanse_prophet' && [7,10].includes(rarity)) return fail('Angelic and Unholy items require Angel’s Wisdom.');
    if (mech === 'cleanse_angel' && ![7,10].includes(rarity)) return fail('Use Prophet’s Wisdom for this item.');
  }
  if (mech === 'reroll_affixes' && rarity >= 6) return fail('Use Satanic or Blessed Dice instead of Tinkerer’s Toolkit.');
  if (mech === 'blessed_dice' && t.info.tier !== 5) return fail('Blessed Dice requires an SS tier item.');
  if (mech === 'satanic_crystal' && d.q) return fail('This item already has a Crystal effect. Remove it first.');
  if (mech === 'remove_satanic_crystal' && !d.q) return fail('This item has no Crystal effect to remove.');
  if (['add_sockets','delete_sockets','empty_sockets'].includes(mech)) {
    const { count } = itemSockets(t);
    if (mech === 'add_sockets') {
      const valid = validateAddSocketsTarget(t,count);
      if (!valid.ok) return valid;
    }
    if (['add_sockets','delete_sockets'].includes(mech) && count == null)
      return fail('The model cannot resolve this item’s current socket count.');
    if (mech === 'add_sockets' && !t.info.maxSockets) return fail('This item has no defined socket capacity.');
    if (mech === 'delete_sockets' && rarity >= 6) return fail('Blacksmith’s Mallet requires rarity below Satanic. Unique items retain their natural sockets. Use Empty Sockets to remove the stones.');
    if (mech === 'delete_sockets' && !count) return fail('There are no sockets to remove.');
    if (mech === 'empty_sockets' && !hasSocketContents(t)) return fail('There are no occupied sockets to empty.');
  }
  if (mech === 'destiny_shard' && t.info.tier > 4) return fail('Destiny Shard supports items up to S tier.');
  if (['destiny_shard','gypsys_prophecy'].includes(mech) && starLevel(t) >= 5) return fail('This item already has the maximum 5 stars.');
  if (mech === 'essence_of_chaos' && (t.itemType !== 11 || t.itemId !== 23 || d.u !== undefined || d.v !== undefined))
    return fail('Requires an Infernal Codex without modifiers.');
  return { ok: true };
}

export function outcomeProbabilities(recipe, item) {
  switch (recipe?.mechanic) {
    case 'random_essence_vault': return Object.fromEntries(VAULT_PROBABILITIES.map((rate,tier)=>[`item:19:${tier}:0`,rate]));
    case 'satanic_crystal': return (item?.info.rarity ?? 6) < 6 ? { affix: .5, corrupted: .5 } : item?.itemType === 10 ? { affix: .38, corrupted: .62 } : { socket: .08, affix: .30, corrupted: .62 };
    case 'satanic_dice': return { edited: .62, corrupted: .38 };
    case 'destiny_shard': case 'gypsys_prophecy': return { level_up: .70, level_down: .22, corrupted: .08 };
    case 'dust_to_fragments': return { destiny_fragment: .25, crystal_fragment: .75 };
    default: return null;
  }
}
