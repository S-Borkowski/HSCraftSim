// The 32 result-type branches of gml_Script_DoCraftResult, transcribed from the decompile
// (research/decomp/docraft5/DoCraftResult.lifted.txt, RESEARCH.md §5 / §5d).
//
// Every function receives (ctx) = { recipe, target, rng, config, random } and returns an
// "edit" object describing what the game would write:
//   { edit: {field: value, ...}   changes to the cube item's definition (a, s, q, r, p, ...)
//     create: [{itemType, itemId, isUnique, amount}]   new items generated afterwards
//     removeTarget: bool, message: string }
//
// `rng.irandom(n)` must behave like GML irandom (uniform 0..n). The game uses its native RNG
// here, not the CPR generator, so the simulator injects any uniform source.

import { applyCodexRecipe, isCodex, codexState } from './codex.js';
import { codexModifiers } from './codex_effects.js';
import { CRAFT_RULES } from './craft_rules.js';
import { applyRunewordRecipe } from './runewords.js';

export const DEFAULT_CONFIG = {
  zrm: 99,               // global.zrm = 99 (DefineGlobals: FUN_140189270(zrm, 0x63)) — outcome rolls are irandom(99) = 0..99
  maxSeed: 1000000000,   // GetItemSeed(): max(1, irandom(GPV(gDataProtected[192]))) — protected constant, 1e9 per Item Editor research
};

export function newSeed(rng, config = DEFAULT_CONFIG) {
  // GetItemSeed(): max(1, irandom(protectedMax))
  return Math.max(1, rng.irandom(config.maxSeed));
}

function roll(ctx) {
  return ctx.rng.irandom(ctx.config.zrm);
}

const RARITY_UNIQUE_MIN = 6; // GetItemInfo(27) >= 6 → satanic/angelic/heroic/unholy families

export const MECHANICS = {
  codex_word: applyCodexRecipe,
  codex_orb: applyCodexRecipe,
  runeword: applyRunewordRecipe,
  socket_rune: applyRunewordRecipe,
  // case 0 / 1 — plain creation of the recipe result
  create(ctx) {
    const r = ctx.recipe.result;
    return { create: [{ itemType: r.itemType, itemId: r.itemId, isUnique: !!r.isUnique, amount: r.amount || 1 }] };
  },
  jewel_tier(ctx) {
    return MECHANICS.create(ctx);
  },
  // case 2 — Tinkerer's Toolkit: new seed, keep everything else
  reroll_affixes(ctx) {
    return { edit: { a: newSeed(ctx.rng, ctx.config) } };
  },
  // Current native case 3: corruption preserves the original seed.
  satanic_dice(ctx) {
    const rv = roll(ctx);
    const edit = rv >= 62 ? { r: 1 } : { a: newSeed(ctx.rng, ctx.config) };
    return { edit, roll: rv, corrupted: rv >= 62 };
  },
  // case 5 — Blessed Dice: new seed, no downside
  blessed_dice(ctx) {
    return { edit: { a: newSeed(ctx.rng, ctx.config) } };
  },
  // Current case 4: increase the existing tier, preserving all other fields.
  upgrade_codex(ctx) {
    return { edit: { p: (Number(ctx.target.def.p)||1)+1 }, outcome:'codex_upgraded' };
  },
  // case 6 — Satanic Crystal
  satanic_crystal(ctx) {
    const item = ctx.target;
    let lo = 0, hi = 50;
    if (Number(item.info?.rarity ?? 0) >= RARITY_UNIQUE_MIN) { lo = 8; hi = 38; }
    if (Number(item.itemType) === 10) lo = 0; // charms never get the socket outcome
    const edit = { ab: newSeed(ctx.rng, ctx.config) };
    const rv = roll(ctx);
    let outcome;
    if (rv < lo) { edit.q = 2; outcome = "socket"; }
    else if (rv < hi) { edit.q = 1; outcome = "affix"; }
    else { edit.r = 1; outcome = "corrupted"; }
    return { edit, roll: rv, outcome, thresholds: { lo, hi } };
  },
  // case 7 — Remove Satanic Crystal effect
  remove_satanic_crystal(ctx) {
    return { edit: { q: 0, ab: newSeed(ctx.rng, ctx.config) } };
  },
  // case 8 — Empty sockets: socket contents are destroyed, socket count stays
  empty_sockets(ctx) {
    return { edit: { unset: "all_sockets" } };
  },
  // case 9 — Add sockets: new socket seed (count = 1 + cpr_irandom(capacity-1) when loaded)
  add_sockets(ctx) {
    if(isCodex(ctx.target))return {edit:{s:newSeed(ctx.rng,ctx.config),simCodex:{...codexState(ctx.target),socketSource:'native'}}};
    return { edit: { s: Math.max(1, ctx.rng.irandom(ctx.config.maxSeed)) } };
  },
  // case 10 — Blacksmith's Mallet: delete sockets
  delete_sockets(ctx) {
    if(isCodex(ctx.target))return {edit:{s:0,simCodex:{...codexState(ctx.target),socketSource:'native'},unset:'all_sockets'}};
    return { edit: { s: 0 } };
  },
  // case 0xb — Supreme Elemelon
  supreme_elemelon(ctx) {
    return { create: [{ itemType: 10, itemId: 51, isUnique: true, amount: 1 }], achievement: 91 };
  },
  // case 0xc — dust → random fragments (table B of DoCraftResult)
  dust_to_fragments(ctx) {
    const tier = { 34: 0, 35: 1, 36: 2 }[ctx.recipe.resultType] ?? 0;
    const first = roll(ctx);
    const second = roll(ctx);
    // counts[tier][kind] = [ <5, <35, else ]
    const SHARD = [[8, 18, 35], [15, 28, 50], [25, 40, 65]];
    const CRYSTAL = [[5, 10, 15], [10, 18, 25], [12, 25, 40]];
    const isShard = first < 25;
    const table = (isShard ? SHARD : CRYSTAL)[tier];
    const amount = second < 5 ? table[0] : second < 35 ? table[1] : table[2];
    return { create: [{ itemType: 14, itemId: isShard ? 66 : 60, isUnique: false, amount }], rolls: [first, second] };
  },
  legacy_tier_craft(ctx) {
    return { edit: {} };
  },
  // cases 0xe / 0xf / 0x10 — random unique picks (rarity filtered by rejection sampling)
  random_angelic(ctx) { return randomUniquePick(ctx, 7); },
  random_unholy(ctx) { return randomUniquePick(ctx, 10); },
  random_unique(ctx) { return randomUniquePick(ctx, null); },
  // case 0x11 — random rune
  random_rune(ctx) {
    let id=1+ctx.rng.irandom(36);
    if(id>=34)id=roll(ctx)<5?[200,201,202,203][ctx.rng.irandom(3)]:1+ctx.rng.irandom(32);
    return { create: [{ itemType: 15, itemId: id, isUnique: false, amount: 1 }] };
  },
  // case 0x12 — 12 dungeon keys (choose_array over the dungeon key list)
  random_dungeon_keys(ctx) {
    const keys = CRAFT_RULES.dungeonKeys;
    const id = keys[ctx.rng.irandom(keys.length - 1)];
    return { create: [{ itemType: 12, itemId: id, isUnique: false, amount: 12 }] };
  },
  // case 0x13 — 10 random materials
  random_materials(ctx) {
    const branch = ctx.rng.irandom(3);
    let id;
    if (branch === 1) id = 40 + ctx.rng.irandom(3);
    else if (branch === 3) id = 62 + ctx.rng.irandom(3);
    else id = ctx.rng.irandom(23);
    return { create: [{ itemType: 14, itemId: id, isUnique: false, amount: 10 }] };
  },
  // case 0x14 — relic-buffing unique
  random_relic_unique(ctx) {
    const row=CRAFT_RULES.relicUniques[ctx.rng.irandom(8)];
    return { create: [{ ...row, isUnique:true, amount:1 }] };
  },
  // case 0x15 — 10 random tarot (major arcana 19..40)
  random_tarot_10(ctx) {
    return { create: [{ itemType: 13, itemId: 19 + ctx.rng.irandom(21), isUnique: false, amount: 10 }] };
  },
  // case 0x16 — 8 random orbs (socketable 112..129)
  random_orbs(ctx) {
    return { create: [{ itemType: 15, itemId: 112 + ctx.rng.irandom(17), isUnique: false, amount: 8 }] };
  },
  // Current case 0x17: independent nested rolls; quest calls only track progress.
  random_essence_vault(ctx) {
    let tier = 0;
    for (const threshold of [50,40,30,20,10]) {
      if (roll(ctx) >= threshold) break;
      tier += 1;
    }
    if (tier === 5) tier += ctx.rng.irandom(1);
    return { create: [{ itemType: 19, itemId: tier, isUnique: false, amount: 1 }] };
  },
  // case 0x18 — 25 random tarot
  random_tarot_25(ctx) {
    return { create: [{ itemType: 13, itemId: 19 + ctx.rng.irandom(21), isUnique: false, amount: 25 }] };
  },
  // case 0x19 — random pristine gem
  random_pristine_gem(ctx) {
    const ids = [39, 135, 45, 51, 57, 63, 69];
    return { create: [{ itemType: 15, itemId: ids[ctx.rng.irandom(6)], isUnique: false, amount: 1 }] };
  },
  // case 0x1a — Reflection of Tarethiel: mirrored copy (same seed, t = 1)
  mirror(ctx) {
    const d = ctx.target.def;
    const copy = { ...d, t: 1 };
    for (const k of ["w", "p", "q", "ab"]) if (d[k] !== undefined) copy[k] = d[k];
    return { create: [{ itemType: ctx.target.itemType, itemId: ctx.target.itemId, subtype: d.j, isUnique: !!ctx.target.isUnique, amount: 1, def: copy }] };
  },
  // cases 0x1b / 0x1c — cleanse corruption
  cleanse_prophet(ctx) { return { edit: { r: 0 } }; },
  cleanse_angel(ctx) { return { edit: { r: 0 } }; },
  // case 0x1d — Angel's Wisdom material
  craft_angels_wisdom(ctx) {
    return { create: [{ itemType: 14, itemId: 70, isUnique: false, amount: 1 }] };
  },
  // case 0x1e — Essence of Chaos on an infernal codex: new buff/debuff indices
  essence_of_chaos(ctx) {
    const effects=codexModifiers(ctx.target.def),natural=effects.filter(e=>e.source==='codex-native');
    const buff=natural.find(e=>e.kind==='buffs')?.id||0,debuff=natural.find(e=>e.kind==='debuffs')?.id||0;
    let u, v;
    do { u = ctx.rng.irandom(10); v = ctx.rng.irandom(7); } while (u === buff || v === debuff);
    return { edit: { u, v } };
  },
  // case 0x1f — Destiny Shard / Gypsy's Prophecy: star level p.
  destiny_shard(ctx) { return destiny(ctx); },
  gypsys_prophecy(ctx) { return destiny(ctx); },
};

function destiny(ctx) {
  const rv = roll(ctx);
  const p = Math.max(0, Math.min(5, Number(ctx.target.def.p) || 0));
  // Native success wrapper 0x14018bde0 calls ADD (0x14018bac0),
  // while failure wrapper 0x14018c0a0 calls SUB (0x14018be80).
  if (rv < 8) return { edit: { p: 0, r: 1 }, roll: rv, outcome: "corrupted" };
  if (rv < 30) return { edit: { p: Math.max(p - 1, 0) }, roll: rv, outcome: "level_down" };
  return { edit: { p: Math.min(5,p + 1) }, roll: rv, outcome: "level_up" };
}

const uniqueCraftPools = new WeakMap();

/** Native list order and eligibility, projected onto the supplied catalog. */
export function uniqueCraftCandidates(rows, rarity = null, tier = null) {
  let pools = uniqueCraftPools.get(rows);
  if (!pools) { pools = new Map(); uniqueCraftPools.set(rows, pools); }
  const key=`${rarity}:${tier}`;
  if (!pools.has(key)) {
    const addresses=rarity===7?CRAFT_RULES.angelicCraft:rarity===10?CRAFT_RULES.unholyCraft:
      tier==null?CRAFT_RULES.uniqueCraftByTier.flat():CRAFT_RULES.uniqueCraftByTier[tier];
    const catalog=new Map(rows.map(row=>[`${row.cls}:${row.sub??0}:${row.b}`,row]));
    pools.set(key,addresses.map(address=>catalog.get(address.join(':'))).filter(Boolean));
  }
  return pools.get(key);
}

function randomUniquePick(ctx, rarity) {
  // Native selects a tier once, then rejects ineligible entries within it.
  // Selecting uniformly from that tier's accepted entries is equivalent and
  // avoids an unbounded rejection loop. Angelic/Unholy always use tier five.
  const tier=rarity===null?ctx.rng.irandom(5):5;
  const pool = uniqueCraftCandidates(ctx.uniquePool || [], rarity, tier);
  if (!pool.length) throw new Error('No eligible items are available for this recipe.');
  const row = pool[ctx.rng.irandom(pool.length - 1)];
  return { create: [{ itemType: row.cls, itemId: row.b, subtype: row.sub, isUnique: true, amount: 1 }] };
}

/** Run the mechanic for a recipe. */
export function applyRecipe(recipe, target, rng, extra = {}) {
  const fn = MECHANICS[recipe.mechanic];
  if (!fn) throw new Error(`unknown mechanic ${recipe.mechanic} (resultType ${recipe.resultType})`);
  const ctx = { recipe, target, rng, config: { ...DEFAULT_CONFIG, ...(extra.config || {}) }, ...extra };
  return fn(ctx);
}
