(async()=>{
 const $=s=>document.querySelector(s),check=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
 const first=$('[data-stack]'),id=first.dataset.stack,transfer=new DataTransfer();
 first.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));
 $('#stash').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));
 check($(`[data-stash="${id}"]`),'Cube to stash drag');results.push('Cube to stash drag');
 const rect=$('#cube-grid').getBoundingClientRect(),transferBack=new DataTransfer();
 $(`[data-stash="${id}"]`).dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transferBack}));
 $('#cube-grid').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transferBack,clientX:rect.left+25,clientY:rect.top+25}));
 check($(`[data-stack="${id}"]`),'Stash to Cube drag');results.push('Stash to Cube drag');
 const saved=JSON.parse(localStorage.getItem('hscraftsim.workshop.v2'));
 const importData=new DataTransfer();importData.items.add(new File([JSON.stringify(saved)],'test-session.json',{type:'application/json'}));
 $('#settings').showModal();$('#session-file').files=importData.files;$('#session-file').dispatchEvent(new Event('change',{bubbles:true}));await wait(150);
 check(!$('#settings').open,'Valid session import closes dialog');check($('#session-crafts').textContent===String(saved.state.crafts),'Import restores craft count');results.push('JSON import roundtrip');
 const invalid=structuredClone(saved);invalid.state.stacks[0].x=99;
 const badData=new DataTransfer();badData.items.add(new File([JSON.stringify(invalid)],'invalid.json',{type:'application/json'}));
 $('#session-file').files=badData.files;$('#session-file').dispatchEvent(new Event('change',{bubbles:true}));await wait(150);
 check($('#toast').classList.contains('error'),'Invalid import error shown');
 check(JSON.parse(localStorage.getItem('hscraftsim.workshop.v2')).state.stacks[0].x!==99,'Invalid import does not overwrite session');results.push('Invalid import preserves session');
 return{passed:results.length,results};
})()
