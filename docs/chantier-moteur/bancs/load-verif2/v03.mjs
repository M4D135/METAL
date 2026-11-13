// LOAD-03: snapshot() cost right after a breach (drains nav queue), orig vs localnav; main realm; min/median over reps.
import {loadFast,makeWorld,med,BL} from './lib.mjs';
const {PATCHES}=await import(BL+'/patches.mjs');
const [spec='l:0',repsArg='7']=process.argv.slice(2);
const toMap=list=>{const m={};for(const [f,a,b] of list)(m[f]=m[f]||[]).push([a,b]);return m;};
const DBG=[["nav:{cells:nav,","nav:{get pending(){return navPending;},cells:nav,"]];
const add=(m,extra)=>({...m,simulation:[...(m.simulation||[]),...extra]});
const W0=loadFast({patches:add({},DBG)}),W1=loadFast({patches:add(toMap(PATCHES.localnav),DBG)});
const campaign=spec.startsWith('c:');
const opts=W=>{const o={brain:W.FBrain.create({mode:'cpu'}),armorSystem:true};o.inventory=campaign?{weapons:[true,true,true,true,true],ammo:[180,36,12,16,1],shield:false}:{weapons:[true,true,true,true],ammo:[180,36,12,16],shield:false};if(campaign){o.campaign={version:2,discovered:['pistol','smg','shotgun','grenade','rocket'],claimedBossRewards:[]};o.equipment={right:2,left:null,shieldEnergy:100};}return o;};
const w0=makeWorld(W0,spec),w1=makeWorld(W1,spec);
const probe=W0.FSimulation.create(w0,opts(W0));let wall=null;
for(const g of w0.destructibles.filter(g=>g.kind==='wall'&&g.colliders.length)){const b=g.bounds,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2,thinX=b.maxX-b.minX<b.maxZ-b.minZ;
  for(const sign of [-1,1]){const nx=thinX?sign:0,nz=thinX?0:sign,x=cx+nx*7,z=cz+nz*7,y=probe.ground(x,z);if(!Number.isFinite(y)||Math.abs(y-b.minY)>.1||probe.blocked(x,z,.28))continue;const hit=probe.ray([x,y+1.62,z],[-nx,0,-nz],9);if(hit<6||hit>7.4)continue;wall={x,y,z,yaw:Math.atan2(-nx,nz)};break;}if(wall)break;}
function once(W,world){
  const sim=W.FSimulation.create(world,opts(W)),s=sim.state;Object.assign(s.player,{x:wall.x,z:wall.z,y:wall.y,yaw:wall.yaw,pitch:0});const r0=s.destructionRevision;let i=0;
  // warm snapshot (cold nav) before the breach
  let t=performance.now();sim.snapshot();const cold=performance.now()-t;
  for(;i<200;i++){sim.step(1/60,i===0?{weapon:2,fire:true}:{});s.events.length=0;if(s.destructionRevision!==r0)break;}
  sim.step(1/60,{});s.events.length=0;const pending=sim.nav.pending;
  t=performance.now();const snap=sim.snapshot();const hot=performance.now()-t;
  t=performance.now();const json=JSON.stringify(snap);const str=performance.now()-t;
  t=performance.now();sim.snapshot();const again=performance.now()-t;
  return {cold,hot,str,again,pending,chars:json.length,breachStep:i};
}
const R={orig:[],local:[]};
for(let k=0;k<+repsArg;k++){for(const [n,W,w] of (k%2?[['local',W1,w1],['orig',W0,w0]]:[['orig',W0,w0],['local',W1,w1]]))R[n].push(once(W,w));}
const s=a=>({pending:a[0].pending,breachStep:a[0].breachStep,chars:a[0].chars,coldMin:+Math.min(...a.map(x=>x.cold)).toFixed(2),hotMin:+Math.min(...a.map(x=>x.hot)).toFixed(2),hotMed:+med(a.map(x=>x.hot)).toFixed(2),againMin:+Math.min(...a.map(x=>x.again)).toFixed(2),strMin:+Math.min(...a.map(x=>x.str)).toFixed(2)});
console.log(JSON.stringify({spec,orig:s(R.orig),local:s(R.local)}));
