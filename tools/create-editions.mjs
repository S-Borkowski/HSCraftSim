import {copyFile,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {editionHtml} from './editions.mjs';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--output'))throw new Error('Usage: node tools/create-editions.mjs [--output NEW_DIRECTORY]');
const output=path.resolve(args[1]||path.join(root,'..','HSCraftSim-Editions'));
const within=(base,target)=>{const rel=path.relative(base,target);return !rel||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
if(within(root,output)||within(output,root))throw new Error('Edition output must be separate from the source checkout.');
try{if((await readdir(output)).length)throw new Error('Output is not empty. Choose a new directory to preserve existing editions.');}catch(error){if(error.code!=='ENOENT')throw error;}
const html=await readFile(path.join(root,'ui/index.html'),'utf8');
const variants=[['01-Community','community'],['02-Website','website']].map(([folder,edition])=>({folder,edition,html:editionHtml(html,edition)}));
const source=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',windowsHide:true}).split('\0').filter(Boolean);
const manifest=JSON.parse(await readFile(path.join(root,'config/local-data-manifest.json'),'utf8'));
const runtime=manifest.files.filter(f=>f.group==='runtime').map(f=>f.path);
if(runtime.some(name=>!name.startsWith('data/')))throw new Error('Runtime files must stay in data/.');
const files=[...new Set([...source,...runtime])];
for(const name of files)if(!within(root,path.resolve(root,name))||path.isAbsolute(name)||name.includes('..')||name.includes('\\'))throw new Error('Unsafe source path: '+name);
await mkdir(output,{recursive:true});
const reports=[];
for(const variant of variants){
  const target=path.join(output,variant.folder);await mkdir(target);
  for(let n=0;n<files.length;n+=24)await Promise.all(files.slice(n,n+24).map(async name=>{
    const destination=path.join(target,name);await mkdir(path.dirname(destination),{recursive:true});
    await copyFile(path.join(root,name),destination);
  }));
  await writeFile(path.join(target,'ui/index.html'),variant.html);
  if(variant.edition==='website'){
    const readme=await readFile(path.join(target,'README.md'),'utf8');
    await writeFile(path.join(target,'README.md'),readme.replace('(Community edition)','(Website edition)'));
    const testing=await readFile(path.join(target,'PLAYER-TESTING.md'),'utf8');
    await writeFile(path.join(target,'PLAYER-TESTING.md'),testing.replace('Community player test build','Website player test build'));
  }
  // A fixed separate port prevents a launcher from reusing the other edition's server/session.
  const port=variant.edition==='community'?17960:17970;
  const launcher=`@echo off\r\ncd /d "%~dp0"\r\nstart "" pythonw "%~dp0server.py" --port ${port}\r\n`;
  for(const name of ['Start.bat','Baslat.bat','run.bat'])await writeFile(path.join(target,name),launcher);
  if(variant.edition==='website')await writeFile(path.join(target,'Start-Desktop.bat'),'@echo off\r\ncd /d "%~dp0"\r\nstart "" pythonw "%~dp0HSCraftSim.py" --profile-dir "%LOCALAPPDATA%\\HSCraftSim-Website"\r\n');
  await writeFile(path.join(target,'EDITION.txt'),`${variant.edition==='community'?'COMMUNITY — version 1':'WEBSITE — version 2'}\n\nCreated by Falor. ${variant.edition==='community'?"Falor's Discord appears in About and the footer. No host credit.":'No Discord links or host credit. Creator attribution remains.'}\n\nStart-Desktop.bat: Python desktop app.\nStart.bat: browser preview.\ndist/: ready-to-host website files; upload the contents of this folder.\n\nApplication source and compatible local runtime data are included for local use.\nOnly the canonical Community repository is pushed to GitHub. These local folders include data excluded from public source; see DISTRIBUTION.md.\n`);
  execFileSync(process.execPath,[path.join(target,'tools/build-web.mjs')],{cwd:target,stdio:'inherit',windowsHide:true});
  reports.push({edition:variant.edition,path:target,build:JSON.parse(await readFile(path.join(target,'dist/build-report.json'),'utf8'))});
}
await writeFile(path.join(output,'README.txt'),'HSCraftSim — two editions\n\n01-Community: version 1. Falor creator credit and Discord. Public GitHub edition.\n02-Website: version 2. Falor creator credit only. No Discord or host links.\n\nOpen Start-Desktop.bat inside the chosen edition, or Start.bat for a browser preview.\nFor hosting, use 02-Website/dist/.\nThe Website desktop launcher uses a separate profile; Community preserves the existing HSCraftSim profile.\n\nBoth folders contain the same crafting engine. Local data stays local; publish source using the canonical repository and its source-distribution checks.\n');
await writeFile(path.join(output,'editions.json'),JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports.map(r=>({edition:r.edition,path:r.path,revision:r.build.revision})),null,2));
