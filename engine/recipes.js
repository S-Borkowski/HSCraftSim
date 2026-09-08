// Recipe table access + ingredient matching, mirroring gml_Script_CraftFindRecipeItems /
// GetCraftItemsAvailable. Data comes from data/recipes.json (built by tools/build_recipes.py).
//
// An "item instance" here is the simulator's item model (see items.js):
//   { itemType, itemId, isUnique, weaponType, def: {a,b,c,j,...}, info: {rarity, tier, ...}, amount }

export const TYPE_NAMES = {
  0: "helmet", 1: "body", 2: "boots", 3: "weapon", 4: "gloves", 5: "amulet", 6: "shield",
  7: "ring", 8: "belt", 10: "charm", 11: "consumable", 12: "key", 13: "tarot", 14: "material",
  15: "socketable", 16: "relic", 18: "potion", 19: "other",
};

// tierRequirement value 7 means "no requirement" in the game's matching code
export const TIER_ANY = 7;

/** Resolve every alternative separately; arrays are choices, never display IDs. */
export function resolveRecipeNames(recipes, catalog) {
  const resolve = ref => {
    if (ref.itemId == null || ref.itemType == null) return { ...ref };
    const types = Array.isArray(ref.itemType) ? ref.itemType : [ref.itemType];
    const ids = Array.isArray(ref.itemId) ? ref.itemId : [ref.itemId];
    const alternatives = [];
    for (const type of types) for (const id of ids) {
      const row = catalog.find(type, id, ref.isUnique);
      if (!row) throw new Error('A recipe item is missing from the catalog.');
      alternatives.push({ name: row.name, catalogId: row.id, sprite: row.spr, key: row.key,
        itemType: row.cls, itemId: row.b, isUnique: row.kind === 'unique' });
    }
    const choices = Array.isArray(ref.itemId) || Array.isArray(ref.itemType);
    const name = choices ? (alternatives.every(r => r.name.startsWith('Perfect '))
      ? 'Any Perfect gem' : alternatives.map(r => r.name).join(' / ')) : alternatives[0].name;
    return { ...ref, ...(choices ? { alternatives } : alternatives[0]), name };
  };
  return recipes.map(recipe => {
    const result = resolve(recipe.result), ingredients = recipe.ingredients.map(resolve);
    const fragments = recipe.mechanic === 'create' && ingredients.length === 1 && /fragment/i.test(ingredients[0].name || '');
    return { ...recipe, result, ingredients, name: fragments ? result.name : recipe.name };
  });
}

/** Does one ingredient definition accept this item? (type / id / unique / tier / rarity) */
export function ingredientAccepts(ing, item) {
  const t = ing.itemType;
  if (Array.isArray(t)) {
    if (!t.map(Number).includes(Number(item.itemType))) return false;
  } else if (t !== null && t !== undefined) {
    if (Number(t) !== Number(item.itemType)) return false;
  }
  const id = ing.itemId;
  if (Array.isArray(id)) {
    if (!id.map(Number).includes(Number(item.itemId))) return false;
  } else if (id !== null && id !== undefined) {
    if (Number(id) !== Number(item.itemId)) return false;
  }
  // An unspecified base id denotes a target category; false is not an exclusion
  // of unique equipment (Crystal/cleanse recipes explicitly operate on both).
  const anyBase = id === null || id === undefined;
  if (ing.isUnique && !item.isUnique) return false;
  if (!anyBase && Boolean(ing.isUnique) !== Boolean(item.isUnique)) return false;
  if (ing.tierRequirement !== null && ing.tierRequirement !== undefined && ing.tierRequirement !== TIER_ANY) {
    // CraftFindRecipeItems: item.GetItemInfo(32) must reach the requirement
    if (Number(item.info?.tier ?? 0) < Number(ing.tierRequirement)) return false;
  }
  if (ing.rarityRequirement !== null && ing.rarityRequirement !== undefined) {
    if (Number(item.info?.rarity ?? 0) < Number(ing.rarityRequirement)) return false;
  }
  return true;
}

/**
 * Match the cube contents against one recipe.
 * `stacks` = [{item, amount}], returns {ok, consumed:[{stack, amount}], target} or {ok:false, reason}.
 * The equipment slot (an ingredient with undefined/any itemId of an equipment type) becomes `target`.
 */
export function matchRecipe(recipe, stacks, acceptsTarget = null) {
  const consumed = [];
  const remaining = stacks.map(s => Number(s.amount));
  let target = null;
  for (const ing of recipe.ingredients) {
    let need = Number(ing.amount || 1);
    let found = false;
    for (let i = 0; i < stacks.length && need > 0; i++) {
      if (remaining[i] <= 0) continue;
      const s = stacks[i];
      if (!ingredientAccepts(ing, s.item)) continue;
      if (ing.itemId == null && acceptsTarget && !acceptsTarget(s.item,ing,s)) continue;
      const take = Math.min(need, remaining[i]);
      consumed.push({ stack: s, amount: take, ingredient: ing });
      remaining[i] -= take;
      need -= take;
      found = true;
      const isEquipment = ing.itemId === null || ing.itemId === undefined || Array.isArray(ing.itemType);
      if (isEquipment && target === null && (s.item.itemType <= 8 || s.item.itemType === 10 || s.item.itemType === 11 || s.item.itemType === 18)) {
        target = s.item;
      }
    }
    if (!found || need > 0) {
      return { ok: false, reason: `missing ingredient: ${describeIngredient(ing)} x${ing.amount}` };
    }
  }
  return { ok: true, consumed, target };
}

/** All recipes whose ingredients are satisfied by the cube contents. */
export function findRecipes(recipes, stacks) {
  const out = [];
  for (const r of recipes) {
    const m = matchRecipe(r, stacks);
    if (m.ok) out.push({ recipe: r, match: m });
  }
  return out;
}

export function describeIngredient(ing) {
  const typeText = Array.isArray(ing.itemType)
    ? "any of " + ing.itemType.map((x) => TYPE_NAMES[x] ?? x).join("/")
    : (TYPE_NAMES[ing.itemType] ?? ing.itemType ?? "any");
  if (ing.name) return ing.name;
  if (ing.alternatives?.length) return ing.alternatives.map(r => r.name).join(' / ');
  if (Array.isArray(ing.itemId)) return 'Any eligible ingredient';
  if (ing.itemId === null || ing.itemId === undefined) return `any ${typeText}`;
  return `Eligible ${typeText}`;
}
