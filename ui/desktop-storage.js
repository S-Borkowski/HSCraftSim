export async function desktopStorage() {
  if(!document.querySelector('meta[name="hscraftsim-desktop"]'))return null;
  if(window.pywebview?.api)return window.pywebview.api;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{window.removeEventListener('pywebviewready',ready);reject(new Error('The desktop connection could not start. Restart HSCraftSim.'));},15000);
    function ready(){clearTimeout(timer);resolve(window.pywebview.api);}
    window.addEventListener('pywebviewready',ready,{once:true});
  });
}

export function latestDesktopSession(stored,cached) {
  if(!stored)return cached;
  if(!cached)return stored;
  const revision=text=>{try{const value=JSON.parse(text).desktopRevision;return Number.isSafeInteger(value)?value:-1;}catch{return -1;}};
  return revision(cached)>revision(stored)?cached:stored;
}
