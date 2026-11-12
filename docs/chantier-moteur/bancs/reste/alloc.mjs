// Residual allocation rate per frame (main realm): V8 sampling heap profiler (includes objects already collected)
// + GC events. usage: node --expose-gc alloc.mjs <orig|r1> [frames] [world kind:idx]  env: EXTRA=module:export (patch set)
import inspector from 'node:inspector';import {PerformanceObserver,constants} from 'node:perf_hooks';import {scene} from './scene.mjs';
const [variant='r1',N='2400',w='camp:6']=process.argv.slice(2);const [kind,idx]=w.split(':');
let patches={},simSpec;if(process.env.EXTRA){const [file,exp]=process.env.EXTRA.split(':');const v=(await import('./'+file+'.mjs'))[exp];const p=typeof v==='function'?v():v;for(const k in p)if(k!=='simulation')patches[k]=p[k];if(p.simulation)simSpec={extra:p.simulation};}
const S=scene({variant,world:[kind,+idx],patches,...(simSpec?{simSpec}:{})});for(let i=0;i<240;i++)S.frame();
const session=new inspector.Session();session.connect();const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
const gcs=[];const obs=new PerformanceObserver(list=>{for(const e of list.getEntries())gcs.push([e.detail?.kind??e.kind,e.duration]);});obs.observe({entryTypes:['gc']});
globalThis.gc?.();await post('HeapProfiler.enable');await post('HeapProfiler.startSampling',{samplingInterval:512,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
const t0=performance.now();for(let i=0;i<+N;i++)S.frame();const ms=performance.now()-t0;
const {profile}=await post('HeapProfiler.stopSampling');await new Promise(r=>setTimeout(r,150));
const agg=new Map(),cat=new Map();let total=0;
const CAT=[['out.simPhase','sim.step'],['draw','renderer.draw'],['updateWorld','renderer.updateWorld'],['models','game.models'],['out.viewPhase','view.other']];
const walk=(n,c,pk='')=>{const cf=n.callFrame,name=cf.functionName||'(anon)';const selfKey=cf.url===''?pk+' > '+name:name+' '+cf.url.split('/').pop()+':'+(cf.lineNumber+1);if(!c||c==='view.other')for(const [fn,label] of CAT)if(name===fn&&!(c==='view.other'&&label==='view.other')){c=label;break;}
  let c2=c;if(c==='game.models'){if(name==='build'&&cf.url.includes('actors'))c2='models>FActors.build';else if(name==='build'&&cf.url.includes('effects'))c2='models>FEffects.build';else if(name==='supplyModel')c2='models>supplyModel';else if(name==='machinery'||name==='systems'||name==='ambience')c2='models>machinery/systems';}
  if(n.selfSize){const key=selfKey;agg.set(key,(agg.get(key)||0)+n.selfSize);cat.set(c2||'(other)',(cat.get(c2||'(other)')||0)+n.selfSize);total+=n.selfSize;}
  for(const ch of n.children)walk(ch,c2&&c2.startsWith('models>')?c2:c,cf.url===''?pk:selfKey);};walk(profile.head,null);
const minor=gcs.filter(g=>g[0]===constants.NODE_PERFORMANCE_GC_MINOR),major=gcs.filter(g=>g[0]!==constants.NODE_PERFORMANCE_GC_MINOR);
console.log(variant,w,'frames',N,'| allocated '+(total/1048576).toFixed(1)+' MB = '+(total/+N/1024).toFixed(1)+' KB/frame | scavenges '+minor.length+' ('+(minor.length/(+N/60)).toFixed(2)+'/s at 60 fps, total '+minor.reduce((a,g)=>a+g[1],0).toFixed(1)+' ms, max '+Math.max(0,...minor.map(g=>g[1])).toFixed(2)+' ms) | major '+major.length+' ('+major.reduce((a,g)=>a+g[1],0).toFixed(1)+' ms) | wall '+ms.toFixed(0)+' ms');
for(const [k,v] of [...cat].sort((a,b)=>b[1]-a[1]))console.log('  CAT '+(100*v/total).toFixed(1).padStart(5)+'%  '+(v/+N/1024).toFixed(1).padStart(7)+' KB/frame  '+k);
for(const [k,v] of [...agg].sort((a,b)=>b[1]-a[1]).slice(0,+(process.env.TOP||28)))console.log('  '+(100*v/total).toFixed(1).padStart(5)+'%  '+(v/+N).toFixed(0).padStart(7)+' B/frame  '+k);
