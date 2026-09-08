// HS Craft Sim engine entry: load data, hold a cube, find & apply recipes, Monte Carlo helpers.
import { Cpr, randomItemSeed } from "./cpr.js";
import { Catalog, makeItem, generateStats, socketCount, itemSockets, RARITY_NAMES, TIER_NAMES } from "./items.js";
import { findRecipes, matchRecipe, describeIngredient, resolveRecipeNames, TYPE_NAMES } from "./recipes.js";
import { applyRecipe, MECHANICS, DEFAULT_CONFIG } from "./mechanics.js";
import { validateCraft } from './validation.js';
import { applyItemModifiers } from './item_modifiers.js';
import { applyCrystal } from './crystal.js';
import { currentSocketableStats, applySocketStats } from './socket_stats.js';
import { codexRecipes, codexStats, orbStats } from './codex.js';
import { runewordRecipes, applyRuneword } from './runewords.js';
import { applyCharacterLevel } from './level_stats.js';
import { applySpecialStats } from './special_stats.js';
import { applyItemDisplay } from './item_display.js';

export { Cpr, randomItemSeed, Catalog, makeItem, generateStats, socketCount, itemSockets, findRecipes, matchRecipe, describeIngredient, applyRecipe, MECHANICS, DEFAULT_CONFIG, RARITY_NAMES, TIER_NAMES, TYPE_NAMES };

/** Uniform native-style RNG adapter (the game's irandom for outcome rolls). */
export class UniformRng {
  constructor(seedOrFn = Math.random) {
    if (typeof seedOrFn === "function") { this.next = seedOrFn; return; }
    // deterministic mulberry32 for reproducible Monte Carlo runs
    let t = seedOrFn >>> 0;
    this.next = () => { t = (t + 0x6D2B79F5) >>> 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }
  irandom(n) { return Math.floor(this.next() * (n + 1)); }
}

export async function loadData(base = "../data/", bundle = null) {
  if (bundle) {
    const compressed = typeof DecompressionStream !== 'undefined';
    const url = compressed ? bundle : new URL('runtime.json', bundle).href;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load application data (${response.status}).`);
    const data = compressed
      ? await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json()
      : await response.json();
    return fromData(data);
  }
  const get = async (name) => { const r = await fetch(base + name); if (!r.ok) throw new Error(`Could not load data: ${name} (${r.status})`); return r.json(); };
  const [recipes, catalog, statNames, pools, attributes, profiles, texts] = await Promise.all([
    get("recipes.json"), get("items_catalog.json"), get("stat_names.json"), get("stat_pools.json"),
    get("translations/attributes.json").catch(() => ({ entries: {} })),
    get('item_profiles.json'),
    get('current_item_text.json'),
  ]);
  return fromData({ recipes, catalog, statNames, pools, attributes, profiles, texts });
}

function fromData({ recipes, catalog, statNames, pools, attributes, profiles, texts }) {
  if (profiles.schemaVersion !== 2 || !profiles.semantics || !profiles.generatedPools)
    throw new Error('Item Editor model data is missing. Reimport with tools/import_item_editor.py.');
  const sim = new Sim({ recipes, catalog, statNames, pools, attributes, profiles });
  sim.texts = texts || {};
  return sim;
}

export class Sim {
  constructor({ recipes, catalog, statNames, pools, attributes, profiles }) {
    this.prospect = recipes.prospect;
    this.model = profiles || {};
    this.catalog = new Catalog(catalog, profiles?.profiles || {}, this.model);
    this.recipes = resolveRecipeNames([...recipes.recipes,...codexRecipes(this.catalog,Math.max(...recipes.recipes.map(r=>r.index))+1)], this.catalog);
    this.recipes.push(...resolveRecipeNames(runewordRecipes(this.catalog,Math.max(...this.recipes.map(r=>r.index))+1),this.catalog));
    this.statNames = statNames;
    this.pools = pools.poolTables;
    this.attributes = attributes?.entries || {};
    this.uniquePool = this.catalog.uniques();
    this.config = { ...DEFAULT_CONFIG };
  }
  statLabel(key) {
    const semantic = this.model.semantics?.[key];
    if (semantic?.name && semantic.name !== 'unknown') return semantic.name;
    const loc = this.statNames[String(key)];
    return this.attributes[loc]?.en || this.attributes[String(key)]?.en || loc || String(key);
  }
  makeItem(itemType, itemId, def, opts) { return makeItem(this.catalog, itemType, itemId, def, opts); }
  stats(item) {
    const codex=codexStats(item);if(codex)return applyCrystal(item,codex,this.model);
    const orb=orbStats(item);if(orb)return orb;
    const base=currentSocketableStats(item,this.model)??generateStats(item,this.pools,this.statNames,null,this.model);
    return applyItemDisplay(item,applyCharacterLevel(item,applySocketStats(this,item,applySpecialStats(item,applyRuneword(item,applyCrystal(item,applyItemModifiers(item,base,this.model),this.model),this.model),this.model))));
  }
  sockets(item) { return itemSockets(item); }
  /** Which recipes the cube contents satisfy. */
  available(stacks) { return findRecipes(this.recipes, stacks); }
  /**
   * Execute a recipe once. Returns {edit, create, items: generated item instances, target: edited item}.
   * rng: UniformRng (outcome rolls); the item stats then follow CPR from the resulting seeds.
   */
  craft(recipe, stacks, rng = new UniformRng()) {
    const m = validateCraft(recipe, stacks, this.config);
    if (!m.ok) throw new Error(m.reason);
    const target = m.target;
    const result = applyRecipe(recipe, target, rng, { config: this.config, uniquePool: this.uniquePool });
    const out = { recipe, result, consumed: m.consumed, target: null, items: [] };
    if (result.edit && target) {
      const def = { ...target.def };
      for (const [k, v] of Object.entries(result.edit)) {
        if (k === "unset") { def.sockets = []; for(let i=1;i<=7;i++) delete def[`s${i}`]; continue; }
        def[k] = v;
      }
      out.target = this.makeItem(target.itemType, target.itemId, def, { isUnique: target.isUnique, tier: target.info.tier, amount: target.amount, row: target.row });
    }
    for (const c of result.create || []) {
      if (c.itemId === null || c.itemId === undefined) { out.items.push({ placeholder: true, ...c }); continue; }
      const def = c.def ? { ...c.def } : { a: Math.max(1, rng.irandom(this.config.maxSeed)) };
      if (c.isUnique) def.c = 1;
      out.items.push(this.makeItem(c.itemType, c.itemId, def, { isUnique: c.isUnique, amount: c.amount || 1, subtype: c.subtype }));
    }
    return out;
  }
  /** Repeat a recipe N times on the same input and tally the outcomes. */
  monteCarlo(recipe, stacks, n = 10000, seed = 1) {
    const m = validateCraft(recipe, stacks, this.config);
    if (!m.ok) throw new Error(m.reason);
    if (!Number.isInteger(n) || n < 1 || n > 100000) throw new Error('Trial count must be 1–100,000.');
    const rng = new UniformRng(seed);
    const tally = {};
    for (let i = 0; i < n; i++) {
      const r = applyRecipe(recipe, m.target, rng, { config: this.config, uniquePool: this.uniquePool });
      const created = r.create?.[0];
      const key = r.outcome || (r.corrupted ? "corrupted" : r.edit ? "edited" : created?.itemId != null ? `item:${created.itemType}:${created.itemId}:${created.isUnique?1:0}${created.subtype!=null?':'+created.subtype:''}` : "created");
      tally[key] = (tally[key] || 0) + 1;
    }
    return Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, v / n]));
  }
}
