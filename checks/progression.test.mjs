import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=fileURLToPath(new URL('../',import.meta.url)),context={window:{}};
vm.createContext(context);
for(const name of ['destruction','economy','simulation'])vm.runInContext(readFileSync(root+'src/'+name+'.js','utf8'),context,{filename:name+'.js'});
const {FSimulation,FEconomy}=context.window;
const json=value=>JSON.parse(JSON.stringify(value));
function world(extra={}){
  return {seed:'progression',stage:0,generation:6,spawn:{x:0,y:0,z:0,yaw:0},bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},
    walkable:[{x:0,y:0,z:0,w:120,d:120}],meshes:[],lights:[],colliders:[],enemies:[],pickups:[],cores:[{x:45,z:45},{x:48,z:45},{x:51,z:45}],exit:{x:54,z:45},
    progression:{version:1,startWeapons:[true,false,false],startAmmo:[48,0,0],ammoCaps:[180,36,12],maxActive:8},...extra};
}
function advance(sim,seconds,input={}){for(let t=0;t<seconds-1e-8;t+=.025)sim.step(Math.min(.025,seconds-t),input);}
function aim(sim,e){const p=sim.state.player,dx=e.x-p.x,dz=e.z-p.z;p.yaw=Math.atan2(dx,-dz);p.pitch=Math.atan2((e.y??1.35)-(p.y+1.62),Math.hypot(dx,dz));}
const events=(sim,name)=>sim.state.events.filter(q=>q.name===name);
function encounterWorld(extra={}){
  const wall={minX:-5,maxX:5,minY:0,maxY:4,minZ:-10.25,maxZ:-9.75,mesh:0};
  return world({meshes:[{shape:'box',p:[0,2,-10],s:[10,4,.5],r:[0,0,0],mat:1}],colliders:[wall],destructibles:[{id:'screen',kind:'wall',strength:6,meshes:[0],colliders:[0]}],
    enemies:[{x:3,y:0,z:-6,type:0,deployed:true,drop:{weapon:0,amount:4}},...[-2,2].map(x=>({x,y:0,z:-14,type:0,deployed:false,drop:false}))],
    encounters:[{id:'yard',label:'Cour',zoneId:1,trigger:{x:0,y:0,z:0,w:14,d:14},leashRadius:20,maxActive:4,waveGap:2,spawnEntries:[{x:-2,y:0,z:-14},{x:2,y:0,z:-14}],waves:[{enemyIds:[0]},{enemyIds:[1,2]}]}],...extra});
}
function killByShooting(sim,e){
  for(let i=0;i<20&&e.hp>0;i++){e.cooldown=30;aim(sim,e);sim.fire();advance(sim,.22);if(sim.state.player.overheated)advance(sim,2.5);}
  assert.equal(e.hp,0,'Actual shots must kill the target');
}

test('The starting arsenal is locked and every discharged weapon consumes finite ammunition exactly once',()=>{
  const sim=FSimulation.create(world(),{});
  assert.deepEqual(json(sim.exportInventory()),{weapons:[true,false,false],ammo:[48,0,0]});
  assert.equal(sim.selectWeapon(1),false);sim.step(.025,{weapon:2});assert.equal(sim.state.weapon,0);
  assert.equal(sim.fire(),true);assert.equal(sim.state.inventory.ammo[0],47);assert.equal(sim.fire(),false);assert.equal(sim.state.inventory.ammo[0],47);
  advance(sim,8);sim.setDifficulty(2);sim.setDifficulty(0);assert.equal(sim.state.inventory.ammo[0],47,'Time and difficulty must never refill ammunition');
  const armed=FSimulation.create(world(),{inventory:{weapons:[true,true,true],ammo:[2,2,2]}});
  armed.selectWeapon(1);armed.fire();assert.equal(armed.state.inventory.ammo[1],1,'Seven pellets consume one shell');advance(armed,1);
  armed.selectWeapon(2);armed.fire();assert.equal(armed.state.inventory.ammo[2],1);assert.equal(armed.state.projectiles.length,1);
  assert.throws(()=>FSimulation.create(world(),{inventory:{weapons:[true,false,false],ammo:[181,0,0]}}));
});

test('Physical weapon racks unlock in order, duplicate racks provide ammunition, and full bags retain their surplus',()=>{
  const sim=FSimulation.create(world({pickups:[{id:'cells',kind:'ammo',weapon:0,amount:10,x:.4,y:0,z:0},{id:'shotgun',kind:'weapon',weapon:1,amount:8,x:3,y:0,z:0},{id:'duplicate',kind:'weapon',weapon:1,amount:5,x:6,y:0,z:0},{id:'launcher',kind:'weapon',weapon:2,amount:3,x:9,y:0,z:0}]}),{inventory:{weapons:[true,false,false],ammo:[179,0,0]}});
  sim.step(.025);assert.equal(sim.state.inventory.ammo[0],180);assert.equal(sim.state.pickups[0].remaining,9);assert.equal(sim.state.pickups[0].taken,false);
  sim.move(sim.state.player,3,0);sim.step(.025);assert.equal(sim.state.weapon,1);assert.equal(sim.state.inventory.ammo[1],8);assert.equal(sim.selectWeapon(2),false);
  sim.move(sim.state.player,3,0);sim.step(.025);assert.equal(sim.state.inventory.ammo[1],13);assert.equal(events(sim,'weaponPickup').length,1);
  sim.move(sim.state.player,3,0);sim.step(.025);assert.equal(sim.state.weapon,2);assert.equal(sim.state.inventory.ammo[2],3);assert.equal(events(sim,'weaponPickup').length,2);
  const carried=sim.exportInventory(),next=FSimulation.create(world({stage:1}),{inventory:carried});assert.deepEqual(json(next.exportInventory()),json(carried));
  carried.ammo[0]=0;assert.equal(next.state.inventory.ammo[0],180,'Transfer must copy rather than alias inventory');
});

test('Supplies cannot be collected through a thin wall or from another floor',()=>{
  const sim=FSimulation.create(world({colliders:[{minX:.35,maxX:.45,minY:0,maxY:3,minZ:-1,maxZ:1}],pickups:[{id:'hidden',kind:'ammo',weapon:0,amount:10,x:.8,y:0,z:0},{id:'above',kind:'weapon',weapon:2,amount:3,x:0,y:3.2,z:0}]}));
  sim.step(.025);assert.equal(sim.state.inventory.ammo[0],48);assert.equal(sim.state.pickups[0].taken,false);assert.equal(sim.state.inventory.weapons[2],false);
  sim.move(sim.state.player,0,2);sim.move(sim.state.player,.8,0);sim.move(sim.state.player,0,-2);sim.step(.025);
  assert.equal(sim.state.inventory.ammo[0],58);assert.equal(sim.state.pickups[0].taken,true);assert.equal(sim.state.pickups[1].taken,false);
});

test('An empty weapon uses a short weak butt strike without heat or projectile; defensive pulse does not replace ammunition',()=>{
  const sim=FSimulation.create(world({enemies:[{x:0,y:0,z:-1.4,type:0,drop:{weapon:0,amount:4}}]}),{inventory:{weapons:[true,false,false],ammo:[0,0,0]}}),enemy=sim.state.enemies[0];enemy.cooldown=30;
  aim(sim,enemy);sim.fire();assert.equal(events(sim,'empty').length,1);assert.equal(events(sim,'melee').length,1);assert.equal(sim.state.shots,0);assert.equal(sim.state.player.heat,0);assert.equal(sim.state.projectiles.length,0);assert.equal(enemy.hp,2.1);
  sim.pulse();assert(enemy.hp>1.8,'Pulse should principally repel/stun, not grant free full-power fire');
  const before=sim.exportInventory();sim.setDifficulty(2);assert.deepEqual(json(sim.exportInventory()),json(before));
  const emptyLauncher=FSimulation.create(world(),{inventory:{weapons:[true,true,true],ammo:[0,0,0]}});emptyLauncher.selectWeapon(2);emptyLauncher.fire();advance(emptyLauncher,.5);
  assert.equal(emptyLauncher.state.projectiles.length,0);assert.equal(events(emptyLauncher,'explosion').length,0);assert.equal(emptyLauncher.state.player.heat,0);assert.equal(emptyLauncher.state.shots,0);
  const close=FSimulation.create(world({enemies:[{x:0,y:0,z:-1.4,type:0,drop:{weapon:0,amount:4}}]}),{inventory:{weapons:[true,false,false],ammo:[0,0,0]}});
  for(let i=0;i<4;i++){const e=close.state.enemies[0],p=close.state.player,dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);if(d>1.2)close.move(p,dx/d*(d-1.2),dz/d*(d-1.2));e.cooldown=30;aim(close,e);close.melee();advance(close,.73);}
  assert.equal(close.state.kills,1);assert.equal(close.state.loot.length,1);assert.equal(close.state.loot[0].ammo[0],4);assert.equal(close.state.loot[0].credits,6);
  close.move(close.state.player,close.state.loot[0].x-close.state.player.x,close.state.loot[0].z-close.state.player.z);close.step(.025);assert.equal(close.state.inventory.ammo[0],4);
  const checkpoint=close.snapshot(),restored=FSimulation.create(close.state.world);assert.equal(restored.restore(checkpoint),true);advance(restored,2);assert.equal(restored.state.loot.length,1);assert.equal(restored.state.inventory.ammo[0],4);
});

test('Undeployed reservations have no hit volume, perception, pulse, blast or elevator collision',()=>{
  const w=world({spawn:{x:0,y:0,z:0,yaw:0},enemies:[{x:0,y:0,z:-5,type:0,deployed:false,drop:false}],encounters:[{id:'later',label:'Later',trigger:{x:35,y:0,z:35,w:4,d:4},maxActive:4,waves:[{enemyIds:[0]}],spawnEntries:[{x:0,y:0,z:-5}]}],
    lifts:[{id:'lift',x:0,z:-5,w:3,d:3,minY:0,maxY:3.2,speed:1.6}],meshes:[{shape:'box',p:[0,1,-7],s:[4,2,.4],r:[0,0,0],mat:1}],colliders:[{minX:-2,maxX:2,minY:0,maxY:2,minZ:-7.2,maxZ:-6.8,mesh:0}],destructibles:[{id:'wall',kind:'wall',strength:5,meshes:[0],colliders:[0]}]});
  const sim=FSimulation.create(w,{inventory:{weapons:[true,true,true],ammo:[48,8,3]}}),enemy=sim.state.enemies[0];
  sim.fire();sim.pulse();advance(sim,.3);assert.equal(sim.state.hits,0);assert.equal(enemy.hp,3);assert.equal(enemy.hasMemory,false);
  sim.selectWeapon(2);advance(sim,.5);sim.fire();advance(sim,.5);assert(events(sim,'explosion').length>0);assert.equal(enemy.hp,3);assert.equal(enemy.deployed,false);
  assert.equal(events(sim,'explosion')[0].kind,'rocket');assert.equal(sim.state.explosions[0].life,2.4);assert.equal(sim.state.explosions[0].owner,'player');
  const lift=sim.state.lifts[0];lift.y=3.2;lift.target=0;lift.moving=true;advance(sim,2.1);assert.equal(lift.y,0,'A reservation underneath must not stop a descending deck');
  assert.equal(enemy.x,0);assert.equal(enemy.z,-5);assert.equal(sim.state.aiStats.reserve,1);
});

test('Waves keep stable IDs, wait for real kills, announce their entry and walk continuously after hidden deployment',()=>{
  const sim=FSimulation.create(encounterWorld());sim.state.enemies[0].cooldown=30;advance(sim,1.8);
  assert.equal(sim.state.encounters[0].wave,0);assert.equal(sim.state.enemies.filter(e=>e.deployed).length,1);advance(sim,2);
  assert.equal(sim.state.enemies[1].deployed,false,'Elapsed time alone cannot skip an unfinished wave');
  killByShooting(sim,sim.state.enemies[0]);advance(sim,.1);assert.equal(sim.state.encounters[0].pendingWave,1);assert.equal(sim.state.enemies[1].deployed,false);
  assert.equal(events(sim,'waveStart').length,2);let deployed=0;const deploymentTimes=[];
  for(let i=0;i<280;i++){
    const before=sim.state.enemies.map(e=>({x:e.x,z:e.z,deployed:e.deployed}));sim.step(.025);sim.state.player.hp=100;
    assert(sim.state.enemies.filter((e,j)=>e.deployed&&!before[j].deployed).length<=1,'Creation work must be staggered across frames');
    for(let j=1;j<3;j++){const e=sim.state.enemies[j];if(e.deployed&&!before[j].deployed){deployed++;deploymentTimes.push(sim.state.time);assert(Math.hypot(e.x-sim.state.player.x,e.z-sim.state.player.z)>=10);assert.equal(sim.sight(sim.state.player.x,sim.state.player.z,e.x,e.z,1.62,e.y),false);for(const other of sim.state.enemies)if(other!==e&&other.deployed&&other.hp>0)assert(Math.hypot(e.x-other.x,e.z-other.z)>=1.3);}
      if(before[j].deployed)assert(Math.hypot(e.x-before[j].x,e.z-before[j].z)<.25,'An already deployed body teleported');}
    assert(sim.state.aiStats.combat<=4);
  }
  assert.equal(deployed,2);assert.deepEqual(sim.state.enemies.map(e=>e.id),[0,1,2]);assert.equal(sim.state.encounters[0].wave,1);
  assert(deploymentTimes[1]-deploymentTimes[0]>=.2-1e-8);
  assert(sim.state.enemies.slice(1).some(e=>Math.abs(e.z+14)>1),'The reinforcement label must cause actual movement');
  const saved=sim.snapshot(),resumed=FSimulation.create(sim.state.world);assert.equal(resumed.restore(saved),true);assert.deepEqual(json(resumed.snapshot()),json(saved));
  advance(sim,.5);advance(resumed,.5);assert.deepEqual(json(resumed.snapshot()),json(sim.snapshot()));
});

test('Looking away never permits a visible spawn, and a destroyed deployment screen leaves reserves waiting',()=>{
  const open=encounterWorld({meshes:[],colliders:[],destructibles:[],enemies:[{x:0,y:0,z:-14,type:0,deployed:false,drop:false}],encounters:[{id:'open',trigger:{x:0,y:0,z:0,w:10,d:10},maxActive:4,waves:[{enemyIds:[0]}],spawnEntries:[{x:0,y:0,z:-14}]}]});
  const sim=FSimulation.create(open);sim.state.player.yaw=Math.PI;advance(sim,4);assert.equal(sim.state.enemies[0].deployed,false);assert.equal(sim.state.encounters[0].status,'waiting');
  const covered=encounterWorld({enemies:[{x:0,y:0,z:-14,type:0,deployed:false,drop:false}],encounters:[{id:'covered',trigger:{x:0,y:0,z:0,w:10,d:10},maxActive:4,waves:[{enemyIds:[0]}],spawnEntries:[{x:0,y:0,z:-14}]}]});
  const broken=FSimulation.create(covered);broken.destruction.blast([0,2,-10],8,80);advance(broken,3);
  assert.equal(broken.state.enemies[0].deployed,false);assert.equal(broken.state.encounters[0].status,'waiting');
  broken.state.cores.forEach(q=>{q.taken=true;});broken.state.relays=3;broken.move(broken.state.player,54,45);broken.step(.025);assert.equal(broken.state.won,true,'An optional blocked wave must never lock the mission exit');
});

test('Global combat budget bounds overlapping encounters and disengaged actors return on foot without despawning',()=>{
  const enemies=Array.from({length:6},(_,i)=>({x:(i%3)*2-2,y:0,z:i<3?-7:7,type:0,deployed:true,drop:false}));
  const encounters=[0,1].map((id)=>({id,label:'Group '+id,trigger:{x:0,y:0,z:0,w:16,d:16},leashRadius:16,maxActive:3,waves:[{enemyIds:[id*3,id*3+1,id*3+2]}],spawnEntries:[]}));
  const sim=FSimulation.create(world({enemies,encounters,progression:{version:1,startWeapons:[true,false,false],startAmmo:[48,0,0],ammoCaps:[180,36,12],maxActive:4}}));
  sim.state.enemies.forEach(e=>{e.cooldown=30;});advance(sim,2);
  assert(sim.state.aiStats.combat>0&&sim.state.aiStats.combat<=4);assert.equal(sim.state.encounters.filter(q=>q.status==='active').length,1);
  sim.move(sim.state.player,40,0);
  for(let i=0;i<480;i++){const old=sim.state.enemies.map(e=>[e.x,e.z]);sim.step(.025);assert(sim.state.aiStats.combat<=4);sim.state.enemies.forEach((e,j)=>{assert.equal(e.deployed,true);assert(Math.hypot(e.x-old[j][0],e.z-old[j][1])<.25);});}
  assert.equal(sim.state.aiStats.combat,0);assert(sim.state.enemies.every((e,i)=>Math.hypot(e.x-enemies[i].x,e.z-enemies[i].z)<3),'Groups should return to their posts after losing territorial contact');
});

test('Inventory, partial caches, pending waves and reservations round-trip atomically without resupply',()=>{
  const w=encounterWorld({pickups:[{id:'cache',kind:'ammo',weapon:0,amount:10,x:.3,y:0,z:0}]}),sim=FSimulation.create(w,{inventory:{weapons:[true,false,false],ammo:[179,0,0]}});
  sim.step(.025);const saved=sim.snapshot(),restored=FSimulation.create(w);assert.equal(restored.restore(saved),true);assert.deepEqual(json(restored.snapshot()),json(saved));
  for(const mutate of [q=>q.state.inventory.ammo[0]=181,q=>q.state.inventory.weapons[0]=false,q=>q.state.weapon=2,q=>q.state.pickupRemaining[0]=11,q=>q.state.enemies[1].combatEnabled=true,q=>q.state.enemies[1].hp=1,q=>q.state.encounters[0].pendingWave=2,q=>q.timers.encounterWait=3,q=>q.state.loot=[{id:'enemy-1',sourceEnemy:1,kind:'ammo',weapon:0,amount:4,remaining:4,x:0,y:0,z:0,taken:false}]]){
    const bad=json(saved);mutate(bad);const before=JSON.stringify(restored.snapshot());assert.equal(restored.restore(bad),false);assert.equal(JSON.stringify(restored.snapshot()),before);
  }
  advance(sim,2);advance(restored,2);assert.deepEqual(json(restored.snapshot()),json(sim.snapshot()));
});

test('Generation-six movement is faster, normalizes diagonals and agrees at 20–120 Hz through reversal and release',()=>{
  const results=[];
  for(const hz of [20,60,120]){
    const sim=FSimulation.create(world()),dt=1/hz;
    for(let i=0;i<hz;i++)sim.step(dt,{moveY:1,sprint:true});const forward=-sim.state.player.z;assert(forward>7.2&&forward<7.61);
    for(let i=0;i<hz/2;i++)sim.step(dt,{moveX:1,moveY:-1,sprint:true});
    for(let i=0;i<hz/4;i++)sim.step(dt);assert(sim.state.locomotion.speed<.005);
    results.push([sim.state.player.x,sim.state.player.z]);
    const diagonal=FSimulation.create(world());for(let i=0;i<hz;i++)diagonal.step(dt,{moveX:1,moveY:1,sprint:true});assert(Math.abs(Math.hypot(diagonal.state.player.x,diagonal.state.player.z)-forward)<.002);
  }
  for(const position of results.slice(1))assert(Math.hypot(position[0]-results[0][0],position[1]-results[0][1])<.02);
  const fast=FSimulation.create(world({colliders:[{minX:2,maxX:2.03,minY:0,maxY:5,minZ:-50,maxZ:50}]}));advance(fast,1,{moveX:1,sprint:true,dash:true});assert(fast.state.player.x<=1.72+1e-8);
});

test('Destroyed pipe mouths stop steam, sound triggers and damage immediately while surviving mouths stay anchored',()=>{
  const w=world({spawn:{x:0,y:0,z:0,yaw:0},meshes:[{shape:'box',p:[0,1,-3],s:[8,2,.6],r:[0,0,0],mat:1},{shape:'box',p:[0,1,-2.72],s:[.24,.24,.36],r:[0,0,0],mat:1}],
    colliders:[{minX:-4,maxX:4,minY:0,maxY:2,minZ:-3.3,maxZ:-2.7,mesh:0}],destructibles:[{id:'pressure',kind:'wall',strength:5,meshes:[0,1],colliders:[0]}],
    pipes:[{id:'pipe',destructibleId:'pressure',x:0,y:1,z:-3,dx:0,dy:0,dz:1,length:4,radius:.45,delay:1,duration:6,damage:8,period:0}]});
  const sim=FSimulation.create(w);const pipe=sim.state.pipes[0];pipe.active=true;pipe.remaining=7;pipe.warning=true;
  sim.destruction.blast([3,1,-3],.45,20);sim.step(.025);assert.equal(sim.destruction.isAlive('pressure'),true);assert.equal(pipe.broken,false);assert.equal(pipe.active,true);
  const mouth=pipe.nozzle,hit=sim.destruction.raycast([mouth[0],mouth[1],mouth[2]+.03],[0,0,-1],.08);assert.equal(hit.id,'pressure');
  sim.destruction.blast([0,1,-3],1,50);sim.step(.025);assert.equal(sim.destruction.isAlive('pressure'),true,'Some side wall remains, so whole-group existence is insufficient');
  assert.equal(pipe.broken,true);assert.equal(pipe.active,false);assert.equal(pipe.hot,false);assert.equal(pipe.warning,false);assert.equal(pipe.remaining,0);
  const hp=sim.state.player.hp,count=events(sim,'pipeLeak').length;advance(sim,8);assert.equal(sim.state.player.hp,hp);assert.equal(events(sim,'pipeLeak').length,count);
  const restored=FSimulation.create(w);assert.equal(restored.restore(sim.snapshot()),true);assert.equal(restored.state.pipes[0].active,false);
});

test('The energetic air profile keeps deterministic pad arcs, midflight inventory saves and swept walls and ceilings',()=>{
  const pad={id:'launch',x:0,y:0,z:0,r:1.1,target:{x:12,y:3.2,z:0},flightTime:1.6};
  const w=world({walkable:[{x:0,y:0,z:0,w:120,d:120},{x:12,y:3.2,z:0,w:6,d:6}],jumpPads:[pad]});
  const landings=[];
  for(const hz of [20,60,120]){
    const sim=FSimulation.create(w);sim.step(0);assert.equal(sim.state.player.airborne,true);let apex=0;
    for(let i=0;i<hz*3&&sim.state.player.airborne;i++){sim.step(1/hz,{moveY:.35});apex=Math.max(apex,sim.state.player.y);}
    assert.equal(sim.state.player.airborne,false);assert.equal(sim.state.player.y,3.2);assert(Math.abs(sim.state.player.x-12)<.16);assert(apex>5.5&&apex<5.7);landings.push(sim.state.player.z);
  }
  assert(landings.every(z=>z<-.8&&z>-1.2));assert(Math.max(...landings)-Math.min(...landings)<.03);
  const mid=FSimulation.create(w);advance(mid,.4,{fire:true});const snapshot=mid.snapshot(),restored=FSimulation.create(w);assert.equal(restored.restore(snapshot),true);assert(mid.state.inventory.ammo[0]<48);assert.deepEqual(json(restored.exportInventory()),json(mid.exportInventory()));
  advance(mid,1.8);advance(restored,1.8);assert.deepEqual(json(restored.snapshot()),json(mid.snapshot()));
  for(const collider of [{minX:5,maxX:5.03,minY:0,maxY:12,minZ:-6,maxZ:6},{minX:-5,maxX:20,minY:3,maxY:3.15,minZ:-6,maxZ:6}]){
    const blocked=FSimulation.create(world({jumpPads:[pad],colliders:[collider]}));blocked.step(0);
    for(let i=0;i<240;i++){blocked.step(1/120,{moveX:.5});const p=blocked.state.player;if(collider.minX===5)assert(p.x<=4.72+1e-7);else assert(p.y+1.8<=3+1e-7);}
  }
});

test('A nearby workshop applies purchased stats to real combat without advancing time or refilling upgrade capacity',()=>{
  const economy=FEconomy.fresh();economy.credits=4000;economy.cores=3;
  const w=world({shops:[{id:'workshop',name:'Atelier',x:1,y:0,z:0}],enemies:[{x:0,y:0,z:-8,type:1,drop:false}]}),sim=FSimulation.create(w,{economy,inventory:{weapons:[true,false,false],ammo:[180,0,0]}});
  assert.equal(sim.nearestInteraction().kind,'shop');assert.equal(sim.interact(),true);assert.equal(events(sim,'shopOpen')[0].id,'workshop');assert.equal(sim.shopOffers('workshop').length,11);
  sim.hurt(30);const time=sim.state.time;
  assert.equal(sim.buy('workshop','capacity').ok,true);assert.deepEqual(json(sim.ammoCaps),[225,45,15]);assert.equal(sim.state.inventory.ammo[0],180);
  assert.equal(sim.buy('workshop','vitality').ok,true);assert.equal(sim.state.maxHp,120);assert.equal(sim.state.player.hp,70,'Vitality only raises the ceiling');
  assert.equal(sim.buy('workshop','repair').ok,true);assert.equal(sim.state.player.hp,95);
  assert.equal(sim.buy('workshop','ammo0').ok,true);assert.equal(sim.state.inventory.ammo[0],204);
  assert.equal(sim.buy('workshop','power').ok,true);const enemy=sim.state.enemies[0];aim(sim,enemy);sim.fire();assert(Math.abs(enemy.hp-3.9)<1e-8);
  assert.equal(sim.buy('workshop','armor').ok,true);const hp=sim.state.player.hp;sim.hurt(10);assert(Math.abs(sim.state.player.hp-(hp-9.2))<1e-8);
  assert.equal(sim.buy('workshop','cooling').ok,true);assert.equal(sim.state.time,time,'Shopping while paused cannot advance encounters');
  const baseline=FSimulation.create(world());baseline.fire();baseline.state.player.heat=.6;sim.state.player.heat=.6;advance(baseline,.5);advance(sim,.5);assert(sim.state.player.heat<baseline.state.player.heat);
  const saved=sim.snapshot(),resumed=FSimulation.create(w);assert.equal(resumed.restore(saved),true);assert.deepEqual(json(resumed.snapshot()),json(saved));assert.equal(resumed.ammoCaps[0],225);assert.equal(resumed.state.maxHp,120);
  const loadout=sim.exportLoadout(),next=FSimulation.create(world({stage:1}),loadout);assert.deepEqual(json(next.exportLoadout()),json(loadout));loadout.economy.credits=0;assert(next.state.economy.credits>0);
});

test('Workshop transactions require a live operator and an unobstructed physical workshop',()=>{
  const economy=FEconomy.fresh();economy.credits=1000;
  const sim=FSimulation.create(world({shops:[{id:'shop',name:'Atelier',x:2,y:0,z:0}],colliders:[{minX:.8,maxX:1,minY:0,maxY:3,minZ:-2,maxZ:2}]}),{economy});
  const before=JSON.stringify(sim.exportLoadout());assert.equal(sim.shopOffers('shop'),null);assert.equal(sim.buy('shop','ammo0').ok,false);assert.equal(JSON.stringify(sim.exportLoadout()),before);
  sim.move(sim.state.player,0,3);sim.move(sim.state.player,2,0);sim.move(sim.state.player,0,-3);assert(sim.shopOffers('shop'));
  assert.equal(sim.buy('shop','weapon1').ok,true);assert.equal(sim.selectWeapon(1),true);assert.equal(sim.state.inventory.ammo[1],6);
  const once=JSON.stringify(sim.exportLoadout());assert.equal(sim.buy('shop','weapon1').ok,false);assert.equal(JSON.stringify(sim.exportLoadout()),once);
  sim.hurt(1000);assert.equal(sim.shopOffers('shop'),null);assert.equal(sim.buy('shop','repair').ok,false);assert.equal(JSON.stringify(sim.exportLoadout()),once);
});

test('Boss salvage awards its physical credits and core once, keeps ammo overflow and rejects corrupted economy checkpoints',()=>{
  const boss={x:0,y:0,z:-10,type:3,bossScale:2,bossKind:'colossus',bossName:'Test',maxHp:30,arena:{x:0,y:0,z:-10,r:28}};
  const w=world({enemies:[boss]}),sim=FSimulation.create(w,{inventory:{weapons:[true,true,true],ammo:[180,36,12]}}),e=sim.state.enemies[0];e.hp=.2;aim(sim,e);sim.fire();
  assert.equal(sim.state.kills,1);assert.equal(sim.state.loot.length,1);const loot=sim.state.loot[0];assert.equal(loot.kind,'boss');assert.equal(loot.credits,160);assert.equal(loot.cores,1);assert.deepEqual(json(loot.ammo),[24,6,2]);assert.equal(loot.y,0);
  const firstLobe=sim.state.explosions[0].id;assert.equal(sim.state.explosions.length,12);assert(sim.state.explosions.every(q=>q.kind==='boss'&&q.life===2.8&&q.owner===e.id));
  sim.move(sim.state.player,loot.x-sim.state.player.x,loot.z-sim.state.player.z);sim.step(.025);assert.equal(sim.state.economy.credits,160);assert.equal(sim.state.economy.cores,1);assert.equal(loot.taken,false);assert.deepEqual(json(loot.ammo),[23,6,2]);
  const saved=sim.snapshot(),resumed=FSimulation.create(w);assert.equal(resumed.restore(saved),true);advance(resumed,.5);assert.equal(resumed.state.economy.credits,160);assert.equal(resumed.state.economy.cores,1);
  for(const mutate of [q=>q.state.economy.credits=-1,q=>q.state.economy.cores=1000,q=>q.state.economy.upgrades.capacity=4,q=>q.state.inventory.ammo[0]=181,q=>q.state.player.hp=101,q=>q.state.loot[0].credits=161,q=>q.state.loot.push(json(q.state.loot[0]))]){
    const bad=json(saved);mutate(bad);const unchanged=JSON.stringify(resumed.snapshot());assert.equal(resumed.restore(bad),false);assert.equal(JSON.stringify(resumed.snapshot()),unchanged);
  }
  const hp=sim.state.player.hp;advance(sim,1.3);assert(sim.state.explosions.some(q=>q.id===firstLobe),'The cosmetic smoke must outlive the brief flash');assert.equal(sim.state.player.hp,hp);advance(sim,3);assert.equal(sim.state.explosions.length,0);
});

function arsenalWorld(extra={}){return world({progression:{version:1,weaponSlots:4,startWeapons:[true,false,false,false],startAmmo:[48,0,0,0],ammoCaps:[180,36,12,16],maxActive:8},...extra});}
const fullArsenal=()=>({weapons:[true,true,true,true],ammo:[40,8,5,6]});
function armed(extra={},equipment={right:0,left:1}){return FSimulation.create(arsenalWorld(extra),{inventory:fullArsenal(),equipment});}

test('Four-slot loadouts migrate old inventories without gifts and enforce distinct owned weapons in each hand',()=>{
  const fresh=FSimulation.create(arsenalWorld());assert.deepEqual(json(fresh.exportInventory()),{weapons:[true,false,false,false],ammo:[48,0,0,0]});assert.equal(fresh.selectLeftWeapon(0),false);assert.equal(fresh.selectLeftWeapon(3),false);assert.equal(fresh.selectLeftWeapon('shield'),false);assert.equal(fresh.state.shield,undefined);
  const migrated=FSimulation.create(arsenalWorld(),{inventory:{weapons:[true,true,false],ammo:[7,2,0]}});assert.deepEqual(json(migrated.exportInventory()),{weapons:[true,true,false,false],ammo:[7,2,0,0]});
  const sim=armed({}, {right:0,left:1});assert.equal(sim.selectWeapon(1),true);assert.deepEqual(json(sim.state.equipment),{right:1,left:0});assert.equal(sim.selectLeftWeapon(1),true);assert.deepEqual(json(sim.state.equipment),{right:0,left:1});
  assert.equal(sim.selectLeftWeapon('shield'),false,'the shield is gone from the left hand');assert.equal(sim.selectLeftWeapon(0),true,'selecting the right-hand gun in the left hand swaps the two hands');assert.deepEqual(json(sim.state.equipment),{right:1,left:0});
  const carried=sim.exportLoadout(),next=FSimulation.create(arsenalWorld({stage:1}),carried);assert.deepEqual(json(next.exportLoadout()),json(carried));assert.equal(next.state.equipment.left,0);assert.equal(next.state.shield,undefined);
  for(const equipment of [{right:0,left:0},{right:4,left:null},{right:0,left:'smg'},{right:0,left:true}])assert.throws(()=>FSimulation.create(arsenalWorld(),{inventory:fullArsenal(),equipment}));
  const legacy=FSimulation.create(arsenalWorld(),{inventory:fullArsenal(),equipment:{right:0,left:'shield',shieldEnergy:100}});assert.deepEqual(json(legacy.state.equipment),{right:0,left:null},'An old loadout that held the shield simply frees the left hand');
});

test('Two hands discharge independently while swapping preserves each weapon cooldown and shared finite ammunition',()=>{
  const sim=armed();sim.step(.025,{fire:true,fireLeft:true});assert.deepEqual(json(sim.state.inventory.ammo),[39,6,5,6]);assert.equal(sim.state.shots,2);assert.equal(sim.state.flash,1);assert.equal(sim.state.leftFlash,1);
  assert.equal(events(sim,'shot')[0].hand,'right');assert.equal(events(sim,'fracture')[0].hand,'left');assert.equal(events(sim,'fracture')[0].shells,2);
  sim.selectWeapon(1);assert.equal(sim.fire(),false);assert.equal(sim.fireLeft(),false);advance(sim,.15);assert.equal(sim.fire(),false);assert.equal(sim.fireLeft(),true);assert.deepEqual(json(sim.state.inventory.ammo),[38,6,5,6]);
  const one=FSimulation.create(arsenalWorld(),{inventory:{weapons:[true,true,false,false],ammo:[0,1,0,0]},equipment:{right:1,left:null}});assert.equal(one.fire(),true);assert.equal(one.state.inventory.ammo[1],0);assert.equal(events(one,'fracture')[0].shells,1);advance(one,.8);const heat=one.state.player.heat;one.fire();assert.equal(one.state.shots,1);assert.equal(one.state.player.heat,heat);assert.equal(events(one,'empty').length,1);
});

test('Hand-specific muzzle paths prevent shooting through an adjacent corner while the unobstructed hand can hit',()=>{
  const wall={minX:.08,maxX:.5,minY:.5,maxY:3,minZ:-1.4,maxZ:-.5},sim=armed({colliders:[wall],enemies:[{x:0,y:0,z:-6,type:0}]});
  assert(sim.sight(0,0,0,-6,1.62,1.35),'The eye itself must see around this corner');const enemy=sim.state.enemies[0];
  assert.equal(sim.fire(),true);assert.equal(enemy.hp,3,'A blocked right barrel cannot borrow the eye ray');assert.equal(sim.fireLeft(),true);assert.equal(enemy.hp,0,'The physically clear left barrel should hit the target');
  const leftWall={minX:-.5,maxX:-.08,minY:.5,maxY:3,minZ:-1.4,maxZ:-.5},rocket=armed({colliders:[leftWall],enemies:[{x:0,y:0,z:-6,type:0}]},{right:0,left:2});
  rocket.fireLeft();assert.equal(rocket.state.projectiles.length,0);assert.equal(events(rocket,'rocketDud').length,1);assert.equal(events(rocket,'rocket')[0].hand,'left');assert.equal(rocket.state.inventory.ammo[2],4);assert.equal(rocket.state.enemies[0].hp,3);
});

test('A finite player grenade launches from the selected hand, follows gravity, bounces safely and restores mid-flight',()=>{
  const sim=armed({}, {right:0,left:3});sim.fireLeft();assert.equal(sim.state.inventory.ammo[3],5);const q=sim.state.projectiles[0],initialY=q.y;
  assert.equal(q.kind,'grenade');assert.equal(q.hand,'left');assert(q.x<-.2);assert.equal(events(sim,'grenadeLaunch')[0].owner,'player');assert.equal(events(sim,'grenadeLaunch')[0].hand,'left');
  advance(sim,.2);assert(q.y>initialY+.3);assert(q.vy<1.5);const saved=sim.snapshot(),restored=FSimulation.create(sim.state.world);assert.equal(restored.restore(saved),true);assert.deepEqual(json(restored.state.projectiles),json(sim.state.projectiles));
  advance(sim,1.7);advance(restored,1.7);assert.equal(events(sim,'explosion').length,1);assert.equal(events(restored,'explosion').length,1);assert.equal(sim.state.projectiles.length,0);assert.equal(events(sim,'explosion')[0].kind,'grenade');assert.equal(sim.state.inventory.ammo[3],5);
  const stopped=armed({colliders:[{minX:-4,maxX:4,minY:0,maxY:4,minZ:-3.1,maxZ:-3},{minX:-5,maxX:5,minY:1.95,maxY:2.2,minZ:-4,maxZ:2}]},{right:3,left:null});stopped.fire();
  for(let i=0;i<60;i++){stopped.step(.025);for(const g of stopped.state.projectiles){assert(g.z>=-2.831,'A swept grenade crossed the wall');assert(g.y<=1.781,'A swept grenade crossed the low ceiling');}}
});

test('A frontal bullet now lands at full strength because nothing absorbs it any more',()=>{
  const sim=armed({}, {right:0,left:1});
  const bolt=(x,z,dx,dz)=>{sim.state.bullets.push({x,y:1.25,z,dx,dy:0,dz,life:1,damage:20});sim.step(.05);};
  bolt(0,-1,0,20);assert.equal(sim.state.player.hp,80,'A frontal hit is no longer absorbed');
  bolt(0,1,0,-20);assert.equal(sim.state.player.hp,60);bolt(1,0,-20,0);assert.equal(sim.state.player.hp,40);
  sim.hurt(8);assert.equal(sim.state.player.hp,32,'An unlocated environmental hazard is not a frontal projectile');
  assert.equal(events(sim,'shieldBlock').length,0);assert.equal(events(sim,'shieldRaise').length,0);assert.equal(sim.state.shield,undefined);
});

test('The dodge always dashes and keeps its short invulnerability without striking',()=>{
  const sim=armed({colliders:[{minX:-5,maxX:5,minY:0,maxY:3,minZ:-2.8,maxZ:-2.6}],enemies:[{x:0,y:0,z:-1.65,type:1}]}),enemy=sim.state.enemies[0];enemy.cooldown=30;
  const hp=sim.state.player.hp;
  sim.step(.025,{dash:true});assert(sim.state.player.dash>1,'the dodge is never replaced by another action');assert(sim.state.player.dashing>0);
  sim.hurt(30);assert.equal(sim.state.player.hp,hp,'the dash window still blocks damage');
  advance(sim,.25);sim.hurt(30);assert.equal(sim.state.player.hp,hp-30,'and that window stays short');
  assert.equal(enemy.hp,5,'the dodge no longer hits anybody');assert.equal(events(sim,'shieldBash').length,0);
  assert.equal(sim.shieldBash,undefined,'the simulation no longer exposes a shield bash');
});

test('Both weapon cooldowns and hand ownership save atomically without free ammunition',()=>{
  const sim=armed({}, {right:3,left:2});sim.step(.025,{fire:true,fireLeft:true});sim.selectLeftWeapon(1);sim.step(.025,{fireLeft:true});
  sim.state.bullets.push({x:0,y:1.25,z:-1,dx:0,dy:0,dz:20,life:1,damage:10});sim.step(.05);
  const saved=sim.snapshot(),resumed=FSimulation.create(sim.state.world);assert.equal(resumed.restore(saved),true);assert.deepEqual(json(resumed.snapshot()),json(saved));assert.equal(resumed.fire(),false);
  const carried=sim.exportLoadout(),next=FSimulation.create(arsenalWorld({stage:1}),carried);assert.equal(next.state.equipment.left,carried.equipment.left);assert.deepEqual(json(next.exportInventory()),json(sim.exportInventory()));
  for(const mutate of [q=>q.state.equipment.left=q.state.weapon,q=>q.state.equipment.left=9,q=>q.state.inventory.ammo[3]=17,q=>q.timers.weaponWait[3]=9,q=>q.state.projectiles[0].hand='middle',q=>q.state.inventory.weapons.splice(3,1)]){
    const bad=json(saved);mutate(bad);const unchanged=JSON.stringify(resumed.snapshot());assert.equal(resumed.restore(bad),false);assert.equal(JSON.stringify(resumed.snapshot()),unchanged);
  }
});

test('Grenade racks are physical, an old shield pickup stays inert and the workshop never sells one',()=>{
  const w=arsenalWorld({pickups:[{id:'legacy-shield',kind:'shield',amount:1,x:.5,y:0,z:0},{id:'grenade',kind:'weapon',weapon:3,amount:4,x:3,y:0,z:0},{id:'spares',kind:'ammo',weapon:3,amount:4,x:6,y:0,z:0}],shops:[{id:'shop',x:9,y:0,z:0}]}),profile={...FEconomy.fresh(),credits:1000},sim=FSimulation.create(w,{economy:profile});
  sim.step(.025);
  assert.equal(sim.state.inventory.shield,undefined);assert.equal(sim.state.pickups[0].taken,false,'a shield left in an old world is never collected');assert.equal(events(sim,'shieldPickup').length,0);assert.equal(sim.state.equipment.left,null);
  sim.move(sim.state.player,3,0);sim.step(.025);assert.equal(sim.state.weapon,3);assert.equal(sim.state.inventory.ammo[3],4);
  sim.state.inventory.ammo[3]=15;sim.move(sim.state.player,3,0);sim.step(.025);assert.equal(sim.state.inventory.ammo[3],16);assert.equal(sim.state.pickups[2].remaining,3);
  sim.move(sim.state.player,3,0);sim.step(.025);
  assert.equal(sim.shopOffers('shop').length,13);assert.equal(sim.shopOffers('shop').some(q=>q.item?.id==='shield'||q.id==='shield'),false);
  assert.equal(sim.buy('shop','shield').ok,false);assert.equal(sim.buy('shop','capacity').ok,true);assert.equal(sim.ammoCaps[3],20);assert.equal(sim.state.inventory.ammo[3],16);
  const saved=sim.snapshot(),restored=FSimulation.create(w);assert.equal(restored.restore(saved),true);assert.equal(restored.state.pickups[2].remaining,3);
});
