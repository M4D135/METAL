// Allocation attribution with the V8 sampling heap profiler (includes objects already collected).
import inspector from 'node:inspector';import {PerformanceObserver} from 'node:perf_hooks';import {SCENES} from '../phys/scenes.v1.mjs';
const session=new inspector.Session();session.connect();const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
let gcs=0;new PerformanceObserver(l=>{gcs+=l.getEntries().length;}).observe({entryTypes:['gc']});
for(const name of ['rubble300','blast200']){
  const {w}=SCENES[name]({});for(let i=0;i<300;i++){if(name==='blast200'&&i===240)w.explode(0,.5,0,14,900);w.step(1/120,1);}
  globalThis.gc?.();await new Promise(r=>setTimeout(r,30));const g0=gcs;
  await post('HeapProfiler.enable');await post('HeapProfiler.startSampling',{samplingInterval:64,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
  const STEPS=600;for(let i=0;i<STEPS;i++)w.step(1/120,1);
  const {profile}=await post('HeapProfiler.stopSampling');await new Promise(r=>setTimeout(r,30));
  const agg=new Map();let total=0;const walk=n=>{const cf=n.callFrame,key=(cf.functionName||'(anon)')+':'+(cf.lineNumber+1);if(n.selfSize){agg.set(key,(agg.get(key)||0)+n.selfSize);total+=n.selfSize;}for(const c of n.children)walk(c);};walk(profile.head);
  console.log(`${name}: sampled allocation ${(total/STEPS).toFixed(0)} B/step over ${STEPS} steps, GC events ${gcs-g0}`);
  for(const [k,v] of [...agg].sort((a,b)=>b[1]-a[1]).slice(0,8))console.log('    '+(v/STEPS).toFixed(0).padStart(7)+' B/step  '+k);
}
