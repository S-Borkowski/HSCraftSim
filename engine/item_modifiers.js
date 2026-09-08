import { MODIFIER_RULES as rules } from './modifier_rules.js';
import { BASE_STAT_RULES } from './base_stat_rules.js';
import { currentNaturalRule, decorate } from './stat_model.js';
import { highRollerStats } from './high_roller.js';
import { normalStateRule } from './normal_state.js';

const corruptionExempt = new Set(rules.corruptionExempt);
const upgradeExempt = new Set(rules.upgradeExempt);
const nonNumeric = new Set(rules.nonNumericStats);
const disabledSkills = new Set(rules.upgradeDisabledSkills);
const skillIdentities = new Map([[203,202],[206,205],[209,208]]);

/** Current native GetStatUpgrades(stat, mode, tier), independently replayed in x86-64. */
export function starUpgrade(key, tier) {
  const rule = rules.upgrades[key];
  return rule ? { amount:rule.amount * (rules.tierMultipliers[tier] ?? 1), additive:rule.additive }
    : { amount:0, additive:true };
}

/** CreateItemCheckGenerationCases: definition stats precede generated/special stats. */
export function modifyDefinitionValue(key, value, {stars=0,corrupted=false,tier=5,skillId,skillGate=value>1}={}) {
  if (!Number.isFinite(value) || key < 22 || key > 475 || nonNumeric.has(key)) return value;
  let result = corrupted && !corruptionExempt.has(key) ? Math.floor(value * rules.corruptionMultiplier) : value;
  if (corrupted || !stars || upgradeExempt.has(key) || (skillGate && disabledSkills.has(skillId))) return result;
  const rule = starUpgrade(key,tier), increment = rule.amount * stars;
  if (increment <= 0) return result;
  const upgraded = rule.additive ? result + increment : result + result * increment * rules.starPercentUnit;
  return Number.isInteger(result) ? Math.floor(upgraded) : upgraded;
}

function applyEarlyEffects(item,generated,metadata) {
  if(!currentNaturalRule(item)||item.itemType!==0||item.itemId!==79)return generated;
  // The current repository is addressed by type/base/subtype, with no item
  // stars argument. Keep its threshold separate from the modified item stats.
  const effect=highRollerStats(Object.fromEntries(generated.stats.map(s=>[s.key,s.value])));
  const stats=generated.stats.map(s=>effect.stats[s.key]===s.value?s:{...s,value:effect.stats[s.key],displayValue:effect.stats[s.key]});
  for(const key of [201,161,282])if(!stats.some(s=>s.key===key)&&effect.stats[key]!=null)
    stats.push(decorate({key,value:effect.stats[key],source:'current.highroller'},null,metadata));
  return {...generated,stats,internalStats:{...generated.internalStats,345:effect.total},highRoller:{total:effect.total,threshold:effect.threshold,active:effect.active}};
}

export function applyItemModifiers(item, generated, metadata={}) {
  if(generated.normalAffixesResolved)return {...generated,modifiersResolved:true,modifierBuild:rules.buildSha256};
  if (!item.def.p && !item.def.r) return applyEarlyEffects(item,generated,metadata);
  const address = `${item.row.kind}:${item.row.cls}:${item.row.sub??0}:${item.row.b}`;
  const currentDefinitions = generated.baseRangesVerified && (normalStateRule(item) ?? currentNaturalRule(item)?.base ?? BASE_STAT_RULES[address])?.stats;
  if (!item.profile?.tooltip && !currentDefinitions) return {...generated,warnings:[...(generated.warnings||[]),
    'This item has no mapped definition; its star and corruption effects are unresolved.'],modifiersResolved:false};
  const rawDefinitions = new Map((item.profile?.tooltip?.stats||[]).map(stat=>[stat.statKey,stat]));
  const definitionKeys = new Set(currentDefinitions ? Object.keys(currentDefinitions).map(Number) : rawDefinitions.keys());
  const options = {stars:Math.max(0,Math.min(5,Math.trunc(Number(item.def.p)||0))),corrupted:Boolean(item.def.r),tier:item.info.tier};
  const stats = generated.stats.map(stat => {
    // Later generated slots use SetItemStat: they overwrite the modified base.
    if (!definitionKeys.has(stat.key) || (!stat.baseContribution&&!['fixed','definition'].includes(stat.source)) || typeof stat.value!=='number') return stat;
    const identity = rawDefinitions.get(skillIdentities.get(stat.key));
    const currentIdentity=currentDefinitions?.[skillIdentities.get(stat.key)];
    const skillId = currentDefinitions ? (currentIdentity?.length===1?currentIdentity[0]:undefined)
      : identity?.representation==='scalar' ? identity.values?.[0] : undefined;
    // Native generation tests the level definition before consulting the skill
    // exclusion: arrays and scalars above one are gated; fixed level one is not.
    const rawLevel=rawDefinitions.get(stat.key), currentLevel=currentDefinitions?.[stat.key];
    const skillGate=currentDefinitions ? currentLevel?.length>1 || currentLevel?.[0]>1
      : rawLevel?.representation==='range' || rawLevel?.values?.[0]>1;
    const context={...options,skillId,skillGate};
    const base=stat.baseContribution;
    const value=base ? stat.value-base.value+modifyDefinitionValue(stat.key,base.value,context) : modifyDefinitionValue(stat.key,stat.value,context);
    if (value===stat.value && stat.min==null) return stat;
    return {...stat,baseValue:stat.value,value,
      displayValue:typeof stat.displayValue==='number'?value:stat.displayValue,
      ...(stat.min!=null?{min:base?stat.min-(base.min??base.value)+modifyDefinitionValue(stat.key,base.min??base.value,context):modifyDefinitionValue(stat.key,stat.min,context),
        max:base?stat.max-(base.max??base.value)+modifyDefinitionValue(stat.key,base.max??base.value,context):modifyDefinitionValue(stat.key,stat.max,context)}:{}),
      modifiers:{stars:options.stars,corrupted:options.corrupted}};
  });
  return applyEarlyEffects(item,{...generated,stats,modifiersResolved:true,modifierBuild:rules.buildSha256},metadata);
}
