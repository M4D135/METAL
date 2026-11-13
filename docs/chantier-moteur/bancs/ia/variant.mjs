// One run of the unmodified or prototype simulation in the MAIN realm.
// usage: node variant.mjs <repo> <flags|base> <driver circle|tour> <steps> [scenarioFilter]
// prints one JSON line per scenario: timing stats + final state hash
import {loadMain} from './loadmain.mjs'; import {drive} from './load.mjs'; import {protoPatch} from './proto.mjs';
import {createHash} from 'node:crypto';
const [root,flags='base',driver='circle',stepsArg='1800',filter='']=process.argv.slice(2);const STEPS=+stepsArg;
const G=loadMain(root,{patch:flags==='base'?null:src=>protoPatch(src,flags)});const {FWorld,FSimulation,FBrain}=G.window;
const SC=[['legacy-s0',0,undefined],['legacy-s2',2,undefined],['v2-w01',0,{campaign:true,campaignVersion:2}],['v2-w06',5,{campaign:true,campaignVersion:2}],['v2-w10',9,{campaign:true,campaignVersion:2}],['v2-w16',15,{campaign:true,campaignVersion:2}],['v2-w18',17,{campaign:true,campaignVersion:2}]].filter(s=>s[0].includes(filter));
for(const [label,idx,opts] of SC){
  globalThis.__labelRejects=0;
  const w=FWorld.create(96,idx,opts);let t=performance.now();const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});const init=performance.now()-t;
  const s=sim.state,input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0},times=[];
  const enc=(s.encounters||[]).filter(q=>!w.rooms?.[q.zoneId]?.bossArena);let tourAt=0,searches=0,deferred=0,labelAt=-1,holdSteps=0,moveSteps=0,engagedSteps=0,firstBake=0;
  for(let i=0;i<STEPS;i++){
    drive(i,input,s);if(driver==='tour'){s.player.hp=Math.max(s.player.hp,60);if(enc.length&&i%420===0){const q=enc[tourAt++%enc.length];s.player.x=q.trigger.x;s.player.z=q.trigger.z;s.player.y=sim.ground(q.trigger.x,q.trigger.z);}}
    const t0=performance.now();sim.step(1/60,input);const ms=performance.now()-t0;times.push(ms);s.events.length=0;
    searches+=s.aiStats.pathSearches;deferred+=s.aiStats.pathDeferred;
    if(labelAt<0&&globalThis.__navProbe?.labelsReady)labelAt=i;if(i<120&&globalThis.__navProbe&&!globalThis.__navProbe.labelsReady)firstBake+=ms;
    for(const e of s.enemies)if(e.hp>0&&e.deployed!==false&&e.hasMemory&&!e.sleeping){engagedSteps++;if(e.tactic==='hold'&&e.attackState!=='aim'&&e.attackState!=='burst'&&e.windup<=0)holdSteps++;if(e.moveSpeed>.3)moveSteps++;}
    if(s.dead)break;
  }
  const sorted=times.slice().sort((a,b)=>a-b),q=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
  const state=JSON.stringify({p:[s.player.x,s.player.z,s.player.hp],k:s.kills,e:s.enemies.map(e=>[+e.x.toFixed(6),+e.z.toFixed(6),e.hp,e.tactic,e.path.length])});
  console.log(JSON.stringify({label,flags,driver,steps:times.length,init:+init.toFixed(1),avg:+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(3),p99:+q(.99).toFixed(2),p999:+q(.999).toFixed(2),max:+sorted.at(-1).toFixed(2),over4:times.filter(v=>v>4).length,over8:times.filter(v=>v>8).length,
    searches,deferred,labelRejects:globalThis.__labelRejects,labelsReadyAt:labelAt,firstBakeMs:+firstBake.toFixed(1),holdPct:+(100*holdSteps/Math.max(1,engagedSteps)).toFixed(1),movePct:+(100*moveSteps/Math.max(1,engagedSteps)).toFixed(1),kills:s.kills,dead:s.dead,nav:globalThis.__navProbe?{...globalThis.__navProbe.stats}:null,hash:createHash('sha1').update(state).digest('hex').slice(0,10)}));
}
