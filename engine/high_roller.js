// Original GenerateItemHighRoller: sum before sockets/Crystal and special tails.
export function highRollerStats(values,repositoryStars=0) {
  const stats={...values};
  const total=[154,51,129,101,52,173,25].reduce((sum,key)=>sum+(stats[key]||0),0);
  const threshold=repositoryStars>0?Math.floor(777+777*repositoryStars*0.05):777;
  if(total>=threshold)for(const key of [201,161,282])stats[key]=(stats[key]||0)+7;
  stats[345]=total;
  return {stats,total,threshold,active:total>=threshold};
}
