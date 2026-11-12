// Shared loader: runs the game modules in a node:vm context, optionally patching
// simulation.js source text in memory (instrumentation / prototypes). Never writes
// into the repository.
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
export function load(root,{patch=null,extra={}}={}){
  const ctx={window:{},performance,console,Math,Date,...extra}; vm.createContext(ctx);
  for(const n of ['renderer','world','destruction','economy','brain','simulation']){
    let src=readFileSync(root+'/src/'+n+'.js','utf8');
    if(n==='simulation'&&patch)src=patch(src);
    vm.runInContext(src,ctx,{filename:n+'.js'});
  }
  return ctx;
}
// Replace an exact substring once; throws when it is missing or ambiguous so a
// silently failed patch can never produce a misleading measurement.
export function rep(src,from,to){
  const i=src.indexOf(from); if(i<0)throw new Error('patch anchor missing: '+from.slice(0,80));
  if(src.indexOf(from,i+1)>=0)throw new Error('patch anchor ambiguous: '+from.slice(0,80));
  return src.slice(0,i)+to+src.slice(i+from.length);
}
export const scenarios=[['legacy-s0',0,undefined],['legacy-s1',1,undefined],['legacy-s2',2,undefined],['campaign-w4',3,{campaign:true}],['campaign-w10',9,{campaign:true}],['campaign-w16',15,{campaign:true}]];
// Same scripted player as bench.mjs: forward + sprint, sinus strafe, fire bursts, dash every 4 s.
export function drive(i,input,s){input.moveX=Math.sin(i/90);input.fire=(i%20)<6;input.dash=(i%240)===0;s.player.yaw+=0.01;}
