// Proves ground v2 == original on a massive sample (Object.is, so -0/NaN count), then times both.
import {loadFast} from './fast.mjs';import {SCENARIOS,build,drive,makeInput} from './lib.mjs';import {groundPatch} from './ground-v2.mjs';
const GCS=+process.argv[2]||2,NR=+process.argv[3]||4e6;
const A=loadFast(),B=loadFast({patches:groundPatch(GCS)});
let seed=987654321;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296;};
for(const [label,idx,opts] of SCENARIOS){
  const a=build(A,idx,opts),bb=build(B,idx,opts),w=a.world,b=w.bounds,floors=w.walkable;
  const pts=[];
  // 1) uniform random points, including 6 m outside the bounds (off-grid fallback path)
  for(let i=0;i<NR;i++)pts.push([b.minX-6+rnd()*(b.maxX-b.minX+12),b.minZ-6+rnd()*(b.maxZ-b.minZ+12)]);
  // 2) floor edges: exact edge, +-1e-7 tolerance, +-1..4 ulp, +-1e-9, along each edge
  const ulp=v=>{const buf=new Float64Array([v]),u=new BigInt64Array(buf.buffer);u[0]+=1n;return buf[0]-v;};
  for(const f of floors)for(const [ex,ez] of [[1,0],[-1,0],[0,1],[0,-1]])for(let k=0;k<400;k++){
    const along=rnd()-.5,bx=f.x+ex*f.w/2+(ez?along*f.w:0),bz=f.z+ez*f.d/2+(ex?along*f.d:0);
    for(const d of [0,1e-7,-1e-7,1e-7+ulp(f.x+f.w/2),1e-7-ulp(f.x+f.w/2),2e-7,-2e-7,1e-9,-1e-9,1e-12,-1e-12,ulp(bx),-ulp(bx),3*ulp(bx),-3*ulp(bx),1e-6,-1e-6])pts.push([bx+ex*d,bz+ez*d]);
  }
  // 3) sub-grid and 8 m bucket boundaries
  for(let k=0;k<200000;k++){const cs=[1,2,4,8][k%4],x=Math.round((b.minX+rnd()*(b.maxX-b.minX))/cs)*cs,z=Math.round((b.minZ+rnd()*(b.maxZ-b.minZ))/cs)*cs;for(const [dx,dz] of [[0,0],[ulp(x)||1e-15,0],[-(ulp(x)||1e-15),0],[0,ulp(z)||1e-15],[0,-(ulp(z)||1e-15)],[1e-9,1e-9],[-1e-9,-1e-9]])pts.push([x+dx,z+dz]);}
  // 4) positions actually queried during a scripted run (player, enemies, debris corners)
  {const s=a.sim.state,input=makeInput();for(let i=0;i<900;i++){drive(i,input,s);a.sim.step(1/60,input);s.events.length=0;pts.push([s.player.x,s.player.z]);for(const e of s.enemies)pts.push([e.x,e.z]);for(const q of s.debris)pts.push([q.x,q.z],[q.x-.3,q.z+.3]);if(s.dead)break;}}
  // 5) special values
  pts.push([0,0],[-0,-0],[NaN,0],[0,NaN],[Infinity,0],[-Infinity,0],[1e300,1e300]);
  let diff=0,first=null;for(const [x,z] of pts){const r1=a.sim.ground(x,z),r2=bb.sim.ground(x,z);if(!Object.is(r1,r2)){diff++;if(!first)first=[x,z,r1,r2];}}
  // 6) explicit floor-trap lists (the restore path passes saved trap states)
  let tdiff=0;const traps=floors.filter(f=>!f.substrate).slice(0,6).map((f,i)=>({kind:i%3===2?'blade':'floor',x:f.x,z:f.z,w:Math.min(3,f.w),d:Math.min(3,f.d),y:f.y||0,travel:i%2?undefined:1.2,progress:(i+1)/7}));
  for(let i=0;i<300000;i++){const f=floors[i%floors.length],x=f.x+(rnd()-.5)*4,z=f.z+(rnd()-.5)*4,list=i%5?traps:traps.slice(1);if(!Object.is(a.sim.ground(x,z,list),bb.sim.ground(x,z,list)))tdiff++;}
  console.log(label,'GCS',GCS,'points',pts.length,'mismatches',diff,first?JSON.stringify(first):'','| trap-list samples 300000 mismatches',tdiff);
  // timing on uniform in-bounds points
  const N=2e6,xs=new Float64Array(N),zs=new Float64Array(N);for(let i=0;i<N;i++){xs[i]=b.minX+rnd()*(b.maxX-b.minX);zs[i]=b.minZ+rnd()*(b.maxZ-b.minZ);}
  const time=g=>{let acc=0;for(let i=0;i<2e5;i++)acc+=g(xs[i],zs[i]);const r=[];for(let k=0;k<5;k++){const t=performance.now();for(let i=0;i<N;i++)acc+=g(xs[i],zs[i]);r.push((performance.now()-t)/N*1e6);}r.sort((p,q)=>p-q);return r[2];};
  const t1=time(a.sim.ground),t2=time(bb.sim.ground);
  // trace-weighted timing (points from the run, repeated)
  const tr=pts.slice(pts.length-200000);const time2=g=>{let acc=0;const r=[];for(let k=0;k<5;k++){const t=performance.now();for(let j=0;j<10;j++)for(const [x,z] of tr)acc+=g(x,z);r.push((performance.now()-t)/(tr.length*10)*1e6);}r.sort((p,q)=>p-q);return r[2];};
  console.log('   ns/call uniform: original',t1.toFixed(1),'v2',t2.toFixed(1),'speedup x'+(t1/t2).toFixed(2),'| trace points: original',time2(a.sim.ground).toFixed(1),'v2',time2(bb.sim.ground).toFixed(1));
}
