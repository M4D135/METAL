// Banc DEMO : chargement des modules de METAL (lecture seule) dans le domaine principal de Node.
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
export const ROOT=(process.env.METAL_ROOT||process.cwd());
export const MODULES=['renderer','world','destruction','economy','brain','simulation'];
export function loadMain({patches={}}={}){
  const win={};globalThis.window=win;
  for(const n of MODULES){
    let src=readFileSync(ROOT+'/src/'+n+'.js','utf8');
    for(const [from,to] of (patches[n]||[])){if(typeof from!=='string'){if(!from.test(src))throw new Error('patch regex introuvable dans '+n+': '+from);src=src.replace(from,to);continue;}const at=src.indexOf(from);if(at<0)throw new Error('patch introuvable dans '+n+': '+from.slice(0,90));if(src.indexOf(from,at+1)>=0)throw new Error('patch non unique dans '+n+': '+from.slice(0,90));src=src.slice(0,at)+to+src.slice(at+from.length);}
    vm.runInThisContext(src,{filename:n+'.js'});
  }
  delete globalThis.window;return win;
}
export const q=(arr,p)=>{const a=Array.from(arr).sort((x,y)=>x-y);return a.length?a[Math.min(a.length-1,Math.floor(a.length*p))]:0;};
