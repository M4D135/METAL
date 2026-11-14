import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const context={window:{}};vm.createContext(context);
for(const name of ['destruction','economy','simulation'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context,{filename:name+'.js'});
const {FSimulation:S,FEconomy:E}=context.window,plain=v=>JSON.parse(JSON.stringify(v));
const HP=[600,850,1200,1550,1900,2400,2900,3400,4000,4650,5300,6050,6850,7700,8600,9600,10800,12000];
function world(index=0,extra={}){
  const stage=index%3,arena={x:0,y:0,z:0,r:28};
  return {seed:'boss-rewards',stage,index,chapter:Math.floor(index/3),campaign:true,campaignVersion:2,generation:6,
    spawn:{x:0,y:0,z:-24,yaw:Math.PI},bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},walkable:[{x:0,y:0,z:0,w:120,d:120}],meshes:[],lights:[],colliders:[],pickups:[],trophies:[],
    cores:[{x:45,y:0,z:45},{x:48,y:0,z:45},{x:51,y:0,z:45}],exit:{x:54,y:0,z:45},
    enemies:[{x:0,y:0,z:0,type:3,boss:true,bossScale:[5.4,7.2,9][stage],bossKind:['colossus','siegebreaker','custodian'][stage],maxHp:HP[index],arena,deployed:true}],
    progression:{version:1,weaponSlots:5,startWeapons:[false,false,false,false,true],startAmmo:[0,0,0,0,1],ammoCaps:[180,36,12,16,1],maxActive:[6,8,10,12,14,16][Math.floor(index/3)]},...extra};
}
function aimCore(sim){const e=sim.state.enemies[0],p=sim.state.player,size=e.bossScale,dx=e.x+Math.sin(e.yaw)*.9*size-p.x,dz=e.z-Math.cos(e.yaw)*.9*size-p.z;p.yaw=Math.atan2(dx,-dz);p.pitch=Math.atan2(e.baseY+1.93*size-p.y-1.62,Math.hypot(dx,dz));}
function finishBoss(sim){
  const e=sim.state.enemies[0];e.hp=.01;sim.selectWeapon(4);aimCore(sim);assert(sim.fire(),'the actual finishing pistol shot must discharge');assert.equal(e.hp,0,'the actual ray must hit the boss');
  assert.equal(sim.state.loot.length,1);return sim.state.loot[0];
}
function collect(sim,q){Object.assign(sim.state.player,{x:q.x,y:q.y,z:q.z});sim.step(.025);}

test('v2 starts a free left hand, migrates legacy carry and preserves distinct historical checkpoints',()=>{
  const w=world(),sim=S.create(w),save=sim.snapshot();
  assert.deepEqual(plain(sim.state.equipment),{right:4,left:null});assert.equal(sim.state.inventory.shield,undefined);assert.equal(sim.state.shield,undefined);assert.equal(sim.state.economy.version,2);assert.equal(sim.state.enemies[0].maxHp,600);
  assert.deepEqual(plain(sim.exportLoadout().campaign),{version:2,discovered:['pistol'],claimedBossRewards:[]});assert.equal(save.campaignVersion,2);assert.equal(save.economyVersion,2);
  const legacyWorld={...w};delete legacyWorld.campaignVersion;legacyWorld.progression={...w.progression};
  const old=S.create(legacyWorld),oldSave=old.snapshot();assert.equal(oldSave.campaignVersion,1);assert.equal(oldSave.economyVersion,1);assert.notEqual(save.fingerprint,oldSave.fingerprint);
  const promoted=S.create(w,old.exportLoadout());assert.equal(promoted.state.campaign.version,2);assert.equal(promoted.state.economy.version,2);assert.deepEqual(plain(promoted.state.campaign.claimedBossRewards),[]);
  assert.equal(sim.restore(oldSave),false);assert.equal(old.restore(save),false);assert.equal(S.create(w).restore(save),true);assert.equal(S.create(legacyWorld).restore(oldSave),true);
});

test('all eighteen bosses grant physical once-only upgrades and finish the exact arsenal calendar by boss six',()=>{
  let carry;const expected=[1,0,3,3,null,2],previous=[0,0,0,0,0],personal={vitality:0,armor:0,capacity:0,power:0,cooling:0};
  for(let index=0;index<18;index++){
    const sim=S.create(world(index),carry),q=finishBoss(sim),before=plain(sim.exportLoadout()),def=E.bossReward(index);
    assert.equal(q.kind,'boss');assert.equal(q.rewardIndex,index);assert.equal(q.weapon,index<6?expected[index]:null);assert.equal(q.rewardTaken,false);
    assert.deepEqual(plain(sim.exportLoadout()),before,'killing must not grant equipment remotely');assert.equal(sim.state.economy.weaponUpgrades[def.weaponUpgrade],previous[def.weaponUpgrade]);
    collect(sim,q);previous[def.weaponUpgrade]++;personal[def.personalUpgrade]++;
    assert.equal(q.rewardTaken,true);assert.deepEqual(plain(sim.state.economy.weaponUpgrades),previous);assert.deepEqual(plain(sim.state.economy.upgrades),personal);
    assert.deepEqual(plain(sim.state.campaign.claimedBossRewards),Array.from({length:index+1},(_,i)=>i));
    const event=sim.state.events.find(e=>e.name==='bossReward');assert(event);assert.equal(event.bossNumber,index+1);assert.equal(event.weapon,index<3||index===5?expected[index]:null);assert.equal(event.weaponUpgrade.rank,previous[def.weaponUpgrade]);assert.equal(event.personalUpgrade.rank,personal[def.personalUpgrade]);
    if(index===3)assert.equal(previous[3],2,'boss four upgrades the already acquired grenade launcher');
    if(index===5)assert(sim.state.inventory.weapons.every(Boolean),'the final twelve worlds start with the entire arsenal');
    const granted=JSON.stringify(sim.exportLoadout());sim.step(.025);assert.equal(JSON.stringify(sim.exportLoadout()),granted,'standing on the loot cannot grant another rank');
    const restored=S.create(world(index));assert(restored.restore(sim.snapshot()),'post-collection save must restore at boss '+(index+1));assert.deepEqual(plain(restored.exportLoadout()),plain(sim.exportLoadout()));carry=sim.exportLoadout();
  }
  assert(previous.every(rank=>rank>0&&rank<8));assert(Object.values(personal).every(rank=>rank>=3&&rank<12),'boss progression still has room for workshop ranks in the final chapter');
});

test('partially collected boss loot saves remaining ammo without replaying upgrades or permitting revisit farming',()=>{
  const w=world(),inventory={weapons:[false,true,false,false,true],ammo:[0,36,0,0,1]},sim=S.create(w,{inventory}),q=finishBoss(sim);
  const unclaimed=sim.snapshot(),fresh=S.create(w);assert(fresh.restore(unclaimed));assert.equal(fresh.state.loot[0].rewardTaken,false);assert.equal(fresh.state.economy.weaponUpgrades[1],0);
  collect(sim,q);assert.equal(q.rewardTaken,true);assert.equal(q.taken,false);assert.equal(q.ammo[1],16);assert.equal(sim.state.economy.weaponUpgrades[1],1);
  const partial=sim.snapshot(),restored=S.create(w);assert(restored.restore(partial));assert.equal(restored.state.loot[0].ammo[1],16);
  const original=JSON.stringify(restored.exportLoadout());restored.step(.025);assert.equal(JSON.stringify(restored.exportLoadout()),original);
  restored.state.inventory.ammo[1]-=4;restored.step(.025);assert.equal(restored.state.loot[0].ammo[1],12);assert.equal(restored.state.economy.weaponUpgrades[1],1);assert.equal(restored.state.economy.upgrades.vitality,1);
  const carry=restored.exportLoadout(),revisit=S.create(w,carry),again=finishBoss(revisit);assert(again.rewardTaken&&again.taken);assert(again.ammo.every(n=>n===0));assert.equal(again.credits,0);assert.equal(again.cores,0);
  collect(revisit,again);assert.deepEqual(plain(revisit.exportLoadout()),plain({...carry,equipment:{...carry.equipment,right:4}}),'a completed boss cannot create another economy reward in a carried run');
  for(const change of [a=>a.loot[0].rewardTaken=false,a=>a.loot[0].weapon=2,a=>a.loot[0].weaponUpgrade=2,a=>a.loot[0].personalUpgrade='power',a=>a.campaign.claimedBossRewards=[],a=>a.economy.weaponUpgrades[1]=0,a=>a.campaign.claimedBossRewards.push(0)]){
    const bad=plain(partial);change(bad.state);const target=S.create(w),before=JSON.stringify(target.snapshot());assert.equal(target.restore(bad),false);assert.equal(JSON.stringify(target.snapshot()),before,'bad reward saves reject atomically');
  }
});

test('the exit requires collecting the physical boss reward, while spare ammo can stay behind',()=>{
  const sim=S.create(world(),{inventory:{weapons:[false,true,false,false,true],ammo:[0,36,0,0,1]}}),q=finishBoss(sim);
  for(const c of sim.state.cores){c.taken=true;}sim.state.relays=3;Object.assign(sim.state.player,sim.state.world.exit);sim.step(.025);assert.equal(sim.state.won,false);
  collect(sim,q);assert(q.rewardTaken&&!q.taken&&q.ammo[1]>0);Object.assign(sim.state.player,sim.state.world.exit);sim.step(.025);assert.equal(sim.state.won,true);
  assert(S.create(world()).restore(sim.snapshot()),'a completed world retains its exact collected reward history');
});

test('weapon calibration changes actual hit damage, projectile payload and heat independently by weapon',()=>{
  const inventory={weapons:[true,true,true,true,true],ammo:[180,36,12,16,1]};
  for(const weapon of [0,1,2,3,4]){
    const profile=E.fresh({campaignVersion:2});profile.weaponUpgrades[weapon]=3;
    const make=economy=>S.create(world(0,{enemies:[{x:0,y:0,z:-12,type:3,bossScale:1,maxHp:30}]}),{inventory,economy});
    const base=make(E.fresh({campaignVersion:2})),up=make(profile);
    for(const sim of [base,up]){sim.selectWeapon(weapon);const p=sim.state.player,e=sim.state.enemies[0],dx=e.x-p.x,dz=e.z-p.z;p.yaw=Math.atan2(dx,-dz);p.pitch=Math.atan2(e.y-p.y-1.62,Math.hypot(dx,dz));assert(sim.fire());}
    assert(up.state.player.heat<base.state.player.heat,'calibration reduces the selected weapon heat');
    if(weapon===2||weapon===3)assert(Math.abs(up.state.projectiles[0].damage/base.state.projectiles[0].damage-2.2)<1e-9);
    else assert(Math.abs((30-up.state.enemies[0].hp)/(30-base.state.enemies[0].hp)-2.2)<1e-7,'calibration increases real ray damage');
    assert.equal(E.weaponStats(profile,(weapon+1)%5).rank,0,'the next weapon has no accidental calibration');
  }
});

test('calibrated live ordnance restores and its actual explosion damages exposed cores using the saved payload',()=>{
  const inventory={weapons:[true,true,true,true,true],ammo:[180,36,12,16,1]};
  for(const weapon of [2,3]){
    const damage=[];
    for(const rank of [0,8]){
      const profile=E.fresh({campaignVersion:2});profile.weaponUpgrades[weapon]=rank;
      const sim=S.create(world(),{inventory,economy:profile}),e=sim.state.enemies[0];e.bossAwake=true;e.bossClock=4;e.weakPointOpen=true;e.weakTimer=3;e.attackLabel='Cœur exposé';
      sim.selectWeapon(weapon);aimCore(sim);assert(sim.fire());const saved=sim.snapshot(),restored=S.create(world());assert(restored.restore(saved),'calibrated payloads above40 remain valid in flight');
      assert.equal(restored.state.projectiles[0].damage,(weapon===2?32:28)*(1+.40*rank));
      const malformed=plain(saved);malformed.state.projectiles[0].damage+=1;assert.equal(S.create(world()).restore(malformed),false,'a forged payload above the owned calibration is rejected');
      if(weapon===3){
        // Isolate detonation at the actual core; trajectory feasibility belongs
        // to the controlled combat audit. The fuse still calls real explode().
        const q=restored.state.projectiles[0],boss=restored.state.enemies[0],size=boss.bossScale;
        Object.assign(q,{x:boss.x+Math.sin(boss.yaw)*.9*size,y:boss.baseY+1.93*size,z:boss.z-Math.cos(boss.yaw)*.9*size,fuse:.01,resting:true,vx:0,vy:0,vz:0});
      }
      for(let i=0;i<120&&restored.state.projectiles.length;i++)restored.step(.025);
      const dealt=600-restored.state.enemies[0].hp;assert(dealt>20,'the real blast must reach the exposed core');damage.push(dealt);
      assert.equal(restored.state.projectiles.length,0);assert(restored.state.events.some(q=>q.name==='explosion'));
    }
    assert(Math.abs(damage[1]/damage[0]-4.2)<1e-7,'actual blast damage must scale with weapon calibration, not a fixed legacy number');
  }
});

test('v2 combat rises across all worlds without scaling down boss HP or shortening core openings',()=>{
  const first=S.create(world(0)),last=S.create(world(17));
  assert.equal(first.state.enemies[0].maxHp,600);assert.equal(last.state.enemies[0].maxHp,12000);assert.equal(last.state.adaptation.bossHpFactor,1);assert(last.state.adaptation.damageMultiplier>first.state.adaptation.damageMultiplier);assert(last.state.adaptation.cadenceMultiplier>first.state.adaptation.cadenceMultiplier);assert(last.state.adaptation.maxActive>first.state.adaptation.maxActive);
  const e=last.state.enemies[0];e.bossAwake=true;e.bossClock=.1;e.weakPointOpen=true;e.weakTimer=2.4;e.hasMemory=true;e.lastSeenX=0;e.lastSeenY=1.6;e.lastSeenZ=-24;e.memory=8;
  for(let i=0;i<80;i++){last.state.player.hp=last.state.maxHp;last.step(.025);}
  assert.equal(e.bossStep,0,'higher cadence cannot cut the existing weak-core opening short');assert(e.weakPointOpen);
  for(let i=0;i<20;i++){last.state.player.hp=last.state.maxHp;last.step(.025);}assert(e.bossStep>0);assert(last.state.bossAttacks.every(a=>a.tell>=1.2),'all attacks retain readable telegraphs');
});
