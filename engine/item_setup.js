import { Cpr } from './cpr.js';
import { itemSockets, socketCount } from './items.js';

export const EQUIPMENT_TYPES = new Set([0,1,2,3,4,5,6,7,8,10,18]);
export const isEquipment = item => EQUIPMENT_TYPES.has(item.itemType);
export const isCorrupted = item => Boolean(item.def.r);
export function startingQualityOptions(item) {
  if(!item.info.normalStateVerified)return [];
  const options=[[1,'Natural roll'],[100,'Magic or Rare'],[200,'Mythic']];
  if([0,1,2,3,6].includes(item.itemType))options.push([1000,'Superior base']);
  if(!options.some(([value])=>value===item.info.dropQuality))options.push([item.info.dropQuality,'Imported item quality']);
  return options;
}
export const starLevel = item => Math.max(0, Math.min(5, Math.trunc(Number(item.def.p) || 0)));
export const isNamedCatalogItem = row => Boolean(row.name) && !/^\?\d/.test(row.name);
export function socketFamily(row) {
  if(row.cls!==15 || row.kind==='runeword' || !isNamedCatalogItem(row) || (row.b>=112 && row.b<=129)) return null;
  return /_rune$/.test(row.key||'') ? 'runes' : /jewel/i.test(`${row.key} ${row.name}`) ? 'jewels' : 'gems';
}
export function filterSocketables(rows,{family='runes',query=''}={}) {
  const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter(row=>socketFamily(row)===family && words.every(word=>`${row.name} ${row.rar}`.toLowerCase().includes(word)));
}

const typeNames = {0:'helmet head',1:'armor armour chest body chestplate',2:'boots feet',3:'weapon',4:'gloves hands',5:'amulet necklace',6:'shield',7:'ring',8:'belt',10:'charm',11:'consumable',12:'key',13:'tarot',14:'material fragment',15:'rune gem jewel socketable',18:'potion'};
const searchCache = new WeakMap();
export function filterCatalog(rows, {query='', rarity='', type=''} = {}) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter(row => {
    if(row.kind === 'runeword' || !isNamedCatalogItem(row) || (rarity && row.rar !== rarity) || (type !== '' && row.cls !== Number(type))) return false;
    let text = searchCache.get(row);
    if(!text) { text = `${row.name} ${row.rar} ${typeNames[row.cls] || ''}`.toLowerCase(); searchCache.set(row,text); }
    return words.every(word => text.includes(word));
  });
}

/** Socket contents use the same base64 JSON definitions as Item Editor s1..s6. */
export function socketContents(sim, item) {
  const count = itemSockets(item).count ?? 0;
  return Array.from({length:count}, (_,index) => {
    const raw = item.def[`s${index+1}`];
    if(!raw) return null;
    try {
      const def = JSON.parse(atob(raw));
      const row = sim.catalog.find(15,def.b,Boolean(def.c),def.j ?? 0);
      if(!row) return {unknown:true,name:'Unrecognized socketed item',raw};
      return sim.makeItem(15,row.b,def,{row,isUnique:row.kind==='unique'});
    } catch { return {unknown:true,name:'Unrecognized socketed item',raw}; }
  });
}

export function hasSocketContents(item) {
  return Array.from({length:7},(_,i)=>item.def[`s${i+1}`]).some(Boolean) || Boolean(item.def.sockets?.some(Boolean));
}

export function setSocketContent(sim, item, index, row) {
  if(item.itemType===11 && [18,23].includes(item.itemId))throw new Error('Use Codex crafting to insert Orbs into a Codex.');
  const count = itemSockets(item).count ?? 0;
  if(!Number.isInteger(index) || index<0 || index>=count) throw new Error('Select an available socket.');
  if(row && (row.cls!==15 || (row.b>=112 && row.b<=129))) throw new Error('Orbs belong to Codex crafting and cannot be socketed in equipment.');
  const def={...item.def};
  if(row) def[`s${index+1}`]=btoa(JSON.stringify({a:1,b:row.b,c:row.kind==='unique'?1:0,j:row.sub??0}));
  else delete def[`s${index+1}`];
  delete def.sockets;
  return rebuild(sim,item,def);
}

export function rebuild(sim,item,def=item.def,tier=item.info.tier) {
  return sim.makeItem(item.itemType,item.itemId,{...def},{row:item.row,isUnique:item.isUnique,tier,amount:item.amount});
}

/** Configure a starting scenario. The explicit socket seed follows the existing Cube model. */
export function configureItem(sim,item,patch) {
  const def={...item.def};
  let tier=item.info.tier;
  if(patch.level!==undefined) {
    if(!Number.isInteger(patch.level)||patch.level<1||patch.level>100)throw new Error('Character level must be 1–100.');
    def.simLevel=patch.level;
  }
  if(patch.seed!==undefined) {
    if(!Number.isInteger(patch.seed)||patch.seed<1||patch.seed>1e9) throw new Error('Item seed must be 1–1,000,000,000.');
    def.a=patch.seed;
  }
  if(patch.dropQuality!==undefined) {
    if(!startingQualityOptions(item).some(([value])=>value===patch.dropQuality))throw new Error('Choose a supported starting quality.');
    def.n=patch.dropQuality;
    if(def.zz) {def.zz={...def.zz};delete def.zz.dropQuality;}
  }
  if(patch.tier!==undefined) {
    if(!Number.isInteger(patch.tier)||patch.tier<0||patch.tier>6) throw new Error('Select a valid item tier.');
    tier=patch.tier;
  }
  if(patch.stars!==undefined) {
    if(!isEquipment(item)||!Number.isInteger(patch.stars)||patch.stars<0||patch.stars>5) throw new Error('Star level must be 0–5 on equipment.');
    def.p=patch.stars;
  }
  if(patch.corrupted!==undefined) def.r=patch.corrupted?1:0;
  if(patch.crystal!==undefined) {
    if(![0,1,2].includes(patch.crystal)) throw new Error('Select a valid Crystal effect.');
    if(patch.crystal===2&&(!item.info.maxSockets||item.itemType===10||item.info.normalStateVerified)) throw new Error('This item cannot receive a Crystal socket.');
    def.q=patch.crystal;
    if(patch.crystal===1) def.ab ||= 123456;
  }
  if(patch.sockets!==undefined) {
    const count=patch.sockets,capacity=item.info.maxSockets;
    if(def.zz?.sockets!=null){def.zz={...def.zz};delete def.zz.sockets;}
    if(count==='auto') delete def.s;
    else if(item.info.naturalSocketRange) {
      const [minimum,maximum]=item.info.naturalSocketRange;
      if(!Number.isInteger(count)||count<minimum||count>maximum)throw new Error(`This item's natural range is ${minimum}–${maximum} sockets.`);
      const rolled=rollNaturalSockets(sim,rebuild(sim,item,def,tier),count);
      def.a=rolled.def.a;delete def.s;
    }
    else {
      if(!Number.isInteger(count)||count<0||count>capacity) throw new Error(`This item supports up to ${capacity} base sockets.`);
      def.s=0;
      if(count>0) {
        // Bounded exact search in the existing independent socket-seed model.
        for(let i=1;i<=100000;i++) {const seed=(i*15485863)%1e9+1;if(socketCount({s:seed},capacity)===count){def.s=seed;break;}}
        if(!def.s) throw new Error('Could not find a socket seed for this count.');
      }
    }
  }
  if(patch.corrupted===true) def.p=0;
  const result=rebuild(sim,item,def,tier),count=itemSockets(result).count??0;
  // Reducing socket capacity removes only the contents of the lost slots.
  if(['sockets','seed','crystal','dropQuality'].some(key=>Object.hasOwn(patch,key)) && itemSockets(result).count!=null)
    for(let i=count+1;i<=7;i++) delete result.def[`s${i}`];
  return result;
}

/** Reroll the real item seed for a measured natural socket count. */
export function rollNaturalSockets(sim,item,count) {
  if(!Number.isInteger(count)||count<(item.info.naturalSocketRange?.[0]??1)||count>item.info.maxSockets) throw new Error('Choose a supported natural socket count.');
  const chain=item.profile?.socketChain;
  if(item.info.naturalSocketRange) {
    const [minimum,maximum]=item.info.naturalSocketRange;
    if(count<minimum||count>maximum)throw new Error(`This item's natural range is ${minimum}–${maximum} sockets.`);
    for(let offset=1;offset<=100000;offset++) {
      const seed=(item.def.a+offset-1)%1e9+1,candidate=rebuild(sim,item,{...item.def,a:seed});
      if(candidate.info.socketCount===count)return configureItem(sim,item,{seed,sockets:'auto'});
    }
    throw new Error('Could not find a natural socket roll.');
  }
  if(!chain) throw new Error('A measured socket seed chain is not available for this item.');
  for(let offset=1;offset<=100000;offset++) {
    const seed=(item.def.a+offset-1)%1e9+1, rng=new Cpr(seed);
    for(let draw=0;draw<chain.statBounds.length+8;draw++) rng.irandom(0);
    if(1+rng.irandom(chain.maxSockets-1)===count) {
      return configureItem(sim,item,{seed,sockets:'auto'});
    }
  }
  throw new Error('Could not find a natural socket roll.');
}
