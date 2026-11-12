import {loadFast} from './fast.mjs';import {load,SCENARIOS,build} from './lib.mjs';
const mode=process.argv[2]||'fast';const ctx=mode==='fast'?loadFast():load();
for(const [label,idx,opts] of SCENARIOS){
  const {world,sim}=build(ctx,idx,opts);const b=world.bounds,N=2e6,xs=new Float64Array(N),zs=new Float64Array(N);
  let seed=12345;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296;};
  for(let i=0;i<N;i++){xs[i]=b.minX+rnd()*(b.maxX-b.minX);zs[i]=b.minZ+rnd()*(b.maxZ-b.minZ);}
  let acc=0;for(let i=0;i<2e5;i++)acc+=sim.ground(xs[i],zs[i]);
  const res=[];for(let rep=0;rep<5;rep++){const t=performance.now();for(let i=0;i<N;i++)acc+=sim.ground(xs[i],zs[i]);res.push((performance.now()-t)/N*1e6);}
  res.sort((a,c)=>a-c);console.log(mode,label,'ground ns/call median',res[2].toFixed(1),'checksum',acc.toFixed(1));
}
