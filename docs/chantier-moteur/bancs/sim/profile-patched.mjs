// Same as profile-fast.mjs but with a patch set applied (to see the next hotspots).
import inspector from 'node:inspector';import {loadFast} from './fast.mjs';import {SCENARIOS,drive,makeInput,build} from './lib.mjs';
const [mod,exp,...args]=process.argv.slice(2);const fn=(await import('./'+mod))[exp];const ctx=loadFast({patches:typeof fn==='function'?fn(...args):fn});
const session=new inspector.Session();session.connect();const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});
const self=new Map(),incl=new Map();let all=0;
for(const [label,idx,opts] of SCENARIOS){
  const {sim}=build(ctx,idx,opts),s=sim.state,input=makeInput();await post('Profiler.start');
  for(let i=0;i<1800;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;if(s.dead)break;}
  const {profile}=await post('Profiler.stop');const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map();for(const n of profile.nodes)for(const c of n.children||[])parent.set(c,n.id);
  const key=id=>{const cf=nodes.get(id).callFrame;return (cf.functionName||'(anon)')+' '+cf.url.split('/').pop()+':'+(cf.lineNumber+1);};
  profile.samples.forEach((id,k)=>{const dt=profile.timeDeltas[k],kk=key(id);if(kk.includes('inspector')||kk.includes('profile-patched'))return;all+=dt;self.set(kk,(self.get(kk)||0)+dt);const seen=new Set();let cur=id;while(cur!==undefined){const c=key(cur);if(!seen.has(c)){seen.add(c);incl.set(c,(incl.get(c)||0)+dt);}cur=parent.get(cur);}});
}
console.log('sim-only sampled '+(all/1000).toFixed(0)+' ms');
for(const [k,v] of [...self].sort((a,b)=>b[1]-a[1]).slice(0,30))console.log('  self '+(100*v/all).toFixed(1).padStart(5)+'%  '+k);
for(const [k,v] of [...incl].sort((a,b)=>b[1]-a[1]).filter(([k])=>!k.startsWith('(root)')).slice(0,30))console.log('  incl '+(100*v/all).toFixed(1).padStart(5)+'%  '+k);
