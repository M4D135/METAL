import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// The QA-only exports call the real runtime eligibility check. Production's
// public API and the generated scene are unchanged by this harness.
const context={window:{}};vm.createContext(context);
for(const name of ['renderer','world','destruction','economy','simulation']){
  let source=readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8');
  if(name==='simulation'){
    assert(source.includes('return {state:s,get destruction()'));
    source=source.replace('return {state:s,get destruction()','return {safeEntry,updateDoorBoxes,state:s,get destruction()');
  }
  vm.runInContext(source,context,{filename:name+'.js'});
}
const {FWorld,FSimulation}=context.window,plain=value=>JSON.parse(JSON.stringify(value)),worlds=new Map();
const generated=index=>{if(!worlds.has(index))worlds.set(index,FWorld.create(96,index,{campaign:true,campaignVersion:2}));return worlds.get(index);};
const samples=[[0,0],[-.9,0],[.9,0],[0,-.9],[0,.9],[-.65,-.65],[-.65,.65],[.65,-.65],[.65,.65]];
function openGates(sim){
  for(const m of sim.state.mechanisms)m.active=true;
  for(const d of sim.state.doors){d.progress=1;d.open=false;}
  for(const l of sim.state.lifts)l.powered=true;
  sim.updateDoorBoxes();
  sim.step(0);sim.snapshot(); // Run the real door transition and finish its queued navigation update.
}
function selectedEncounters(world){
  const all=world.encounters.filter(q=>world.rooms[q.zoneId]&&!world.rooms[q.zoneId].bossArena),out=[];
  for(const q of [all.find(q=>world.rooms[q.zoneId].outdoor),all.find(q=>!world.rooms[q.zoneId].outdoor),all.at(-1)])if(q&&!out.includes(q))out.push(q);
  return out;
}
function observerPositions(sim,encounter){
  const world=sim.state.world,r=world.rooms[encounter.zoneId],bay=world.encounterBays.find(q=>q.zoneId===r.id),step=.8;
  const nx=Math.floor((r.w-1.4)/step)+1,nz=Math.floor((r.d-1.4)/step)+1,x0=r.x-r.w/2+.7,z0=r.z-r.d/2+.7,cells=[];
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    const p={x:x0+x*step,z:z0+z*step};p.y=sim.ground(p.x,p.z);p.free=Number.isFinite(p.y)&&Math.abs(p.y-r.y)<.08&&!sim.blocked(p.x,p.z,.28,p.y);cells.push(p);
  }
  let start=-1,best=Infinity;
  for(let i=0;i<cells.length;i++)if(cells[i].free){const d=Math.hypot(cells[i].x-r.x,cells[i].z-r.z);if(d<best){best=d;start=i;}}
  assert(start>=0,'generated encounter has no accessible central cross');
  const reached=new Set([start]),queue=[start];
  for(let head=0;head<queue.length;head++){
    const at=queue[head],x=at%nx,z=Math.floor(at/nx),a=cells[at];
    for(const next of [x?at-1:-1,x+1<nx?at+1:-1,z?at-nx:-1,z+1<nz?at+nx:-1])if(next>=0&&!reached.has(next)&&cells[next].free&&sim.nav.canTraverse(a.x,a.z,cells[next].x,cells[next].z,.28)){reached.add(next);queue.push(next);}
  }
  const targets=[['center',r.x,r.z],['incoming',r.x-bay.normal[0]*(Math.max(r.w,r.d)/2-1.5),r.z-bay.normal[1]*(Math.max(r.w,r.d)/2-1.5)],['left',r.x-r.w*.27,r.z+r.d*.23],['right',r.x+r.w*.27,r.z-r.d*.23]],used=new Set(),out=[];
  for(const [name,x,z] of targets){
    const nearest=[...reached].sort((a,b)=>Math.hypot(cells[a].x-x,cells[a].z-z)-Math.hypot(cells[b].x-x,cells[b].z-z)).find(i=>!used.has(i));
    if(nearest!==undefined){used.add(nearest);out.push({name,x:cells[nearest].x,y:cells[nearest].y,z:cells[nearest].z});}
  }
  return out;
}
function visibleSamples(sim,actor,entry,encounter){
  const p=sim.state.player,origin=[p.x,p.y+1.62,p.z],yaw=Math.atan2(encounter.trigger.x-entry.x,entry.z-encounter.trigger.z),offsets=actor.type===1?[...samples,[Math.sin(yaw)*1.5,-Math.cos(yaw)*1.5]]:samples;
  let visible=0;
  for(const height of [.2,1.1,2.15])for(const [dx,dz] of offsets){
    const delta=[entry.x+dx-origin[0],entry.y+height-origin[1],entry.z+dz-origin[2]],distance=Math.hypot(...delta);
    if(distance<1e-8||sim.ray(origin,delta.map(v=>v/distance),distance)>=distance-.06)visible++;
  }
  return visible;
}

test('natural v2 reserve sites provide real cover in early, middle and final worlds without camera-dependent visible spawning',()=>{
  let accepted=0,visibleRejected=0;
  for(const index of [0,7,17]){
    const world=generated(index),sim=FSimulation.create(world);openGates(sim);
    assert(!world.meshes.some(m=>['reinforcement_baffle','reinforcement_frame','reinforcement_mark'].includes(m.category)),'artificial barrier geometry returned');
    // Isolate geometry after a cleared earlier wave; occupancy is tested during
    // the actual deployments below. Open gates must not provide fictitious cover.
    for(const e of sim.state.enemies)e.deployed=false;
    for(const encounter of selectedEncounters(world)){
      const home=sim.state.enemies[encounter.waves.flatMap(q=>q.enemyIds)[0]],positions=observerPositions(sim,encounter);let roomAccepted=0;
      for(const observer of positions){
        Object.assign(sim.state.player,{x:observer.x,y:observer.y,z:observer.z,yaw:0});
        for(const entry of encounter.spawnEntries)for(const type of [0,1]){
          const actor={...home,type,deployed:false},visible=visibleSamples(sim,actor,entry,encounter),eligible=sim.safeEntry(actor,entry,encounter);
          sim.state.player.yaw=Math.PI;assert.equal(sim.safeEntry(actor,entry,encounter),eligible,'turning away bypassed physical spawn cover');sim.state.player.yaw=0;
          if(eligible){assert.equal(visible,0,'an admitted reserve has a visible body or weapon sample');accepted++;roomAccepted++;}
          if(visible){assert.equal(eligible,false,'a visible reserve was allowed to pop into the scene');visibleRejected++;}
        }
      }
      assert(roomAccepted>0,`world ${index}, room ${encounter.zoneId}: all natural entries remain visible from all sampled reachable positions`);
    }
  }
  assert(accepted>12&&visibleRejected>12,'the regression did not exercise both hidden arrivals and visible rejection');
});

function isolatedReserveWorld(index,source){
  const world=plain(generated(index)),original=world.encounters.find(q=>q.id===source.id),reserveIds=original.waves.flatMap(q=>q.enemyIds).filter(id=>world.enemies[id].deployed===false);
  if(!reserveIds.length)return null;
  const actors=reserveIds.slice(0,Math.min(3,reserveIds.length)).map(id=>({...world.enemies[id],wave:0}));
  world.enemies=actors;world.encounters=[{...original,waves:[{enemyIds:actors.map((_,i)=>i)}]}];
  // Leave all original walls, floors, ramps, doors, lifts and machinery in place.
  // Other squads are omitted to isolate this encounter's approach and timers.
  return world;
}
function findApproachScenario(index){
  const world=generated(index);
  for(const source of selectedEncounters(world)){
    const isolated=isolatedReserveWorld(index,source);if(!isolated)continue;
    const sim=FSimulation.create(isolated);openGates(sim);const encounter=sim.state.encounters[0];
    for(const observer of observerPositions(sim,encounter)){
      Object.assign(sim.state.player,{x:observer.x,y:observer.y,z:observer.z});
      const distant=encounter.spawnEntries.filter(entry=>Math.hypot(entry.x-observer.x,entry.z-observer.z)>30&&sim.state.enemies.some(e=>sim.safeEntry(e,entry,encounter)));
      if(distant.length){
        // Exercise the long approach explicitly using only genuinely generated,
        // currently hidden choices. The coverage test above uses the whole list.
        sim.dispose();isolated.encounters[0].spawnEntries=plain(distant);
        const run=FSimulation.create(isolated);openGates(run);Object.assign(run.state.player,{x:observer.x,y:observer.y,z:observer.z});
        return {world:isolated,sim:run,encounter:run.state.encounters[0],observer};
      }
    }
    sim.dispose();
  }
  assert.fail(`world ${index}: no physically hidden natural approach longer than thirty metres`);
}
function holdPlayerAlive(sim){sim.state.player.hp=sim.state.maxHp;sim.step(.05);assert(!sim.state.dead,'controlled observer died before the movement check');assert(sim.state.aiStats.combat<=sim.state.aiStats.combatCap,'arrival grace bypassed the combat actor cap');}

for(const index of [0,7,17])test(`real natural reserves in world ${index} deploy and approach instead of silently turning back after five seconds`,()=>{
    const {sim,encounter}=findApproachScenario(index),p=sim.state.player;let tracked=null,initialDistance=0,deployedAt=0,minimum=Infinity,pastFive=false;
    for(let frame=0;frame<760;frame++){
      const pending=sim.state.enemies.filter(e=>!e.deployed).map(e=>e.id);holdPlayerAlive(sim);
      for(const id of pending){const actor=sim.state.enemies[id];if(actor.deployed){const entry=Array.from(encounter.spawnEntries).sort((a,b)=>Math.hypot(a.x-actor.x,a.z-actor.z)-Math.hypot(b.x-actor.x,b.z-actor.z))[0];assert(Math.hypot(entry.x-actor.x,entry.z-actor.z)<.25,'a new reserve teleported away from its accepted entry');assert.equal(visibleSamples(sim,actor,entry,encounter),0,'actual runtime deployment appeared in a visible silhouette');}}
      if(!tracked){
        tracked=sim.state.enemies.find(e=>e.deployed&&Math.hypot(e.x-p.x,e.z-p.z)>30);
        if(tracked){initialDistance=Math.hypot(tracked.x-p.x,tracked.z-p.z);minimum=initialDistance;deployedAt=sim.state.time;assert(tracked.entryGrace>5,'distant deployment received no time to approach');}
      }
      if(tracked){
        minimum=Math.min(minimum,Math.hypot(tracked.x-p.x,tracked.z-p.z));
        if(sim.state.time-deployedAt>=6&&sim.state.time-deployedAt<7){pastFive=true;assert(!tracked.returning&&tracked.combatEnabled,'the five-second idle rule sent the arriving reserve back');}
        if(pastFive&&initialDistance-minimum>5&&(minimum<25||tracked.seen))break;
      }
    }
    assert(tracked&&pastFive,`world ${index}: no real distant reserve deployed and survived the old five-second cutoff`);
    assert(initialDistance-minimum>5&&(minimum<25||tracked.seen),`world ${index}: reserve failed to approach (start ${initialDistance.toFixed(2)}, closest ${minimum.toFixed(2)}): `+JSON.stringify({encounter:encounter.id,player:[p.x,p.y,p.z],actor:[tracked.x,tracked.baseY,tracked.z],type:tracked.type,grace:tracked.entryGrace,seen:tracked.seen,returning:tracked.returning,enabled:tracked.combatEnabled,awareness:tracked.awareness,tactic:tracked.tactic,goal:[tracked.goalX,tracked.goalZ],pathAt:tracked.pathAt,pathLength:tracked.path.length,stuck:tracked.stuck,moveSpeed:tracked.moveSpeed,quietTime:tracked.quietTime,time:sim.state.time,deployedAt}));
    assert(sim.state.enemies.filter(e=>e.deployed&&e.hp>0&&e.combatEnabled).length<=sim.state.aiStats.combatCap);
    sim.dispose();
});

test('an ongoing natural approach survives checkpoint restore and malformed entry grace is rejected atomically',()=>{
  const {world,sim}=findApproachScenario(0);let actor;
  for(let frame=0;frame<180;frame++){holdPlayerAlive(sim);actor=sim.state.enemies.find(e=>e.deployed&&e.entryGrace>6);if(actor&&actor.deployAge>=2&&sim.state.time>6)break;}
  assert(actor&&actor.entryGrace>0&&actor.deployed&&!actor.returning,'no valid approaching actor was captured');
  const checkpoint=sim.snapshot(),copy=FSimulation.create(world);assert(copy.restore(checkpoint),'valid arrival grace checkpoint rejected');assert.equal(JSON.stringify(copy.snapshot()),JSON.stringify(checkpoint));
  const before=JSON.stringify(copy.snapshot()),id=actor.id;
  for(const corrupt of [q=>q.state.enemies[id].entryGrace=-1,q=>q.state.enemies[id].entryGrace=1e9,q=>q.state.enemies[id].entryGrace=NaN,q=>q.reinforcementVersion=7]){
    const invalid=plain(checkpoint);corrupt(invalid);assert.equal(copy.restore(invalid),false);assert.equal(JSON.stringify(copy.snapshot()),before,'invalid arrival timer mutated the live checkpoint');
  }
  const undeployed=FSimulation.create(world),pending=undeployed.snapshot(),unreleased=pending.state.enemies.find(e=>!e.deployed);assert(unreleased);unreleased.entryGrace=1;
  const original=JSON.stringify(undeployed.snapshot());assert.equal(undeployed.restore(pending),false,'an undeployed reserve cannot claim active arrival time');assert.equal(JSON.stringify(undeployed.snapshot()),original);
  const distance=Math.hypot(copy.state.enemies[id].x-copy.state.player.x,copy.state.enemies[id].z-copy.state.player.z);
  for(let frame=0;frame<120;frame++)holdPlayerAlive(copy);
  const resumed=copy.state.enemies[id];assert(!resumed.returning,'restoration discarded the remaining approach allowance');assert(Math.hypot(resumed.x-copy.state.player.x,resumed.z-copy.state.player.z)<distance-2||resumed.seen,'restored reserve did not continue physically approaching');
});
