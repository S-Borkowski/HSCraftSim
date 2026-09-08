import { Cpr } from './cpr.js';
import { CODEX_EFFECT_RULES as rules } from './codex_effect_rules.js';

/** Full CreateItemNew draw order; isolated mode retains the older entry-point fixtures. */
export function codexModifiers(def,infernal=true,options) {
  return codexGenerationState(def,infernal,options).effects;
}
export function codexGenerationState(def,infernal=true,{isolated=false}={}) {
  const rng=new Cpr(def.a),effects=[];
  let entries,variant,zoneIndex,packSize;
  if(isolated){rng.irandom(1);rng.irandom(1);}
  else {
    const base=value=>def.r?Math.floor(value*0.25):value;
    entries=base((infernal?12:8)+rng.irandom(infernal?8:7));
    variant=base(1+rng.irandom(infernal?2:1));packSize=base(infernal?3:2);
    rng.irandom(1);zoneIndex=rng.irandom(44);
  }
  const result=()=>({rng,effects,entries,variant,zoneIndex,packSize});
  if(!infernal)return result();
  const add=(kind,id,source)=>{
    const rule=rules[kind][id];
    if(!rule)return;
    const roll=rng.irandom(rule.min===rule.max?1:rule.max-rule.min);
    effects.push({...rule,id,kind,source,value:rule.min+(rule.min===rule.max?0:roll)});
  };
  const natural=rng.irandom(99)<33;
  const buff=natural?1+rng.irandom(9):0;
  if(buff)add('buffs',buff,'codex-native');
  let extraBuff=Number(def.u)||0;
  if(extraBuff>0){if(extraBuff===buff)extraBuff+=extraBuff>1?-1:1;add('buffs',extraBuff,'codex-essence');}
  else rng.irandom(1);
  const debuff=natural?1+rng.irandom(6):0;
  if(debuff)add('debuffs',debuff,'codex-native');
  let extraDebuff=Number(def.v)||0;
  if(extraDebuff>0)add('debuffs',extraDebuff,'codex-essence');
  else rng.irandom(1);
  return result();
}

/** Current Codex socket branches; natural draws share the modeled initial state. */
export function codexSocketCount(def,infernal=true,{isolated=false}={}) {
  if(Object.hasOwn(def,'s')&&Number(def.s)===0)return 0;
  let count=0;
  const capacity=isolated||infernal?6:4;
  if(def.n>=1001&&def.n<=1006)count=def.n-1000;
  else if(Object.hasOwn(def,'s')) {
    if(def.s>0){const rng=new Cpr(def.s);count=1;for(let i=1;i<capacity;i++)if(rng.irandom(99)<38)count++;}
  } else {
    const {rng}=codexGenerationState(def,infernal,{isolated});
    for(let i=0;i<capacity;i++)if(rng.irandom(99)<38)count++;
  }
  return Math.min(6,count+(def.q===2?1:0));
}

export function codexEffectStats(item) {
  return codexModifiers(item.def,item.itemId===23).map(effect=>({
    ...effect,key:`codex-${effect.kind}-${effect.id}-${effect.source}`,
    name:`${effect.kind==='buffs'?'Buff':'Debuff'} · ${effect.name}`,
    higherIsBetter:effect.kind==='buffs',displayValue:effect.min===effect.max&&effect.value===1?'Active':effect.value,
    unit:'',identity:effect.min===effect.max&&effect.value===1
  }));
}
