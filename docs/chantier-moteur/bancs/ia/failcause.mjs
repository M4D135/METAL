// Why do the 2400-node A* searches fail? For each failed search, run an uncapped
// BFS over the same edge predicate (nav cell + segmentFree(.4)) from start and from
// end, and report component sizes. usage: node failcause.mjs <repo> [scenario]
import {load,drive,rep} from './load.mjs';
const root=process.argv[2],filter=process.argv[3]||'';
const LOG=[];globalThis.__LOG=LOG;
const patch=src=>{
  // expose start/end/explored of every failed search, and the internals needed for BFS
  src=rep(src,'if(!found)return null;','if(!found){__LOG.push({id:e.id,type:e.type,r,start,end,explored,ex:e.x,ez:e.z,ey:e.baseY,gx:x,gz:z,t:s.time});return null;}');
  src=rep(src,'nav:{cells:nav,','__internals:{segmentFree,coord,edgeKnown,edgeOpen,ground},nav:{cells:nav,');
  return src;
};
const ctx=load(root,{patch,extra:{__LOG:LOG}});
const {FWorld,FSimulation,FBrain}=ctx.window;
const SC=[['legacy-s0',0,undefined],['legacy-s2',2,undefined],['v2-w01',0,{campaign:true,campaignVersion:2}],['v2-w10',9,{campaign:true,campaignVersion:2}],['v2-w16',15,{campaign:true,campaignVersion:2}]].filter(s=>s[0].includes(filter));
for(const [label,idx,opts] of SC){
  LOG.length=0;
  const w=FWorld.create(96,idx,opts);const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});const s=sim.state,I=sim.__internals,N=sim.nav;
  const input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
  for(let i=0;i<1800;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;if(s.dead)break;}
  // full component labelling with the exact A* edge predicate (radius .4)
  const t0=performance.now();const comp=new Int32Array(N.cells.length).fill(-1);const sizes=[];let edges=0;
  const q=new Int32Array(N.cells.length);
  for(let c=0;c<N.cells.length;c++){if(!N.cells[c]||comp[c]>=0)continue;const id=sizes.length;let h=0,t=0;q[t++]=c;comp[c]=id;
    while(h<t){const i=q[h++],ix=i%N.nx;for(const j of [ix?i-1:-1,ix<N.nx-1?i+1:-1,i-N.nx,i+N.nx]){if(j<0||j>=N.cells.length||!N.cells[j]||comp[j]>=0)continue;edges++;const [ax,az]=I.coord(i),[bx,bz]=I.coord(j);if(I.segmentFree(ax,az,bx,bz,.4)){comp[j]=id;q[t++]=j;}}}
    sizes.push(t);}
  const ms=performance.now()-t0;
  const order=sizes.map((n,i)=>[i,n]).sort((a,b)=>b[1]-a[1]);
  console.log(`=== ${label} cells=${N.cells.length} walkable=${N.cells.reduce((a,b)=>a+b,0)} components=${sizes.length} largest=${order.slice(0,6).map(x=>x[1]).join(',')} singletons=${sizes.filter(n=>n===1).length} labelMs=${ms.toFixed(0)} edgeTests=${edges} (${(ms*1000/edges).toFixed(2)} us/test)`);
  const seen=new Map();
  for(const f of LOG){const key=f.id+':'+f.start+':'+f.end;seen.set(key,(seen.get(key)||0)+1);}
  const uniq=[...new Map(LOG.map(f=>[f.id+':'+f.start+':'+f.end,f])).values()];
  let diff=0,same=0;
  for(const f of uniq){const a=comp[f.start],b=comp[f.end];if(a!==b)diff++;else same++;}
  console.log(`failed searches=${LOG.length} unique(start,end)=${uniq.length} differentComponent=${diff} sameComponent(cap hit)=${same}`);
  for(const f of uniq.slice(0,8)){const a=comp[f.start],b=comp[f.end];console.log(`  enemy ${f.id} type ${f.type} r=${f.r} at(${f.ex.toFixed(1)},${f.ey.toFixed(2)},${f.ez.toFixed(1)}) goal(${f.gx.toFixed(1)},${f.gz.toFixed(1)}) startComp=${a} size=${sizes[a]} endComp=${b} size=${sizes[b]} repeats=${seen.get(f.id+':'+f.start+':'+f.end)} t=${f.t.toFixed(1)}`);}
}
