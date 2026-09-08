// Run in agent-browser eval --stdin against the local UI.
(async()=>{
 const $=s=>document.querySelector(s),wait=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
 const check=(condition,label)=>{if(!condition)throw new Error(label);results.push(label);};
 const click=s=>{const e=$(s);if(!e)throw new Error('Missing '+s);e.click();};
 const input=(s,value)=>{$(s).value=value;$(s).dispatchEvent(new Event('input',{bubbles:true}));};
 const change=(s,value)=>{$(s).value=value;$(s).dispatchEvent(new Event('change',{bubbles:true}));};
 // Return to a repeatable, clean starting point using actual controls.
 click('#reset');click('[data-view="workshop"]');
 input('#recipe-search','Old');click('[data-recipe="60"]');click('#prepare');
 check($('#cube-grid').textContent.includes('3'),'Rune input stack prepared');
 check(!$('#transmute').disabled,'Rune craft enabled');
 click('#transmute');await wait(700);
 check($('#session-crafts').textContent==='1','Craft count updated');
 check(document.querySelectorAll('[data-stack]').length===1&&$('[data-stack]').getAttribute('aria-label')==='Old, 1 item','Rune output replaces ingredients in Cube');
 check(document.querySelectorAll('[data-stash]').length===0,'Craft output stays out of stash');
 check($('#inspector-content').textContent.includes('Old'),'Correct rune produced');
 click('#undo');check(document.querySelectorAll('[data-stack]').length===1&&$('[data-stack]').getAttribute('aria-label')==='Ol, 3 items','Undo restores inputs');
 check(document.querySelectorAll('[data-stash]').length===0,'Undo removes outputs');
 click('#transmute');await wait(700);
 click('[data-view="history"]');check($('#history-view').textContent.includes('Old'),'History records craft');
 click('[data-view="workshop"]');click('#reset');
 change('#outcome-seed','1');input('#recipe-search','Satanic');click('[data-recipe="28"]');
 click('#open-picker');input('#item-search',"Harlequinn's Crest");
 check(document.querySelectorAll('[data-catalog]').length===1,'Catalog search matches exact helmet');
 change('#item-tier','5');click('[data-catalog]');click('[data-close="picker"]');click('#prepare');
 check(document.querySelectorAll('[data-stack]').length===2,'Equipment and crystal placed');
 check(!$('#transmute').disabled,'Unique helmet accepts Crystal');
 click('[data-view="analysis"]');click('#monte-carlo');await wait(350);
 check($('#mc-results').textContent.includes('10,000'),'Monte Carlo completes');
 check($('#session-crafts').textContent==='0','Monte Carlo leaves session unchanged');
 click('[data-view="workshop"]');click('#transmute');await wait(700);
 check(document.querySelectorAll('[data-stack]').length===1,'Crystal consumed, equipment retained');
 check($('#inspector-content').textContent.includes('CORRUPTED'),'Deterministic corruption recorded');
 click('#prepare');check($('#transmute').disabled,'Corrupted item prevents repeated Crystal');
 input('#recipe-search','Prophet');click('[data-recipe="41"]');click('#prepare');
 check(!$('#transmute').disabled,'Corrupted helmet can be cleansed');click('#transmute');await wait(700);
 check(!$('#inspector-content').textContent.includes('CORRUPTED'),'Wisdom cleanses corruption');
 click('[data-grid="9"]');check($('#cube-grid').classList.contains('large'),'Large Cube layout works');
 click('[data-grid="4"]');check(!$('#cube-grid').classList.contains('large'),'Small Cube repacks items');
 if($('#favorite-toggle').getAttribute('aria-label')==='Add to favorites')click('#favorite-toggle');
 click('#favorites');check(document.querySelectorAll('[data-recipe]').length>=1&&[...document.querySelectorAll('[data-recipe]')].every(b=>b.textContent.includes('★')),'Favorite filter works');click('#favorites');
 input('#recipe-search','');
 check(!document.body.innerText.includes('NaN'),'No invalid stat numbers displayed');
 check(document.documentElement.scrollWidth<=innerWidth,'No horizontal page overflow');
 const broken=[...document.images].filter(i=>i.complete&&i.naturalWidth===0);check(broken.length===0,'All rendered images load');
 return {passed:results.length,results};
})()
