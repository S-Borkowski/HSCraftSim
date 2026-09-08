(async()=>{
 const $=s=>document.querySelector(s),click=s=>$(s).click(),wait=ms=>new Promise(r=>setTimeout(r,ms));
 const input=(s,v)=>{$(s).value=v;$(s).dispatchEvent(new Event('input',{bubbles:true}));};
 const change=(s,v)=>{$(s).value=v;$(s).dispatchEvent(new Event('change',{bubbles:true}));};
 click('#reset');click('[data-view="workshop"]');input('#recipe-search','Old');click('[data-recipe="60"]');
 click('#open-picker');change('#item-kind','');change('#item-type','15');input('#item-search','Ol');$('#item-amount').value=30;
 const ol=[...document.querySelectorAll('#item-list button')].find(b=>b.querySelector('strong').textContent==='Ol');if(!ol)throw Error('Ol not found');ol.click();click('[data-close="picker"]');
 $('#batch-count').value='10';click('#transmute');await wait(850);
 if($('#session-crafts').textContent!=='10'||$('#session-results').textContent!=='10'||document.querySelectorAll('[data-stack]').length!==1||$('[data-stack]').getAttribute('aria-label')!=='Old, 10 items'||document.querySelectorAll('[data-stash]').length!==0)throw Error('Batch result or material consumption mismatch');
 const result={passed:true,crafts:$('#session-crafts').textContent,results:$('#session-results').textContent,materialSpent:$('#session-spent').textContent};
 // Leave a clean, ready-to-craft demonstration for the visual handoff.
 click('#reset');input('#recipe-search','');click('[data-recipe="28"]');click('#open-picker');
 change('#item-type','0');change('#item-kind','unique');input('#item-search',"Harlequinn's Crest");$('#item-amount').value=1;change('#item-tier','5');
 click('[data-catalog]');click('[data-close="picker"]');click('#prepare');
 return result;
})()
