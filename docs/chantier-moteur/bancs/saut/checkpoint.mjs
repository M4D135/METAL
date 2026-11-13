// (f) Checkpoints: the real rule of src/game.js:94-97 and :238 replayed on the simulation events, for 60 s of sprint vs 60 s of
// continuous hopping (V1: buffered jump fires at the next step; V0: rebound inside land(), i.e. never grounded at a step end).
import {loadFast,WORLDS} from './lib.mjs';import {physPatches} from './phys.mjs';
const DUE=new Set(['core','mechanism','armorPickup','bossReward','weaponPickup','shieldPickup','trophy','trophyComplete','encounterClear','bossDeath']);
const wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
function run(Wn,mode,secs=60,deadline=0){
  const world=Wn.FWorld.create(96,0,{campaign:true,campaignVersion:2});const sim=Wn.FSimulation.create(world,{}),s=sim.state,p=s.player;
  const m0=world.mechanisms[0],m1=world.mechanisms[1],c2=world.cores[2];
  const wp=[{x:m0.x,z:m0.z+.9,mech:0},{x:-41.6,z:36},{x:-41.6,z:33.2},{x:-41.6,z:3.5},{x:m1.x+1.0,z:m1.z,mech:1},{x:-41.6,z:-4},{x:-41.6,z:-8.4},{x:-41.6,z:-38},{x:c2.x,z:c2.z,core:2},{x:-36,z:-38},{x:-47,z:-38},{x:-47,z:-46},{x:-36,z:-46}];
  let at=0,pending=false,pendingSince=0,t=0,grounded=0,steps=0,lastX=p.x,lastZ=p.z,stuckT=0,strafe=0,jumpEvents=0;const dues=[],saves=[],input={moveX:0,moveY:1,sprint:true};let interactPhase=false,dist=0,maxDelay=0,forced=0;
  const save=(why)=>{if(s.dead||s.won)return;if(p.airborne&&!(deadline>0&&pending&&t-pendingSince>=deadline)){if(!pending){pending=true;pendingSince=t;}return;}
    if(p.airborne)forced++;if(pending)maxDelay=Math.max(maxDelay,t-pendingSince);pending=false;const snap=sim.snapshot();saves.push({t:+t.toFixed(2),air:p.airborne,why,bytes:JSON.stringify(snap).length});};
  for(let i=0;i<secs*60;i++){
    const w=wp[Math.min(at,wp.length-1)],dx=w.x-p.x,dz=w.z-p.z,d=Math.hypot(dx,dz);
    const want=Math.atan2(dx,-dz);input.lookX=Math.max(-.12,Math.min(.12,wrap(want-p.yaw)));
    const near=w.mech!==undefined&&d<3.2;input.moveY=near&&d<.5?0:1;input.moveX=strafe;
    input.jump=mode!=='run'&&!near&&(i%2===0);
    input.interact=false;if(w.mech!==undefined&&d<2.2&&!p.airborne){interactPhase=!interactPhase;input.interact=interactPhase;}
    const px=p.x,pz=p.z;sim.step(1/60,input);t+=1/60;steps++;dist+=Math.hypot(p.x-px,p.z-pz);p.hp=sim.stats.maxHp;if(s.dead){s.dead=false;}
    if(!p.airborne)grounded++;
    let due=false;for(const e of s.events){if(DUE.has(e.name)||e.name==='liftStop'&&e.carrying||e.name==='lootPickup'&&(e.boss||e.armor>0)){due=true;dues.push({t:+t.toFixed(2),name:e.name,air:p.airborne});}if(e.name==='jump')jumpEvents++;}
    s.events.length=0;if(due||pending&&(!p.airborne||deadline>0))save(due?'due':'pending');
    if(w.mech!==undefined?s.mechanisms[w.mech].active:w.core!==undefined?s.cores[w.core].taken:d<1.3){at++;if(at>=wp.length)at=9;}
    if(i%60===59){if(Math.hypot(p.x-lastX,p.z-lastZ)<.8)stuckT++;else{stuckT=0;strafe=0;}if(stuckT>=1)strafe=strafe?-strafe:1;lastX=p.x;lastZ=p.z;}
  }
  return {mode,deadline,dues:dues.length,saves:saves.length,forcedInAir:forced,pendingAtEnd:pending,maxDelay:+maxDelay.toFixed(2),groundedStepEnds:grounded,steps,jumps:jumpEvents,metres:Math.round(dist),dueList:dues.map(d=>d.name+'@'+d.t+(d.air?'(vol)':'')).join(' '),saveTimes:saves.map(v=>v.t+(v.air?'(vol)':'')).join(' ')};
}
const V1=loadFast({patches:physPatches({})}),V0=loadFast({patches:physPatches({rebound:true})});
console.log(JSON.stringify(run(V1,'run')));
console.log(JSON.stringify(run(V1,'bhop-V1')));
console.log(JSON.stringify(run(V0,'bhop-V0')));
console.log(JSON.stringify(run(V0,'bhop-V0',60,1.5)));
// in-flight snapshot validity with the 0.8.0 validAir (physicsVersion 1): ascending vs descending part of a jump
{const world=V1.FWorld.create(96,0,{campaign:true,campaignVersion:2});const sim=V1.FSimulation.create(world,{}),p=sim.state.player,input={moveX:0,moveY:1,sprint:true,jump:true};
 const res=[];for(let i=0;i<40;i++){sim.step(1/60,input);input.jump=false;if(p.airborne&&(i===5||i===30)){const snap=sim.snapshot();const fresh=V1.FSimulation.create(V1.FWorld.create(96,0,{campaign:true,campaignVersion:2}),{});res.push({step:i,airVY:+p.airVY.toFixed(2),restoreOK:fresh.restore(JSON.parse(JSON.stringify(snap)))});}}
 console.log('snapshot en vol (validAir 0.8.0):',JSON.stringify(res));}
