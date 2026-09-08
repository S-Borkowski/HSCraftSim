import { Cpr } from './cpr.js';
import { CRYSTAL_RULES as rules } from './crystal_rules.js';
import { decorate } from './stat_model.js';
import { isCodex } from './codex.js';
import { CODEX_DATA } from './codex_data.js';

export function crystalValue({group,selector,subtype,itemType,unique,rarity,existing=0}, roll) {
  const entry=rules.pools[group]?.[selector];
  if (!entry) throw new Error('Unknown Crystal stat pool entry.');
  const key=entry.keysBySubtype?.[subtype-1] ?? entry.key;
  const scale=itemType===10&&!unique?(rules.charmMultipliers[rarity]??1):1;
  return {key,value:Math.ceil((existing+entry.minimum+roll)*scale),
    minimum:Math.ceil(entry.minimum*scale),maximum:Math.ceil(entry.maximum*scale)};
}

/** CreateItemNew reseeds with ab, then draws group, subtype, selector and value. */
export function applyCrystal(item,generated,metadata) {
  if (Number(item.def.q)!==1) return generated;
  if (!item.profile?.tooltip&&!isCodex(item)) return {...generated,crystalResolved:false};
  const rng=new Cpr(item.def.ab ?? 666), trace=[];
  const draw=(upper,phase)=>{const roll=rng.irandom(upper);trace.push({phase,upper,roll,state:rng.state});return roll;};
  let group=1+draw(2,'crystal.group');const subtype=1+draw(4,'crystal.subtype');
  if(isCodex(item))group=5;
  const pool=rules.pools[group],selector=draw(pool.length-1,'crystal.selector'),entry=pool[selector];
  const key=entry.keysBySubtype?.[subtype-1]??entry.key;
  const previous=generated.stats.find(stat=>stat.key===key);
  if (previous && typeof previous.value!=='number') return {...generated,crystalResolved:false};
  const roll=draw(entry.maximum-entry.minimum,'crystal.value');
  const context={group,selector,subtype,itemType:item.itemType,unique:item.isUnique,rarity:item.info.rarity,existing:previous?.value??0};
  const effect=crystalValue(context,roll);
  const bonus={key,value:effect.value,source:'crystal',crystal:{seed:rng.state,group,selector,subtype,bonusMin:effect.minimum,bonusMax:effect.maximum},
    min:crystalValue(context,0).value,max:crystalValue(context,entry.maximum-entry.minimum).value};
  const stat=previous?{...previous,...bonus,displayValue:effect.value}:isCodex(item)?{...bonus,...CODEX_DATA.orbStats[key]}:decorate(bonus,null,metadata);
  const stats=previous?generated.stats.map(row=>row===previous?stat:row):[...generated.stats,stat];
  return {...generated,stats,trace:[...(generated.trace??[]),...trace],crystalResolved:true,crystalBuild:rules.buildSha256};
}
