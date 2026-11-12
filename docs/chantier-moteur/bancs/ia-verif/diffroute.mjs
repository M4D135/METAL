// Differential test of result-neutral route() changes: base and patched copies in one
// process, same world; (1) identical route()/nearestNode() outputs on random queries,
// (2) identical full snapshot() after N driven steps. Timing per route() call too.
// usage: node diffroute.mjs <repo> <flags> <scenario> [pairs=1500] [steps=1800] [driver=tour]
import {loadSet,rep,pickScen,makeDriver,quant} from './lib.mjs';import {protoPatch} from '../ia/proto.mjs';
const [root,flags='heap,nearest,long',filter='v2-w10',pairsArg='1500',stepsArg='1800',driver='tour']=process.argv.slice(2);
const expose=src=>rep(src,'nav:{cells:nav,','__route:route,__nearest:nearestNode,__setBudget(n){routeBudget=n;},nav:{cells:nav,');
const A=loadSet(root,{patch:expose}),B=loadSet(root,{patch:src=>expose(protoPatch(src,flags))});
const [label,idx,opts]=pickScen(filter)[0];
function mk(Wn){const w=Wn.FWorld.create(96,idx,opts);return {w,sim:Wn.FSimulation.create(w,{brain:Wn.FBrain.create({mode:'cpu'})})};}
const a=mk(A),b=mk(B);const N=a.sim.nav;
let seed=99;const R=()=>(seed=(seed*1103515245+12345)>>>0)/4294967296;
const walk=[];for(let i=0;i<N.cells.length;i++)if(N.cells[i])walk.push(i);
const qs=[];for(let k=0;k<+pairsArg;k++){const c=walk[Math.floor(R()*walk.length)],[x,z]=N.coord(c),ang=R()*Math.PI*2,d=4+R()*30;qs.push([x+R()*.6-.3,z+R()*.6-.3,x+Math.cos(ang)*d,z+Math.sin(ang)*d]);}
let nearDiff=0;for(const [x,z] of qs){if(a.sim.__nearest(x,z,.38)!==b.sim.__nearest(x,z,.38))nearDiff++;}
const actor={x:0,z:0,type:0,bossScale:1};let diff=0,nulls=0;const ta=[],tb=[];
for(let pass=0;pass<2;pass++)for(const [x,z,gx,gz] of qs){actor.x=x;actor.z=z;
  a.sim.__setBudget(1e9);let t=performance.now();const ra=a.sim.__route(actor,gx,gz);const da=performance.now()-t;
  b.sim.__setBudget(1e9);t=performance.now();const rb=b.sim.__route(actor,gx,gz);const db=performance.now()-t;
  if(pass){ta.push(da);tb.push(db);}if(JSON.stringify(ra)!==JSON.stringify(rb))diff++;if(!ra)nulls++;}
const st=t=>({mean:+(t.reduce((x,y)=>x+y,0)/t.length*1000).toFixed(0),p50:+(quant(t,.5)*1000).toFixed(0),p95:+(quant(t,.95)*1000).toFixed(0),max:+(Math.max(...t)*1000).toFixed(0)});
console.log(JSON.stringify({label,flags,queries:qs.length*2,nearestDiffs:nearDiff,routeDiffs:diff,nullRoutes:nulls,warmUsBase:st(ta),warmUsPatched:st(tb)}));
// full-run neutrality
const c=mk(A),d=mk(B);const dc=makeDriver(driver,c.sim,c.w),dd=makeDriver(driver,d.sim,d.w),ic={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0},id={...ic};let first=-1;
for(let i=0;i<+stepsArg;i++){dc(i,ic);dd(i,id);c.sim.step(1/60,ic);d.sim.step(1/60,id);c.sim.state.events.length=0;d.sim.state.events.length=0;
  if(first<0&&i%60===59){const ea=c.sim.state.enemies,eb=d.sim.state.enemies;if(ea.some((e,k)=>e.x!==eb[k].x||e.z!==eb[k].z||e.hp!==eb[k].hp||e.path.length!==eb[k].path.length))first=i;}}
const sa=JSON.stringify(c.sim.snapshot()),sb=JSON.stringify(d.sim.snapshot());
console.log(JSON.stringify({label,driver,steps:+stepsArg,snapshotsIdentical:sa===sb,firstEnemyDivergenceStep:first,snapshotBytes:sa.length}));
