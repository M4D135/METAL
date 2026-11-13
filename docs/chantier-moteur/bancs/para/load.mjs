// Chargement des modules METAL dans le domaine principal du fil courant (page ou worker), comme bench/sim/fast.mjs.
import vm from 'node:vm';import {readFileSync} from 'node:fs';
export const ROOT=process.env.METAL_ROOT||(process.env.METAL_ROOT||process.cwd());
export const SIM_MODULES=['renderer','world','destruction','economy','brain','simulation'];
export function loadMain(mods=SIM_MODULES,extraGlobals={}){
  const win={...extraGlobals};globalThis.window=win;
  for(const n of mods)vm.runInThisContext(readFileSync(ROOT+'/src/'+n+'.js','utf8'),{filename:n+'.js'});
  delete globalThis.window;return win;
}
export const SCENARIOS={'legacy-s0':[0,undefined],'legacy-s2':[2,undefined],'campaign-w10':[9,{campaign:true}],'campaign-w16':[15,{campaign:true}],'campaign2-w10':[9,{campaign:true,campaignVersion:2}],'campaign2-w6':[5,{campaign:true,campaignVersion:2}]};
export function build(win,name,simOptions={}){
  const [idx,opts]=SCENARIOS[name];const {FWorld,FSimulation,FBrain}=win;const world=FWorld.create(96,idx,opts);
  let brain=null;try{brain=FBrain.create({mode:'cpu'});}catch(e){}
  const sim=FSimulation.create(world,{brain,...simOptions});return {world,sim};
}
// Pilote scripte (meme mouvement que bench/sim/lib.mjs, mais le lacet passe par input.lookX : aucune ecriture directe dans l'etat).
export function drive(i,input){input.moveX=Math.sin(i/90);input.moveY=1;input.sprint=true;input.fire=(i%20)<6;input.dash=(i%240)===0;input.lookX=0.01;input.lookY=0;return input;}
export const q=(arr,p)=>{if(!arr.length)return NaN;const a=Float64Array.from(arr).sort();return a[Math.min(a.length-1,Math.floor(a.length*p))];};
export const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
export const summ=a=>({n:a.length,moy:+mean(a).toFixed(4),p50:+q(a,.5).toFixed(4),p95:+q(a,.95).toFixed(4),p99:+q(a,.99).toFixed(4),max:+Math.max(...a).toFixed(3)});
const f64=new Float64Array(1),u32=new Uint32Array(f64.buffer);
const mix=(h,v)=>{f64[0]=v;h=Math.imul(h^u32[0],16777619);return Math.imul(h^u32[1],16777619);};
export function digest(s,h){h=mix(h,s.player.x);h=mix(h,s.player.y);h=mix(h,s.player.z);h=mix(h,s.player.yaw);h=mix(h,s.player.hp);h=mix(h,s.kills);for(const e of s.enemies){h=mix(h,e.x);h=mix(h,e.z);h=mix(h,e.hp);h=mix(h,e.baseY);}for(const d of s.debris){h=mix(h,d.x);h=mix(h,d.y);h=mix(h,d.z);h=mix(h,d.rotation[0]);}h=mix(h,s.events.length);for(const e of s.events)for(const c of e.name)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
