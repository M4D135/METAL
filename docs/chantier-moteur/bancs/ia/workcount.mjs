// Deterministic work counters per step (machine-independent): ground(), blocked(),
// ray(), segmentFree() calls, A* nodes; base vs prototype. Main realm, instrumented.
// usage: node workcount.mjs <repo> <flags|base> <driver> <steps> [filter]
import {loadMain} from './loadmain.mjs'; import {drive} from './load.mjs'; import {instrument,makeCounters} from './instr.mjs'; import {protoPatch} from './proto.mjs';
const [root,flags='base',driver='circle',stepsArg='1800',filter='']=process.argv.slice(2);const STEPS=+stepsArg;
const C=makeCounters(1e9);globalThis.__C=C;
const G=loadMain(root,{patch:src=>instrument(flags==='base'?src:protoPatch(src,flags),{wrap:false})});const {FWorld,FSimulation,FBrain}=G.window;
const SC=[['legacy-s0',0,undefined],['legacy-s2',2,undefined],['v2-w01',0,{campaign:true,campaignVersion:2}],['v2-w06',5,{campaign:true,campaignVersion:2}],['v2-w10',9,{campaign:true,campaignVersion:2}],['v2-w16',15,{campaign:true,campaignVersion:2}],['v2-w18',17,{campaign:true,campaignVersion:2}]].filter(s=>s[0].includes(filter));
const out=[];
for(const [label,idx,opts] of SC){
  const w=FWorld.create(96,idx,opts);const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});const s=sim.state;
  const input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0},enc=(s.encounters||[]).filter(q=>!w.rooms?.[q.zoneId]?.bossArena);let tourAt=0;
  const tot={ground:0,blocked:0,ray:0,seg:0,explored:0},mx={ground:0,blocked:0,ray:0,seg:0,explored:0},over={g10k:0,g20k:0};
  for(let i=0;i<STEPS;i++){
    drive(i,input,s);if(driver==='tour'){s.player.hp=Math.max(s.player.hp,60);if(enc.length&&i%420===0){const q=enc[tourAt++%enc.length];s.player.x=q.trigger.x;s.player.z=q.trigger.z;s.player.y=sim.ground(q.trigger.x,q.trigger.z);}}
    C.reset();sim.step(1/60,input);s.events.length=0;
    const v={ground:C.ground,blocked:C.blocked,ray:C.ray,seg:Object.values(C.seg).reduce((a,b)=>a+b,0),explored:C.explored};
    for(const k in v){tot[k]+=v[k];mx[k]=Math.max(mx[k],v[k]);}if(v.ground>10000)over.g10k++;if(v.ground>20000)over.g20k++;
    if(s.dead)break;
  }
  out.push({label,driver,flags:flags==='base'?'base':'proto',max:mx,totalPerStep:Object.fromEntries(Object.entries(tot).map(([k,v])=>[k,+(v/STEPS).toFixed(0)])),stepsGround10k:over.g10k,stepsGround20k:over.g20k});
}
for(const r of out)console.log(JSON.stringify(r));
