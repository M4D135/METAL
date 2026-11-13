// Self-time distribution of samples whose stack contains a given function (main realm, whole 1800-step runs).
// usage: node subtree.mjs <fnName> [patchModule exportName]
import inspector from 'node:inspector';import {loadFast} from './fast.mjs';import {SCENARIOS,drive,makeInput,build} from './lib.mjs';
const target=process.argv[2]||'route',mod=process.argv[3],exp=process.argv[4];
const patches=mod?(await import('./'+mod))[exp]:undefined;const ctx=loadFast(patches?{patches:typeof patches==='function'?patches():patches}:{});
const session=new inspector.Session();session.connect();const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});
const agg=new Map();let all=0,inside=0;
for(const [label,idx,opts] of SCENARIOS){
  const {sim}=build(ctx,idx,opts),s=sim.state,input=makeInput();await post('Profiler.start');
  for(let i=0;i<1800;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;if(s.dead)break;}
  const {profile}=await post('Profiler.stop');const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map();for(const n of profile.nodes)for(const c of n.children||[])parent.set(c,n.id);
  const has=new Map();const under=id=>{if(has.has(id))return has.get(id);const n=nodes.get(id);const r=n.callFrame.functionName===target||(parent.has(id)&&under(parent.get(id)));has.set(id,r);return r;};
  profile.samples.forEach((id,k)=>{const n=nodes.get(id),cf=n.callFrame,dt=profile.timeDeltas[k];if(cf.url.includes('simulation')||cf.url.includes('destruction')||cf.functionName==='(garbage collector)')all+=dt;if(!under(id))return;inside+=dt;const key=(cf.functionName||'(anon)')+' '+cf.url.split('/').pop()+':'+(cf.lineNumber+1);agg.set(key,(agg.get(key)||0)+dt);});
}
console.log('samples under '+target+': '+(inside/1000).toFixed(0)+' ms = '+(100*inside/all).toFixed(1)+'% of simulation time; self distribution:');
for(const [k,v] of [...agg].sort((a,b)=>b[1]-a[1]).slice(0,14))console.log('  '+(100*v/inside).toFixed(1).padStart(5)+'%  '+k);
