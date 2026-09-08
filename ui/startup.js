/* Classic script: also runs when the HTML is opened directly from disk. */
(() => {
  const script=document.currentScript;
  function notice(title,message){
    let overlay=document.getElementById('startup-notice');
    if(!overlay){
      overlay=document.createElement('section');overlay.id='startup-notice';overlay.setAttribute('role','alert');
      overlay.style.cssText='position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:#0b1119;color:#dce3ed;font:15px/1.65 Segoe UI,sans-serif;';
      overlay.innerHTML='<div style="max-width:570px;border:1px solid #39485b;border-radius:16px;padding:30px;background:#151e2a"><small style="letter-spacing:2px;color:#ddbb8a">HSCRAFTSIM</small><h1 style="font-size:24px;margin:12px 0"></h1><p style="white-space:pre-line"></p><button style="margin-top:12px;padding:10px 18px;background:#39242c;color:#fff0df;border:0;border-radius:8px;cursor:pointer">Try again</button></div>';
      document.body.append(overlay);overlay.querySelector('button').onclick=()=>location.reload();
      document.querySelector('header')?.setAttribute('inert','');document.querySelector('main')?.setAttribute('inert','');
    }
    overlay.querySelector('h1').textContent=title;overlay.querySelector('p').textContent=message;
    return overlay;
  }
  if(location.protocol==='file:'){
    const overlay=notice('Open the launcher to start crafting','For the desktop app, open HSCraftSim.exe or Start-Desktop.bat.\nFor the local browser version, open Start.bat.\n\nThis index.html is the website entry point. Opening it directly from disk prevents the browser from loading the simulator. Upload the complete dist folder to a web host, or use the local preview launcher.');
    overlay.querySelector('button').remove();return;
  }
  const timeout=setTimeout(()=>notice('The workshop is taking longer to load','Check that the complete website package is available, then try again.'),20000);
  import(new URL(script.dataset.module,document.baseURI).href).then(()=>{
    clearTimeout(timeout);document.getElementById('startup-notice')?.remove();
    document.querySelector('header')?.removeAttribute('inert');document.querySelector('main')?.removeAttribute('inert');
  }).catch(error=>{
    clearTimeout(timeout);notice('The workshop could not start',`${error.message}\n\nReload the page. If this continues, check that all files from the same build were uploaded together.`);
  });
})();
