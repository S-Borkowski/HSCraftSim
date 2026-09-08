import { ingredientAccepts, matchRecipe } from './recipes.js';
import { validateCraft, validateTargetStack } from './validation.js';
import { canStackItems, findPosition, transmuteInCube, packItem } from './session.js';
import { captureItem, retainVersion } from './history.js';
import { isEquipment } from './item_setup.js';
import { isCodex } from './codex.js';

/** Plan supplies in detached stacks. Existing items, quantities and RNG stay untouched. */
export function prepareIngredients(sim, recipe, stacks, {columns=4, rows=4, choices=new Map(), idFactory=()=>crypto.randomUUID()}={}) {
  if(!recipe)throw new Error('Select a recipe.');
  const next=stacks.map(s=>({...s})), remaining=stacks.map(s=>s.amount);
  let added=0;
  for(const [index,ing] of recipe.ingredients.entries()) {
    let need=Number(ing.amount);
    for(let n=0;n<next.length&&need>0;n++) {
      if(!remaining[n]||!ingredientAccepts(ing,next[n].item))continue;
      if(ing.itemId==null&&!validateTargetStack(recipe,next[n],ing).ok)continue;
      const take=Math.min(need,remaining[n]);remaining[n]-=take;need-=take;
    }
    // A starting target is always chosen by the user, never supplied here.
    if(ing.itemId==null||need<=0)continue;
    const selected=choices.get(`${recipe.index}:${index}`);
    const alternative=ing.alternatives?.find(a=>a.catalogId===selected)||ing.alternatives?.[0];
    const row=alternative?sim.catalog.byId.get(alternative.catalogId):sim.catalog.find(
      Array.isArray(ing.itemType)?ing.itemType[0]:ing.itemType,
      Array.isArray(ing.itemId)?ing.itemId[0]:ing.itemId,ing.isUnique);
    if(!row)throw new Error(`${ing.name||'Recipe ingredient'} was not found in the catalog.`);
    const item=sim.makeItem(row.cls,row.b,{a:123456,c:row.kind==='unique'?1:0,j:row.sub??0},{row});
    if(!ingredientAccepts(ing,item))throw new Error('The selected material does not meet this recipe’s requirements.');
    const same=next.find(s=>canStackItems(s.item,item));
    if(same)same.amount+=need;
    else {
      const position=findPosition(next,item,columns,rows);
      if(!position)throw new Error('The Cube is full. Make room for the ingredients or switch to 9 × 6.');
      next.push({id:idFactory(),item,amount:need,...position});remaining.push(0);
    }
    added+=need;
  }
  return {stacks:next,added};
}

/** Check the complete recipe after supplies, including target, level and space guards. */
export function craftReadiness(sim,recipe,stacks,options={}) {
  const current=validateCraft(recipe,stacks,options.config);
  if(current.ok||!current.missing)return {...current,addIngredients:false};
  const targets=recipe.ingredients.filter(i=>i.itemId==null);
  const target=matchRecipe({...recipe,ingredients:targets},stacks,
    (item,ing,stack)=>validateTargetStack(recipe,stack,ing).ok);
  if(!target.ok)return {ok:false,targetMissing:true,reason:'Choose an eligible target item first.',addIngredients:false};
  try {
    let id=0;
    const prepared=prepareIngredients(sim,recipe,stacks,{...options,idFactory:()=>`preview-supply-${++id}`});
    const valid=validateCraft(recipe,prepared.stacks,options.config);
    return {...valid,addIngredients:valid.ok&&prepared.added>0};
  } catch(error) { return {ok:false,reason:error.message,addIngredients:false}; }
}

/** Craft only with ingredients already in the Cube; preparation is a separate action.
 * Commit each successful craft with its own immutable history entry.
 * On total failure the original state is returned by identity, without even advancing RNG.
 */
export function runCraftAction(sim,recipe,state,{count=1,time=()=>new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}={}) {
  if(![1,10,100].includes(count)||count>1&&!recipe?.allowMultiCraft)throw new Error('This recipe does not support batch crafting.');
  const options={columns:state.columns,rows:state.rows,config:{...sim.config,jewelLevel:state.jewelLevel}};
  let next=state,done=0,error=null,lastItem=null,lastBefore=null;
  for(let n=0;n<count;n++) {
    try {
      const ready=validateCraft(recipe,next.stacks,options.config);
      if(!ready.ok)throw new Error(ready.reason);
      const tx=transmuteInCube(sim,recipe,next.stacks,next.rng,options);
      const item=tx.after||tx.resultStacks[0]?.item;
      const outputStack=tx.stacks.find(s=>s.item===item);
      const outcome=tx.output.result.outcome||(tx.output.result.corrupted?'corrupted':tx.after?'edited':'created');
      const entry={number:next.crafts+1,recipeName:recipe.name,recipe:recipe.index,seed:next.rng,time:time(),outcome,
        itemName:item?.name,itemSeed:item?.def.a,cost:tx.cost,before:tx.before?packItem(tx.before):null,after:item?packItem(item):null,
        lineage:outputStack?.id,beforeSnapshot:captureItem(sim,tx.before),afterSnapshot:captureItem(sim,item)};
      if(outputStack&&(isEquipment(item)||isCodex(item)))retainVersion(outputStack,entry);
      next={...next,stacks:tx.stacks,history:[entry,...next.history].slice(0,100),crafts:entry.number,
        spent:next.spent+tx.cost.reduce((n,c)=>n+c.amount,0),results:next.results+tx.created.reduce((n,i)=>n+i.amount,0),
        rng:next.rng>=4294967295?1:next.rng+1};
      lastItem=item;lastBefore=tx.before;done++;
    } catch(e) {error=e;break;}
  }
  return {state:next,done,error,lastItem,lastBefore};
}
