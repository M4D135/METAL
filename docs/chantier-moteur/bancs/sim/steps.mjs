// Per-step timing (avg/p95/p99/max/spikes>8ms) for the scripted 30 s run, in main realm (fast) or vm sandbox.
import {loadFast} from './fast.mjs';import {load,SCENARIOS,drive,makeInput,build,q,mean} from './lib.mjs';
const mode=process.argv[2]||'fast',reps=+process.argv[3]||1,only=process.argv[4];const ctx=mode==='fast'?loadFast():load();
const out={};
for(let r=0;r<reps;r++)for(const [label,idx,opts] of SCENARIOS){
  if(only&&label!==only)continue;
  let t=performance.now();const {world,sim}=build(ctx,idx,opts);const createMs=performance.now()-t;
  const s=sim.state,input=makeInput(),times=[];const spikes=[];
  for(let i=0;i<1800;i++){drive(i,input,s);const t0=performance.now();sim.step(1/60,input);const d=performance.now()-t0;times.push(d);if(d>8)spikes.push(i+':'+d.toFixed(1));s.events.length=0;if(s.dead)break;}
  const o=out[label]||(out[label]=[]);o.push({create:+createMs.toFixed(0),avg:+mean(times).toFixed(3),p95:+q(times,.95).toFixed(2),p99:+q(times,.99).toFixed(2),max:+Math.max(...times).toFixed(1),n8:spikes.length,spikes:spikes.slice(0,8).join(' ')});
}
for(const [k,v] of Object.entries(out))for(const o of v)console.log(mode,k.padEnd(13),JSON.stringify(o));
