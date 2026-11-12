import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=fileURLToPath(new URL('../',import.meta.url)),context={window:{}};
vm.createContext(context);
for(const name of ['destruction','economy','simulation'])vm.runInContext(readFileSync(root+'src/'+name+'.js','utf8'),context,{filename:name+'.js'});
const {FSimulation,FEconomy}=context.window,json=value=>JSON.parse(JSON.stringify(value));
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} should equal ${b}`);
function world(extra={}){
  return {seed:'armor',stage:0,generation:6,spawn:{x:0,y:0,z:0,yaw:0},bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40},
    walkable:[{x:0,y:0,z:0,w:80,d:80}],meshes:[],lights:[],colliders:[],enemies:[],pickups:[],cores:[{x:25,z:25},{x:28,z:25},{x:31,z:25}],exit:{x:34,z:25},
    progression:{version:1,weaponSlots:4,startWeapons:[true,false,false,false],startAmmo:[48,0,0,0],startShield:false,ammoCaps:[180,36,12,16],maxActive:8},...extra};
}
function campaignWorld(extra={}){return world({campaign:true,index:0,chapter:0,progression:{version:1,weaponSlots:5,startWeapons:[false,false,false,false,true],startAmmo:[0,0,0,0,1],startShield:false,ammoCaps:[180,36,12,16,1],maxActive:4},...extra});}
const inventory=(shield=true)=>({weapons:[true,true,true,true],ammo:[100,12,4,6],shield});
function armored(w=world(),options={}){return FSimulation.create(w,{armorSystem:true,...options});}
function advance(sim,seconds,input={}){for(let t=0;t<seconds-1e-8;t+=.025)sim.step(Math.min(.025,seconds-t),input);}
function bullet(sim,damage=30,input={}){sim.state.bullets.push({x:0,y:1.25,z:-1,dx:0,dy:0,dz:20,life:1,damage});sim.step(.05,input);}
function aim(sim,e){const p=sim.state.player,dx=e.x-p.x,dz=e.z-p.z;p.yaw=Math.atan2(dx,-dz);p.pitch=Math.atan2(e.y-(p.y+1.62),Math.hypot(dx,dz));}
function killByShooting(sim,e){
  for(let i=0;i<180&&e.hp>0;i++){
    e.cooldown=30;aim(sim,e);sim.fire();advance(sim,.22);if(sim.state.player.overheated)advance(sim,2.5);
  }
  assert.equal(e.hp,0,'Normal weapon damage must kill the target');
}
const events=(sim,name)=>sim.state.events.filter(e=>e.name===name);

test('Armor is automatic in campaign, opt-in in classic, and absent from unchanged legacy data',()=>{
  const legacy=FSimulation.create(world());assert.equal(legacy.state.armor,undefined);assert.equal(legacy.snapshot().armorVersion,undefined);assert.equal(legacy.exportLoadout().armor,undefined);
  legacy.hurt(30);assert.equal(legacy.state.player.hp,70);
  const classic=armored();assert.deepEqual(json(classic.state.armor),{points:0,capacity:100});assert.equal(classic.snapshot().armorVersion,1);
  assert.deepEqual(json(FSimulation.create(campaignWorld()).state.armor),{points:0,capacity:100});
  const carried=FSimulation.create(world(),{armor:{version:1,points:37.25}});assert.equal(carried.state.armor.points,37.25);
  for(const profile of [null,{version:2,points:0},{version:1,points:-1},{version:1,points:201},{version:1,points:Infinity},{version:1,points:NaN},{version:1,points:20,refill:true}]){
    assert.equal(FSimulation.copyArmor(profile),null);assert.throws(()=>armored(world(),{armor:profile}));
  }
  assert.throws(()=>armored(world(),{armor:{version:1,points:101}}),'Without an equipped shield the initial cap is 100');
  assert.deepEqual(json(FSimulation.copyArmor({version:1,points:137.5})),{version:1,points:137.5});
});

test('Shield equipment changes only capacity; switching hands clamps excess and never refills',()=>{
  const w=world({pickups:[{id:'armor',kind:'armor',amount:50,x:3,y:0,z:0}]}),sim=armored(w,{inventory:inventory(),armor:{version:1,points:80}});
  assert.equal(sim.state.armor.capacity,100,'Owning a shield alone gives no capacity bonus');
  assert.equal(sim.selectLeftWeapon('shield'),true);assert.deepEqual(json(sim.state.armor),{points:80,capacity:200});
  sim.move(sim.state.player,3,0);sim.step(.025);assert.equal(sim.state.armor.points,130);assert.equal(sim.state.pickups[0].taken,true);
  sim.selectLeftWeapon(1);assert.deepEqual(json(sim.state.armor),{points:100,capacity:100});
  sim.selectLeftWeapon('shield');assert.deepEqual(json(sim.state.armor),{points:100,capacity:200});sim.selectWeapon(2);assert.equal(sim.state.armor.points,100);
  sim.selectLeftWeapon(null);sim.selectLeftWeapon('shield');assert.equal(sim.state.armor.points,100);
  const noShield=armored();assert.equal(noShield.selectLeftWeapon('shield'),false);assert.equal(noShield.state.armor.capacity,100);
});

test('Real bullets consume one third of residual damage after passive armor and frontal guard',()=>{
  const economy=FEconomy.fresh();economy.upgrades.armor=1;
  const sim=armored(world(),{inventory:inventory(),equipment:{right:0,left:'shield',shieldEnergy:100},economy,armor:{version:1,points:90}});
  bullet(sim,30,{fireLeft:true});
  const residual=30*.92*.2;
  near(sim.state.armor.points,90-residual/3);near(sim.state.player.hp,100-residual*2/3);
  assert.equal(events(sim,'shieldBlock').length,1);assert(sim.state.shield.energy<67&&sim.state.shield.energy>66,'Guard energy remains a separate consumed resource');
  const ungarded=armored(world(),{armor:{version:1,points:30}});bullet(ungarded);near(ungarded.state.armor.points,20);near(ungarded.state.player.hp,80);
  const exhausted=armored(world(),{armor:{version:1,points:2}});bullet(exhausted);near(exhausted.state.armor.points,0);near(exhausted.state.player.hp,72);
});

test('Invulnerability never spends armor and fatal falling bypasses both armor and guard',()=>{
  const sim=armored(world(),{armor:{version:1,points:50}});sim.step(.025,{dash:true});sim.hurt(30);assert.equal(sim.state.armor.points,50);assert.equal(sim.state.player.hp,100);
  const saved=armored(world(),{armor:{version:1,points:50}}).snapshot(),restored=armored();assert.equal(restored.restore(saved,{recover:true}),true);restored.hurt(30);assert.equal(restored.state.armor.points,50);
  const falling=armored(world({walkable:[{x:0,y:6.4,z:0,w:2,d:2},{x:0,y:-.25,z:0,w:80,d:80,substrate:true}],spawn:{x:0,y:6.4,z:0,yaw:0}}),{inventory:inventory(),equipment:{right:0,left:'shield',shieldEnergy:100},armor:{version:1,points:200}});
  falling.move(falling.state.player,2,0);assert.equal(falling.state.player.airborne,true);advance(falling,2,{fireLeft:true});
  assert.equal(falling.state.dead,true);assert.equal(falling.state.player.hp,0);assert.equal(falling.state.armor.points,200);assert.deepEqual(json(events(falling,'dead')),[{name:'dead',reason:'fall'}]);
});

test('Physical armor pickups retain overflow, fractional remainder and exact checkpoint state',()=>{
  const w=world({pickups:[{id:'armor',kind:'armor',amount:25,x:.4,y:0,z:0}]}),sim=armored(w,{armor:{version:1,points:95}});
  sim.step(.025);assert.equal(sim.state.armor.points,100);assert.equal(sim.state.pickups[0].remaining,20);assert.equal(sim.state.pickups[0].taken,false);assert.equal(events(sim,'armorPickup')[0].amount,5);
  sim.hurt(10);sim.step(.025);near(sim.state.armor.points,100);near(sim.state.pickups[0].remaining,20-10/3);
  const saved=sim.snapshot(),restored=armored(w);assert.equal(restored.restore(saved),true);assert.deepEqual(json(restored.snapshot()),json(saved));
  advance(restored,1);near(restored.state.pickups[0].remaining,20-10/3);assert.equal(events(restored,'armorPickup').length,0,'Restoration and a full pool cannot consume or recreate armor');
  sim.move(sim.state.player,3,0);sim.hurt(10);assert(sim.state.armor.points<100);sim.step(.025);assert(sim.state.armor.points<100,'A distant item cannot heal armor');
});

test('Armor collection obeys wall and floor occlusion, and inactive legacy modes ignore new item kinds',()=>{
  const w=world({colliders:[{minX:.35,maxX:.45,minY:0,maxY:3,minZ:-1,maxZ:1}],pickups:[{id:'behind',kind:'armor',amount:25,x:.8,y:0,z:0},{id:'upstairs',kind:'armor',amount:50,x:0,y:3.2,z:0}]}),sim=armored(w);
  sim.step(.025);assert.equal(sim.state.armor.points,0);assert(sim.state.pickups.every(q=>!q.taken));
  sim.move(sim.state.player,0,2);sim.move(sim.state.player,.8,0);sim.move(sim.state.player,0,-2);sim.step(.025);assert.equal(sim.state.armor.points,25);assert.equal(sim.state.pickups[1].taken,false);
  const inactive=FSimulation.create(world({pickups:[{id:'ignored',kind:'armor',amount:25,x:0,y:0,z:0}]}));inactive.step(.025);assert.equal(inactive.state.pickups[0].taken,false);
});

test('Purchases, upgrades, health pickups and guard recharge do not refill armor',()=>{
  const economy={...FEconomy.fresh(),credits:5000,cores:5},w=world({shops:[{id:'shop',x:0,y:0,z:0}],pickups:[{id:'health',kind:'health',amount:35,x:0,y:0,z:0}]}),sim=armored(w,{economy,armor:{version:1,points:31},equipment:{right:0,left:null,shieldEnergy:37}});
  sim.hurt(30);const points=sim.state.armor.points;
  for(const item of ['shield','armor','capacity','vitality','repair','power','cooling']){assert.equal(sim.buy('shop',item).ok,true,item);assert.equal(sim.state.armor.points,points,item+' cannot refill armor');}
  assert.equal(sim.state.armor.capacity,200);assert.equal(sim.state.shield.energy,37);advance(sim,5);assert.equal(sim.state.armor.points,points);assert(sim.state.shield.energy>37);assert.equal(sim.state.player.hp,120);
});

test('Entry loadouts and mid-level checkpoints preserve fractional armor without granting refills',()=>{
  const sim=armored(world(),{inventory:inventory(),equipment:{right:0,left:'shield',shieldEnergy:38.5},armor:{version:1,points:137.25}}),entry=sim.exportLoadout();
  sim.hurt(14);const saved=sim.snapshot(),restored=armored(world());assert.equal(restored.restore(saved),true);assert.deepEqual(json(restored.snapshot()),json(saved));
  const carried=sim.exportLoadout(),next=FSimulation.create(world({stage:1}),carried);assert.deepEqual(json(next.exportLoadout()),json(carried));
  const restarted=FSimulation.create(world(),entry);assert.equal(restarted.state.armor.points,137.25);assert.equal(restarted.state.shield.energy,38.5);
  carried.armor.points=0;assert(next.state.armor.points>100,'Loadout copies must not alias each other');
  for(const mutate of [q=>q.armorVersion=2,q=>q.state.armor.points=-1,q=>q.state.armor.points=201,q=>q.state.armor.points=null,q=>q.state.armor.capacity=100,q=>q.state.armor.free=100,q=>delete q.state.armor]){
    const bad=json(saved);mutate(bad);const before=JSON.stringify(restored.snapshot());assert.equal(restored.restore(bad),false);assert.equal(JSON.stringify(restored.snapshot()),before);
  }
  assert.equal(FSimulation.create(world()).restore(saved),false,'Unenabled legacy APIs must not silently discard a new armor reserve');
});

test('Real enemy kills drop deterministic armor on the floor; partial loot is persistent and collected only once',()=>{
  const w=world({enemies:[{x:0,y:0,z:-6,type:0,drop:false}]}),sim=armored(w,{inventory:inventory(),armor:{version:1,points:95}});
  killByShooting(sim,sim.state.enemies[0]);assert.equal(sim.state.loot.length,1);const loot=sim.state.loot[0];assert.equal(loot.armor,10);assert.equal(loot.y,sim.ground(loot.x,loot.z));assert.equal(sim.state.armor.points,95,'Killing does not award armor at a distance');
  sim.move(sim.state.player,loot.x-sim.state.player.x,loot.z-sim.state.player.z);sim.step(.025);assert.equal(sim.state.armor.points,100);assert.equal(loot.armor,5);assert.equal(loot.taken,false);assert.equal(events(sim,'lootPickup').at(-1).armor,5);
  sim.hurt(4);sim.step(.025);near(loot.armor,5-4/3);const saved=sim.snapshot(),resumed=armored(w);assert.equal(resumed.restore(saved),true);assert.deepEqual(json(resumed.snapshot()),json(saved));
  resumed.selectLeftWeapon('shield');resumed.step(.025);near(resumed.state.armor.points,100+5-4/3);assert.equal(resumed.state.loot[0].armor,0);assert.equal(resumed.state.loot[0].taken,true);const points=resumed.state.armor.points;advance(resumed,1);assert.equal(resumed.state.armor.points,points);
  for(const mutate of [q=>q.state.loot[0].armor=11,q=>delete q.state.loot[0].armor,q=>q.state.loot[0].armor=-1,q=>q.state.loot[0].taken=true]){
    const bad=json(saved);mutate(bad);assert.equal(resumed.restore(bad),false);
  }
});

test('Old classic checkpoints restore at zero armor and never retroactively reward already dead enemies',()=>{
  const w=world({enemies:[{x:0,y:0,z:-6,type:0,drop:false},{x:15,y:0,z:-6,type:0,drop:false},{x:18,y:0,z:-6,type:0,drop:false},{x:21,y:0,z:-6,type:0,drop:false},{x:24,y:0,z:-6,type:0,drop:false}]}),legacy=FSimulation.create(w);
  legacy.state.enemies.forEach(e=>{e.cooldown=30;});killByShooting(legacy,legacy.state.enemies[0]);const saved=legacy.snapshot();assert.equal(saved.armorVersion,undefined);assert.equal(saved.state.loot[0].armor,undefined);
  const resumed=armored(w,{armor:{version:1,points:70}});assert.equal(resumed.restore(saved),true);assert.equal(resumed.state.armor.points,0);assert.equal(resumed.state.loot[0].armor,0);
  const oldLoot=resumed.state.loot[0];resumed.move(resumed.state.player,oldLoot.x,oldLoot.z);resumed.step(.025);assert.equal(resumed.state.armor.points,0);assert.equal(oldLoot.taken,true);
  killByShooting(resumed,resumed.state.enemies[4]);assert.equal(resumed.state.loot.find(q=>q.sourceEnemy===4).armor,10,'Only a new kill can create the new reward');
  const upgraded=resumed.snapshot(),again=armored(w);assert.equal(again.restore(upgraded),true);assert.equal(again.state.loot.find(q=>q.sourceEnemy===0).armor,0);
});

test('Armor pickup overflow also survives old non-progression API snapshots without introducing inventory fields',()=>{
  const w=world({progression:undefined,pickups:[{id:'armor',kind:'armor',amount:25,x:0,y:0,z:0}]}),sim=armored(w,{armor:{version:1,points:97.5}});sim.step(.025);
  const saved=sim.snapshot();assert.equal(saved.state.inventory,undefined);assert.equal(saved.state.armorPickupRemaining[0],22.5);
  const resumed=armored(w);assert.equal(resumed.restore(saved),true);assert.deepEqual(json(resumed.snapshot()),json(saved));resumed.step(.025);assert.equal(resumed.state.pickups[0].remaining,22.5);
  const legacy=FSimulation.create(w),old=legacy.snapshot();assert.equal(resumed.restore(old),true);assert.equal(resumed.state.armor.points,0);
});

test('A giant boss drops fifty armor in its physical salvage without granting an immediate refill',()=>{
  const w=world({enemies:[{x:0,y:0,z:-10,type:3,bossScale:2,bossKind:'colossus',bossName:'Test',maxHp:30,arena:{x:0,y:0,z:-10,r:28}}]}),sim=armored(w,{inventory:inventory(),equipment:{right:0,left:'shield',shieldEnergy:100},armor:{version:1,points:150}}),boss=sim.state.enemies[0];
  // A wounded-boss fixture isolates the final actual shot and its death reward.
  boss.hp=.2;aim(sim,boss);sim.fire();assert.equal(boss.hp,0);assert.equal(sim.state.loot[0].armor,50);assert.equal(sim.state.armor.points,150);
  const loot=sim.state.loot[0];sim.move(sim.state.player,loot.x,loot.z);sim.step(.025);assert.equal(sim.state.armor.points,200);assert.equal(sim.state.loot[0].armor,0);
  const resumed=armored(w);assert.equal(resumed.restore(sim.snapshot()),true);resumed.step(.025);assert.equal(resumed.state.armor.points,200);
});
