// LOAD-02: (A) correctness of local invalidation, (B) paired perf (per-step MIN over reps: sim is deterministic), main realm.
// usage: node v02.mjs spec steps reps mode(walk|rocket)
import {loadFast,makeWorld,drive,mkInput,med,q,BL} from './lib.mjs';
const {PATCHES}=await import(BL+'/patches.mjs');
const [spec='c:9',stepsArg='1800',repsArg='3',mode='walk']=process.argv.slice(2);const STEPS=+stepsArg,REPS=+repsArg;
const toMap=list=>{const m={};for(const [f,a,b] of list)(m[f]=m[f]||[]).push([a,b]);return m;};
const DBG=[["nav:{cells:nav,","nav:{edgeKnown,edgeOpen,get pending(){return navPending;},cells:nav,"]];
const add=(m,extra)=>({...m,simulation:[...(m.simulation||[]),...extra]});
const W0=loadFast({patches:add(toMap([...PATCHES.instr,...PATCHES.rubblefix]),DBG)});
const W1=loadFast({patches:add(toMap([...PATCHES.localnav,...PATCHES.instr,...PATCHES.rubblefix]),DBG)});
const campaign=spec.startsWith('c:');
const opts=(W)=>{const o={brain:W.FBrain.create({mode:'cpu'}),armorSystem:true};if(mode==='rocket'){o.inventory=campaign?{weapons:[true,true,true,true,true],ammo:[180,36,12,16,1],shield:false}:{weapons:[true,true,true,true],ammo:[180,36,12,16],shield:false};if(campaign){o.campaign={version:2,discovered:['pistol','smg','shotgun','grenade','rocket'],claimedBossRewards:[]};o.equipment={right:2,left:null,shieldEnergy:100};}}return o;};
const w0=makeWorld(W0,spec),w1=makeWorld(W1,spec);
function findWalls(W,world){const probe=W.FSimulation.create(world,opts(W)),walls=[];
  for(const g of world.destructibles.filter(g=>g.kind==='wall'&&g.colliders.length)){const b=g.bounds,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2,thinX=b.maxX-b.minX<b.maxZ-b.minZ;
    for(const sign of [-1,1]){const nx=thinX?sign:0,nz=thinX?0:sign,x=cx+nx*7,z=cz+nz*7,y=probe.ground(x,z);if(!Number.isFinite(y)||Math.abs(y-b.minY)>.1||probe.blocked(x,z,.28))continue;const hit=probe.ray([x,y+1.62,z],[-nx,0,-nz],9);if(hit<6||hit>7.4)continue;walls.push({x,y,z,yaw:Math.atan2(-nx,nz)});break;}}
  return walls;}
const walls=mode==='rocket'?findWalls(W0,w0):[];
function run(W,world,prof){
  W.__s.sf=0;W.__s.routes=[];
  const sim=W.FSimulation.create(world,opts(W)),s=sim.state,input=mkInput();let revs=0,last=s.destructionRevision||0,pendSteps=0,n=0;const c0=process.cpuUsage();
  for(let i=0;i<STEPS;i++){
    let inp=input;
    if(mode==='rocket'){const wi=Math.floor(i/150);if(i%150===0&&wi<Math.min(10,walls.length)){const wall=walls[wi];Object.assign(s.player,{x:wall.x,z:wall.z,y:wall.y,yaw:wall.yaw,pitch:0});inp={weapon:2,fire:true};}else inp={};}
    else drive(i,input,s);
    const t=performance.now();sim.step(1/60,inp);const d=performance.now()-t;prof[i]=Math.min(prof[i]??Infinity,d);n++;s.events.length=0;if(s.destructionRevision!==last){revs++;last=s.destructionRevision;}if(sim.nav.pending>0)pendSteps++;if(s.dead)break;}
  const cpu=process.cpuUsage(c0).user/1000;const r=W.__s.routes,astar=r.filter(x=>x.astar);
  return {sim,cpu,sf:W.__s.sf,routes:r.length,astar:astar.length,astarFail:astar.filter(x=>!x.found).length,astarMsMin:astar.map(x=>x.ms),revs,pendSteps,steps:n,dead:s.dead};
}
const prof={orig:[],local:[]},res={orig:[],local:[]},sims={};
for(let k=0;k<REPS;k++){for(const [name,W,world] of (k%2?[['local',W1,w1],['orig',W0,w0]]:[['orig',W0,w0],['local',W1,w1]])){const r=run(W,world,prof[name]);sims[name]=r.sim;res[name].push(r);}}
const sum=(a,p)=>{const am=a[0].astarMsMin.map((_,i)=>Math.min(...a.map(x=>x.astarMsMin[i])));return {cpuMsMed:+med(a.map(x=>x.cpu)).toFixed(0),minProfTotalMs:+p.reduce((x,y)=>x+y,0).toFixed(1),meanMs:+(p.reduce((x,y)=>x+y,0)/p.length).toFixed(3),p99:+q(p,.99).toFixed(2),max:+Math.max(...p).toFixed(2),over2:p.filter(x=>x>2).length,over4:p.filter(x=>x>4).length,over8:p.filter(x=>x>8).length,sf:a[0].sf,routes:a[0].routes,astar:a[0].astar,astarFail:a[0].astarFail,astarMsSum:+am.reduce((x,y)=>x+y,0).toFixed(1),astarMsMax:+Math.max(0,...am).toFixed(1),revs:a[0].revs,pendSteps:a[0].pendSteps,steps:a[0].steps,dead:a[0].dead};};
console.log(JSON.stringify({spec,mode,STEPS,REPS,walls:walls.length,orig:sum(res.orig,prof.orig),local:sum(res.local,prof.local)}));
function check(W,world,sim,label){
  const snap=sim.snapshot();const fresh=W.FSimulation.create(world,opts(W));const ok=fresh.restore(JSON.parse(JSON.stringify(snap)),{recover:false});
  const a=sim.nav.cells,bb=fresh.nav.cells;let diff=0;for(let i=0;i<a.length;i++)if(a[i]!==bb[i])diff++;
  const pristine=W.FSimulation.create(world,opts(W)).nav.cells;let changed=0;for(let i=0;i<a.length;i++)if(bb[i]!==pristine[i])changed++;
  const nx=sim.nav.nx,ek=sim.nav.edgeKnown,eo=sim.nav.edgeOpen;let known=0,stale=0;
  for(let i=0;i<a.length;i++){if(!ek[i])continue;const ix=i%nx,nb=[ix?i-1:-1,ix<nx-1?i+1:-1,i-nx,i+nx];for(let k=0;k<4;k++){if(!(ek[i]&(1<<k)))continue;known++;const j=nb[k];const free=sim.nav.canTraverse(...sim.nav.coord(i),...sim.nav.coord(j),.4);if(free!==!!(eo[i]&(1<<k)))stale++;}}
  console.log(JSON.stringify({label,restoreOk:ok,cells:a.length,cellsChangedVsPristine:changed,cellDiffVsFullRebuild:diff,edgeBitsKnown:known,edgeBitsStale:stale,destructionRevision:sim.state.destructionRevision}));
}
check(W0,w0,sims.orig,'orig');check(W1,w1,sims.local,'localnav');
