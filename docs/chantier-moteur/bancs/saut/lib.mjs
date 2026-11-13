// SAUT bench loader: METAL sources evaluated in the MAIN realm (vm.runInThisContext, wrapped), patched IN MEMORY only.
import {readFileSync} from 'node:fs';import vm from 'node:vm';
export const ROOT=(process.env.METAL_ROOT||process.cwd());
export const MODULES=['renderer','world','destruction','economy','brain','simulation'];
export function source(name){return readFileSync(ROOT+'/src/'+name+'.js','utf8');}
export function applyPatches(name,src,list){
  for(const [from,to,opt] of list||[]){
    if(typeof from==='string'){const at=src.indexOf(from);if(at<0)throw new Error('patch not found in '+name+': '+from.slice(0,110));if(!(opt&&opt.all)&&src.indexOf(from,at+1)>=0)throw new Error('patch not unique in '+name+': '+from.slice(0,110));src=opt&&opt.all?src.split(from).join(to):src.slice(0,at)+to+src.slice(at+from.length);}
    else{if(!from.test(src))throw new Error('regex patch not found in '+name+': '+from);src=src.replace(from,to);}
  }
  return src;
}
export function loadFast({patches={},modules=MODULES}={}){
  const win={};
  for(const n of modules){
    const src=applyPatches(n,source(n),patches[n]);
    const fn=vm.runInThisContext('(function(window){'+src+'\n})',{filename:n+'.js'});fn(win);
  }
  return win;
}
export const WORLDS=[...Array.from({length:18},(_,i)=>['v2-'+String(i).padStart(2,'0'),i,{campaign:true,campaignVersion:2}]),['legacy-0',0,undefined],['legacy-1',1,undefined],['legacy-2',2,undefined]];
export const q=(arr,p)=>{const a=arr.slice().sort((x,y)=>x-y);return a.length?a[Math.min(a.length-1,Math.floor(a.length*p))]:NaN;};
export const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
export const fnv=(text)=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16);};
