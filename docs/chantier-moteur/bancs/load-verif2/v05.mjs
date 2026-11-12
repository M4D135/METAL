// LOAD-05 in the main realm: cost of rubble at rest / never-resting pieces. Block minima (machine is loaded).
import {loadFast,BL} from './lib.mjs';
const {PATCHES}=await import(BL+'/patches.mjs');
const toMap=list=>{const m={};for(const [f,a,b] of list)(m[f]=m[f]||[]).push([a,b]);return m;};
const [spec='l:0',wallsArg='8',skip='0']=process.argv.slice(2);
const W=loadFast({patches:toMap(PATCHES.instr2)});const now=()=>performance.now();
const world=W.FWorld.create(96,+spec.split(':')[1]);
const sim=W.FSimulation.create(world,{brain:W.FBrain.create({mode:'cpu'}),armorSystem:true,inventory:{weapons:[true,true,true,true],ammo:[180,36,12,16],shield:false}});
const s=sim.state,p=s.player,walls=[];
for(const g of world.destructibles.filter(g=>g.kind==='wall'&&g.colliders.length)){const b=g.bounds,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2,thinX=b.maxX-b.minX<b.maxZ-b.minZ;
  for(const sign of [-1,1]){const nx=thinX?sign:0,nz=thinX?0:sign,x=cx+nx*7,z=cz+nz*7,y=sim.ground(x,z);if(!Number.isFinite(y)||Math.abs(y-b.minY)>.1||sim.blocked(x,z,.28))continue;const hit=sim.ray([x,y+1.62,z],[-nx,0,-nz],9);if(hit<6||hit>7.4)continue;walls.push({x,y,z,yaw:Math.atan2(-nx,nz),cx,cz});break;}}
const far=walls.filter((w,i)=>walls.findIndex(q=>Math.hypot(q.cx-w.cx,q.cz-w.cz)<12)===i).slice(+skip);
for(const wall of far.slice(0,+wallsArg))for(let k=0;k<2;k++){Object.assign(p,{x:wall.x,z:wall.z,y:wall.y,yaw:wall.yaw,pitch:k?.08:0,hp:100});s.inventory.ammo[2]=12;for(let i=0;i<180;i++){sim.step(1/60,i===0?{weapon:2,fire:true}:{});s.events.length=0;s.dead=false;}}
Object.assign(p,{x:far[0].x,z:far[0].z,y:far[0].y});
const idle=n=>{W.__s.debris=0;let t=0;for(let i=0;i<n;i++){const a=now();sim.step(1/60,{});t+=now()-a;s.events.length=0;s.dead=false;p.hp=100;}return {step:t/n,debris:W.__s.debris/n};};
idle(600);const awake0=s.debris.filter(q=>q.structural&&!q.resting).map(q=>q.id);idle(3600);
const all=s.debris.slice(),awake=all.filter(q=>q.structural&&!q.resting),resting=all.filter(q=>!awake.includes(q)),persistent=awake.filter(q=>awake0.includes(q.id));
const runs={all:[],noAwake:[],onlyAwake:[],none:[]};
for(let rep=0;rep<6;rep++)for(const [k,list] of [['all',all],['noAwake',resting],['onlyAwake',awake],['none',[]]]){s.debris=list.slice();runs[k].push(idle(200));}
const mn=(a,f)=>+Math.min(...a.map(x=>x[f])).toFixed(3);
console.log(JSON.stringify({spec,walls:far.length,rubble:all.filter(q=>q.structural).length,awakeAfter10s:awake0.length,stillAwakeAfter70s:persistent.length,debrisMsMin:{all:mn(runs.all,'debris'),restingOnly:mn(runs.noAwake,'debris'),neverRestingOnly:mn(runs.onlyAwake,'debris'),empty:mn(runs.none,'debris')},stepMsMin:{all:mn(runs.all,'step'),restingOnly:mn(runs.noAwake,'step'),empty:mn(runs.none,'step')},awakeDetail:persistent.slice(0,5).map(q=>({shape:q.shape,speed:+Math.hypot(q.vx,q.vy,q.vz).toFixed(2),size:q.size.map(v=>+v.toFixed(2))}))}));
