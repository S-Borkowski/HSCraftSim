import { Cpr } from './cpr.js';
import { NORMAL_AFFIX_RULES as rules } from './normal_affix_rules.js';
import { MODIFIER_RULES } from './modifier_rules.js';
import { modifyDefinitionValue } from './item_modifiers.js';

// LoadCommonItems builds ordered lists before selecting each affix. Entries
// removed from a list stay removed for subsequent selections on this item.
export function normalAffixes(item, state) {
  let groups=rules.pools[item.itemType];
  if((!groups&&!(item.itemType===3&&rules.weapon))||!state)return null;
  const rng=new Cpr(state.trace.at(-1)?.state??item.def.a),trace=[...state.trace];
  const options={stars:Number(item.def.p)||0,corrupted:Boolean(item.def.r),tier:state.base.tier};
  const stats=new Map(state.stats.map(s=>[s.key,{...s,
    value:modifyDefinitionValue(s.key,s.value,options),min:modifyDefinitionValue(s.key,s.min,options),
    max:modifyDefinitionValue(s.key,s.max,options),source:'current.normal.base'}])),affixes=[];
  if(state.superiorPrefix!=null) {
    let index=trace.findIndex(t=>t.phase==='normal.superior.value');
    const superiorRng=new Cpr(trace[index-1]?.state??item.def.a);
    affixes.push(rollNormalAffix(item,0,state.superiorPrefix,stats,upper=>{
      const roll=superiorRng.irandom(upper);
      trace[index++]={upper,roll,phase:'normal.superior.value',state:superiorRng.state};return roll;
    }));
  }
  const draw=(upper,phase)=>{const roll=rng.irandom(upper);trace.push({upper,roll,phase,state:rng.state});return roll;};
  if(draw(99,'normal.pool.optional.element')<65)draw(4,'normal.pool.optional.element.value');
  draw(99,'normal.pool.optional.group');
  const element=draw(4,'normal.pool.element'),gate=draw(99,'normal.pool.group');
  const tier=state.base.tier,width=tier===4?2:[2,3].includes(tier)?1:0;
  if(item.itemType===3) {
    const roll=draw(99,'normal.weapon.archetype'),sub=Number(item.def.j);
    let archetype=0;
    if([1,3,2,5].includes(sub))archetype=item.info.handed===1?(roll<([1,3].includes(sub)?25:50)?2:0):1;
    else if([13,14,16].includes(sub))archetype=1;
    else if([8,9,10,11,12,15].includes(sub))archetype=2;
    const bonus=archetype<2&&state.affixCount>=2&&state.superiorCount===0;
    if(bonus) {
      let [min,max]=[[75,135],[100,175],[150,200],[200,275],[240,350]][tier];
      for(let step=0;step<2;step++) {
        if(draw(99,'normal.weapon.bonus.upgrade')>=25)break;
        min+=Math.floor(min*0.5);max+=Math.floor(max*0.5);
      }
      const roll=draw(max-min,'normal.weapon.bonus.value'),prior=stats.get(28)?.value??0;
      stats.set(28,{key:28,value:prior+min+roll,min:prior+min,max:prior+max,roll,source:'current.normal.weapon'});
    }
    groups=rules.weapon[`${archetype}:${Number(bonus)}`];
  }
  const pools=[[],[]];
  for(const [threshold,entries] of groups)if(gate<threshold) {
    for(const [side,bases,fixed] of Array.isArray(entries)?entries:entries.byElement[element]) {
      const base=Array.isArray(bases)?bases[element]:bases;
      // Special base drops exclude this prefix before drawing its tier.
      if(state.special&&side===0&&base===671)continue;
      pools[side].push(fixed?base:base+width+draw(tier-width,'normal.pool.candidate'));
    }
  }
  let side=draw(1,'normal.affix.side');
  for(let slot=0;slot<state.affixCount;slot++) {
    const pool=pools[side],index=draw(pool.length-1,'normal.affix.selector');
    const [id]=pool.splice(index,1);
    // The native loop can exhaust one side. Its empty lookup adds no affix,
    // but both the selector draw (upper = -1) and next-side draw still run.
    if(id!=null)affixes.push(rollNormalAffix(item,side,id,stats,draw));
    side=draw(1,'normal.affix.side');
  }
  return {stats:[...stats.values()],trace,affixes,finalState:rng.state};
}

export function rollNormalAffix(item,side,id,stats,draw) {
  const rule=rules.affixes[side][id];
  if(!rule)throw new Error(`Missing native normal affix ${side}:${id}`);
  if(!Array.isArray(rule)) {
    const rows=rule.rows.map(row=>[...row]);
    if(rule.selector) {
      const [tableKey,key]=rule.selector,table=rules.procTables[tableKey];
      const selector=draw(table.length-1,'normal.affix.proc'),selected=table[selector],row=rows.find(r=>r[0]===key);
      [row[1],row[2]]=Array.isArray(selected)?selected:[selected,selected];
      if(tableKey==='418')rows.find(r=>r[0]===207).splice(1,2,selector+1,selector+1);
    }
    const values=rows.map(row=>rollAffixRow(item,row,stats,draw,rows[0][0]));
    return {side:side===0?'prefix':'suffix',id,...values[0],values};
  }
  const result=rollAffixRow(item,rule,stats,draw);
  if(rule[4]==='class') {
    const value=affixBound(21,stats.get(21)?.value??0,item)+1+draw(23,'normal.affix.class')-(item.def.r?1:0);
    stats.set(21,{key:21,value,source:'current.normal.affix'});
  }
  return {side:side===0?'prefix':'suffix',id,...result};
}

function rollAffixRow(item,rule,stats,draw,upgradeKey=rule[0]) {
  const [key,minimum,maximum,random,extra]=rule;
  // Existing rolled values and the new range are modified separately. In
  // particular, flooring their sum would change integer corruption results.
  const existing=stats.get(key)?.value??0,prior=affixBound(upgradeKey,existing,item);
  const min=prior+affixBound(upgradeKey,minimum,item),max=prior+affixBound(upgradeKey,maximum,item);
  const roll=random?draw(max-min,'normal.affix.value'):(draw(0,'normal.affix.float'),0),value=min+roll;
  stats.set(key,{key,value,min,max,roll,source:'current.normal.affix'});
  return {key,min,max,value};
}

// Affix ranges are upgraded before their value roll; base definition values
// follow a separate path in CreateItemCheckGenerationCases.
export function affixBound(key,value,item) {
  if(item.def.r) {
    const result=value-value*0.75*0.01;
    return Number.isInteger(value)?Math.floor(result):result;
  }
  const stars=Number(item.def.p)||0,upgrade=MODIFIER_RULES.upgrades[key];
  if(!stars||!upgrade)return value;
  const amount=upgrade.amount*(MODIFIER_RULES.tierMultipliers[item.info.tier]??1)*stars;
  const result=upgrade.additive?value+amount:value+value*amount*0.01;
  return Number.isInteger(value)?Math.floor(result):result;
}
