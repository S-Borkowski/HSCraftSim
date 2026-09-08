import { SOCKETABLE_RULES } from './socketable_rules.js';
import { MODIFIER_RULES } from './modifier_rules.js';
import { decorate } from './stat_model.js';
import { socketContents, isEquipment } from './item_setup.js';

const excluded=new Set(MODIFIER_RULES.nonNumericStats);

export function currentSocketableStats(item,metadata) {
  if (item.itemType!==15 || item.isUnique) return null;
  const definition=SOCKETABLE_RULES.definitions[item.itemId];
  if (!definition) return null;
  return {stats:Object.entries(definition).map(([key,value])=>decorate({key:Number(key),value,source:'current.socketable'},null,metadata)),
    trace:[],finalState:item.def.a,unresolved:[],catalogNotes:[],warnings:[],model:'current-native-socketable',build:SOCKETABLE_RULES.buildSha256};
}

/** CreateItemNew adds each numeric socket stat after the equipment modifiers. */
export function socketContribution(value,enhancement=0) {
  return Math.floor(value*(1+enhancement*0.5));
}

export function applySocketStats(sim,item,generated) {
  if (!isEquipment(item)) return generated;
  const contents=socketContents(sim,item);
  if (!contents.some(Boolean)) return generated;
  const values=new Map(generated.stats.map(stat=>[stat.key??stat.name,{...stat}]));
  let resolved=generated.model!=='catalog-approximate';
  const contributions=[];
  for (const [index,socket] of contents.entries()) {
    if (!socket) continue;
    if (socket.unknown) {resolved=false;continue;}
    const child=sim.stats(socket);
    if (child.model==='catalog-approximate'||child.unresolved?.length) {resolved=false;continue;}
    // Native GetItemInfo(15 + (socketNumber - 1), 0). Enhanced socket info
    // can be supplied by current definitions without changing saved payloads.
    const enhancement=item.info.socketEnhancements?.[index]??0;
    for (const stat of child.stats) {
      if (!Number.isInteger(stat.key)||excluded.has(stat.key)||stat.key===0) continue;
      if (typeof stat.value!=='number') {resolved=false;continue;}
      const bonus=socketContribution(stat.value,enhancement),previous=values.get(stat.key);
      if (previous && typeof previous.value!=='number') {resolved=false;continue;}
      const value=(previous?.value??0)+bonus;
      const updated=previous?{...previous,value,displayValue:value}:{...stat,value,displayValue:value,source:'socket'};
      if (previous?.min!=null) {updated.min=previous.min+bonus;updated.max=previous.max+bonus;}
      else if (!previous && stat.min!=null) {updated.min=socketContribution(stat.min,enhancement);updated.max=socketContribution(stat.max,enhancement);}
      updated.socketBonus=(previous?.socketBonus??0)+bonus;
      values.set(stat.key,updated);contributions.push({socket:index+1,key:stat.key,bonus});
    }
  }
  return {...generated,stats:[...values.values()],socketsResolved:resolved,socketContributions:contributions};
}
