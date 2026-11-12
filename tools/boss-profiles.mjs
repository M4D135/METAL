// Deterministic v2 boss profiles from the actual generated worlds and economy.
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
const context={window:{}};vm.createContext(context);
for(const name of ['world','economy','simulation'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context,{filename:name+'.js'});
const {FWorld:W,FEconomy:E,FSimulation:S}=context.window,weaponNames=['Mitraillette','Double pompe','Lance-roquettes','Lance-grenades','Pistolet'];
let profile=E.fresh({campaignVersion:2});const weapons=[false,false,false,false,true],rows=[];
for(let index=0;index<18;index++){
  const world=W.create(96,index,{campaign:true,campaignVersion:2}),boss=world.enemies.at(-1),arena=world.rooms.find(r=>r.bossArena),reward=E.bossReward(index),inventory={weapons,shield:true},policy=S.campaignPolicy(index,inventory,world.progression.maxActive,2);
  const arenaAmmo=[0,0,0,0,0],enemyAmmo=[0,0,0,0,0];
  for(const q of world.pickups)if(q.kind==='ammo'&&q.zoneId===arena.id)arenaAmmo[q.weapon]+=q.amount;
  for(const e of world.enemies)if(e.drop)enemyAmmo[e.drop.weapon]+=e.drop.amount;
  rows.push({world:index+1,bossHp:boss.maxHp,bossKind:boss.bossKind,garrison:world.enemies.length,combatCap:policy.maxActive,enemyDamageMultiplier:policy.damageMultiplier,enemyCadenceMultiplier:policy.cadenceMultiplier,
    entryWeapons:weapons.flatMap((owned,i)=>owned?[weaponNames[i]]:[]),entryWeaponRanks:profile.weaponUpgrades.slice(),entryPersonalRanks:{...profile.upgrades},entryStats:E.stats(profile),entryAmmoCaps:E.ammoCaps(profile,{campaign:true}),
    reward:{...reward,weaponName:reward.weapon===null?null:weaponNames[reward.weapon],weaponUpgradeName:weaponNames[reward.weaponUpgrade]},arenaAmmo,enemyAmmo,arenaArmor:world.pickups.filter(q=>q.kind==='armor'&&q.zoneId===arena.id).reduce((n,q)=>n+q.amount,0),arenaWorkshop:world.shops.some(q=>q.zoneId===arena.id)});
  profile=E.grantBossReward(profile,index);if(reward.weapon!==null)weapons[reward.weapon]=true;
}
const result={campaignVersion:2,seed:96,weaponOrder:weaponNames,calibration:{damagePerRank:.4,heatFormula:'1 / (1 + .08 * rank)',maxRank:8},personalMaxRank:12,armorIncomingFloor:.5,profileAfter18Bosses:profile,
  caveat:'Entry profile assumes mandatory boss rewards only, with no optional workshop purchases. Arena and enemy ammo are generated finite sources, not automatic refills.',rows};
const output=process.argv[2]||new URL('../docs/boss-progression-v08.json',import.meta.url);
writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({worlds:rows.length,firstBossHp:rows[0].bossHp,lastBossHp:rows.at(-1).bossHp,campaignVersion:2}));
