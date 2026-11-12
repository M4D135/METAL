// AI quality proxies (deterministic, machine independent), base vs prototype.
// usage: node aiq.mjs <repo> <flags|base> [steps=3600] [filter=v2]
import {loadMain} from './loadmain.mjs'; import {drive,rep} from './load.mjs'; import {protoPatch} from './proto.mjs';
const [root,flags='base',stepsArg='3600',filter='v2']=process.argv.slice(2);const STEPS=+stepsArg;
const count=src=>{
  src=rep(src,'    function plan(e){','    function plan(e){globalThis.__Q.plans++;');
  src=rep(src,'if(e.stuck>1.1){','if(e.stuck>1.1){globalThis.__Q.stuck++;');
  return src;};
globalThis.__Q={plans:0,stuck:0};
const G=loadMain(root,{patch:src=>count(flags==='base'?src:protoPatch(src,flags))});const {FWorld,FSimulation,FBrain}=G.window;
const SC=[['v2-w01',0],['v2-w06',5],['v2-w10',9],['v2-w16',15],['v2-w18',17]].filter(s=>s[0].includes(filter));
for(const [label,idx] of SC){
  globalThis.__Q={plans:0,stuck:0};
  const w=FWorld.create(96,idx,{campaign:true,campaignVersion:2});const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});const s=sim.state;
  const input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0},enc=s.encounters.filter(q=>!w.rooms?.[q.zoneId]?.bossArena);let tourAt=0;
  let engaged=0,seen=0,aiming=0,idleHold=0,moving=0,maxAimers=0,aimSum=0,aimSteps=0,shots=0,hits=0,seenSince=new Map(),reaction=[],damage=0;
  for(let i=0;i<STEPS;i++){
    drive(i,input,s);s.player.hp=Math.max(s.player.hp,60);if(enc.length&&i%420===0){const q=enc[tourAt++%enc.length];s.player.x=q.trigger.x;s.player.z=q.trigger.z;s.player.y=sim.ground(q.trigger.x,q.trigger.z);}
    const hp0=s.player.hp;sim.step(1/60,input);damage+=Math.max(0,hp0-s.player.hp);
    for(const ev of s.events)if(ev.name==='enemyShot')shots++;s.events.length=0;
    let aimers=0;
    for(const e of s.enemies){if(!(e.hp>0&&e.deployed!==false&&e.hasMemory&&!e.sleeping&&e.type!==3))continue;engaged++;
      if(e.seen){seen++;if(!seenSince.has(e.id))seenSince.set(e.id,i);}else seenSince.delete(e.id);
      const busy=e.windup>0||e.burstLeft>0||e.rushTime>0;if(busy){aiming++;aimers++;if(seenSince.has(e.id)&&seenSince.get(e.id)>=0){reaction.push((i-seenSince.get(e.id))/60);seenSince.set(e.id,-1);}}
      else if(e.tactic==='hold'&&e.moveSpeed<.05)idleHold++;
      if(e.moveSpeed>.3)moving++;}
    maxAimers=Math.max(maxAimers,aimers);if(aimers){aimSum+=aimers;aimSteps++;}
  }
  reaction.sort((a,b)=>a-b);const sec=STEPS/60,meanEng=engaged/STEPS;
  console.log(JSON.stringify({label,flags:flags==='base'?'base':'proto',meanEngaged:+meanEng.toFixed(1),plansPerEnemyPerS:+(globalThis.__Q.plans/sec/Math.max(.01,meanEng)).toFixed(2),stuckPerMin:+(globalThis.__Q.stuck/(sec/60)).toFixed(1),
    seenPct:+(100*seen/engaged).toFixed(1),aimingPct:+(100*aiming/engaged).toFixed(1),idleHoldPct:+(100*idleHold/engaged).toFixed(1),movingPct:+(100*moving/engaged).toFixed(1),
    maxSimultaneousAimers:maxAimers,meanAimersWhenAny:+(aimSum/Math.max(1,aimSteps)).toFixed(2),enemyShotsPerS:+(shots/sec).toFixed(2),playerDamagePerS:+(damage/sec).toFixed(2),
    reactionMedianS:reaction.length?+reaction[Math.floor(reaction.length/2)].toFixed(2):null,reactionP90S:reaction.length?+reaction[Math.floor(reaction.length*.9)].toFixed(2):null}));
}
