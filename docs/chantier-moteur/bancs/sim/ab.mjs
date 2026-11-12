// A/B harness (main realm): bit-exact state digest every step + final snapshot hash, and interleaved timing.
// usage: node ab.mjs <patchModule> <exportName> [args...]  (env REPS, STEPS, WEAPON, SCEN)
import {loadFast} from './fast.mjs';import {SCENARIOS,build,drive,makeInput,q,mean} from './lib.mjs';
const [mod,exp,...args]=process.argv.slice(2);const patchFn=(await import('./'+mod))[exp];const patches=typeof patchFn==='function'?patchFn(...args.map(a=>isNaN(+a)?a:+a)):patchFn;
const REPS=+process.env.REPS||3,STEPS=+process.env.STEPS||1800,WEAPON=process.env.WEAPON!==undefined?+process.env.WEAPON:undefined,SCEN=process.env.SCEN;
const A=loadFast(),B=loadFast({patches});
const f64=new Float64Array(1),u32=new Uint32Array(f64.buffer);
function mix(h,v){f64[0]=v;h=Math.imul(h^u32[0],16777619);return Math.imul(h^u32[1],16777619);}
function digest(s,h){h=mix(h,s.player.x);h=mix(h,s.player.y);h=mix(h,s.player.z);h=mix(h,s.player.hp);h=mix(h,s.kills);for(const e of s.enemies){h=mix(h,e.x);h=mix(h,e.z);h=mix(h,e.hp);h=mix(h,e.baseY);}for(const d of s.debris){h=mix(h,d.x);h=mix(h,d.y);h=mix(h,d.z);h=mix(h,d.rotation[0]);}h=mix(h,s.events.length);for(const e of s.events)for(const c of e.name)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function run(ctx,idx,opts){
  const {sim}=build(ctx,idx,opts),s=sim.state,input=makeInput();if(WEAPON!==undefined)input.weapon=WEAPON;const times=[];let h=2166136261,firstDiv=-1;const trace=[];
  for(let i=0;i<STEPS;i++){drive(i,input,s);const t=performance.now();sim.step(1/60,input);times.push(performance.now()-t);h=digest(s,h);trace.push(h);s.events.length=0;if(s.dead)break;}
  const snap=JSON.stringify(sim.snapshot());let sh=2166136261;for(let i=0;i<snap.length;i++)sh=Math.imul(sh^snap.charCodeAt(i),16777619);
  return {times,trace,snap:(sh>>>0).toString(16),len:snap.length};
}
for(const [label,idx,opts] of SCENARIOS){
  if(SCEN&&label!==SCEN)continue;
  const ra=[],rb=[];for(let r=0;r<REPS;r++){ra.push(run(A,idx,opts));rb.push(run(B,idx,opts));}
  const a=ra[0],b=rb[0];let div=-1;for(let i=0;i<Math.max(a.trace.length,b.trace.length);i++)if(a.trace[i]!==b.trace[i]){div=i;break;}
  const stat=rs=>{const avg=q(rs.map(r=>mean(r.times)),.5),p99=q(rs.map(r=>q(r.times,.99)),.5),mx=q(rs.map(r=>Math.max(...r.times)),.5),tot=q(rs.map(r=>r.times.reduce((x,y)=>x+y,0)),.5);return {avg,p99,mx,tot};};
  const sa=stat(ra),sb=stat(rb);
  console.log(label.padEnd(13)+' identical='+(div<0&&a.snap===b.snap)+(div>=0?' DIVERGES@'+div:'')+' snap '+a.snap+'/'+b.snap+' | mean '+sa.avg.toFixed(3)+' -> '+sb.avg.toFixed(3)+' ms ('+(100*(sb.avg/sa.avg-1)).toFixed(0)+'%) | p99 '+sa.p99.toFixed(2)+' -> '+sb.p99.toFixed(2)+' | max '+sa.mx.toFixed(1)+' -> '+sb.mx.toFixed(1)+' | total '+sa.tot.toFixed(0)+' -> '+sb.tot.toFixed(0)+' ms');
}
