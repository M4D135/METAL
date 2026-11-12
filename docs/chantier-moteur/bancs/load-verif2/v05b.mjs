// LOAD-05 item 1 prototype: skip resting rubble while no support input changed. Lockstep equality + paired timing.
import {loadFast,fnv} from './lib.mjs';
const [spec='l:0',wallsArg='8',mode='rocket']=process.argv.slice(2);
const PROTO={simulation:[
 ['    function updateDebris(dt){\n','    const __dyn=(q,h)=>s.doors.some(d=>Math.abs(q.x-d.x)<h[0]+d.w/2+.3&&Math.abs(q.z-d.z)<h[2]+d.d/2+.3)||s.lifts.some(l=>Math.abs(q.x-l.x)<h[0]+l.w/2+.3&&Math.abs(q.z-l.z)<h[2]+l.d/2+.3)||s.traps.some(t=>{const R=Math.max(t.w,t.d)+(t.travel||2)+.3;return Math.abs(q.x-t.x)<h[0]+R&&Math.abs(q.z-t.z)<h[2]+R;});\n    function updateDebris(dt){\n'],
 ['        q.rotation=q.rotation||[0,0,0];q.angularVelocity=q.angularVelocity||[0,0,0];q.settleTime=q.settleTime||0;\n','        if(q.resting&&q.__rev===s.destructionRevision){G.__s.skipped=(G.__s.skipped||0)+1;continue;}\n        q.rotation=q.rotation||[0,0,0];q.angularVelocity=q.angularVelocity||[0,0,0];q.settleTime=q.settleTime||0;\n'],
 ['if(q.resting){if(Number.isFinite(debrisSupport(q,h,boxes)))continue;q.resting=false;q.settleTime=0;}','if(q.resting){if(Number.isFinite(debrisSupport(q,h,boxes))){if(!__dyn(q,h))q.__rev=s.destructionRevision;else G.__s.dyn=(G.__s.dyn||0)+1;continue;}q.resting=false;q.settleTime=0;}'],
]};
const W0=loadFast(),W1=loadFast({patches:PROTO});
const mkWorld=W=>spec.startsWith('c:')?W.FWorld.create(96,+spec.split(':')[1],{campaign:true,campaignVersion:2}):W.FWorld.create(96,+spec.split(':')[1]);
const w0=mkWorld(W0),w1=mkWorld(W1);
const campaign=spec.startsWith('c:');
const opts=W=>{const o={brain:W.FBrain.create({mode:'cpu'}),armorSystem:true};o.inventory=campaign?{weapons:[true,true,true,true,true],ammo:[180,36,12,16,1],shield:false}:{weapons:[true,true,true,true],ammo:[180,36,12,16],shield:false};if(campaign){o.campaign={version:2,discovered:['pistol','smg','shotgun','grenade','rocket'],claimedBossRewards:[]};o.equipment={right:2,left:null,shieldEnergy:100};}return o;};
const A=W0.FSimulation.create(w0,opts(W0)),B=W1.FSimulation.create(w1,opts(W1));
const walls=[];
for(const g of w0.destructibles.filter(g=>g.kind==='wall'&&g.colliders.length)){const b=g.bounds,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2,thinX=b.maxX-b.minX<b.maxZ-b.minZ;
  for(const sign of [-1,1]){const nx=thinX?sign:0,nz=thinX?0:sign,x=cx+nx*7,z=cz+nz*7,y=A.ground(x,z);if(!Number.isFinite(y)||Math.abs(y-b.minY)>.1||A.blocked(x,z,.28))continue;const hit=A.ray([x,y+1.62,z],[-nx,0,-nz],9);if(hit<6||hit>7.4)continue;walls.push({x,y,z,yaw:Math.atan2(-nx,nz),cx,cz});break;}}
const far=walls.filter((w,i)=>walls.findIndex(q=>Math.hypot(q.cx-w.cx,q.cz-w.cz)<12)===i);
let steps=0,mismatch=0,checks=0;
const both=(f)=>{f(A);f(B);};
const cmp=()=>{checks++;if(fnv(JSON.stringify(A.snapshot()))!==fnv(JSON.stringify(B.snapshot())))mismatch++;};
const stepBoth=(inp)=>{both(S=>{S.step(1/60,{...inp});S.state.events.length=0;S.state.dead=false;});steps++;};
for(const wall of far.slice(0,+wallsArg))for(let k=0;k<2;k++){both(S=>{Object.assign(S.state.player,{x:wall.x,z:wall.z,y:wall.y,yaw:wall.yaw,pitch:k?.08:0,hp:100});S.state.inventory.ammo[2]=12;});for(let i=0;i<180;i++)stepBoth(i===0?{weapon:2,fire:true}:{});cmp();}
// walk around with fire so doors/lifts/traps/enemies interact with existing rubble
for(let i=0;i<1800;i++){both(S=>{S.state.player.yaw+=0.01;S.state.player.hp=100;});stepBoth({moveX:Math.sin(i/90),moveY:1,sprint:true,fire:(i%20)<6,dash:(i%240)===0,lookX:0,lookY:0});if(i%300===299)cmp();}
const rub=A.state.debris.filter(q=>q.structural);
// paired idle timing, alternated blocks
const T={orig:[],proto:[]};
for(let rep=0;rep<8;rep++){for(const [n,S] of (rep%2?[['proto',B],['orig',A]]:[['orig',A],['proto',B]])){let t=0;for(let i=0;i<150;i++){S.state.player.hp=100;const a=performance.now();S.step(1/60,{});t+=performance.now()-a;S.state.events.length=0;S.state.dead=false;}T[n].push(t/150);}}
cmp();
console.log(JSON.stringify({spec,skippedChecks:W1.__s.skipped,dynChecks:W1.__s.dyn,steps:steps+1200,rubble:rub.length,resting:rub.filter(q=>q.resting).length,snapshotChecks:checks,mismatch,idleStepMsMin:{orig:+Math.min(...T.orig).toFixed(3),proto:+Math.min(...T.proto).toFixed(3)},gain:Math.round(100*(1-Math.min(...T.proto)/Math.min(...T.orig)))+'%'}));
