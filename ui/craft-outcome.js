/** Describe the recorded roll separately from the visible item changes. */
export function craftOutcome(entry, labels={}) {
  const before=entry?.beforeSnapshot,after=entry?.afterSnapshot;
  if(entry?.outcome==='level_down'&&before?.stars===0&&after?.stars===0) {
    return {label:'Star loss roll · Already at 0',note:'A star decrease was rolled, but the item was already at 0 stars. It stays at 0; the material was consumed.'};
  }
  if(['level_up','level_down'].includes(entry?.outcome)&&Number.isInteger(before?.stars)&&Number.isInteger(after?.stars)) {
    return {label:`${entry.outcome==='level_up'?'Star increased':'Star decreased'} · ${before.stars} → ${after.stars}`,note:''};
  }
  if(entry?.outcome==='corrupted'&&before?.stars>0&&after?.stars===0) {
    return {label:`Corrupted · Stars ${before.stars} → 0`,note:'The item was corrupted and its stars were reset to 0.'};
  }
  return {label:labels[entry?.outcome]||({corrupted:'Corrupted',level_up:'Star +1',level_down:'Star −1',edited:'Modified',created:'Created',rerolled:'Rerolled'}[entry?.outcome])||entry?.outcome||'Completed',note:''};
}
