// Octets alloués par image et par fonction (delta used_heap_size, deltas négatifs = GC écartés).
// node --max-semi-space-size=128 alloc.mjs <ferro> [monde] [secondes]
import v8 from 'node:v8';import {createHarness} from './harness.mjs';
const root=process.argv[2],worldIndex=process.argv[3]===undefined?9:+process.argv[3],seconds=+(process.argv[4]||10);
const H=await createHarness(root);await H.startGame();
if(worldIndex>=0){H.G.load(worldIndex,96,undefined,true,2);H.G.saveCheckpoint();H.G.start('bench');}
const heap=()=>v8.getHeapStatistics().used_heap_size;
const A={};const add=(k,d)=>{if(d<0)return;const q=A[k]??={bytes:0,n:0};q.bytes+=d;q.n++;};
// Remplace la sonde de temps par une sonde mémoire (inclusive).
H.ctx.__probe=(name,fn)=>{const h=heap();try{return fn();}finally{add(name,heap()-h);}};
const step=H.G.sim.step;H.G.sim.step=(dt,i)=>{const h=heap();const r=step(dt,i);add('sim.step',heap()-h);return r;};
let t=H.now,frames=0,elapsed=0;H.key('keydown','KeyW');H.key('keydown','ShiftLeft');
// échauffement JIT
for(let i=0;i<120;i++){t+=1000/60;H.frame(t);}
for(const k in A)delete A[k];
while(elapsed<seconds*1000){const dt=1000/60;t+=dt;elapsed+=dt;frames++;
  if(Math.floor(elapsed/333)!==Math.floor((elapsed-dt)/333))H.mouse.down(0);if(Math.floor((elapsed-100)/333)!==Math.floor((elapsed-100-dt)/333))H.mouse.up(0);
  H.mouse.move(6,0);const h=heap();H.frame(t);add('frame',heap()-h);}
const rows=Object.entries(A).map(([k,v])=>({fonction:k,'Ko par image':+(v.bytes/frames/1024).toFixed(1),'Ko par appel':+(v.bytes/v.n/1024).toFixed(2),appels:v.n})).sort((a,b)=>b['Ko par image']-a['Ko par image']);
console.log('monde',worldIndex,'images',frames,'maillages dernière image',H.C.meshes);console.table(rows);
process.exit(0);
