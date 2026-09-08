// Item model for the simulator: catalog lookup, derived info (rarity/tier), stat generation.
//
// Current Unique base/generated/natural-socket chains live in stat_model.js
// and current_unique_generation.js. Explicit normal-equipment socket seeds
// use socketCount below. Imported models remain a fallback for other items;
// later modifiers, Crystal, special and socket effects are composed by Sim.
// See research/current/CURRENT_UNIQUE_GENERATION_VERIFICATION.md for boundaries.

import { Cpr } from "./cpr.js";
import { generateModelStats, nativeSocketState, currentNaturalRule } from './stat_model.js';
import { isCodex, codexState, codexWord } from './codex.js';
import { activeRuneword, runewordRequiredLevel } from './runewords.js';
import { EQUIPMENT_RULES } from './equipment_rules.js';
import { SOCKET_ENHANCEMENTS } from './socket_enhancement_rules.js';
import { normalState, normalStateRule } from './normal_state.js';
import { normalNameParts } from './normal_names.js';
import { socketableRequiredLevel, socketRequiredLevel } from './socket_levels.js';
import { vaultTier } from './vaults.js';
import { SOCKET_RESTRICTED_CONSUMABLES } from './socket_restriction_rules.js';

export const RARITY_NAMES = ["normal", "common", "magic", "rare", "legendary", "mythic", "satanic", "angelic", "runeword", "heroic", "unholy"];
export const RARITY_INDEX = { Normal: 1, Common: 1, Magic: 2, Rare: 3, Legendary: 4, Mythic: 5, Satanic: 6, Angelic: 7, Heroic: 9, Unholy: 10 };
export const TIER_NAMES = ["D", "C", "B", "A", "S", "SS", "SSS"];

export function itemRarityName(item) {
  if(vaultTier(item))return vaultTier(item);
  if(item?.info?.runeword)return 'Runeword';
  if(item?.info?.normalStateVerified) {
    const name=RARITY_NAMES[item.info.rarity];
    return item.info.rarity<=1?'Normal':name[0].toUpperCase()+name.slice(1);
  }
  return item?.row?.rar || 'Normal';
}

export class Catalog {
  constructor(rows, profiles = {}, metadata = {}) {
    this.rows = rows;
    this.byId = new Map(rows.map(row => [row.id, row]));
    this.profiles = profiles;
    this.metadata = metadata;
    this.byAddr = new Map();
    this.byFullAddr = new Map();
    for (const r of rows) {
      const key = `${r.kind === "unique" ? 1 : 0}:${r.cls}:${r.b}`;
      if (!this.byAddr.has(key)) this.byAddr.set(key, r);
      this.byFullAddr.set(`${key}:${r.sub ?? 0}`, r);
    }
  }
  find(itemType, itemId, isUnique, subtype) {
    if (subtype !== undefined) return this.byFullAddr.get(`${isUnique ? 1 : 0}:${Number(itemType)}:${Number(itemId)}:${Number(subtype)}`) || null;
    return this.byAddr.get(`${isUnique ? 1 : 0}:${Number(itemType)}:${Number(itemId)}`) || null;
  }
  uniques() {
    return this.rows.filter((r) => r.kind === "unique").map((r) => ({ ...r, rarityIndex: RARITY_INDEX[r.rar] ?? 6 }));
  }
}

/** Parse the catalog's "min-max" stat strings. */
export function parseStatRanges(row) {
  const out = [];
  for (const [name, range] of row.stats || []) {
    const text = String(range).trim();
    const m = text.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)(%?)$/);
    if (m) out.push({ name, min: Number(m[1]), max: Number(m[2]), unit: m[3] });
    else {
      const numeric = text.match(/^([+-]?\d+(?:\.\d+)?)(%?)$/);
      out.push(numeric ? { name, min: Number(numeric[1]), max: Number(numeric[1]), unit: numeric[2], fixed: true }
        : { name, text, fixed: true });
    }
  }
  return out;
}

/**
 * Build an item instance from a definition. `def` = save-file style object:
 *   a seed, b base id, c unique flag (1/0), j weapon subtype, s socket seed, w identified flag, q crystal,
 *   r corrupted, t mirrored, p star level, ab crystal seed, u/v codex indices
 */
export function makeItem(catalog, itemType, itemId, def = {}, opts = {}) {
  const isUnique = def.c === 1 || def.c === 1.0 || !!opts.isUnique;
  const row = opts.row || catalog.find(itemType, itemId, isUnique, opts.subtype ?? def.j);
  const profile = row ? catalog.profiles[`${row.kind}:${row.cls}:${row.sub ?? 0}:${row.b}`] : null;
  const socketStat = profile?.stats?.find(s => s.key === 20);
  const currentBase = row ? EQUIPMENT_RULES.items[`${row.kind}:${row.cls}:${row.sub ?? 0}:${row.b}`] : null;
  const item = {
    itemType: Number(itemType),
    itemId: Number(itemId),
    isUnique,
    row,
    profile,
    name: row ? row.name : `${itemType}#${itemId}`,
    // Catalog equipment is identified. Preserve an explicit imported w=0;
    // native IsIdentified reads w for uniques, independently of corruption r.
    def: { a: def.a ?? 1, b: Number(itemId), c: isUnique ? 1 : 0, j: def.j ?? row?.sub ?? 0, ...(Number(itemType)<=10?{w:1}:{}), ...def },
    info: {
      rarity: currentBase?.rarity ?? (row ? (RARITY_INDEX[row.rar] ?? (isUnique ? 6 : 1)) : (isUnique ? 6 : 1)),
      socketCraftBlocked: !isUnique && Number(itemType) === 11 && SOCKET_RESTRICTED_CONSUMABLES.includes(Number(itemId)),
      tier: opts.tier ?? currentBase?.tier ?? profile?.tier ?? Math.max(0,TIER_NAMES.indexOf(row?.tier)),
      maxSockets: currentBase?.maxSockets ?? profile?.maxSockets ?? socketStat?.values?.[0] ?? 0,
      width: row?.w ?? 1,
      height: row?.h ?? 1,
      sprite: row?.spr,
      handed: currentBase?.handed ?? row?.handed ?? 1,
      socketEnhancements: row ? SOCKET_ENHANCEMENTS[`${row.kind}:${row.cls}:${row.sub ?? 0}:${row.b}`] : undefined,
      requiredLevel: Number(itemType) === 15 && !isUnique ? socketableRequiredLevel(Number(itemId)) : row?.lvl,
    },
    amount: opts.amount ?? 1,
  };
  if(vaultTier(item)) {
    item.info.tier=item.itemId;
  }
  if(isCodex(item)) {
    item.def.simCodex=codexState(item);
    item.info.maxSockets=6;
    item.info.socketCount=item.def.simCodex.sockets;
    item.info.socketSource='codex-simulation';
    item.name=codexWord(item)?.name||item.name;
    return item;
  }
  const normal = normalState(item);
  if(normal)Object.assign(item.info,{rarity:normal.rarity,tier:opts.tier??normal.base.tier,requiredLevel:normal.requiredLevel,
    affixCount:normal.affixCount,superiorCount:normal.superiorCount,dropQuality:normal.dropQuality,normalStateVerified:true});
  if(normal) {
    const parts=normalNameParts(item,normal);
    if(parts) {
      item.info.affixNameParts=parts;
      item.name=(parts.prefix+item.name+parts.suffix).trim();
    }
  }
  const sockets = normal || nativeSocketState(item, catalog.metadata);
  item.info.maxSockets = sockets.capacity;
  item.info.socketCount = sockets.count;
  item.info.socketSource = sockets.source;
  if(sockets.range)item.info.naturalSocketRange=sockets.range;
  item.info.baseRarity=item.info.rarity;
  item.info.baseRequiredLevel=item.info.requiredLevel;
  const word=activeRuneword(item,item.info.socketCount);
  if(word){item.info.runeword=word;item.info.rarity=8;item.name=word.name;
    item.info.requiredLevel=runewordRequiredLevel(item,item.info.socketCount);}
  if([0,1,2,3,4,5,6,7,8,10,18].includes(item.itemType))
    item.info.requiredLevel=socketRequiredLevel(item,itemSockets(item).count);
  return item;
}

/** Explicit s override: current native normal-equipment fixtures verify this formula.
 * Missing s uses a separate natural-generation path; callers must distinguish it.
 */
export function socketCount(def, capacity) {
  const s = Number(def.s || 0);
  if (!s || !capacity) return 0;
  const rng = new Cpr(s);
  return 1 + rng.irandom(capacity - 1);
}

export function itemSockets(item) {
  if(isCodex(item))return {count:codexState(item).sockets,capacity:6,bonus:0,source:'codex-simulation'};
  // Current Unique generation never reads the normal equipment socket seed.
  // Retain saved fields for round trips, but derive active slots from def.a.
  const natural = currentNaturalRule(item);
  const explicit = !natural && Object.hasOwn(item.def, 's');
  const forcedCount = item.info.normalStateVerified ? item.def.zz?.sockets : null;
  const count = forcedCount!=null ? Number(forcedCount) : explicit ? socketCount(item.def, item.info.maxSockets) : item.info.socketCount ?? null;
  const bonus = item.def.q === 2 && !normalStateRule(item) && !(natural && count>=6) ? 1 : 0;
  const currentNormal = !item.isUnique && item.row && EQUIPMENT_RULES.items[`normal:${item.itemType}:${item.def.j}:${item.itemId}`]?.maxSockets > 0;
  return { count: count == null ? null : count + bonus, capacity: item.info.maxSockets, bonus,
    source: explicit ? (currentNormal ? 'current-normal-socket-override' : 'legacy-cube-override') : item.info.socketSource || 'unresolved' };
}

/**
 * Generate visible stats for an item from its seed.
 * pools = data/stat_pools.json.poolTables, statNames = data/stat_names.json
 * profile (optional) = Item Editor per-item profile (poolSlots, definition events).
 */
export function generateStats(item, pools, statNames, profile = null, metadata = {}) {
  if (item.profile?.tooltip || currentNaturalRule(item) || normalStateRule(item)) return generateModelStats(item, metadata);
  const rng = new Cpr(item.def.a);
  const stats = [];
  const trace = [];
  const ranges = item.row ? parseStatRanges(item.row) : [];
  const definition = profile || item.profile;
  const definitionRolls = new Map();
  // The catalog display order is NOT the game's RNG draw order. Preserve the
  // extracted definition event sequence, including non-visible identity draws.
  if (definition?.events?.length) {
    for (const event of definition.events) {
      const value = rng.irandom(event.delta);
      definitionRolls.set(event.key, value);
      trace.push({ phase: 'definition', stat: event.key, roll: value, upper: event.delta });
    }
  }
  const usedDefinitionKeys = new Set();
  const fallbackRng = new Cpr(item.def.a);
  // definition ranges (uniques and jewels/gems roll their listed ranges in catalog order)
  for (const r of ranges) {
    if (r.fixed) { stats.push({ name: r.name, value: r.min ?? r.text, unit: r.unit, source: "fixed" }); continue; }
    const delta = r.max - r.min;
    let roll;
    if (definitionRolls.size) {
      const candidates = definition.stats.filter(s => s.minimum === r.min && s.maximum === r.max && definitionRolls.has(s.key) && !usedDefinitionKeys.has(s.key));
      const normalized = r.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const exactName = candidates.find(s => (statNames[String(s.key)] || '').replace(/[^a-z0-9]/g,'').toLowerCase() === normalized);
      const entry = exactName || (candidates.length === 1 ? candidates[0] : null);
      if (entry) { roll = definitionRolls.get(entry.key); usedDefinitionKeys.add(entry.key); }
      // Ambiguous display-to-stat mappings remain explicitly approximate. They
      // must not advance the real definition RNG and corrupt generated slots.
      else { roll = fallbackRng.irandom(delta); trace.push({ phase:'catalog_fallback',stat:r.name,roll,upper:delta }); }
    } else roll = rng.irandom(delta);
    stats.push({ name: r.name, value: r.min + roll, min: r.min, max: r.max, unit: r.unit, roll, source: "definition" });
    if (!definitionRolls.size) trace.push({ phase: "catalog_fallback", stat: r.name, roll, upper: delta });
  }
  // 4 generated slots
  const slots = profile?.poolSlots || item.profile?.poolSlots || item.row?.poolSlots || {};
  for (let slot = 0; slot < 4; slot++) {
    const groupRoll = rng.irandom(2);
    const subtypeRoll = rng.irandom(4);
    const configured = Number(slots[slot] || 0);
    if (!configured) continue;
    const group = configured === 4 ? groupRoll + 1 : configured;
    const table = pools[String(group)];
    if (!table) continue;
    const selector = rng.irandom(table.length - 1);
    const entry = table[selector];
    const key = entry.keysBySubtype ? entry.keysBySubtype[subtypeRoll] : entry.key;
    const delta = entry.maximum - entry.minimum;
    const roll = rng.irandom(delta);
    stats.push({ key, name: statNames[String(key)] || `stat_${key}`, value: entry.minimum + roll, min: entry.minimum, max: entry.maximum, roll, source: `generated.slot${slot}` });
    trace.push({ phase: "generated", slot, group, selector, key, roll, upper: delta });
  }
  return { stats: stats.map(s => ({...s, source: 'catalog_approximate'})), trace, finalState: rng.state,
    warnings: ranges.length ? ['This item has no mapped stat chain; values are approximate catalog previews.'] : [],
    unresolved: [], catalogNotes: [], model: 'catalog-approximate' };
}
