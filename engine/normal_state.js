// Native LoadCommonItems prelude and socket tail. Full random affix values
// remain separate: do not treat this state model as a complete item tooltip.
import { Cpr } from './cpr.js';
import { NORMAL_STATE_RULES as rules } from './normal_state_rules.js';

export function normalStateRule(item) {
  if(item.row?.kind!=='normal')return null;
  return rules.items[`normal:${item.itemType}:${item.def.j??0}:${item.itemId}`]??null;
}

export function normalState(item) {
  const rule=normalStateRule(item);if(!rule)return null;
  const rng=new Cpr(item.def.a),trace=[],stats=[];
  const draw=(upper,phase)=>{const roll=rng.irandom(upper);trace.push({upper,roll,phase,state:rng.state});return roll;};
  for(const key of Object.keys(rule.stats).sort()) {
    const [min,max]=rule.stats[key],roll=max==null?0:draw(max-min,'definition');
    stats.push({key:Number(key),value:min+roll,min,max:max??min,roll,source:max==null?'fixed':'definition'});
  }
  let quality=Math.max(1,Number(item.def.n)||1);
  if(quality===1&&item.def.zz?.dropQuality!=null)quality=Number(item.def.zz.dropQuality);
  const dropQuality=quality;
  const forcedSockets=item.def.zz?.sockets;
  const guaranteedSuperior=quality>=1000&&quality<=1006;
  const special=guaranteedSuperior||[666,6666].includes(quality);
  let affixCount=1,white=special,superiorCount=0,earlySockets=0,superiorPrefix=null;
  let magic=true,whiteChance=16;
  if(quality===100){affixCount=2+draw(1,'normal.forced.affixes');magic=false;whiteChance=0;}
  if(quality===200){affixCount=4;magic=false;whiteChance=0;}
  if(quality===6666)whiteChance=0;
  if(guaranteedSuperior||[666,6668].includes(quality))whiteChance=100;
  if(quality===10){whiteChance=40;quality=3;}
  if(magic&&[0,1,2,3,6].includes(item.itemType)&&draw(99,'normal.white')<whiteChance) {
    magic=false;
    if(quality!==6666&&forcedSockets==null)white=true;
    const superiorChance=guaranteedSuperior?100:25;
    if(draw(99,'normal.superior')<superiorChance) {
      for(let n=0;n<3;n++) {
        if(draw(99,'normal.superior')>=superiorChance)break;
        affixCount++;superiorCount++;
      }
      const prefix=(item.itemType===3?702:707)+superiorCount*10+rule.tier;
      superiorPrefix=prefix;
      for(const upper of rules.superiorDraws[prefix])draw(upper,'normal.superior.value');
    }
  }
  if(magic) {
    const multiplier=({2:2,3:4,4:6,6:8})[quality]??1;
    for(const chance of [28+6*multiplier,22+5*multiplier,12+4*multiplier,1+3*multiplier,1+2*multiplier]) {
      if(draw(99,'normal.affix.count')>=chance)break;
      affixCount++;
    }
  }
  if(white&&[0,1,2,3,6].includes(item.itemType)) {
    if(quality===1000)earlySockets=draw(rule.capacity,'normal.white.socket');
    else if(quality>=1001&&quality<=1006)earlySockets=quality-1000;
    else if(quality===666) {
      earlySockets=Object.keys(rule.stats).filter(key=>Number(key)>=10&&Number(key)<=15).length;
      affixCount=1+superiorCount;
    } else {
      for(let slot=0;slot<rule.capacity;slot++)earlySockets+=draw(99,'normal.white.socket')<(4+2*quality)*(rule.tier+1)?1:0;
      affixCount=1+superiorCount;
    }
  }
  const rarity=superiorCount?1:affixCount>=4?5:affixCount>=3?3:
    affixCount>=2||[5,7].includes(item.itemType)?2:1;
  const requiredLevel=([1,16,26,40,52,100][rule.tier]??1)+
    (rule.tier+1)*(affixCount>=4?3:affixCount>=3?2:affixCount>=2&&!superiorCount?1:0);
  let count=earlySockets;
  if(forcedSockets!=null)count=Number(forcedSockets);
  else if(rule.capacity) {
    if(Object.hasOwn(item.def,'s')) {
      const socketSeed=Number(item.def.s)||0;
      count=socketSeed?1+new Cpr(socketSeed).irandom(rule.capacity-1):0;
    } else if(!white) {
      // LoadCommonItems reseeds with def.a before the natural socket tail.
      const sockets=new Cpr(item.def.a);
      count=sockets.irandom(99)<(superiorCount?45:22)?1+sockets.irandom(rule.capacity-1):0;
    }
  }
  return {rarity,requiredLevel,affixCount,superiorCount,superiorPrefix,white,earlySockets,count,quality,dropQuality,special,
    capacity:rule.capacity,source:Object.hasOwn(item.def,'s')?'current-normal-socket-override':'current-normal-natural-sockets',
    stats,trace,base:rule,buildSha256:rules.buildSha256};
}
