// Chargeur domaine principal (pas de vm.createContext) : les modules s'exécutent dans le realm de Node.
import {readFileSync} from 'node:fs';import vm from 'node:vm';
export const ROOT=(process.env.METAL_ROOT||process.cwd());
export function loadFast({patch,modules=['renderer','world','destruction','economy','brain','simulation']}={}){
  const win={};globalThis.window=win;
  for(const n of modules){let src=readFileSync(ROOT+'/src/'+n+'.js','utf8');if(patch)src=patch(n,src);vm.runInThisContext(src,{filename:n+'.js'});}
  delete globalThis.window;return win;
}
export const rep=(src,a,b)=>{const at=src.indexOf(a);if(at<0)throw new Error('motif introuvable: '+a.slice(0,80));if(src.indexOf(a,at+1)>=0)throw new Error('motif non unique: '+a.slice(0,80));return src.slice(0,at)+b+src.slice(at+a.length);};
export const mkWorld=(W,label)=>{const [k,i]=label.split('-');return k==='classic'?W.FWorld.create(96,+i):W.FWorld.create(96,+i,{campaign:true,campaignVersion:2});};
export const INPUTS={
  a:t=>({moveX:Math.sin(t*.667),moveY:1,sprint:true,fire:(t%.333)<.1,dash:false,lookX:.01,lookY:0}),
  b:t=>({moveX:Math.sign(Math.sin(t*.9)),moveY:1,lookX:.012,lookY:Math.sin(t*.5)*.002,fire:true,fireLeft:false,dash:(t%2.5)<1/60,sprint:(t%4)<2,weapon:Math.floor(t/5)%5}),
  c:t=>({moveX:Math.sin(t*1.3)*.6,moveY:Math.cos(t*.21)>-.3?1:-1,lookX:Math.sin(t*.37)*.02,lookY:0,fire:(t%1)<.5,fireLeft:false,dash:false,sprint:false,weapon:Math.floor(t/7)%5})};
export const stat=a=>{const s=[...a].sort((x,y)=>x-y),q=p=>s[Math.min(s.length-1,Math.floor(s.length*p))];return {n:s.length,moy:+(s.reduce((x,y)=>x+y,0)/Math.max(1,s.length)).toFixed(3),p50:+q(.5).toFixed(3),p95:+q(.95).toFixed(3),p99:+q(.99).toFixed(3),max:+(s.at(-1)||0).toFixed(2)};};
