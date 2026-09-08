// Item Editor semantics identify per-character-level coefficients explicitly.
// Keep raw coefficients for generation; calculate player-facing totals last.
export function applyCharacterLevel(item,generated) {
  const level=Math.max(1,Math.min(100,Math.trunc(Number(item.def.simLevel)||100)));
  const stats=generated.stats.map(stat=>{
    if(!stat.name?.includes('(Based on Level)')||!Number.isFinite(stat.value))return stat;
    return {...stat,displayValue:stat.value*level,characterLevel:level,perLevel:stat.value,
      ...(stat.min!=null?{displayMin:stat.min*level,displayMax:stat.max*level}:{})};
  });
  return {...generated,stats};
}
