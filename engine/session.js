import { UniformRng } from './index.js';
import { isCodex } from './codex.js';

export function findPosition(stacks, item, columns = 4, rows = 4, ignoreId = null) {
  const w = Math.max(1, item.info.width), h = Math.max(1, item.info.height);
  for (let y=0;y<=rows-h;y++) for (let x=0;x<=columns-w;x++) {
    if (canPlace(stacks, item, x, y, columns, rows, ignoreId)) return {x,y};
  }
  return null;
}
export function canPlace(stacks,item,x,y,columns=4,rows=4,ignoreId=null) {
  const w=item.info.width,h=item.info.height;
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+w>columns||y+h>rows)return false;
  return !stacks.some(s=>s.id!==ignoreId && x<s.x+s.item.info.width && x+w>s.x && y<s.y+s.item.info.height && y+h>s.y);
}
export const packItem = item => ({rowId:item.row?.id, def:structuredClone(item.def), tier:item.info.tier, amount:item.amount});
export function unpackItem(sim, packed) {
  const row=sim.catalog.rows.find(r=>r.id===packed.rowId);
  if(!row || row.kind==='runeword')throw new Error('Invalid item record.');
  return sim.makeItem(row.cls,row.b,structuredClone(packed.def),{row,isUnique:row.kind==='unique',tier:packed.tier,amount:packed.amount});
}

/** Atomic inventory transaction: inputs consumed, target replaced, outputs stored. */
export function transact(sim,recipe,stacks,seed) {
  const output=sim.craft(recipe,stacks,new UniformRng(seed));
  if(output.items.some(i=>i.placeholder || !i.row))throw new Error('Result item data is missing; no materials were consumed.');
  const inputTarget=output.consumed.find(c=>c.ingredient.itemId==null && (Array.isArray(c.ingredient.itemType)||c.stack.item.itemType<=11))?.stack;
  const spent=new Map();
  for(const c of output.consumed){
    if(c.stack===inputTarget && (output.target || recipe.keepItem || recipe.mechanic==='mirror'))continue;
    spent.set(c.stack,(spent.get(c.stack)||0)+c.amount);
  }
  const next=stacks.map(s=>({...s,amount:s.amount-(spent.get(s)||0),item:s===inputTarget&&output.target?output.target:s.item})).filter(s=>s.amount>0);
  return {output,stacks:next,created:output.items, before:inputTarget?.item, after:output.target,
    cost:[...spent].map(([s,amount])=>({name:s.item.name,sprite:s.item.row?.spr,amount}))};
}

/** Fungible materials/runes can stack; rolled items retain their own seed. */
export function canStackItems(a, b) {
  if(isCodex(a)||isCodex(b))return false;
  if (a.row?.id !== b.row?.id || a.isUnique || b.isUnique || a.itemType <= 10 || a.itemType === 18) return false;
  if ([12,13,14,19].includes(a.itemType) || /_rune$/.test(a.row?.key || '')) return true;
  const canonical = def => JSON.stringify(Object.keys(def).sort().map(k => [k,def[k]]));
  return canonical(a.def) === canonical(b.def);
}

/** Consumption and output placement commit together. No inventory spillover. */
export function transmuteInCube(sim, recipe, stacks, seed, { columns = 4, rows = 4, idFactory = () => crypto.randomUUID() } = {}) {
  const tx = transact(sim, recipe, stacks, seed);
  const next = tx.stacks.map(s => ({ ...s })), resultStacks = [];
  const preferred = stacks.filter(s => !next.some(n => n.id === s.id));
  for (const item of tx.created) {
    const same = next.find(s => canStackItems(s.item, item));
    if (same) { same.amount += item.amount; resultStacks.push(same); continue; }
    const prior = preferred.find(s => canPlace(next, item, s.x, s.y, columns, rows));
    const position = prior ? { x: prior.x, y: prior.y } : findPosition(next, item, columns, rows);
    if (!position) throw new Error('The result does not fit in the Cube. Move items to inventory or switch to 9 × 6.');
    const outputStack = { id: idFactory(), item, amount: item.amount, ...position };
    next.push(outputStack); resultStacks.push(outputStack);
  }
  return { ...tx, stacks: next, resultStacks };
}
