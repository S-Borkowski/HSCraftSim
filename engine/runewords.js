import { Cpr } from './cpr.js';
import { RUNEWORD_RULES } from './runeword_rules.js';
import { decorate } from './stat_model.js';

export const RUNEWORDS=RUNEWORD_RULES.words;
const replaced=new Set(RUNEWORD_RULES.replaceStats);
export function runewordBaseAccepts(word,item) {
  if(item.isUnique||item.row?.kind!=='normal'||(item.info.baseRarity??item.info.rarity)!==1||!word.types.includes(item.itemType))return false;
  if(item.itemType===3) {
    if(Array.isArray(word.weapons)&&!word.weapons.includes(item.def.j))return false;
    if(!Array.isArray(word.weapons)&&word.weapons>0&&word.weapons!==item.def.j)return false;
    if(word.handed&&word.handed!==item.info.handed)return false;
  }
  return true;
}
export function socketRuneIds(item,count) {
  return Array.from({length:count},(_,i)=>{
    try {const def=JSON.parse(atob(item.def[`s${i+1}`]));return def.c?null:Number(def.b);} catch {return null;}
  });
}
// GetRuneword follows the Crystal stage and applies its own count adjustment.
// Normal base sockets remain unchanged by that stage; Codex already adds its
// Crystal socket during generation and is exempt from the extra adjustment.
export function activeRuneword(item,count) {
  if(!count)return null;
  if(item.def.q===2&&item.itemType!==11&&count<6)count++;
  const ids=socketRuneIds(item,count);
  if(!ids.length||ids.some(id=>id==null))return null;
  return RUNEWORDS.find(w=>runewordBaseAccepts(w,item)&&w.runes.length===count&&w.runes.every((id,i)=>ids[i]===id))||null;
}
export function runewordRequiredLevel(item,count) {
  // LoadRunewords scans the actual socket stat, before the matcher-only
  // Crystal adjustment, then keeps the largest base/Rune level requirement.
  return Math.max(item.info.requiredLevel??item.row?.lvl??1,
    ...socketRuneIds(item,count).map(id=>RUNEWORD_RULES.runeLevels[id]??0));
}
export function runewordRecipeValid(recipe,item,count) {
  const fail=reason=>({ok:false,reason});
  if(item.isUnique||item.row?.kind!=='normal'||(item.info.baseRarity??item.info.rarity)!==1||![0,1,2,3,6].includes(item.itemType))return fail('Runewords require a white base item.');
  if(item.info.runeword)return fail('This item already contains a Runeword. Empty its sockets first.');
  const ids=socketRuneIds(item,count);
  if(recipe.mechanic==='runeword') {
    const word=RUNEWORDS.find(w=>w.id===recipe.wordId);
    if(!word||!runewordBaseAccepts(word,item))return fail('This base item does not match the Runeword’s equipment or weapon requirements.');
    if(count!==word.runes.length)return fail(`This Runeword requires exactly ${word.runes.length} sockets.`);
    if(ids.some(Boolean))return fail('The complete Runeword shortcut requires empty sockets. Insert the remaining Runes individually, or use Empty Sockets.');
  } else if(!count||ids.every(Boolean))return fail('Choose equipment with an empty socket.');
  return {ok:true};
}
export function applyRunewordRecipe({recipe,target,rng,config}) {
  const edit={};
  const ids=recipe.mechanic==='runeword'?RUNEWORDS.find(w=>w.id===recipe.wordId).runes:[recipe.rune];
  let first=0;
  if(recipe.mechanic!=='runeword')while(target.def[`s${first+1}`])first++;
  ids.forEach((id,i)=>{
    edit[`s${first+i+1}`]=btoa(JSON.stringify({a:1,b:id,c:0,j:0}));
    edit.i=Math.max(1,rng.irandom(config.maxSeed));
  });
  return {edit,outcome:recipe.mechanic==='runeword'?'runeword_created':'rune_inserted'};
}
export function runewordRecipes(catalog,start) {
  const base={category:'runewords',allowMultiCraft:false,keepItem:true,resultType:-1,result:{itemId:null,amount:1}};
  const target=types=>({itemType:types,itemId:null,isUnique:false,amount:1,name:'White base equipment'});
  const rune=(id,amount=1)=>({itemType:15,itemId:id,isUnique:false,amount});
  const words=RUNEWORDS.map((word,i)=>({...base,index:start+i,name:word.name,wordId:word.id,mechanic:'runeword',
    description:`Insert ${word.runes.map(id=>catalog.find(15,id,false).name).join(' → ')} in that order. Requires exactly ${word.runes.length} empty sockets in a matching white base item. This shortcut inserts the complete sequence.`,
    ingredients:[target(word.types),...[...new Set(word.runes)].map(id=>rune(id,word.runes.filter(x=>x===id).length))]}));
  const singles=[...Array.from({length:33},(_,i)=>i+1),200,201,202,203].map((id,i)=>({...base,index:start+words.length+i,name:`Insert ${catalog.find(15,id,false).name} Rune`,mechanic:'socket_rune',rune:id,
    description:'Insert one Rune into the next empty equipment socket. Order matters. Each insertion is recorded in History; the final matching Rune activates the Runeword.',
    ingredients:[target([0,1,2,3,6]),rune(id)]}));
  return [...words,...singles];
}
export function rollRuneword(word,seed,itemType,handed=1) {
  const table=word.stats[itemType!==3?'armor':handed===2?'twoHand':'oneHand'];
  const rng=new Cpr(seed),stats=[];
  for(const [raw,range] of Object.entries(table).sort(([a],[b])=>a<b?-1:a>b?1:0)) {
    const key=Number(raw),isRange=Array.isArray(range),min=isRange?range[0]:range,max=isRange?range[1]:range;
    if([376,380,378,382,347,431,10,11,12,13,14,15,16,17,18,19,444,21,432,20].includes(key))continue;
    stats.push({key,value:min+(isRange?rng.irandom(max-min):0),min,max,replace:replaced.has(key)});
  }
  const randomClass=stats.find(s=>s.key===221);
  if(randomClass)stats.push({...randomClass,key:[222,224,223,225,226,227][rng.irandom(5)]});
  return stats;
}
export function applyRuneword(item,generated,metadata) {
  const word=item.info.runeword;
  if(!word)return generated;
  const stats=new Map(generated.stats.map(s=>[s.key??s.name,{...s}]));
  for(const bonus of rollRuneword(word,item.def.i??0,item.itemType,item.info.handed)) {
    if(bonus.key===0||bonus.key===21||bonus.key===221)continue;
    const previous=stats.get(bonus.key),base=bonus.replace?0:Number(previous?.value)||0;
    const value=base+bonus.value;
    const stat=decorate({...bonus,value,source:'runeword',min:base+bonus.min,max:base+bonus.max},null,metadata);
    stats.set(bonus.key,{...previous,...stat,runewordBonus:bonus.value});
  }
  return {...generated,stats:[...stats.values()],runeword:word.name,runewordBuild:RUNEWORD_RULES.buildSha256};
}
