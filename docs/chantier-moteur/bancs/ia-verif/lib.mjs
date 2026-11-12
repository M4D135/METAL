// Independent verification helpers (IA axis). Loads the game modules in the MAIN
// realm (indirect eval, like a browser page) or in node:vm, with optional in-memory
// patches of simulation.js. Never writes into the repository.
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
export const ORDER=['renderer','world','destruction','economy','brain','simulation'];
export function rep(src,from,to){
  const i=src.indexOf(from);if(i<0)throw new Error('anchor missing: '+from.slice(0,90));
  if(src.indexOf(from,i+1)>=0)throw new Error('anchor ambiguous: '+from.slice(0,90));
  return src.slice(0,i)+to+src.slice(i+from.length);
}
// Load one copy of the modules. In the main realm each call gets a fresh window
// object, so two copies (base and patched) can coexist in one process.
export function loadSet(root,{patch=null,realm='main'}={}){
  const srcs=ORDER.map(n=>{let s=readFileSync(root+'/src/'+n+'.js','utf8');if(n==='simulation'&&patch)s=patch(s);return [n,s];});
  if(realm==='vm'){
    const ctx={window:{},performance,console,Math,Date,__V:globalThis.__V};vm.createContext(ctx);
    for(const [n,s] of srcs)vm.runInContext(s,ctx,{filename:n+'.js'});return ctx.window;
  }
  const w={};globalThis.window=w;
  for(const [n,s] of srcs)(0,eval)(s+'\n//# sourceURL='+n+'.js');
  return w;
}
export const SCEN=[['legacy-s0',0,undefined],['legacy-s1',1,undefined],['legacy-s2',2,undefined],
  ['v2-w01',0,{campaign:true,campaignVersion:2}],['v2-w04',3,{campaign:true,campaignVersion:2}],['v2-w06',5,{campaign:true,campaignVersion:2}],
  ['v2-w10',9,{campaign:true,campaignVersion:2}],['v2-w13',12,{campaign:true,campaignVersion:2}],['v2-w16',15,{campaign:true,campaignVersion:2}],['v2-w18',17,{campaign:true,campaignVersion:2}]];
export function pickScen(filter){return SCEN.filter(s=>!filter||filter.split(',').some(f=>s[0]===f||s[0].includes(f)));}
// Deterministic drivers. circle = same scripted player as the other benches.
// tour = same, plus a teleport onto the next (non boss) encounter trigger every 420 steps, hp floor 60.
export function makeDriver(kind,sim,world){
  const s=sim.state,enc=(s.encounters||[]).filter(q=>!world.rooms?.[q.zoneId]?.bossArena);let at=0;
  return (i,input)=>{
    input.moveX=Math.sin(i/90);input.fire=(i%20)<6;input.dash=(i%240)===0;s.player.yaw+=0.01;
    if(kind==='tour'){s.player.hp=Math.max(s.player.hp,60);if(enc.length&&i%420===0){const q=enc[at++%enc.length];s.player.x=q.trigger.x;s.player.z=q.trigger.z;s.player.y=sim.ground(q.trigger.x,q.trigger.z);}}
  };
}
export const quant=(arr,p)=>{const s=arr.slice().sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(s.length*p))];};
export const median=a=>quant(a,.5);
