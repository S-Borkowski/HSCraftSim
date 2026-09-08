import {Cpr} from './cpr.js';
import {CRYSTAL_RULES} from './crystal_rules.js';

/** Original CreateItemNew stages up to its pre-Crystal socket boundary. */
export function replayCurrentGenerated(item,rule) {
  const rng=new Cpr(item.def.a),stats=new Map(),trace=[],internalStats={};
  const draw=(upper,phase,extra={})=>{const roll=rng.irandom(upper);trace.push({upper,roll,phase,state:rng.state,...extra});return roll;};
  const assign=(key,range,source='definition',phase='definition')=>{
    const roll=range.length===2?draw(range[1]-range[0],phase,{stat:key}):0;
    const stat={key,value:range[0]+roll,source:range.length===1&&source==='definition'?'fixed':source,
      ...(range.length===2?{min:range[0],max:range[1],roll}:{})};
    stats.set(key,stat);return stat;
  };
  const definitions=rule.base.stats;
  for(const key of rule.base.order) {
    const stat=assign(key,definitions[key]);
    if(key===221) {
      internalStats[221]=stat.value;stats.delete(221);
      const target=222+draw(5,'definition.identity',{stat:221});
      // The placeholder and chosen tree each roll the range independently.
      assign(target,definitions[key],'current.skill.tree','definition.tree.value');
    }
  }
  for(let slot=0;slot<4;slot++) {
    const groupRoll=draw(2,'generated.group',{slot}),subtype=draw(4,'generated.subtype',{slot});
    const configured=definitions[slot]?.[0];
    if(!configured)continue;
    const group=configured===4?groupRoll+1:configured,pool=CRYSTAL_RULES.pools[group];
    if(!pool?.length)throw new Error(`Missing current generated pool ${group}`);
    const selector=draw(pool.length-1,'generated.selector',{slot,group}),entry=pool[selector];
    const key=entry.keysBySubtype?.[subtype]??entry.key;
    const previous=stats.get(key),rolled=assign(key,[entry.minimum,entry.maximum],`generated.slot${slot}`,'generated');
    if(previous)stats.set(key,{...rolled,value:previous.value+rolled.value,
      min:(previous.min??previous.value)+rolled.min,max:(previous.max??previous.value)+rolled.max,
      baseContribution:['fixed','definition'].includes(previous.source)?previous:previous.baseContribution});
    internalStats[slot]=[key,entry.minimum,entry.maximum];
  }
  // The native stat-419 loop accepts only GetSubTalentInfo(id, 1, 9) > 0.
  if(definitions[419]) {
    const valid=new Set(rule.subskillCandidates),seen=new Set();
    let selected;
    do {
      if(seen.has(rng.state))throw new Error('Could not resolve the current subskill roll.');
      seen.add(rng.state);
      selected=assign(419,definitions[419],'current.subskills','subskills');
    } while(!valid.has(selected.value));
  }
  if(definitions[21])assign(21,definitions[21],'current.subskills','subskills');
  if(rule.faceCandidates) {
    // GetTalentInfo's tag-12 membership is unchanged across all 16 augment
    // masks for all 428 candidates (player-skill-tags-native.json).
    const skill=rule.faceCandidates[draw(rule.faceCandidates.length-1,'special.face.skill',{stat:444})];
    stats.set(444,{key:444,value:skill,source:'current.face.skill'});
  }
  const roll=draw(rule.socketDrawUpper,'natural.socket',{stat:20});
  const count=rule.range[0]+(rule.socketRandom?roll:0);
  stats.set(20,{key:20,value:Math.min(6,count+(item.def.q===2?1:0)),min:rule.range[0],max:rule.range[1],source:'current.natural.socket'});
  return {stats:[...stats.values()],internalStats,count,capacity:rule.range[1],range:rule.range,trace,finalState:rng.state,source:'current-unique-generated'};
}
