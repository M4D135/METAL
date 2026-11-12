// Paired A/B (main realm): sims A (original) and B (patched) advance in LOCKSTEP, alternating which one
// steps first, so both see the same machine load. Reports bit-exactness (per-step digest + final snapshot)
// and the paired ratio of step times (robust to other processes on the machine).
// usage: node ab2.mjs <patchModule> <exportName> [args...]   env: REPS STEPS WEAPON SCEN
import {loadFast} from './fast.mjs';import {SCENARIOS,build,drive,makeInput,q,mean} from './lib.mjs';
const [mod,exp,...args]=process.argv.slice(2);const fn=(await import('./'+mod))[exp];const patches=typeof fn==="function"?fn(...args.map(a=>isNaN(+a)?a:+a)):fn;
const REPS=+process.env.REPS||2,STEPS=+process.env.STEPS||1800,WEAPON=process.env.WEAPON!==undefined?+process.env.WEAPON:undefined,SCEN=process.env.SCEN;
let basePatches;if(process.env.BASE){const [bm,be,...ba]=process.env.BASE.split(':');const bf=(await import('./'+bm))[be];basePatches=typeof bf==='function'?bf(...ba):bf;}
const A=basePatches?loadFast({patches:basePatches}):loadFast(),B=loadFast({patches:basePatches?{simulation:[...basePatches.simulation,...patches.simulation]}:patches});
const f64=new Float64Array(1),u32=new Uint32Array(f64.buffer);
const mix=(h,v)=>{f64[0]=v;h=Math.imul(h^u32[0],16777619);return Math.imul(h^u32[1],16777619);};
function digest(s,h){h=mix(h,s.player.x);h=mix(h,s.player.y);h=mix(h,s.player.z);h=mix(h,s.player.hp);h=mix(h,s.kills);for(const e of s.enemies){h=mix(h,e.x);h=mix(h,e.z);h=mix(h,e.hp);h=mix(h,e.baseY);}for(const d of s.debris){h=mix(h,d.x);h=mix(h,d.y);h=mix(h,d.z);h=mix(h,d.rotation[0]);}h=mix(h,s.events.length);for(const e of s.events)for(const c of e.name)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
const snapHash=sim=>{const t=JSON.stringify(sim.snapshot());let h=2166136261;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);return (h>>>0).toString(16);};
for(const [label,idx,opts] of SCENARIOS){
  if(SCEN&&label!==SCEN)continue;
  let identical=true,divAt=-1;const ta=[],tb=[];
  for(let r=0;r<REPS;r++){
    const a=build(A,idx,opts),b=build(B,idx,opts),sa=a.sim.state,sb=b.sim.state,ia=makeInput(),ib=makeInput();if(WEAPON!==undefined)ia.weapon=ib.weapon=WEAPON;let ha=2166136261,hb=2166136261;
    for(let i=0;i<STEPS;i++){
      drive(i,ia,sa);drive(i,ib,sb);let x,y;
      if(i&1){let t=performance.now();b.sim.step(1/60,ib);y=performance.now()-t;t=performance.now();a.sim.step(1/60,ia);x=performance.now()-t;}
      else{let t=performance.now();a.sim.step(1/60,ia);x=performance.now()-t;t=performance.now();b.sim.step(1/60,ib);y=performance.now()-t;}
      if(r>0||REPS===1){ta.push(x);tb.push(y);}
      ha=digest(sa,ha);hb=digest(sb,hb);if(ha!==hb&&divAt<0){identical=false;divAt=i;}sa.events.length=0;sb.events.length=0;if(sa.dead||sb.dead){if(sa.dead!==sb.dead)identical=false;break;}
    }
    if(snapHash(a.sim)!==snapHash(b.sim))identical=false;
  }
  const sum=v=>v.reduce((x,y)=>x+y,0),SA=sum(ta),SB=sum(tb);
  // robust paired estimate: median of per-step ratios over steps > 0.05 ms, and ratio of totals
  const ratios=ta.map((x,i)=>tb[i]/x).filter((v,i)=>ta[i]>.05);
  const spikesA=ta.filter(v=>v>4).length,spikesB=tb.filter(v=>v>4).length;
  if(process.env.DEBUG)console.log('  B-only spikes: '+tb.map((v,i)=>[i,v,ta[i]]).filter(([i,v,w])=>v>4&&w<2).map(([i,v,w])=>i+':'+v.toFixed(1)+'/'+w.toFixed(1)).join(' ')+' | A-only: '+ta.map((v,i)=>[i,v,tb[i]]).filter(([i,v,w])=>v>4&&w<2).map(([i,v,w])=>i+':'+v.toFixed(1)+'/'+w.toFixed(1)).join(' '));
  if(process.env.DEBUG)console.log('  all B>4: '+tb.map((v,i)=>[i%STEPS,v,ta[i]]).filter(([i,v,w])=>v>4).map(([i,v,w])=>i+':'+v.toFixed(1)+'/'+w.toFixed(1)).join(' '));
  console.log(label.padEnd(13)+' identical='+identical+(divAt>=0?' (diverges at step '+divAt+')':'')+' | total '+SA.toFixed(0)+' -> '+SB.toFixed(0)+' ms ('+(100*(SB/SA-1)).toFixed(0)+'%) | median step ratio '+q(ratios,.5).toFixed(2)+' | mean '+mean(ta).toFixed(3)+' -> '+mean(tb).toFixed(3)+' | p99 '+q(ta,.99).toFixed(2)+' -> '+q(tb,.99).toFixed(2)+' | max '+Math.max(...ta).toFixed(1)+' -> '+Math.max(...tb).toFixed(1)+' | steps>4ms '+spikesA+' -> '+spikesB);
}
