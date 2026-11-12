// RCPU: in-process CPU profile (node:inspector Session, no port) of the Canvas2D fallback during the tour.
// usage: node prof-canvas.mjs <ferroRoot> [frames=600] [world=camp:6]
import inspector from 'node:inspector';
import {scene} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||600),[kind,idx]=(process.argv[4]||'camp:6').split(':');
const S=scene(root,{world:[kind,+idx],quality:'auto',canvas2d:true,wrap:false});
const session=new inspector.Session();session.connect();
const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
for(let i=0;i<90;i++)S.frame(1/60,{tour:true});
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:50});await post('Profiler.start');
let drawMs=0;for(let i=0;i<frames;i++)drawMs+=S.frame(1/60,{tour:true}).drawMs;
const {profile}=await post('Profiler.stop');
const interval=(profile.endTime-profile.startTime)/profile.samples.length;
const byId=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map();
for(const n of profile.nodes)for(const c of n.children||[])parent.set(c,n.id);
const fns=new Map(),lines=new Map(),incl=new Map();
for(const n of profile.nodes){
  const f=n.callFrame.url.split('/').pop()||'(native)',k=f+' '+(n.callFrame.functionName||'(anon)')+':'+(n.callFrame.lineNumber+1);
  fns.set(k,(fns.get(k)||0)+(n.hitCount||0));
  if(f==='renderer.js')for(const pt of n.positionTicks||[]){const key='renderer.js:'+pt.line;lines.set(key,(lines.get(key)||0)+pt.ticks);}
  // inclusive: charge hits to every distinct ancestor function once
  const seen=new Set();let id=n.id;while(id!==undefined){const m=byId.get(id),mk=(m.callFrame.url.split('/').pop()||'(native)')+' '+(m.callFrame.functionName||'(anon)')+':'+(m.callFrame.lineNumber+1);if(!seen.has(mk)){seen.add(mk);incl.set(mk,(incl.get(mk)||0)+(n.hitCount||0));}id=parent.get(id);}
}
const us=t=>(t*interval/frames).toFixed(1).padStart(8)+' us/frame';
console.log('world',kind+':'+idx,'frames',frames,'draw ms/frame',(drawMs/frames).toFixed(2),'sample us',interval.toFixed(1));
console.log('--- self by function');for(const [k,t] of [...fns].sort((a,b)=>b[1]-a[1]).slice(0,22))console.log(us(t),k);
console.log('--- inclusive (renderer.js)');for(const [k,t] of [...incl].filter(([k])=>k.startsWith('renderer.js')).sort((a,b)=>b[1]-a[1]).slice(0,16))console.log(us(t),k);
console.log('--- self by line (renderer.js)');for(const [k,t] of [...lines].sort((a,b)=>b[1]-a[1]).slice(0,22))console.log(us(t),k);
