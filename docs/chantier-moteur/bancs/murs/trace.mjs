// Enregistre la trace des appels damageScenery d'un combat automatique (un scénario par processus).
// usage : node trace.mjs <index monde 0..17> <arme 0|1|4> <secondes> <A|B> [def pour B]   → trace-<...>.json
import {writeFileSync} from 'node:fs';import {loadFast,loadoutV2,q,mean} from './lib.mjs';import {patchesA,patchesB,armoredIds,classify} from './proto.mjs';
const [indexArg,weaponArg,secArg,mode='A',DEF='R3']=process.argv.slice(2),index=+indexArg,weapon=+weaponArg,SECONDS=+secArg||60,STEPS=Math.round(SECONDS*60),ERR=process.env.ERR!==undefined?+process.env.ERR:.05;
const W=loadFast({patches:mode==='B'?patchesB:patchesA});
const world=W.FWorld.create(96,index,{campaign:true,campaignVersion:2});if(mode==='B')world.armored=armoredIds(world,DEF);
const carry=loadoutV2(W,index);if(!carry.inventory.weapons[weapon])throw new Error('arme absente');
let brain=null;try{brain=W.FBrain.create({mode:'cpu'});}catch{}
const sim=W.FSimulation.create(world,{...carry,armorSystem:true,...(brain?{brain}:{})});sim.selectWeapon(weapon);
const PASSIVE=process.env.PASSIVE==='1',TOUR=+process.env.TOUR||600,IDS=process.env.TOURIDS?process.env.TOURIDS.split(',').map(n=>'encounter-'+n):null,SPRAY=process.env.SPRAY==='1',TAG=process.env.TAG||'';
const s=sim.state,p=s.player,enc=s.encounters.filter(e=>!world.rooms?.[e.zoneId]?.bossArena&&(!IDS||IDS.includes(e.id)));let tour=0,step=0,lastSeen=null,lastSeenAt=-1e9;
const calls=[];globalThis.__SRC='joueur:balle';globalThis.__RULE={enemy:true,boss:true,steam:false};globalThis.__DOORS_ARMORED=mode==='B';
globalThis.__CALL=(point,power,r,direction,ignoreId)=>calls.push([step,globalThis.__SRC,point.map(v=>+v.toFixed(4)),power,r,direction?direction.map(v=>+v.toFixed(5)):null,ignoreId??null]);
let revs=0,revSteps=0,last=0,rubbleSum=0,rubbleMax=0;const times=[],revTimes=[];
globalThis.__REV=()=>{revs++;};
const input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
for(step=0;step<STEPS;step++){
  p.hp=Math.max(p.hp,70);if(weapon!==4&&s.inventory.ammo[weapon]<8)s.inventory.ammo[weapon]=sim.ammoCaps[weapon];
  if(process.env.ARENA==='1'){if(step===0){p.x=world.bossArena.x-16;p.z=world.bossArena.z;p.y=sim.ground(p.x,p.z);}else if(Math.hypot(p.x-world.bossArena.x,p.z-world.bossArena.z)>24){p.x=world.bossArena.x+(p.x-world.bossArena.x)*.6;p.z=world.bossArena.z+(p.z-world.bossArena.z)*.6;p.y=sim.ground(p.x,p.z);}}
  else if(enc.length&&step%TOUR===0){const e=enc[tour++%enc.length];p.x=e.trigger.x;p.z=e.trigger.z;p.y=sim.ground(p.x,p.z);}
  let best=null,bd=1e9;for(const e of s.enemies){if(!(e.hp>0)||e.deployed===false||e.sleeping)continue;const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<bd&&d<34&&Math.abs(e.baseY-p.y)<4&&sim.sight(p.x,p.z,e.x,e.z,p.y+1.62,e.y)){best=e;bd=d;}}
  input.moveX=Math.sin(step/90);input.moveY=best?.2:1;input.sprint=!best;
  const err=ERR*(Math.sin(step*.37)+.6*Math.sin(step*.113+1.3));
  if(best){const dx=best.x-p.x,dz=best.z-p.z;p.yaw=Math.atan2(dx,-dz)+err;p.pitch=Math.atan2(best.y-(p.y+1.62),Math.hypot(dx,dz))+err*.5*Math.cos(step*.21);input.fire=true;lastSeen={x:best.x,y:best.y,z:best.z};lastSeenAt=step;}
  else if(SPRAY&&lastSeen&&step-lastSeenAt<90){const dx=lastSeen.x-p.x,dz=lastSeen.z-p.z;p.yaw=Math.atan2(dx,-dz)+err;p.pitch=Math.atan2(lastSeen.y-(p.y+1.62),Math.hypot(dx,dz));input.fire=true;}   // tir de suppression 1,5 s sur la dernière position vue
  else{input.fire=(step%45)<6;p.yaw+=.02;p.pitch=0;}
  if(PASSIVE)input.fire=false;
  if(process.env.ARENA==='1'){input.moveY=.6;input.sprint=false;if(!best)p.yaw+=.01;}
  const r0=revs,t0=performance.now();sim.step(1/60,input);const dt=performance.now()-t0;times.push(dt);if(revs>r0){revSteps++;revTimes.push(dt);}
  const rubble=s.debris.filter(d=>d.structural).length;rubbleSum+=rubble;rubbleMax=Math.max(rubbleMax,rubble);s.events.length=0;
}
const sorted=times.slice().sort((a,b)=>a-b),others=times.filter((_,i)=>true);
const explosions={};for(const c of calls)if(c[4]>0)explosions[c[1]]=(explosions[c[1]]||0)+1;
const summary={tag:TAG,explosions,mode,def:mode==='B'?DEF:null,index,weapon,seconds:SECONDS,calls:calls.length,shots:s.shots,hits:s.hits,kills:s.kills,revs,revSteps,revPerMin:+(revs*60/SECONDS).toFixed(1),revStepsPerMin:+(revSteps*60/SECONDS).toFixed(1),rubbleMax,rubbleMean:+(rubbleSum/STEPS).toFixed(1),
  stepMedian:+q(times,.5).toFixed(3),stepMean:+mean(times).toFixed(3),p99:+q(times,.99).toFixed(2),revStepMedian:revTimes.length?+q(revTimes,.5).toFixed(2):null,revStepMean:revTimes.length?+mean(revTimes).toFixed(2):null,states:sim.destruction.snapshot().states.length,snapshotBytes:JSON.stringify(sim.snapshot()).length};
writeFileSync(new URL('./trace-w'+String(index+1).padStart(2,'0')+'-a'+weapon+'-'+mode+TAG+'.json',import.meta.url),JSON.stringify({summary,calls}));
console.log(JSON.stringify(summary));
