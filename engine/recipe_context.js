import { ingredientAccepts } from './recipes.js';
import { validateCraft, validateTargetStack, UNSUPPORTED } from './validation.js';

/** Relevance depends on Cube contents, not on selection, inventory or missing materials. */
export function recipeContext(recipe, stacks, config = {}) {
  const live = stacks.filter(s => s.amount > 0);
  if (UNSUPPORTED[recipe.mechanic]) return { rank: 2, dimmed: !!live.length, ready: false, reason: UNSUPPORTED[recipe.mechanic] };
  if (!live.length) return { rank: 2, dimmed: false, ready: false, reason: '' };
  const validation = validateCraft(recipe, live, config);
  if (validation.ok) return { rank: 0, dimmed: false, ready: true, reason: 'Ready to craft with the items in your Cube.' };
  const targets = recipe.ingredients.filter(i => i.itemId == null);
  const compatible = targets.length
    ? targets.every(ingredient => live.some(s => ingredientAccepts(ingredient, s.item) && validateTargetStack(recipe, s, ingredient).ok))
    : recipe.ingredients.some(ingredient => live.some(s => ingredientAccepts(ingredient, s.item)));
  const levelBlocked = recipe.resultType >= 37 && recipe.resultType <= 41 && Number(config.jewelLevel ?? 3750) < (recipe.resultType - 36) * 750;
  const related = compatible && !levelBlocked;
  return { rank: related ? 1 : 2, dimmed: !related, ready: false,
    reason: related ? 'Uses an item in your Cube. Add the remaining ingredients.' : 'Not applicable to the current Cube items. Select to view requirements.' };
}
