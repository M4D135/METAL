// RCPU: CPU profile (node:inspector) + sampled allocations of the render path (models + draw) over a tour.
// usage: node prof-draw.mjs <ferroRoot> [frames=2400] [world=camp:6] [quality=auto]
import inspector from 'node:inspector';
import {scene} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||2400),[kind,idx]=(process.argv[4]||'camp:6').split(':'),quality=process.argv[5]||'auto';
const S=scene(root,{world:[kind,+idx],quality,wrap:false});
const session=new inspector.Session();session.connect();
const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
for(let i=0;i<120;i++)S.frame(1/60,{tour:true});
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:50});
await post('HeapProfiler.enable');
await post('HeapProfiler.startSampling',{samplingInterval:1024,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
await post('Profiler.start');
let drawMs=0,modelsMs=0;
for(let i=0;i<frames;i++){const r=S.frame(1/60,{tour:true});drawMs+=r.drawMs;modelsMs+=r.modelsMs;}
const {profile}=await post('Profiler.stop');
const heap=(await post('HeapProfiler.stopSampling')).profile;
// ---- CPU: restrict to samples whose stack contains the render path roots.
const nodes=new Map(profile.nodes.map(n=>[n.id,n]));const parent=new Map();for(const n of profile.nodes)for(const c of n.children||[])parent.set(c,n.id);
const key=n=>{const cf=n.callFrame;return (cf.functionName||'(anon)')+' '+cf.url.split('/').pop()+':'+(cf.lineNumber+1);};
const isRoot=k=>/^draw renderer\.js:1533|^models game-models\.js|^lights effects\.js/.test(k);
const selfT=new Map(),inclT=new Map();let total=0,renderTotal=0;
const dts=profile.timeDeltas;
for(let k=0;k<profile.samples.length;k++){
  const id=profile.samples[k],dt=dts[k]||0;total+=dt;
  const chain=[];let cur=id;while(cur!==undefined){chain.push(key(nodes.get(cur)));cur=parent.get(cur);}
  if(!chain.some(isRoot))continue;renderTotal+=dt;
  selfT.set(chain[0],(selfT.get(chain[0])||0)+dt);
  for(const c of new Set(chain))inclT.set(c,(inclT.get(c)||0)+dt);
}
const fmt=us=>(us/frames).toFixed(1)+' us/frame';
console.log('frames',frames,'measured drawMs/frame',(drawMs/frames).toFixed(3),'modelsMs/frame',(modelsMs/frames).toFixed(3));
console.log('profile total ms',(total/1000).toFixed(0),'render-path ms',(renderTotal/1000).toFixed(0));
console.log('--- SELF (render path)');for(const [k,t] of [...selfT].sort((a,b)=>b[1]-a[1]).slice(0,30))console.log(fmt(t).padStart(18),(100*t/renderTotal).toFixed(1).padStart(5)+'%',k);
console.log('--- INCLUSIVE (render path)');for(const [k,t] of [...inclT].sort((a,b)=>b[1]-a[1]).slice(0,30))console.log(fmt(t).padStart(18),k);
// ---- Allocations: sampled bytes by allocating function, render path vs other.
const hp=new Map();let allocRender=0,allocAll=0;
function walk(n,chain){const k=(n.callFrame.functionName||'(anon)')+' '+n.callFrame.url.split('/').pop()+':'+(n.callFrame.lineNumber+1);const c=chain.concat(k);
  const size=n.selfSize||0;allocAll+=size;if(c.some(isRoot)){allocRender+=size;hp.set(k,(hp.get(k)||0)+size);}
  for(const ch of n.children||[])walk(ch,c);}
walk(heap.head,[]);
console.log('--- ALLOC sampled bytes/frame: render path',(allocRender/frames/1024).toFixed(1),'KB, everything',(allocAll/frames/1024).toFixed(1),'KB');
for(const [k,b] of [...hp].sort((a,b)=>b[1]-a[1]).slice(0,25))console.log(((b/frames/1024).toFixed(2)+' KB/frame').padStart(18),k);
