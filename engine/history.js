import { packItem } from './session.js';
import { itemRarityName } from './items.js';
import { socketContents, starLevel, isCorrupted, isEquipment } from './item_setup.js';

export const VERSION_LIMIT = 10;

/** Detached, serializable values, captured before a later roll or model can change them. */
export function captureItem(sim, item) {
  if (!item) return null;
  const generated = sim.stats(item), sockets = sim.sockets(item);
  return structuredClone({
    item: packItem(item), name: item.name, sprite: item.row?.spr,
    rarity: itemRarityName(item), tier: item.info.tier, requiredLevel:item.info.requiredLevel??item.row?.lvl,
    stars: starLevel(item), equipment:isEquipment(item),
    corrupted: isCorrupted(item), crystal: item.def.q || 0, mirrored: Boolean(item.def.t),
    stats: generated.stats, warnings: generated.warnings || [],
    unresolved: Boolean(generated.normalAffixesResolved === false || generated.unresolved?.length || generated.modifiersResolved === false || generated.crystalResolved === false || generated.socketsResolved === false),
    sockets: { count: sockets.count, contents: socketContents(sim,item).map(s => s ? {name:s.name,sprite:s.row?.spr} : null) }
  });
}

/** Versions travel with the stack through inventory moves, undo, export and reload. */
export function retainVersion(stack, entry) {
  stack.versions = [{number:entry.number,time:entry.time,recipeName:entry.recipeName,lineage:entry.lineage,beforeSnapshot:entry.beforeSnapshot,afterSnapshot:entry.afterSnapshot}, ...(stack.versions || [])].slice(0, VERSION_LIMIT);
}

export function itemVersions(entry, stacks, history) {
  if (!entry?.lineage) return entry ? [entry] : [];
  const retained = stacks.find(s => s.id === entry.lineage)?.versions || [];
  const matches = history.filter(h => h.lineage === entry.lineage);
  const recent=[...new Map([...retained,...matches,entry].map(h=>[h.number,h])).values()].sort((a,b)=>b.number-a.number).slice(0,VERSION_LIMIT);
  // A selected older journal entry must still display its own snapshots.
  return recent.some(h=>h.number===entry.number)?recent:[entry,...recent.slice(0,VERSION_LIMIT-1)].sort((a,b)=>b.number-a.number);
}

const statKey = s => `${s.key ?? s.name}:${s.unit || ''}`;
export function compareStats(before, after) {
  const left = new Map((before?.stats || []).map(s=>[statKey(s),s]));
  const right = new Map((after?.stats || []).map(s=>[statKey(s),s]));
  return [...new Set([...left.keys(),...right.keys()])].map(key=>{
    const a=left.get(key),b=right.get(key);
    const numeric = a && b && !a.identity && !b.identity && typeof (a.displayValue ?? a.value)==='number' && typeof (b.displayValue ?? b.value)==='number';
    const delta = numeric ? Number(((b.displayValue ?? b.value)-(a.displayValue ?? a.value)).toFixed(2)) : null;
    return {key,before:a,after:b,delta,changed:!a||!b||(a.displayValue??a.value)!==(b.displayValue??b.value)};
  });
}
