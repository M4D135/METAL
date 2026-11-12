// Allocation profile of the step loop (main realm): V8 sampling heap profiler (bytes allocated by function,
// including objects already collected) + GC counts/pauses (PerformanceObserver 'gc').
// usage: node --expose-gc alloc.mjs [patchModule exportName]
import inspector from 'node:inspector';import {PerformanceObserver,constants} from 'node:perf_hooks';import {loadFast} from './fast.mjs';import {SCENARIOS,drive,makeInput,build} from './lib.mjs';
const mod=process.argv[2],exp=process.argv[3];const fn=mod?(await import('./'+mod))[exp]:null;const ctx=loadFast(fn?{patches:typeof fn==='function'?fn():fn}:{});
const session=new inspector.Session();session.connect();const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
const gcs=[];const obs=new PerformanceObserver(list=>{for(const e of list.getEntries())gcs.push([e.detail?.kind??e.kind,e.duration]);});obs.observe({entryTypes:['gc']});
const agg=new Map();let total=0,steps=0;
for(const [label,idx,opts] of SCENARIOS){
  const {sim}=build(ctx,idx,opts),s=sim.state,input=makeInput();globalThis.gc?.();
  await post('HeapProfiler.enable');await post('HeapProfiler.startSampling',{samplingInterval:256,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
  for(let i=0;i<1800;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;steps++;if(s.dead)break;}
  const {profile}=await post('HeapProfiler.stopSampling');
  const walk=(n)=>{const cf=n.callFrame,key=(cf.functionName||'(anon)')+' '+cf.url.split('/').pop()+':'+(cf.lineNumber+1);if(n.selfSize&&!cf.url.includes('alloc.mjs')&&cf.url!==''){agg.set(key,(agg.get(key)||0)+n.selfSize);total+=n.selfSize;}for(const c of n.children)walk(c);};walk(profile.head);
}
await new Promise(r=>setTimeout(r,200));
const minor=gcs.filter(g=>g[0]===constants.NODE_PERFORMANCE_GC_MINOR),major=gcs.filter(g=>g[0]!==constants.NODE_PERFORMANCE_GC_MINOR);
console.log('allocated (sampled estimate) '+(total/1048576).toFixed(1)+' MB over '+steps+' steps = '+(total/steps/1024).toFixed(1)+' KB/step | GC minor '+minor.length+' ('+minor.reduce((a,g)=>a+g[1],0).toFixed(1)+' ms, max '+Math.max(0,...minor.map(g=>g[1])).toFixed(2)+') major/other '+major.length+' ('+major.reduce((a,g)=>a+g[1],0).toFixed(1)+' ms)');
for(const [k,v] of [...agg].sort((a,b)=>b[1]-a[1]).slice(0,22))console.log('  '+(100*v/total).toFixed(1).padStart(5)+'%  '+(v/steps).toFixed(0).padStart(6)+' B/step  '+k);
