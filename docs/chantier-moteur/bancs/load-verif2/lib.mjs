// Main-realm loader (no vm sandbox). Read-only on sources. srcDir overrides per-module dir.
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
export const ROOT=(process.env.METAL_ROOT||process.cwd());
export const BL=(process.env.METAL_BANCS||process.cwd()+'/docs/chantier-moteur/bancs')+'/load';
export const MODULES=['renderer','world','destruction','economy','brain','simulation'];
export function loadFast({srcDir=ROOT+'/src',patches={},mods=MODULES}={}){
  const win={};win.__s={sf:0,routes:[],t:0,pump:0,debris:0};
  const prev=globalThis.window;globalThis.window=win;
  for(const n of mods){
    let src=readFileSync(srcDir+'/'+n+'.js','utf8');
    for(const [from,to] of (patches[n]||[])){const at=src.indexOf(from);if(at<0)throw new Error('patch not found in '+n+': '+from.slice(0,90));if(src.indexOf(from,at+1)>=0)throw new Error('patch not unique '+from.slice(0,90));src=src.slice(0,at)+to+src.slice(at+from.length);}
    vm.runInThisContext(src,{filename:n+'.js'});
  }
  if(prev===undefined)delete globalThis.window;else globalThis.window=prev;
  return win;
}
export function makeWorld(W,spec){const [k,i]=spec.split(':');return k==='c'?W.FWorld.create(96,+i,{campaign:true,campaignVersion:2}):W.FWorld.create(96,+i);}
export const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1];};
export const q=(a,p)=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(s.length*p))];};
export function fnv(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
export function drive(i,input,s){input.moveX=Math.sin(i/90);input.fire=(i%20)<6;input.dash=(i%240)===0;s.player.yaw+=0.01;}
export const mkInput=()=>({moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0});
