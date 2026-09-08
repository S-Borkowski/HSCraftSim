// Current GetItemTooltipString numeric calculations, after all item/socket
// effects. Keep raw rolled stats intact: these are item display totals, not
// the player's combat damage. See tests/current_display_native.json.
export function applyItemDisplay(item, generated) {
  const level=Math.max(1,Math.min(100,Math.trunc(Number(item.def.simLevel)||100)));
  const eligible=Boolean(item.def.w)||item.info.rarity<6;
  if(!eligible)return generated;
  const values=new Map(generated.stats.map(stat=>[stat.key,stat.value]));
  const value=key=>Number.isFinite(values.get(key))?values.get(key):0;
  const calculations=new Map();
  if(item.itemType===3) {
    if(value(22)>0&&(value(28)>0||value(31)>0)) {
      const percent=(value(28)+value(31)*level)*0.01;
      calculations.set(22,base=>Math.ceil(base+base*percent));
    }
    if(value(23)>0&&value(68)>0) {
      const multiplier=1+value(68)*0.01;
      calculations.set(23,base=>base*multiplier);
    }
  }
  // Native defense applies the per-level terms only inside the positive
  // Enhanced Defense branch. Do not turn it into an unconditional bonus.
  if(value(154)>0&&value(29)>0) {
    const flat=value(156)*level,percent=(value(29)+value(30)*level)*0.01;
    calculations.set(154,base=>{const defense=base+flat;return Math.ceil(defense+defense*percent);});
  }
  if(!calculations.size)return generated;
  return {...generated,stats:generated.stats.map(stat=>{
    const calculate=calculations.get(stat.key);
    if(!calculate)return stat;
    // Preview still shows the actual total for this seed. A raw base roll
    // range is not a range of final damage with independently varying affixes.
    return {...stat,displayValue:calculate(stat.value),itemDisplayCalculated:true};
  })};
}
