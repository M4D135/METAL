// Micro-costs of the navigation primitives, uninstrumented build.
// usage: node prims.mjs <repo>
import {load} from './load.mjs';import {loadMain} from './loadmain.mjs';
const root=process.argv[2];
const ctx=process.argv[3]==='main'?loadMain(root):load(root);console.log('realm',process.argv[3]==='main'?'main':'vm');const {FWorld,FSimulation}=ctx.window;
const w=FWorld.create(96,9,{campaign:true,campaignVersion:2});const sim=FSimulation.create(w);const N=sim.nav;
const cells=[];for(let i=0;i<N.cells.length;i++)if(N.cells[i])cells.push(i);
let rnd=12345;const R=()=>(rnd=(rnd*1103515245+12345)>>>0)/4294967296;
const pick=()=>cells[Math.floor(R()*cells.length)];
function bench(name,n,f){let sink=0;for(let k=0;k<Math.min(2000,n);k++)sink+=f(k)?1:0;const reps=[];for(let r=0;r<5;r++){const t=performance.now();for(let k=0;k<n;k++)sink+=f(k)?1:0;reps.push((performance.now()-t)*1e6/n);}reps.sort((a,b)=>a-b);console.log(name.padEnd(42),'median',reps[2].toFixed(0),'ns/call  min',reps[0].toFixed(0),'max',reps[4].toFixed(0),sink?'':'');}
const pts=Array.from({length:4096},()=>{const [x,z]=N.coord(pick());return [x+R()*.8-.4,z+R()*.8-.4];});
bench('ground(x,z)',200000,k=>{const q=pts[k&4095];return sim.ground(q[0],q[1])>0;});
bench('blocked(x,z,.4) (computes ground)',200000,k=>{const q=pts[k&4095];return sim.blocked(q[0],q[1],.4);});
const edges=[];for(let k=0;k<4096;k++){const i=pick(),j=R()<.5?i+1:i+N.nx;if(j<N.cells.length&&N.cells[j])edges.push([...N.coord(i),...N.coord(j)]);}
bench('segmentFree grid edge 0.8 m',60000,k=>{const q=edges[k%edges.length];return N.canTraverse(q[0],q[1],q[2],q[3],.4);});
for(const len of [3,8,15,25]){const segs=[];for(let k=0;k<2048;k++){const [x,z]=N.coord(pick()),a=R()*Math.PI*2;segs.push([x,z,x+Math.cos(a)*len,z+Math.sin(a)*len]);}
  bench(`segmentFree random ${len} m`,len>10?4000:12000,k=>{const q=segs[k%segs.length];return N.canTraverse(q[0],q[1],q[2],q[3],.38);});}
for(const len of [3,8,15,25]){const segs=[];for(let k=0;k<2048;k++){const [x,z]=N.coord(pick()),a=R()*Math.PI*2;segs.push([x,z,x+Math.cos(a)*len,z+Math.sin(a)*len]);}
  let free=0;for(const q of segs)if(N.canTraverse(q[0],q[1],q[2],q[3],.38))free++;console.log(`  free fraction ${len} m: ${(free/segs.length*100).toFixed(0)} %`);}
// ray and sight (perception)
const rays=[];for(let k=0;k<2048;k++){const [x,z]=N.coord(pick()),[x2,z2]=N.coord(pick());rays.push([x,z,x2,z2]);}
bench('sight(a,b) random pair (ray over all boxes+floors)',20000,k=>{const q=rays[k%rays.length];return sim.sight(q[0],q[1],q[2],q[3]);});
console.log('colliders',w.colliders.length,'floors',(w.walkable||[]).length,'traps',(w.traps||[]).length,'lifts',(w.lifts||[]).length,'doors',(w.doors||[]).length,'navCells',N.cells.length,'walkable',cells.length);
