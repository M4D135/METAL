// Shared loader for SIM benches. Patches are applied IN MEMORY only (the repo is read-only).
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
export const ROOT=(process.env.METAL_ROOT||process.cwd());
export const MODULES=['renderer','world','destruction','economy','brain','simulation'];
export function source(name){return readFileSync(ROOT+'/src/'+name+'.js','utf8');}
export function load({patches={},globals={}}={}){
  const ctx={window:{},performance,console,Math,Date,...globals};vm.createContext(ctx);
  for(const n of MODULES){
    let src=source(n);
    for(const [from,to] of (patches[n]||[])){
      if(typeof from==='string'){const at=src.indexOf(from);if(at<0)throw new Error('patch not found in '+n+': '+from.slice(0,90));if(src.indexOf(from,at+1)>=0)throw new Error('patch not unique in '+n+': '+from.slice(0,90));src=src.slice(0,at)+to+src.slice(at+from.length);}
      else{if(!from.test(src))throw new Error('regex patch not found in '+n+': '+from);src=src.replace(from,to);}
    }
    vm.runInContext(src,ctx,{filename:n+'.js'});
  }
  return ctx;
}
export const SCENARIOS=[['legacy-s0',0,undefined],['legacy-s2',2,undefined],['campaign-w10',9,{campaign:true}],['campaign-w16',15,{campaign:true}]];
// Same scripted player as bench.mjs / bench2.mjs / spike.mjs.
export function drive(i,input,s){input.moveX=Math.sin(i/90);input.fire=(i%20)<6;input.dash=(i%240)===0;s.player.yaw+=0.01;}
export function makeInput(){return {moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};}
export function build(ctx,idx,opts,simOptions={}){
  const {FWorld,FSimulation,FBrain}=ctx.window;const world=FWorld.create(96,idx,opts);
  let brain=null;try{brain=FBrain.create({mode:'cpu'});}catch(e){}
  const sim=FSimulation.create(world,{brain,...simOptions});return {world,sim};
}
export const q=(arr,p)=>{const a=arr.slice().sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(a.length*p))];};
export const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
