// Self-time profile (main realm) restricted to the spike steps of each scenario (> THRESH ms in a dry run).
import inspector from 'node:inspector';import {loadFast} from './fast.mjs';import {SCENARIOS,drive,makeInput,build} from './lib.mjs';
const THRESH=+process.env.THRESH||5,mod=process.argv[2],exp=process.argv[3];
const patches=mod?(await import('./'+mod))[exp]:undefined;const ctx=loadFast(patches?{patches:typeof patches==='function'?patches():patches}:{});
const session=new inspector.Session();session.connect();const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:50});
const agg=new Map();let all=0,spikeMs=0,nSpikes=0;
for(const [label,idx,opts] of SCENARIOS){
  // dry run to find spike steps
  let {sim}=build(ctx,idx,opts);let s=sim.state,input=makeInput();const spikes=new Set();
  for(let i=0;i<1800;i++){drive(i,input,s);const t=performance.now();sim.step(1/60,input);if(performance.now()-t>THRESH)spikes.add(i);s.events.length=0;if(s.dead)break;}
  ({sim}=build(ctx,idx,opts));s=sim.state;input=makeInput();
  for(let i=0;i<1800;i++){drive(i,input,s);const sp=spikes.has(i);if(sp)await post('Profiler.start');const t=performance.now();sim.step(1/60,input);const d=performance.now()-t;
    if(sp){const {profile}=await post('Profiler.stop');spikeMs+=d;nSpikes++;const nodes=new Map(profile.nodes.map(n=>[n.id,n]));profile.samples.forEach((id,k)=>{const cf=nodes.get(id).callFrame,key=(cf.functionName||'(anon)')+' '+cf.url.split('/').pop()+':'+(cf.lineNumber+1);agg.set(key,(agg.get(key)||0)+profile.timeDeltas[k]);all+=profile.timeDeltas[k];});}
    s.events.length=0;if(s.dead)break;}
}
console.log('spike steps',nSpikes,'total',spikeMs.toFixed(1),'ms; self time share:');
for(const [k,v] of [...agg].sort((a,b)=>b[1]-a[1]).slice(0,16))console.log('  '+(100*v/all).toFixed(1).padStart(5)+'%  '+k);
