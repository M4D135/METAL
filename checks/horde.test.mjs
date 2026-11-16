// Hordes, kamikazes, liquid blades and ammunition before hordes and bosses
// (David, 16/11/2026). World content is an opt-in revision (hordeVersion 1).
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const ctx={window:{},TextEncoder,TextDecoder};vm.createContext(ctx);
for(const n of ['fmath','passages','renderer','profiles','world','destruction','economy','simulation','demo','pilot','demo-metal'])vm.runInContext(readFileSync(new URL('../src/'+n+'.js',import.meta.url),'utf8'),ctx,{filename:n+'.js'});
const {FWorld:W,FSimulation:S,MetalDemo:D}=ctx.window;
const make=(index,horde=true)=>W.create(96,index,{campaign:true,campaignVersion:2,combatVersion:1,profiles:true,...(horde?{hordeVersion:1}:{})});
const worlds=new Map(),world=(index,horde=true)=>{const key=index+':'+horde;if(!worlds.has(key))worlds.set(key,make(index,horde));return worlds.get(key);};
const plain=v=>JSON.parse(JSON.stringify(v)),names=sim=>{const out=sim.state.events.map(e=>e.name);sim.state.events.length=0;return out;};

test('Hordes are opt-in: an earlier save regenerates the same world without them',()=>{
  const old=world(0,false),now=world(0,true);
  assert.equal(old.hordeVersion,undefined);assert.equal(now.hordeVersion,1);
  assert(!old.encounters.some(q=>q.horde));assert(!old.enemies.some(e=>e.variant||e.livery!==undefined||e.bossLook));
  assert(now.encounters.some(q=>q.horde));assert(now.enemies.some(e=>e.variant==='endo'));
});

test('Each world has one horde after its largest deep room: kamikazes, blades and endoskeleton gunners, the guardian stays last',()=>{
  for(const [index,waves] of [[0,3],[8,4],[17,5]]){
    const w=world(index),q=w.encounters.find(q=>q.horde),base=w.encounters.find(c=>c.id===q.after),boss=w.enemies[w.enemies.length-1];
    assert(q&&base&&base.zoneId===q.zoneId,'the horde follows the regular fight of the same room');
    assert.equal(q.waves.length,waves);assert.equal(q.label,'Déferlante');assert(q.maxActive>=12);
    const roster=q.waves.flatMap(v=>v.enemyIds).map(id=>w.enemies[id]);
    assert(roster.every(e=>e.type===1&&e.deployed===false&&e.horde&&['kamikaze','blade','endo'].includes(e.variant)));
    assert(roster.filter(e=>e.variant==='kamikaze').length>roster.length/2,'mostly kamikazes');
    assert(q.waves.slice(1).every(v=>v.enemyIds.some(id=>w.enemies[id].variant==='blade')),'blades from the second wave on');
    assert(boss.boss&&boss.type===3);for(const e of w.enemies.filter(e=>e.bossWave))assert.equal(e.bossId,w.enemies.length-1);
    assert.equal(w.campaignProfile.garrison,w.enemies.length);assert.equal(w.campaignProfile.horde.enemies,roster.length);
    // The horde never waits on a door: entries along the room's own walls.
    const room=w.rooms[q.zoneId];assert(q.spawnEntries.filter(p=>Math.abs(p.x-room.x)<room.w/2&&Math.abs(p.z-room.z)<room.d/2).length>=8);
  }
});

test('Large ammunition caches wait in the horde room and at the guardian gate; the arena holds twice the ammunition',()=>{
  for(const index of [0,8,17]){
    const w=world(index),old=world(index,false),q=w.encounters.find(q=>q.horde),caches=w.pickups.filter(p=>String(p.id).startsWith('cache-'));
    for(const label of ['horde-a','horde-b','gate'])assert.equal(caches.filter(p=>p.id.startsWith('cache-'+label+'-')).map(p=>p.weapon).sort().join(),'0,1,2,3',label);
    assert(caches.filter(p=>p.id.startsWith('cache-horde')).every(p=>p.zoneId===q.zoneId&&p.kind==='ammo'&&p.amount>=6));
    // Worlds whose arena holds its supply corners carry twice as much.
    for(const id of ['boss-cells-wn','boss-shells-es','boss-rockets-en']){const a=w.pickups.find(p=>String(p.id).endsWith(id)),b=old.pickups.find(p=>String(p.id).endsWith(id));assert.equal(!!a,!!b,id);if(a)assert(a.amount>b.amount&&a.amount>=1.6*b.amount,id+' '+a.amount+'/'+b.amount);}
    if(index)assert(w.pickups.some(p=>String(p.id).endsWith('boss-cells-wn')));
  }
});

test('Guardians alternate between the robot, the chrome endoskeleton and liquid metal, with their own names; chapters dress their machines',()=>{
  assert.equal(world(0).enemies.at(-1).bossLook,undefined);
  for(const [index,look] of [[8,'liquid'],[17,'liquid']]){const boss=world(index).enemies.at(-1);assert.equal(boss.bossLook,look);assert(/Vif-Argent|Mercure|Métal liquide/.test(boss.bossName));}
  const w=world(8);assert(w.enemies.filter(e=>!e.boss).every(e=>e.livery===w.chapter),'every machine of the chapter');assert(world(0).enemies.every(e=>e.livery===undefined));
});

function arena(enemies){return {seed:96,stage:0,generation:6,spawn:{x:0,y:0,z:10,yaw:0},bounds:{minX:-32,maxX:32,minZ:-32,maxZ:32},walkable:[{x:0,y:0,z:0,w:64,d:64}],colliders:[],meshes:[],lights:[],enemies,cores:[{id:0,x:-28,y:0,z:28},{id:1,x:-26,y:0,z:28},{id:2,x:-24,y:0,z:28}],pickups:[],exit:{x:28,y:0,z:28}};}

test('A kamikaze sprints at the player screaming and blows up on contact',()=>{
  const sim=S.create(arena([{x:0,y:0,z:-6,type:1,variant:'kamikaze'}])),e=sim.state.enemies[0],p=sim.state.player;
  assert.equal(e.maxHp,2);const seen=new Set();let fastest=0,before=e.z;
  for(let i=0;i<600&&e.hp>0;i++){sim.step(1/60);for(const n of names(sim))seen.add(n);fastest=Math.max(fastest,(e.z-before)*60);before=e.z;}
  assert(seen.has('kamikazeScream')&&seen.has('explosion')&&seen.has('hurt')&&seen.has('kill'));
  assert.equal(e.hp,0);assert(p.hp<100,'the blast hurts the player');assert(fastest>4.5,'it runs faster than a walk: '+fastest.toFixed(2));
  assert.equal(sim.state.kills,1);assert.equal(sim.state.score,0,'its own blast scores nothing');sim.dispose?.();
});

test('Shooting a kamikaze blows up the crowd around it, credited to the player',()=>{
  const sim=S.create(arena([{x:0,y:0,z:-8,yaw:0,type:1,variant:'kamikaze'},{x:1.4,y:0,z:-8,yaw:0,type:1,variant:'kamikaze'},{x:-1.4,y:0,z:-8.6,yaw:0,type:1,variant:'kamikaze'}])),p=sim.state.player,[a,b,c]=sim.state.enemies;
  p.z=6;p.yaw=0;p.pitch=Math.atan2(1.1-1.62,14);
  for(let i=0;i<40&&a.hp>0;i++){sim.fire();sim.step(1/60);names(sim);}
  assert.equal(a.hp,0);assert.equal(b.hp,0,'the neighbour caught the blast');assert.equal(c.hp,0);
  assert.equal(sim.state.kills,3);assert(sim.state.score>0);assert.equal(p.hp,100,'far enough to be safe');sim.dispose?.();
});

test('A liquid blade telegraphs its slash, then strikes within reach',()=>{
  const sim=S.create(arena([{x:0,y:0,z:7.6,type:1,variant:'blade'}])),e=sim.state.enemies[0],p=sim.state.player;assert.equal(e.maxHp,7);
  let windup=-1,strike=-1;
  for(let i=0;i<300&&strike<0;i++){sim.step(1/60);const n=names(sim);if(e.windup>0&&windup<0)windup=i;if(n.includes('bladeStrike'))strike=i;}
  assert(windup>=0&&strike>windup,'wind-up before the strike');assert((strike-windup)/60>=.35,'visible for at least 0.35 s');assert(p.hp<100);sim.dispose?.();
});

test('A horde pours in wave after wave once its room is cleared, without waiting for a door',()=>{
  const w=make(0),sim=S.create(w,D.loadout(0,'heavy'));sim.setDifficulty(0);
  const q=sim.state.encounters.find(q=>q.horde),base=sim.state.encounters.find(c=>c.id===q.after),p=sim.state.player;
  // The room's own fight ends as in play: every machine deployed, then
  // destroyed by a blast, so that its salvage drops like any kill.
  let serial=500;for(const v of base.waves)for(const id of v.enemyIds){const e=sim.state.enemies[id];e.deployed=true;e.encounterReleased=true;sim.state.projectiles.push({id:++serial,kind:'grenade',owner:'player',x:e.x,y:e.baseY+1,z:e.z,vx:0,vy:0,vz:0,age:0,life:4,fuse:.001,radius:.17,blastRadius:2,damage:400,terrainPower:0,travel:0,bounces:0,resting:true,profile:sim.state.activeProfile});sim.state.shots++;}
  sim.step(1/60);names(sim);assert(base.waves.every(v=>v.enemyIds.every(id=>sim.state.enemies[id].hp===0)),'the room is cleared');
  p.x=q.trigger.x;p.z=q.trigger.z;p.y=q.trigger.y||0;
  const count={};let checkpoint=null;
  for(let i=0;i<60*70&&q.status!=='cleared';i++){
    p.hp=100;sim.state.dead=false;
    if(i%20===0){const near=sim.state.enemies.filter(e=>e.hp>0&&e.deployed!==false&&e.horde).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];if(near){p.yaw=Math.atan2(near.x-p.x,p.z-near.z);p.pitch=Math.atan2(near.baseY+1.1-(p.y+1.62),Math.hypot(near.x-p.x,near.z-p.z));sim.fire();}}
    sim.step(1/60);for(const n of names(sim))count[n]=(count[n]||0)+1;
    if(!checkpoint&&q.wave>=1&&sim.state.enemies.some(e=>e.horde&&e.hp>0&&e.deployed))checkpoint=sim.snapshot();
  }
  assert(count.waveStart>=3,'three waves announced: '+count.waveStart);assert(count.hordeSpawn>=15);assert(count.kamikazeScream>=3);
  assert(checkpoint,'a mid-horde checkpoint');const copy=S.create(w,D.loadout(0,'heavy'));assert(copy.restore(checkpoint));assert.deepEqual(plain(copy.snapshot()),plain(checkpoint));
  assert.equal(checkpoint.hordeVersion,1);sim.dispose?.();copy.dispose?.();
});

test('Every boss phase drops four full crates in horde worlds',()=>{
  // The arena of combat-balance.test.mjs, in a horde world.
  const world={seed:96,stage:0,index:0,chapter:0,campaign:true,campaignVersion:2,combatVersion:1,hordeVersion:1,generation:6,spawn:{x:0,y:0,z:-24,yaw:Math.PI},bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},walkable:[{x:0,y:0,z:0,w:120,d:120}],meshes:[],lights:[],colliders:[],pickups:[],trophies:[],cores:[{x:45,y:0,z:45},{x:48,y:0,z:45},{x:51,y:0,z:45}],exit:{x:54,y:0,z:45},enemies:[{x:0,y:0,z:0,type:3,boss:true,bossScale:5.4,bossKind:'colossus',maxHp:250,arena:{x:0,y:0,z:0,r:28},deployed:true}],progression:{version:1,weaponSlots:5,startWeapons:[true,true,true,true,true],startAmmo:[10,36,0,16,1],ammoCaps:[180,36,12,16,1],maxActive:8}};
  const sim=S.create(world);sim.step(1/60);const e=sim.state.enemies[0];e.hp=e.maxHp*.65;sim.step(1/60);
  let crates=sim.state.loot.filter(q=>q.kind==='resupply');assert.equal(crates.length,4);
  assert(crates.every(q=>q.ammo.filter(Boolean).length===1&&q.ammo.every((n,i)=>n<=[120,24,8,12,0][i])));assert(crates.some(q=>q.ammo[0]===120));
  e.hp=e.maxHp*.3;sim.step(1/60);assert.equal(sim.state.loot.filter(q=>q.kind==='resupply').length,8);
  const point=sim.snapshot(),copy=S.create(world);assert(copy.restore(point));assert.deepEqual(plain(copy.snapshot()),plain(point));
  const bad=JSON.parse(JSON.stringify(point));bad.state.loot[0].ammo[0]=121;assert.equal(copy.restore(bad),false);
});
