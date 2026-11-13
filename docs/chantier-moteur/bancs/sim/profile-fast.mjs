// CPU self-time profile of the step loop in the MAIN realm (browser-like global access).
// Args: [scenario|all] [steps] [interval_us] [fromStep] [toStep]
import inspector from 'node:inspector';import {loadFast} from './fast.mjs';import {SCENARIOS,drive,makeInput,build} from './lib.mjs';
const only=process.argv[2]||'all',steps=+process.argv[3]||1800,interval=+process.argv[4]||100,from=+process.argv[5]||0,to=+process.argv[6]||steps;
const ctx=loadFast();const session=new inspector.Session();session.connect();
const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval});
const total=new Map(),totalIncl=new Map();let all=0;
for(const [label,idx,opts] of SCENARIOS){
  if(only!=='all'&&label!==only)continue;
  const {sim}=build(ctx,idx,opts);const s=sim.state,input=makeInput();
  for(let i=0;i<steps;i++){drive(i,input,s);if(i===from)await post('Profiler.start');sim.step(1/60,input);s.events.length=0;if(i===to-1||s.dead)break;}
  const {profile}=await post('Profiler.stop');
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map();for(const n of profile.nodes)for(const c of n.children||[])parent.set(c,n.id);
  const key=id=>{const cf=nodes.get(id).callFrame;return (cf.functionName||'(anon)')+' '+cf.url.split('/').pop()+':'+(cf.lineNumber+1);};
  const self=new Map(),incl=new Map();
  profile.samples.forEach((id,k)=>{const dt=profile.timeDeltas[k],kk=key(id);self.set(kk,(self.get(kk)||0)+dt);const seen=new Set();let cur=id;while(cur!==undefined){const c=key(cur);if(!seen.has(c)){seen.add(c);incl.set(c,(incl.get(c)||0)+dt);}cur=parent.get(cur);}});
  const tot=[...self.values()].reduce((a,b)=>a+b,0);all+=tot;
  for(const [k,v] of self)total.set(k,(total.get(k)||0)+v);for(const [k,v] of incl)totalIncl.set(k,(totalIncl.get(k)||0)+v);
  console.log('== '+label+' sampled '+(tot/1000).toFixed(0)+' ms');
  for(const [k,v] of [...self].sort((a,b)=>b[1]-a[1]).slice(0,18))console.log('  self '+(100*v/tot).toFixed(1).padStart(5)+'%  '+(v/1000).toFixed(1).padStart(7)+' ms  '+k);
}
console.log('== ALL sampled '+(all/1000).toFixed(0)+' ms (self)');
for(const [k,v] of [...total].sort((a,b)=>b[1]-a[1]).slice(0,40))console.log('  self '+(100*v/all).toFixed(1).padStart(5)+'%  '+(v/1000).toFixed(1).padStart(7)+' ms  '+k);
console.log('== ALL inclusive');
for(const [k,v] of [...totalIncl].sort((a,b)=>b[1]-a[1]).slice(0,45))console.log('  incl '+(100*v/all).toFixed(1).padStart(5)+'%  '+(v/1000).toFixed(1).padStart(7)+' ms  '+k);
