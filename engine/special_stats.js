import {Cpr} from './cpr.js';
import {CURRENT_SPECIAL_RULES} from './current_special_rules.js';
import {decorate,currentNaturalRule} from './stat_model.js';
import {itemSockets} from './items.js';

/** The native special stage starts again at the item's a seed. */
export function specialStatBonuses(definition,rule,socketCount) {
  const rng=new Cpr(definition.a),bonuses=[],trace=[];
  const draw=(upper,phase)=>{const roll=rng.irandom(upper);trace.push({upper,roll,phase,state:rng.state});return roll;};
  const apply=(stats,source,socket)=>{
    for(const key of Object.keys(stats).sort()) {
      const range=stats[key],roll=range.length===2?draw(range[1]-range[0],'special.value'):0;
      bonuses.push({key:Number(key),value:range[0]+roll,min:range[0],max:range.at(-1),source,socket});
    }
  };
  const elements=Object.keys(rule.damage).sort();
  if(elements.length)apply(rule.damage[elements[draw(elements.length-1,'special.element')]],'special.element');
  for(let index=1;index<=Math.min(6,socketCount);index++) {
    let gem=definition[`s${index}`];
    if(typeof gem==='string') {
      try {gem=JSON.parse(atob(gem));} catch {continue;}
    }
    const stats=gem&&rule.socket[gem.b];
    if(stats) {
      apply(stats,'special.socket',index);
      if(!rule.stackSockets)break;
    }
  }
  return {bonuses,trace,finalState:rng.state};
}

export function applySpecialStats(item,generated,metadata) {
  if(!currentNaturalRule(item))return generated;
  const key=`${item.row.kind}:${item.row.cls}:${item.row.sub??0}:${item.row.b}`,rule=CURRENT_SPECIAL_RULES[key];
  if(!rule)return generated;
  const result=specialStatBonuses(item.def,rule,itemSockets(item).count??0);
  const values=new Map(generated.stats.map(s=>[s.key,s]));
  for(const bonus of result.bonuses) {
    const previous=values.get(bonus.key),value=(previous?.value??0)+bonus.value;
    values.set(bonus.key,previous?{...previous,value,displayValue:typeof previous.displayValue==='number'?value:previous.displayValue,
      min:(previous.min??previous.value)+bonus.min,max:(previous.max??previous.value)+bonus.max}
      :decorate(bonus,null,metadata));
  }
  return {...generated,stats:[...values.values()],specialContributions:result.bonuses,
    trace:[...(generated.trace??[]),...result.trace],specialResolved:true,specialFinalState:result.finalState};
}
