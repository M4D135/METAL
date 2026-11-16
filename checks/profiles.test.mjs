import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={window:{}};vm.createContext(context);
for(const name of ['fmath','passages','renderer','physics-geometry','profiles','world','destruction','economy','simulation'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context,{filename:name+'.js'});
const {FSimulation,FWorld,FEconomy,MetalProfiles,FDestruction}=context.window;
const plain=v=>JSON.parse(JSON.stringify(v));
const fixture=(extra={})=>({seed:'profiles-test',index:0,stage:0,generation:6,campaign:true,campaignVersion:2,profileVersion:1,progression:{version:1,weaponSlots:5,maxActive:4,startWeapons:[true,true,true,true,true],startAmmo:[60,12,6,8,1]},spawn:{x:0,z:0,yaw:0},bounds:{minX:-100,maxX:100,minZ:-100,maxZ:100},colliders:[],enemies:[],pickups:[],cores:[{id:0,x:85,z:85},{id:1,x:88,z:85},{id:2,x:91,z:85}],exit:{x:94,z:85},...extra});
const advance=(s,time,input={},fps=120)=>{for(let t=0;t<time-1e-9;t+=1/fps)s.step(Math.min(1/fps,time-t),typeof input==='function'?input(t):input);};
const event=(s,name)=>s.state.events.filter(e=>e.name===name);
// New expeditions start with the heavy; these scenarios start with the drone.
const droneFirst=()=>MetalProfiles.fresh(undefined,'light');

test('new expeditions start with the heavy, his drone parked one metre above his head',()=>{
 const sim=FSimulation.create(fixture()),s=sim.state;assert.equal(s.activeProfile,'heavy');assert.equal(MetalProfiles.fresh().active,'heavy');
 assert.deepEqual({...plain(MetalProfiles.position(s.player)),y:s.player.y+1,airborne:true},plain(s.profiles.light.position));advance(sim,.5,{});assert.equal(s.player.airborne,false,'the heavy stands on the ground');
 assert(sim.switchProfile());assert.equal(s.activeProfile,'light');assert.equal(s.player.y,1);assert(FSimulation.create(fixture()).restore(sim.snapshot()),'a drone just taken off restores');advance(sim,.5,{});assert(s.player.airborne,'the drone hovers');assert(Math.abs(s.player.y-1)<1e-9);
 // A low ceiling over the spawn keeps the parked drone below it.
 const low=FSimulation.create(fixture({colliders:[{minX:-3,maxX:3,minY:2.2,maxY:2.5,minZ:-3,maxZ:3}]}));assert(Math.abs(low.state.profiles.light.position.y-.4)<1e-9);
 assert.equal(FSimulation.create(fixture(),{profiles:droneFirst()}).state.player.y,0,'an active drone keeps its spawn');
});

test('switch preserves world, position, health, inventory and separate equipment; held input switches once',()=>{
 const sim=FSimulation.create(fixture(),{profiles:droneFirst()}),s=sim.state;assert.equal(s.activeProfile,'light');assert(sim.selectWeapon(1));assert(!sim.selectWeapon(3));s.player.hp=73;s.economy.credits=91;
 const before=plain({p:s.player,inventory:s.inventory,enemies:s.enemies});
 sim.step(0,{switchProfile:true,weapon:1});assert.equal(s.activeProfile,'heavy');assert.equal(s.weapon,4);assert.equal(s.economy.credits,0);assert.equal(s.profiles.light.economy.credits,91);assert.deepEqual(plain({p:s.player,inventory:s.inventory,enemies:s.enemies}),before);
 assert(sim.selectWeapon(3));assert(!sim.selectWeapon(1));sim.step(0,{switchProfile:true});assert.equal(s.activeProfile,'heavy');sim.step(0,{});sim.step(0,{switchProfile:true,weapon:4});assert.equal(s.activeProfile,'light');assert.equal(s.weapon,1);assert.equal(s.economy.credits,91);assert.equal(s.player.hp,73);
});

test('light flies without fuel consumption and heavy retains its free jump',()=>{
 for(const fps of [20,60,120]){const light=FSimulation.create(fixture(),{profiles:droneFirst()}),heavy=FSimulation.create(fixture());for(const sim of [light,heavy]){sim.step(1/fps,{jump:true,jumpHeld:true});advance(sim,.85,{jumpHeld:true},fps);}
 assert(light.state.player.y>3);assert.equal(light.state.jetpack.fuel,4);assert.equal(heavy.state.player.airborne,false);assert.equal(heavy.state.jetpack.fuel,4);
 light.switchProfile();const fuel=light.state.jetpack.fuel;advance(light,.2,{jumpHeld:true},fps);assert.equal(light.state.jetpack.fuel,fuel);assert.equal(light.state.jetpack.active,false);
 }
});

test('class snapshots restore both economies, held weapon, fuel and an ascending jetpack without mutating rejected saves',()=>{
 const world=fixture(),sim=FSimulation.create(world,{profiles:droneFirst()});sim.state.economy.credits=120;sim.selectWeapon(1);sim.switchProfile();sim.state.economy.credits=230;sim.selectWeapon(3);sim.switchProfile();sim.step(1/120,{jump:true,jumpHeld:true});advance(sim,.3,{jumpHeld:true});
 const snap=plain(sim.snapshot()),copy=FSimulation.create(world);assert(copy.restore(snap));assert.deepEqual(plain(copy.snapshot()),snap);
 for(const edit of [x=>x.state.profiles.classes.light.xp=-1,x=>x.state.profiles.jetpack.fuel=999,x=>x.state.profiles.classes.heavy.weapon=1,x=>x.state.economy.credits++,x=>delete x.state.profiles]){const bad=plain(snap);edit(bad);assert.equal(copy.restore(bad),false);assert.deepEqual(plain(copy.snapshot()),snap);}
 sim.step(1/120,{jumpHeld:true});copy.step(1/120,{jumpHeld:true});assert.deepEqual(plain(copy.snapshot()),plain(sim.snapshot()));
 const carry=FSimulation.create(world,sim.exportLoadout());for(const id of MetalProfiles.names){const a=plain(carry.exportProfiles().classes[id]),b=plain(sim.exportProfiles().classes[id]);delete a.position;delete b.position;assert.deepEqual(a,b);}assert.equal(carry.state.player.x,world.spawn.x);
});

test('projectile keeps its heavy origin through switch and save/restore',()=>{
 const world=fixture(),sim=FSimulation.create(world);sim.selectWeapon(3);assert(sim.fire());assert.equal(sim.state.projectiles[0].profile,'heavy');sim.switchProfile();
 const snap=plain(sim.snapshot()),copy=FSimulation.create(world);assert(copy.restore(snap));assert.equal(copy.state.projectiles[0].profile,'heavy');const bad=plain(snap);bad.state.projectiles[0].profile='light';assert(!copy.restore(bad));
});

test('only heavy player explosives breach walls; bullets and enemy blasts cannot bypass class gates',()=>{
 const mesh={shape:'box',p:[0,2,-3],s:[6,4,.6],mat:3},world=fixture({meshes:[mesh],destructibles:[{id:'wall',kind:'wall',profileRequired:'heavy',strength:18,meshes:[0],colliders:[0]}],colliders:[{minX:-3,maxX:3,minY:0,maxY:4,minZ:-3.3,maxZ:-2.7,mesh:0}]});
 for(const [source,allowed] of [[undefined,false],[{owner:'player',profile:'light'},false],[{owner:0,profile:'heavy'},false],[{owner:'player',profile:'heavy'},true]]){const d=FDestruction.create(world,{canDamage:MetalProfiles.canDamage});d.hit([0,2,-3],999,[0,0,-1],source);assert(d.isAlive('wall'));d.blast([0,2,-3],5,999,undefined,source);assert.equal(d.isAlive('wall'),!allowed);}
});

test('heavy automatic pistol is faster and class experience stays with the shooter',()=>{
 const counts=[];for(const profile of ['light','heavy']){const sim=FSimulation.create(fixture({enemies:[{type:0,x:0,z:-5}]}));if(profile==='light')sim.switchProfile();advance(sim,1.2,()=>{const e=sim.state.enemies[0],p=sim.state.player;p.yaw=Math.atan2(e.x-p.x,p.z-e.z);p.pitch=Math.atan2(e.y-(p.y+1.62),Math.hypot(e.x-p.x,e.z-p.z));return {fire:true};});counts.push(sim.state.shots);assert(sim.state.profiles[profile].xp>0);assert.equal(sim.state.profiles[profile==='heavy'?'light':'heavy'].xp,0);}
 assert(counts[1]>counts[0]);
});

test('each class owns its capacity upgrades while shared ammunition survives switching and saves',()=>{
 const profiles=MetalProfiles.fresh();profiles.classes.heavy.economy.upgrades.capacity=2;
 const sim=FSimulation.create(fixture(),{profiles,inventory:{weapons:[true,true,true,true,true],ammo:[60,12,18,24,1]}});assert.deepEqual(plain(sim.ammoCaps),[180,36,18,24,1]);sim.switchProfile();assert.deepEqual(plain(sim.ammoCaps),[180,36,18,24,1]);const copy=FSimulation.create(fixture());assert(copy.restore(sim.snapshot()));assert.deepEqual(plain(copy.ammoCaps),[180,36,18,24,1]);
});

test('generated class campaign adds both ordered locks and alternates boss requirements without changing legacy worlds',()=>{
 for(const index of [0,1,8,17]){const legacy=FWorld.create(96,index,{campaign:true,campaignVersion:2}),world=FWorld.create(96,index,{campaign:true,campaignVersion:2,profiles:true});assert.equal(legacy.profileVersion,undefined);assert.equal(world.profileVersion,1);assert(world.destructibles.find(g=>g.id==='profile-breach'));assert(world.mechanisms.find(m=>m.id==='profile-power'&&m.profileRequired==='light'));assert(world.doors.find(d=>d.id==='profile-door'&&d.requires==='profile-power'));assert(world.enemies.some(e=>e.bossScale>1&&e.profileRequired===(index%2?'heavy':'light')));const sim=FSimulation.create(world);assert(FSimulation.create(world).restore(sim.snapshot()));}
});

test('all eighteen generated corridors require heavy breach, light flight and relay activation in that order',()=>{
 for(let index=0;index<18;index++){
 const world=FWorld.create(96,index,{campaign:true,campaignVersion:2,profiles:true});
 world.enemies=[];world.encounters=[];world.spawn={...world.profileGoals.entry,yaw:Math.PI/2};
 const sim=FSimulation.create(world,{inventory:{weapons:[true,true,true,true,true],ammo:[60,12,6,8,1]},profiles:droneFirst()}),p=sim.state.player,wall=world.meshes.find(m=>m.category==='profile-breach'),relay=world.mechanisms.find(m=>m.id==='profile-power'),door=world.doors.find(d=>d.id==='profile-door');
 advance(sim,1.5,{moveY:1,jump:true,jumpHeld:true});assert(p.x<wall.p[0]-.5,'light flew over the breach');advance(sim,1.5,{});assert(!sim.state.dead);
 sim.switchProfile();sim.selectWeapon(3);advance(sim,.6,{moveY:-1});advance(sim,.5,{});p.pitch=0;assert(sim.fire());advance(sim,2.3,{});
 advance(sim,2,{moveY:1});assert(p.x>wall.p[0]+.6,`heavy did not open actual breach: ${p.x} vs ${wall.p[0]}`);
 // Approach the relay on the tunnel floor: a normal heavy jump is insufficient.
 p.x=relay.x;p.z=relay.z+1.4;p.y=relay.y-3.2;p.yaw=0;Object.assign(p,{airborne:false,airVX:0,airVY:0,airVZ:0,airTime:0});
 sim.step(1/120,{jump:true,jumpHeld:true});advance(sim,.3,{jumpHeld:true});assert.equal(sim.interact(),false);advance(sim,.5,{});
 sim.switchProfile();advance(sim,2,{descendHeld:true});advance(sim,.55,{jumpHeld:true});advance(sim,.4,{});for(let i=0;i<800&&Math.hypot(p.x-relay.x,p.z-relay.z-1.4)>.2;i++){const dx=relay.x-p.x,dz=relay.z+1.4-p.z;p.yaw=Math.atan2(dx,-dz);sim.step(1/120,{moveY:Math.min(1,Math.hypot(dx,dz)*3)});}advance(sim,.4,{});assert(Math.hypot(p.x-relay.x,p.z-relay.z-1.4)<.6,'light failed to fly through the heavy breach '+JSON.stringify({index,p:[p.x,p.y,p.z],relay:[relay.x,relay.y,relay.z],wall:wall.p}));sim.step(1/120,{jump:true,jumpHeld:true});let activated=false;
 for(let i=0;i<180&&!activated;i++){sim.step(1/120,{jumpHeld:true});const q=sim.nearestInteraction();if(q?.id===relay.id)activated=sim.interact();}
 assert(activated,'light could not reach the aerial relay');assert(sim.state.profiles.light.xp>=40);advance(sim,1.5,{});assert(sim.state.doors.find(d=>d.id===door.id).progress>.99);
 sim.switchProfile();assert.equal(sim.state.activeProfile,'heavy');assert.equal(sim.state.mechanisms.find(m=>m.id===relay.id).active,true);
 }
});

test('eighteen class bosses reject the wrong profile, route rewards to both banks, and carry their progression',()=>{
 let carry;
 for(let index=0;index<18;index++){
  const required=index%2?'heavy':'light',world=fixture({index,stage:index%3,spawn:{x:0,y:0,z:-24,yaw:Math.PI},walkable:[{x:0,y:0,z:0,w:200,d:200}],enemies:[{x:0,y:0,z:0,type:3,boss:true,bossScale:5.4,bossKind:'colossus',maxHp:600,arena:{x:0,y:0,z:0,r:28},deployed:true,profileRequired:required}]}),sim=FSimulation.create(world,carry),s=sim.state,e=s.enemies[0],p=s.player;
  const aim=()=>{const dx=e.x+Math.sin(e.yaw)*.9*e.bossScale-p.x,dz=e.z-Math.cos(e.yaw)*.9*e.bossScale-p.z;p.yaw=Math.atan2(dx,-dz);p.pitch=Math.atan2(e.baseY+1.93*e.bossScale-p.y-1.62,Math.hypot(dx,dz));};
  if(s.activeProfile===required)sim.switchProfile();e.hp=.01;sim.selectWeapon(4);aim();assert(sim.fire());assert.equal(e.hp,.01,'wrong class damaged boss');assert(event(sim,'profileBlocked').length);
  advance(sim,.4);sim.switchProfile();sim.selectWeapon(4);aim();assert(sim.fire());assert.equal(e.hp,0);assert(s.profiles[required].xp>=100);
  const q=s.loot[0];Object.assign(p,{x:q.x,y:q.y,z:q.z});sim.step(.025);assert(q.rewardTaken);
  const reward=FEconomy.bossReward(index),owner=MetalProfiles.owner(reward.weaponUpgrade,required);assert(s.profiles[owner].economy.weaponUpgrades[reward.weaponUpgrade]>0);assert(s.profiles[required].economy.upgrades[reward.personalUpgrade]>0);
  const saved=sim.snapshot(),copy=FSimulation.create(world);assert(copy.restore(saved),'reward restore '+index);assert.deepEqual(plain(copy.exportLoadout()),plain(sim.exportLoadout()));
  carry=sim.exportLoadout();assert(FSimulation.create(world,carry));
 }
 assert(carry.profiles.classes.light.xp>0&&carry.profiles.classes.heavy.xp>0);
});

test('switching upgraded vitality preserves integrity percentage without healing by repeated switches',()=>{
 const profiles=MetalProfiles.fresh();profiles.classes.light.economy.upgrades.vitality=2;const sim=FSimulation.create(fixture(),{profiles});sim.state.player.hp=sim.state.maxHp*.57;
 for(let i=0;i<100;i++){sim.switchProfile();assert(Math.abs(sim.state.player.hp/sim.state.maxHp-.57)<1e-12);}
});

test('each character stays at its own location; switching and checkpoint restore retain both positions',()=>{
 const world=fixture(),sim=FSimulation.create(world,{profiles:droneFirst()});advance(sim,1,{moveY:1});advance(sim,.5,{});const light=plain(MetalProfiles.position(sim.state.player)),elapsed=sim.state.elapsed;
 sim.switchProfile();assert.equal(sim.state.player.z,0);assert.equal(sim.state.elapsed,elapsed);advance(sim,1,{moveX:1});advance(sim,.5,{});const heavy=plain(MetalProfiles.position(sim.state.player));assert(heavy.x>3);
 sim.switchProfile();assert.deepEqual(plain(MetalProfiles.position(sim.state.player)),light);sim.switchProfile();assert.deepEqual(plain(MetalProfiles.position(sim.state.player)),heavy);
 const saved=plain(sim.snapshot()),copy=FSimulation.create(world);assert(copy.restore(saved));copy.switchProfile();assert.deepEqual(plain(MetalProfiles.position(copy.state.player)),light);copy.switchProfile();assert.deepEqual(plain(MetalProfiles.position(copy.state.player)),heavy);
 const bad=plain(saved);bad.state.profiles.classes.light.position.x=10000;assert(!copy.restore(bad));assert.deepEqual(plain(copy.snapshot()),saved);
});

test('partner marker reports distance, elevation and a bounded direction for targets ahead and behind',()=>{
 const player={x:0,y:0,z:0,yaw:0,pitch:0},screen={width:390,height:844,fov:75};
 const ahead=MetalProfiles.marker(player,{x:0,y:0,z:-10},screen);assert.equal(ahead.distance,10);assert.equal(ahead.offscreen,false);assert.equal(ahead.x,195);
 const high=MetalProfiles.marker(player,{x:3,y:4,z:0},screen);assert.equal(high.distance,5);assert.equal(high.height,4);
 for(const target of [{x:20,y:0,z:10},{x:-20,y:0,z:10},{x:0,y:30,z:-10},{x:0,y:-30,z:-10}]){const q=MetalProfiles.marker(player,target,screen);assert(q.offscreen);assert(q.x>=60&&q.x<=330&&q.y>=100&&q.y<=724);}
});

test('the heavy class breaches relief and retaining walls; floors and mandatory locks stay protected',()=>{const piece=category=>({kind:'prop',active:[{mesh:{category}}]}),heavy={owner:'player',profile:'heavy'},light={owner:'player',profile:'light'};for(const category of ['boundary','hill','cliff','cliff_stratum']){const g=piece(category);assert.equal(MetalProfiles.canDamage(g,true,heavy),false);assert.equal(MetalProfiles.canDamage(g,false,light),false);assert.equal(MetalProfiles.canDamage(g,false,heavy),true);}assert.equal(MetalProfiles.canDamage(piece('trail'),false,heavy),false);assert.equal(MetalProfiles.canDamage({profileProtected:true},false,heavy),false);assert.equal(MetalProfiles.canDamage({kind:'support',bounds:{minX:0,maxX:.2,minZ:0,maxZ:.2}},true,light),true);});
