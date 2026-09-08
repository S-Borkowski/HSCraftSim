const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=(sprite,cls='')=>`<img class="${cls}" src="../data/${sprite==null?'game/Craft_Icon_spr_0.png':`icons/${Number(sprite)}.png`}" alt="" loading="lazy" decoding="async">`;

/** Game-style recipe tile: title, result sprite, ingredient art and quantities. */
export function recipeCardHtml(recipe,{selected=false,favorite=false,unavailable=false,summary='',context=null}={}) {
  const output=recipe.result;
  const showOutput=output.catalogId!=null&&['create','jewel_tier'].includes(recipe.mechanic);
  const ingredients=recipe.orbs
    ? [{itemId:null,amount:1,name:'Codex'},...recipe.orbs.map(id=>recipe.ingredients.find(i=>i.itemId===id)).map(i=>({...i,amount:1}))]
    : recipe.ingredients;
  return `<button class="recipe-row game-recipe ${selected?'active':''} ${unavailable?'unsupported':''} ${context?.dimmed?'dimmed':''} ${context?.ready?'craft-ready':''}" data-recipe="${recipe.index}" data-context="${context?.rank??2}" aria-pressed="${selected}" aria-label="${esc(recipe.name)} — ${esc(summary)}" aria-description="${esc(context?.reason||'')}">
    <strong class="game-recipe-name">${esc(recipe.name)}</strong>${favorite?'<span class="game-recipe-favorite" aria-label="Favorite">★</span>':''}
    <span class="game-recipe-art ${ingredients.length>4?'many-ingredients':''}">
      ${showOutput?`<span class="game-recipe-result" data-hover-catalog="${output.catalogId}" data-preview="true">${art(output.sprite)}${output.amount>1?`<span>×${output.amount}</span>`:''}</span>`:''}
      <span class="game-recipe-cost">${ingredients.map(ingredient=>{
        const choice=ingredient.alternatives?.[0]||ingredient,target=ingredient.itemId==null;
        return `<span class="game-recipe-ingredient ${target?'game-recipe-target':''}" ${choice.catalogId!=null?`data-hover-catalog="${choice.catalogId}"`:''} title="${esc(ingredient.name||'Target item')}">${target?'<span class="target-symbol">◇</span>':art(choice.sprite)}<span class="game-recipe-quantity">${target?'[Item]':`×${ingredient.amount||1}`}</span>${ingredient.alternatives?.length?'<small>Any</small>':''}</span>`;
      }).join('')}</span>
    </span>${unavailable?'<span class="game-recipe-unavailable">Unavailable</span>':''}
  </button>`;
}
