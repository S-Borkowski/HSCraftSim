// Current native Unique chains, with imported Item Editor models retained as
// explicit fallbacks. Native and historical fixture boundaries remain separate.
import { Cpr } from './cpr.js';
import { BASE_ROLL_ORDER } from './base_order_rules.js';
import { BASE_STAT_RULES } from './base_stat_rules.js';
import { NATURAL_SOCKET_RULES } from './natural_socket_rules.js';
import { CURRENT_NATURAL_SOCKET_RULES } from './current_natural_socket_rules.js';
import { CURRENT_GENERATED_RULES } from './current_generated_rules.js';
import { replayCurrentGenerated } from './current_unique_generation.js';
import { normalState } from './normal_state.js';
import { normalAffixes } from './normal_affixes.js';

export const currentNaturalRule = item => !item.def.zz && item.row &&
  (CURRENT_NATURAL_SOCKET_RULES[`${item.row.kind}:${item.row.cls}:${item.row.sub??0}:${item.row.b}`]
    ?? CURRENT_GENERATED_RULES[`${item.row.kind}:${item.row.cls}:${item.row.sub??0}:${item.row.b}`]
    ?? NATURAL_SOCKET_RULES[`${item.row.kind}:${item.row.cls}:${item.row.sub??0}:${item.row.b}`]);

export function replayDynamic(model, seed, pools) {
  const rng = new Cpr(seed), trace = [], assignments = new Map(), identities = [];
  let pendingTarget = null;
  const draw = (upper, phase, extra = {}) => {
    const roll = rng.irandom(upper ?? 0);
    const callIndex = trace.length;
    trace.push({ phase, upper, roll: upper == null ? null : roll, state: rng.state, ...extra });
    return [callIndex, roll];
  };
  const assign = (key, minimum, maximum, roll, source, callIndex) => {
    assignments.set(key, { key, value: minimum + roll, min: minimum, max: maximum, roll, source, callIndex });
  };
  for (const event of model.events) {
    if (event.advance) {
      for (let i = 0; i < event.advance; i++) {
        if (event.key === 221 && event.phase === 'generated_target_key_222_227') {
          const target = model.target221;
          pendingTarget = target.minimum + draw(target.maximum - target.minimum, 'definition.identity', { stat: 221 })[1];
        } else draw(null, 'hidden', { stat: event.key });
      }
      continue;
    }
    const [callIndex, roll] = draw(event.delta, 'definition', { stat: event.key });
    if (event.score === false) continue;
    const key = event.key === 221 ? pendingTarget : event.key;
    if (key == null) throw new Error('Could not resolve the stat identity.');
    const minimum = model.minimums[event.key];
    assign(key, minimum, minimum + event.delta, roll, 'definition', callIndex);
  }
  for (let slot = 0; slot < 4; slot++) {
    const groupRoll = draw(2, 'generated.group', { slot })[1];
    const subtypeRoll = draw(4, 'generated.subtype', { slot })[1];
    const configured = model.poolSlots[slot] || 0;
    if (!configured) continue;
    const group = configured === 4 ? groupRoll + 1 : configured;
    const table = pools[group];
    if (!table?.length) throw new Error(`Missing stat pool: ${group}`);
    const selector = draw(table.length - 1, 'generated.selector', { slot, group })[1];
    const entry = table[selector], key = entry.keysBySubtype?.[subtypeRoll] ?? entry.key;
    const [callIndex, roll] = draw(entry.maximum - entry.minimum, 'generated', { slot, group, selector, key });
    // SetItemStat is last-write-wins, including generated → definition collisions.
    assign(key, entry.minimum, entry.maximum, roll, `generated.slot${slot}`, callIndex);
  }
  if (model.subskills) {
    const sub = model.subskills, valid = new Set(sub.validCandidateIds), seen = new Set();
    let attempts = 0;
    while (true) {
      if (seen.has(rng.state)) throw new Error('Could not resolve the skill roll loop.');
      seen.add(rng.state);
      const [callIndex, roll] = draw(sub.upperInclusive, 'subskills.identity', { stat: sub.statKey });
      const identity = roll + sub.candidateOffset;
      attempts++;
      if (valid.has(identity)) {
        identities.push({ key: sub.statKey, selectedIdentity: identity, attempts, callIndex, source: 'subskills.overloaded' });
        break;
      }
    }
  }
  const socket = model.socketTail;
  if (socket.kind === 'missing_hidden_advance') draw(socket.upperInclusive, 'socket.hidden', { stat: 20 });
  else if (socket.kind === 'range_assignment') {
    const [callIndex, roll] = draw(socket.delta, 'socket', { stat: 20 });
    assign(20, socket.minimum, socket.maximum, roll, 'late.socket', callIndex);
  } else if (socket.kind !== 'fixed_no_draw') throw new Error('Unknown socket model.');
  for (const special of model.specialTail) {
    const [callIndex, selector] = draw(special.candidateStatKeys.length - 1, 'special.identity');
    const key = special.candidateStatKeys[selector];
    if (special.kind === 'variable_damage_type') {
      const [valueIndex, roll] = draw(special.maximum - special.minimum, 'special.value', { stat: key });
      assign(key, special.minimum, special.maximum, roll, 'special.damage_type', valueIndex);
    } else {
      assignments.delete(key);
      identities.push({ key, selectedIdentity: key, fixedValue: special.fixedValue, source: special.kind, callIndex });
    }
  }
  return { assignments: [...assignments.values()].sort((a,b) => a.callIndex - b.callIndex || a.key - b.key), identities, trace, finalState: rng.state };
}

const hiddenKeys = new Set([1, 2, 24, 108, 110, 295, 447]);
const identityKinds = new Set(['skill_id', 'class_id', 'element_id', 'internal_enum']);

export function decorate(stat, raw, metadata) {
  const meta = metadata.semantics?.[stat.key];
  const unknown = meta?.name === 'unknown';
  const unit = meta ? (['percent','chance_percent'].includes(meta.valueKind) ? '%' : meta.valueKind === 'duration' ? ' s' : '') : raw?.percent ? '%' : '';
  const name = meta && !unknown ? meta.name : raw?.label || stat.name || `Stat #${stat.key}`;
  let displayValue = stat.value;
  if (meta?.valueKind === 'skill_id' && stat.value != null) {
    const talent = metadata.talents?.[stat.value];
    displayValue = talent?.name || talent?.slug || `Skill #${stat.value}`;
  } else if (meta?.valueKind === 'class_id' && stat.value != null) {
    displayValue = metadata.classes?.[stat.value] || `Class #${stat.value}`;
  } else if (meta?.valueKind === 'boolean' && stat.value != null) displayValue = stat.value ? 'Active' : 'Inactive';
  return { ...stat, name, unit, displayValue, description: meta?.plainDescription || '',
    valueKind: meta?.valueKind, linkedKeys: meta?.linkedKeys || [stat.key],
    higherIsBetter: meta?.higherIsBetter, semanticConfidence: meta?.evidence?.confidence,
    identity: identityKinds.has(meta?.valueKind),
    order: raw?.catalogLineIndex ?? 100000 + (stat.key ?? 0) };
}

export function generateModelStats(item, metadata = {}, {legacyBaseOrder=false} = {}) {
  const definition = item.profile?.tooltip || {stats:[],events:[],unmappedCatalogLines:[]}, dynamic = item.profile?.dynamic;
  const address=`${item.row.kind}:${item.row.cls}:${item.row.sub??0}:${item.row.b}`;
  const normal=!legacyBaseOrder&&normalState(item);
  if(normal) {
    const rawByKey=new Map(definition.stats.map(s=>[s.statKey,s]));
    const affixes=normalAffixes(item,normal);
    return {stats:[...(affixes?.stats??normal.stats),{key:20,value:normal.count,source:'current.normal.socket'}]
      .filter(s=>!hiddenKeys.has(s.key)).map(s=>decorate(s,rawByKey.get(s.key),metadata)).sort((a,b)=>a.order-b.order),
      trace:affixes?.trace??normal.trace,affixes:affixes?.affixes??[],unresolved:[],catalogNotes:[],
      warnings:affixes?[]:['Normal item affix values are not yet included. Rarity, required level, base properties and socket counts use the current game model.'],
      normalAffixesResolved:Boolean(affixes),model:affixes?'current-normal-affixes':'current-normal-state',baseOrderVerified:true,baseRangesVerified:true};
  }
  const naturalRule = !legacyBaseOrder && currentNaturalRule(item);
  if(naturalRule?.generated) {
    const result=replayCurrentGenerated(item,naturalRule);
    const rawByKey=new Map(definition.stats.map(s=>[s.statKey,s]));
    return {...result,stats:result.stats.filter(s=>!hiddenKeys.has(s.key)).map(s=>decorate(s,rawByKey.get(s.key),metadata)).sort((a,b)=>a.order-b.order),
      unresolved:[],catalogNotes:[],warnings:[],model:'current-native-generated',baseOrderVerified:true,baseRangesVerified:true};
  }
  const currentBase = !legacyBaseOrder && !dynamic && (naturalRule?.base ?? BASE_STAT_RULES[address]);
  const currentOrder = !legacyBaseOrder && !dynamic && (currentBase?.order ?? BASE_ROLL_ORDER[address]);
  const currentValues = new Map();
  const naturalState=naturalRule?nativeSocketState(item,metadata):null;
  for(const stat of naturalState?.lateStats||[])currentValues.set(stat.key,stat);
  const values = new Map(), unresolved = [], catalogNotes = [];
  let trace = [], finalState = item.def.a;
  const rawByKey = new Map(definition.stats.map(s => [s.statKey, s]));
  const put = stat => values.set(stat.key, decorate(stat, rawByKey.get(stat.key), metadata));
  const visible = raw => !hiddenKeys.has(raw.statKey) &&
    (!naturalRule || Object.hasOwn(currentBase.stats,raw.statKey)) &&
    !(dynamic && Object.hasOwn(dynamic.poolSlots, raw.statKey));
  let rolls = [];
  if (!dynamic) {
    const rng = new Cpr(item.def.a);
    rolls = definition.events.map(event => {
      const roll = rng.irandom(event.delta ?? 0);
      trace.push({ phase: event.delta == null ? 'hidden' : 'definition', stat: event.statKey, upper: event.delta, roll: event.delta == null ? null : roll, state: rng.state });
      return event.delta == null ? null : roll;
    });
    finalState = rng.state;
    if (currentOrder) {
      // Current native code sorts struct field names lexically. Keep the
      // imported tail values separate: this verifies the base stage only.
      const currentRng=new Cpr(item.def.a),currentTrace=[];
      for(const key of currentOrder) {
        const index=definition.events.findIndex(event=>event.statKey===key);
        const range=currentBase?.stats[key];
        const upper=range ? range[1]-range[0] : definition.events[index].delta;
        const roll=currentRng.irandom(upper);
        if(index>=0)rolls[index]=roll;
        if(range)currentValues.set(key,{key,value:range[0]+roll,min:range[0],max:range[1],roll,source:'definition'});
        currentTrace.push({phase:'definition',stat:key,upper,roll,state:currentRng.state});
      }
      const currentKeys=new Set(currentOrder);
      trace=[...currentTrace,...trace.filter(event=>!currentKeys.has(event.stat)).map(event=>({...event,phase:'legacy.tail'}))];
    }
  }
  for (const raw of definition.stats) {
    if (!visible(raw)) continue;
    const key = raw.statKey;
    if (raw.representation === 'scalar' && raw.values.length === 1) {
      put({ key, value: raw.values[0], source: 'fixed' });
    } else if (!dynamic && raw.representation === 'range' && Number.isInteger(raw.eventIndex) && rolls[raw.eventIndex] != null) {
      const roll = rolls[raw.eventIndex];
      put({ key, value: raw.minimum + roll, min: raw.minimum, max: raw.maximum, roll, source: 'definition' });
    } else if (!dynamic || raw.representation === 'dynamic_or_reference') {
      put({ key, value: null, min: raw.minimum, max: raw.maximum, source: 'unresolved' });
      unresolved.push(key);
    }
  }
  if(currentBase) {
    for(const [key,range] of Object.entries(currentBase.stats)) {
      if(hiddenKeys.has(Number(key)))continue;
      put(range.length===1 ? {key:Number(key),value:range[0],source:'fixed'} : currentValues.get(Number(key)));
    }
  }
  if (dynamic) {
    const replay = replayDynamic(dynamic, item.def.a, metadata.generatedPools);
    trace = replay.trace; finalState = replay.finalState;
    for (const stat of replay.assignments) if (!hiddenKeys.has(stat.key)) put(stat);
    for (const identity of replay.identities) {
      if (hiddenKeys.has(identity.key)) continue;
      const value = identity.source === 'subskills.overloaded' ? identity.selectedIdentity : identity.fixedValue ?? null;
      put({ key: identity.key, value, source: identity.source, attempts: identity.attempts });
      if (value == null) unresolved.push(identity.key);
    }
  }
  if (naturalRule) {
    const socket = nativeSocketState(item, metadata);
    put({key:20,value:Math.min(6,socket.count + (item.def.q===2?1:0)),min:socket.range[0],max:socket.range[1],source:'current.natural.socket'});
    trace=socket.trace;finalState=socket.finalState;
  }
  // The catalog also describes alternative random outcomes and unsupported
  // formulas. Keep them as reference text, never as simultaneous rolled stats.
  for (const raw of definition.unmappedCatalogLines) {
    const id = raw.label.match(/^Stat #(\d+)$/)?.[1];
    const name = metadata.semantics?.[id]?.name;
    catalogNotes.push({ name: name && name !== 'unknown' ? name : raw.label, template: raw.template });
  }
  const warnings = [];
  if (unresolved.length) warnings.push('Some special stat values are unresolved and displayed as "—".');
  if (catalogNotes.length) warnings.push('Some catalog entries are not mapped to rolled stats. They appear under Catalog reference.');
  if (item.row.kind === 'normal' && item.itemType <= 10) warnings.push('Random rarity and affix pools for normal items are not yet modeled.');
  return { stats: [...values.values()].sort((a,b) => a.order-b.order), trace, finalState, unresolved, catalogNotes, warnings,
    model: currentOrder ? 'current-base-editor-tails' : 'item-editor-s10', baseOrderVerified: Boolean(currentOrder), baseRangesVerified: Boolean(currentBase) };
}

/** Verified static ranges take priority over imported natural socket chains. */
export function nativeSocketState(item, metadata = {}, {legacy=false}={}) {
  const normal=!legacy&&normalState(item);
  if(normal)return normal;
  const rule = !legacy && currentNaturalRule(item);
  if (rule) {
    if(rule.generated)return replayCurrentGenerated(item,rule);
    const rng = new Cpr(item.def.a),trace=[],lateStats=[];
    const draw=(upper,phase,extra={})=>{const roll=rng.irandom(upper);trace.push({upper,roll,phase,state:rng.state,...extra});return roll;};
    for (const key of rule.base.order) draw(rule.base.stats[key][1]-rule.base.stats[key][0],'definition',{stat:key});
    for (let slot=0;slot<4;slot++) {draw(2,'generated.group',{slot});draw(4,'generated.subtype',{slot});}
    for(const key of rule.lateOrder||[]) {
      const [min,max]=rule.base.stats[key],roll=draw(max-min,'subskills.class',{stat:key});
      lateStats.push({key,value:min+roll,min,max,roll,source:'current.subskills'});
    }
    const [minimum,maximum] = rule.range;
    const roll=draw(rule.socketDrawUpper??maximum-minimum,'natural.socket',{stat:20});
    const count=minimum+(rule.socketRandom===false?0:roll);
    return {count,capacity:maximum,range:rule.range,source:'current-unique-socket-range',trace,lateStats,finalState:rng.state};
  }
  const chain = item.profile?.socketChain;
  if (chain) {
    const rng = new Cpr(item.def.a);
    for (let i = 0; i < chain.statBounds.length + 8; i++) rng.irandom(0);
    return { count: 1 + rng.irandom(chain.maxSockets - 1), capacity: chain.maxSockets, source: 'measured-a-chain' };
  }
  const dynamic = item.profile?.dynamic;
  if (dynamic?.socketTail.kind === 'fixed_no_draw') return { count: dynamic.socketTail.value, capacity: dynamic.socketTail.value, source: 'definition' };
  if (dynamic?.socketTail.kind === 'range_assignment') {
    const replay = metadata.generatedPools ? replayDynamic(dynamic, item.def.a, metadata.generatedPools) : null;
    return { count: replay?.assignments.find(s => s.key === 20)?.value ?? null, capacity: dynamic.socketTail.maximum, source: 'dynamic' };
  }
  return { count: null, capacity: item.info.maxSockets || 0, source: 'unresolved' };
}
