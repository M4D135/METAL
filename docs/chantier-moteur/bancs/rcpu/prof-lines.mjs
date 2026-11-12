// RCPU: line-level CPU profile (positionTicks) for selected files during the tour (no heap sampling).
// usage: node prof-lines.mjs <ferroRoot> [frames=3000] [world=camp:17] [files=effects.js,actors.js,game-models.js,renderer.js,motion.js]
import inspector from 'node:inspector';
import {scene} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||3000),[kind,idx]=(process.argv[4]||'camp:17').split(':'),files=(process.argv[5]||'effects.js,actors.js,game-models.js,renderer.js,motion.js').split(',');
const S=scene(root,{world:[kind,+idx],wrap:false});
const session=new inspector.Session();session.connect();
const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
for(let i=0;i<120;i++)S.frame(1/60,{tour:true});
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:40});await post('Profiler.start');
let drawMs=0,modelsMs=0;for(let i=0;i<frames;i++){const r=S.frame(1/60,{tour:true});drawMs+=r.drawMs;modelsMs+=r.modelsMs;}
const {profile}=await post('Profiler.stop');
const interval=(profile.endTime-profile.startTime)/profile.samples.length; // us per sample
const lines=new Map(),fns=new Map();
for(const n of profile.nodes){const f=n.callFrame.url.split('/').pop();if(!files.includes(f))continue;
  const fk=f+' '+(n.callFrame.functionName||'(anon)')+':'+(n.callFrame.lineNumber+1);fns.set(fk,(fns.get(fk)||0)+(n.hitCount||0));
  for(const pt of n.positionTicks||[]){const k=f+':'+pt.line;lines.set(k,(lines.get(k)||0)+pt.ticks);}}
console.log('frames',frames,'draw ms/frame',(drawMs/frames).toFixed(3),'models ms/frame',(modelsMs/frames).toFixed(3),'sample us',interval.toFixed(1));
console.log('--- self time by function');for(const [k,t] of [...fns].sort((a,b)=>b[1]-a[1]).slice(0,25))console.log((t*interval/frames).toFixed(1).padStart(7),'us/frame',k);
console.log('--- self time by line');for(const [k,t] of [...lines].sort((a,b)=>b[1]-a[1]).slice(0,40))console.log((t*interval/frames).toFixed(1).padStart(7),'us/frame',k);
