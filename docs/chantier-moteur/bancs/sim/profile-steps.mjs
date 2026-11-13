// CPU self-time profile of the 1800-step loop ONLY (world generation and FSimulation.create excluded).
import inspector from 'node:inspector';import {load,SCENARIOS,drive,makeInput,build} from './lib.mjs';
const ctx=load();const session=new inspector.Session();session.connect();
const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:200});
const only=process.argv[2];const total=new Map();let all=0;
for(const [label,idx,opts] of SCENARIOS){
  if(only&&label!==only)continue;
  const {sim}=build(ctx,idx,opts);const s=sim.state,input=makeInput();
  await post('Profiler.start');
  for(let i=0;i<1800;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;if(s.dead)break;}
  const {profile}=await post('Profiler.stop');
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),self=new Map();
  profile.samples.forEach((id,k)=>{const cf=nodes.get(id).callFrame,key=(cf.functionName||'(anon)')+' '+cf.url.split('/').pop()+':'+(cf.lineNumber+1);self.set(key,(self.get(key)||0)+profile.timeDeltas[k]);});
  const tot=[...self.values()].reduce((a,b)=>a+b,0);all+=tot;
  for(const [k,v] of self)total.set(k,(total.get(k)||0)+v);
  console.log('== '+label+' total '+(tot/1000).toFixed(0)+' ms');
  for(const [k,v] of [...self].sort((a,b)=>b[1]-a[1]).slice(0,14))console.log('  '+(100*v/tot).toFixed(1).padStart(5)+'%  '+(v/1000).toFixed(1).padStart(7)+' ms  '+k);
}
console.log('== ALL total '+(all/1000).toFixed(0)+' ms');
for(const [k,v] of [...total].sort((a,b)=>b[1]-a[1]).slice(0,24))console.log('  '+(100*v/all).toFixed(1).padStart(5)+'%  '+(v/1000).toFixed(1).padStart(7)+' ms  '+k);
