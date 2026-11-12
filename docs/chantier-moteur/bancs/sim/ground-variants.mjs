// Timing of ground variants (main realm) + fraction of queries resolved by the dominant-flat cell.
import {loadFast} from './fast.mjs';import {SCENARIOS,build,drive,makeInput} from './lib.mjs';import {groundPatch} from './ground-v2.mjs';
const variants=[['original',null],['v2 cs8',groundPatch(8)],['v2 cs4',groundPatch(4)],['v2 cs2',groundPatch(2)],['v2 cs1',groundPatch(1)],['v2 cs2 noTop',groundPatch(2,{topCells:false})]];
const ctxs=variants.map(([n,p])=>[n,p?loadFast({patches:p}):loadFast()]);
let seed=4242;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296;};
for(const [label,idx,opts] of SCENARIOS){
  const sims=ctxs.map(([n,c])=>[n,build(c,idx,opts)]);const w=sims[0][1].world,b=w.bounds;
  // trace: positions from a scripted run (player, enemies, debris footprint corners)
  const tr=[];{const sim=sims[0][1].sim,s=sim.state,input=makeInput();for(let i=0;i<900;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;tr.push(s.player.x,s.player.z);for(const q of s.debris)tr.push(q.x-.2,q.z-.2,q.x+.2,q.z+.2);for(const e of s.enemies)if(e.deployed!==false)tr.push(e.x,e.z);if(s.dead)break;}}
  const T=new Float64Array(tr),N=2e6,U=new Float64Array(2*N);for(let i=0;i<N;i++){U[2*i]=b.minX+rnd()*(b.maxX-b.minX);U[2*i+1]=b.minZ+rnd()*(b.maxZ-b.minZ);}
  const time=(g,P)=>{let acc=0;for(let i=0;i<4e5;i+=2)acc+=g(P[i],P[i+1]);const r=[];for(let k=0;k<5;k++){const t=performance.now();let n=0;while(n<2e6){for(let i=0;i<P.length;i+=2)acc+=g(P[i],P[i+1]);n+=P.length/2;}r.push((performance.now()-t)/n*1e6);}r.sort((p,q)=>p-q);return r[2];};
  console.log(label+' trace points '+T.length/2+': '+sims.map(([n,o])=>n+' '+time(o.sim.ground,U).toFixed(1)+'/'+time(o.sim.ground,T).toFixed(1)).join(' | ')+'  (ns/call uniform/trace)');
}
