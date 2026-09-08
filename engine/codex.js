import { Cpr } from './cpr.js';
import { CODEX_DATA } from './codex_data.js';
import { SOCKETABLE_RULES } from './socketable_rules.js';
import { codexEffectStats, codexSocketCount, codexGenerationState } from './codex_effects.js';

export const { zones: CODEX_ZONES, words: CODEX_WORDS } = CODEX_DATA;
export const isCodex = item => item?.itemType === 11 && [18,23].includes(item.itemId) && !item.isUnique;
export const isOrb = item => item?.itemType === 15 && item.itemId >= 112 && item.itemId <= 129 && !item.isUnique;
export function codexState(item) {
  const infernal = item.itemId === 23,native=codexGenerationState(item.def,infernal);
  const defaults = {zone:CODEX_ZONES[native.zoneIndex].id,entries:native.entries,zoneSource:'native',entriesSource:'native'};
  const saved = {...item.def.simCodex};
  if(saved.zone!=null&&!saved.zoneSource)saved.zoneSource='setup';
  if(saved.zoneSource==='native')delete saved.zone;
  if(saved.entriesSource==='native')delete saved.entries;
  // Older sessions retain their saved scenario; newly generated items follow
  // the native definition again when their seed or corruption changes.
  if(saved.entries!=null&&!saved.entriesSource)saved.entriesSource='legacy';
  const baseSockets=saved.socketSource==='native'||(saved.baseSockets==null&&saved.sockets==null)
    ? codexSocketCount({...item.def,q:0},infernal) : saved.baseSockets??saved.sockets;
  const socketSource=saved.socketSource??(saved.baseSockets!=null||saved.sockets!=null?'setup':'native');
  const sockets=socketSource==='native'?codexSocketCount(item.def,infernal):Math.min(6,baseSockets+(item.def.q===2?1:0));
  return {...defaults,...saved,socketSource,baseSockets,sockets};
}
export function codexOrbs(item) {
  return Array.from({length:codexState(item).sockets},(_,i)=>{
    try { const d=JSON.parse(atob(item.def[`s${i+1}`])); return d.c?null:Number(d.b); } catch {return null;}
  });
}
export function codexWord(item) {
  if(!isCodex(item))return null;
  const orbs=codexOrbs(item);
  return CODEX_WORDS.find(word=>word.orbs.length===orbs.length && word.orbs.every((id,i)=>id===orbs[i]))||null;
}
export function configureCodex(sim,item,patch) {
  if(!isCodex(item))throw new Error('Choose an Eternity or Infernal Codex.');
  const state={...codexState(item),...patch};
  if(!CODEX_ZONES.some(z=>z.id===state.zone))throw new Error('Choose a supported Codex zone.');
  if(!Number.isInteger(state.sockets)||state.sockets<0||state.sockets>6)throw new Error('Codex socket setup must be 0–6.');
  if(!Number.isInteger(state.entries)||state.entries<1||state.entries>99)throw new Error('Starting entries must be 1–99.');
  if(Object.hasOwn(patch,'zone'))state.zoneSource='setup';
  if(Object.hasOwn(patch,'entries'))state.entriesSource='setup';
  state.baseSockets=patch.sockets??state.baseSockets;
  if(Object.hasOwn(patch,'sockets'))state.socketSource='setup';
  delete state.sockets;
  const def={...item.def,simCodex:state};
  for(let i=Math.min(6,state.baseSockets+(def.q===2?1:0))+1;i<=7;i++)delete def[`s${i}`];
  return sim.makeItem(item.itemType,item.itemId,def,{row:item.row,amount:item.amount});
}
export function codexRecipeValid(recipe,item) {
  if(!isCodex(item))return {ok:false,reason:'Choose an Eternity or Infernal Codex.'};
  const state=codexState(item),orbs=codexOrbs(item);
  if(recipe.mechanic==='codex_word') {
    if(state.sockets!==recipe.orbs.length)return {ok:false,reason:`This Orb word requires exactly ${recipe.orbs.length} sockets. Configure a starting Codex with that socket count.`};
    if(orbs.some(Boolean))return {ok:false,reason:'The Orb word shortcut requires empty sockets. Use Empty Sockets first, or insert the remaining Orbs individually.'};
  } else if(!state.sockets||orbs.every(Boolean))return {ok:false,reason:'This Codex has no empty sockets. Configure a starting Codex with available sockets.'};
  return {ok:true};
}
export function applyCodexRecipe({recipe,target,rng,config}) {
  const valid=codexRecipeValid(recipe,target);if(!valid.ok)throw new Error(valid.reason);
  const edit={simCodex:codexState(target)};
  const ids=recipe.mechanic==='codex_word'?recipe.orbs:[recipe.orb];
  const first=recipe.mechanic==='codex_word'?0:codexOrbs(target).indexOf(null);
  ids.forEach((id,i)=>{
    edit[`s${first+i+1}`]=btoa(JSON.stringify({a:1,b:id,c:0,j:0}));
    // InventorySocketItem writes GetItemSeed() to i after each insertion.
    // The full-word shortcut follows the same sequence as individual Orbs.
    edit.i=Math.max(1,rng.irandom(config.maxSeed));
  });
  return {edit,outcome:recipe.mechanic==='codex_word'?'codex_word':'orb_inserted'};
}
export function codexRecipes(catalog,start) {
  const target={itemType:11,itemId:null,isUnique:false,amount:1,name:'Eternity or Infernal Codex'};
  const base={category:'codex',allowMultiCraft:false,keepItem:true,resultType:-1,result:{itemType:11,itemId:null,amount:1}};
  const material=(id,amount=1)=>({itemType:15,itemId:id,isUnique:false,amount});
  const words=CODEX_WORDS.map((word,i)=>({...base,index:start+i,name:word.name,mechanic:'codex_word',orbs:word.orbs,
    description:`Socket the Orbs in the order shown to form ${word.name}. This shortcut inserts the full sequence into an empty Codex and preserves its zone.`,
    ingredients:[target,...[...new Set(word.orbs)].map(id=>material(id,word.orbs.filter(x=>x===id).length))]}));
  const singles=Array.from({length:18},(_,i)=>{const id=112+i;return {...base,index:start+words.length+i,name:`Socket ${catalog.find(15,id,false).name}`,mechanic:'codex_orb',orb:id,
    description:'Insert one Orb into the next empty Codex socket. Socket order matters for Orb words. Each insertion creates a separate history record.',ingredients:[target,material(id)]};});
  return [...words,...singles];
}
export function orbStats(item) {
  if(!isOrb(item))return null;
  return {stats:Object.entries(SOCKETABLE_RULES.definitions[item.itemId]).map(([key,value])=>({key:Number(key),value,...CODEX_DATA.orbStats[key],source:'current.codex-orb'})),warnings:[],unresolved:[],model:'current-native-socketable'};
}
export function codexStats(item) {
  if(!isCodex(item))return null;
  const state=codexState(item),zone=CODEX_ZONES.find(z=>z.id===state.zone),word=codexWord(item);
  const stats=[{name:'Target zone',value:zone?`Act ${zone.act} · ${zone.name}`:'Unknown zone',identity:true},
    {name:'Zone selection',value:state.zoneSource==='setup'?'Starting scenario':state.zoneSource==='native'?'Game seed roll':'Saved simulation scenario',identity:true},
    {name:'Entries remaining',value:state.entries},{name:'Pack size increase',value:codexGenerationState(item.def,item.itemId===23).packSize},
    ...(item.itemId===23?[{name:'Codex tier',value:Number(item.def.p)||1}]:[]),...codexEffectStats(item)];
  const totals=new Map();
  for(const id of codexOrbs(item).filter(Boolean))for(const [key,value] of Object.entries(SOCKETABLE_RULES.definitions[id]||{}))totals.set(key,(totals.get(key)||0)+value);
  for(const [key,value] of totals)stats.push({key:Number(key),value,...CODEX_DATA.orbStats[key],source:'codex-orb'});
  if(word){const rng=new Cpr(item.def.i??0);stats.push({name:'Orb word',value:word.name,identity:true},{name:word.effect,value:word.min+(word.max===word.min?0:rng.irandom(word.max-word.min)),unit:'%',min:word.min,max:word.max,source:'current.orb-word'});}
  if(item.def.u!==undefined||item.def.v!==undefined)stats.push({name:'Essence of Chaos',value:'Applied',identity:true});
  const warnings=[];
  if(state.zoneSource==='simulated')warnings.push('This saved Codex retains its earlier simulation zone. New Codexes use the current game seed roll.');
  return {stats,warnings,unresolved:[],model:'current-native-codex'};
}
