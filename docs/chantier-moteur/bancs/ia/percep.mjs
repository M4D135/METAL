// Perception / decision cost breakdown in combat (tour driver, main realm):
// rays per caller, calls and exclusive time of AI functions, per second of game time.
// usage: node percep.mjs <repo> [steps] [scenarioFilter]
import {loadMain} from './loadmain.mjs'; import {drive} from './load.mjs'; import {instrument,makeCounters} from './instr.mjs';
const root=process.argv[2],STEPS=+process.argv[3]||3600,filter=process.argv[4]||'v2';
const C=makeCounters(99);globalThis.__C=C;
const G=loadMain(root,{patch:src=>instrument(src)});const {FWorld,FSimulation,FBrain}=G.window;
const SC=[['v2-w06',5],['v2-w10',9],['v2-w16',15],['v2-w18',17]].filter(s=>s[0].includes(filter));
for(const [label,idx] of SC){
  const w=FWorld.create(96,idx,{campaign:true,campaignVersion:2});const brain=FBrain.create({mode:'cpu'});const sim=FSimulation.create(w,{brain});const s=sim.state;
  const input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0},enc=s.encounters.filter(q=>!w.rooms?.[q.zoneId]?.bossArena);let tourAt=0;
  const rayCat={},calls={},time={};let rays=0,engaged=0,steps=0;
  for(let i=0;i<STEPS;i++){
    drive(i,input,s);s.player.hp=Math.max(s.player.hp,60);if(enc.length&&i%420===0){const q=enc[tourAt++%enc.length];s.player.x=q.trigger.x;s.player.z=q.trigger.z;s.player.y=sim.ground(q.trigger.x,q.trigger.z);}
    C.reset();sim.step(1/60,input);C.close();s.events.length=0;steps++;
    for(const [k,v] of Object.entries(C.rayCat))rayCat[k]=(rayCat[k]||0)+v;C.rayCat={};
    for(const [k,v] of Object.entries(C.calls))calls[k]=(calls[k]||0)+v;for(const [k,v] of Object.entries(C.time))time[k]=(time[k]||0)+v;rays+=C.ray;
    engaged+=s.enemies.filter(e=>e.hp>0&&e.deployed!==false&&e.hasMemory&&!e.sleeping).length;
  }
  const sec=steps/60;
  console.log(`=== ${label} ${sec.toFixed(0)} s, mean engaged enemies ${(engaged/steps).toFixed(1)}, rays/s ${(rays/sec).toFixed(0)}, brain metrics ${JSON.stringify(brain.metrics)}`);
  console.log('  rays/s by caller: '+Object.entries(rayCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+(v/sec).toFixed(0)).join(' '));
  const keys=['perceive','hear','reactToShot','canShoot','clearLane','plan','cover','peek','neuralPlan','updateBrain','safeEntry','updateEncounters','navigate','separate','rebuildNeighbors','attack','burst','returnToPost'];
  console.log('  calls/s and exclusive us per call / ms per s: '+keys.filter(k=>calls[k]).map(k=>`${k}:${(calls[k]/sec).toFixed(0)}/s ${(1000*time[k]/calls[k]).toFixed(1)}us ${(time[k]/sec).toFixed(2)}ms/s`).join(' | '));
}
