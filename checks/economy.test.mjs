import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope={};vm.runInNewContext(fs.readFileSync(new URL('../src/economy.js',import.meta.url),'utf8'),scope);const E=scope.FEconomy;
const plain=value=>JSON.parse(JSON.stringify(value));
const make=(credits=1000,cores=3)=>({profile:{...plain(E.fresh()),credits,cores},inventory:{weapons:[true,false,false,false],ammo:[48,0,0,0]},hp:80});
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}

test('boss campaign profiles extend finite ranks without changing historical profile shape or armor bounds',()=>{
 const legacy=E.fresh(),promoted=E.campaign(freeze(legacy));assert.equal(promoted.version,2);assert.deepEqual(plain(promoted.weaponUpgrades),[0,0,0,0,0]);assert.equal(Object.keys(legacy).length,3);
 for(let rank=0;rank<=12;rank++){
  const profile=E.fresh({campaignVersion:2});for(const key of Object.keys(profile.upgrades))profile.upgrades[key]=rank;profile.weaponUpgrades.fill(Math.min(8,rank));
  assert(E.validate(profile));const stats=E.stats(profile),caps=E.ammoCaps(profile,{campaign:true});assert(stats.incomingMultiplier>=.5&&stats.incomingMultiplier<=1);assert(stats.maxHp<=340);assert(caps.every(Number.isInteger));assert.deepEqual(plain(caps),[180+45*rank,36+9*rank,12+3*rank,16+4*rank,1]);
  const state={profile:{...profile,credits:100000,cores:99},inventory:{weapons:[true,true,true,true,true],ammo:[0,0,0,0,1]},hp:100},offer=E.quote(state,'power',{campaign:true});
  assert.equal(offer.item.maxRank,12);assert.equal(offer.ok,rank<12);if(rank<12){assert(offer.cost.credits>0&&Number.isInteger(offer.cost.credits));assert.equal(E.transact(state,'power',{campaign:true}).state.profile.upgrades.power,rank+1);}
 }
 for(const change of [p=>p.weaponUpgrades[0]=9,p=>p.weaponUpgrades[0]=-1,p=>p.weaponUpgrades.pop(),p=>p.weaponUpgrades[1]=NaN,p=>p.upgrades.vitality=13,p=>p.version=3,p=>p.extra=true]){const invalid=E.fresh({campaignVersion:2});change(invalid);assert.equal(E.validate(invalid),false);}
});

test('eighteen deterministic boss awards retain weapon-specific growth and personal upgrades into the final chapter',()=>{
 let profile=E.fresh({campaignVersion:2});const unlocks=[];
 for(let index=0;index<18;index++){
  const reward=E.bossReward(index),before=plain(profile);freeze(profile);const next=E.grantBossReward(profile,index);assert(next&&E.validate(next));assert.deepEqual(plain(profile),before);
  assert.equal(next.weaponUpgrades[reward.weaponUpgrade],before.weaponUpgrades[reward.weaponUpgrade]+1);assert.equal(next.upgrades[reward.personalUpgrade],before.upgrades[reward.personalUpgrade]+1);
  assert(reward.weaponUpgradeLabel.length>10&&reward.personalUpgradeLabel.length>3);unlocks.push(reward.weapon);profile=next;
 }
 assert.deepEqual(unlocks.slice(0,6),[1,0,3,3,null,2]);assert(unlocks.slice(6).every(q=>q===null));assert(profile.weaponUpgrades.every(r=>r>=3&&r<=4));assert(Object.values(profile.upgrades).every(r=>r>=3&&r<=4));
 for(const index of [-1,18,.5,NaN]){assert.equal(E.bossReward(index),null);assert.equal(E.grantBossReward(profile,index),null);}
 assert.equal(E.weaponStats(profile,1).damageMultiplier,1+profile.weaponUpgrades[1]*.40);assert(E.weaponStats(profile,1).heatMultiplier<1);assert.deepEqual(plain(E.weaponStats(E.fresh(),1)),{rank:0,damageMultiplier:1,heatMultiplier:1});
});

test('profiles are strict, independent and copyable without shared upgrades',()=>{
 const fresh=E.fresh();assert(E.validate(fresh));assert.deepEqual(plain(fresh),{credits:0,cores:0,upgrades:{vitality:0,armor:0,capacity:0,power:0,cooling:0}});
 const copy=E.copy(fresh);copy.upgrades.power=3;copy.credits=999;assert.equal(fresh.upgrades.power,0);assert.equal(fresh.credits,0);
 for(const value of [null,undefined,[],{},NaN])assert.equal(E.copy(value),null);
 for(const key of ['credits','cores'])for(const value of [-1,.5,NaN,Infinity,'10']){const p=plain(fresh);p[key]=value;assert(!E.validate(p));assert.equal(E.copy(p),null);}
 for(const value of [-1,4,.5,NaN,'1']){const p=plain(fresh);p.upgrades.armor=value;assert(!E.validate(p));}
 for(const change of [p=>delete p.upgrades.power,p=>p.upgrades.speed=1,p=>p.unknown=1,p=>p.credits=1000000001,p=>p.cores=1000]){const p=plain(fresh);change(p);assert(!E.validate(p));}
 assert.equal(E.stats({}),null);assert.equal(E.ammoCaps({}),null);
});

test('every rank gives bounded explicit stats and integer ammunition capacities',()=>{
 for(let rank=0;rank<=3;rank++){
  const p=E.fresh();for(const key of Object.keys(p.upgrades))p.upgrades[key]=rank;const stats=E.stats(p);
  assert.equal(stats.maxHp,100+rank*20);assert.equal(stats.damageMultiplier,1+rank*.1);assert.equal(stats.incomingMultiplier,1-rank*.08);assert.equal(stats.coolingMultiplier,1+rank*.2);
  assert.deepEqual(plain(E.ammoCaps(p)),[180+45*rank,36+9*rank,12+3*rank,16+4*rank]);assert(E.ammoCaps(p).every(Number.isInteger));
 }
});

test('the thirteen catalog offers describe all four firearms and no shield without mutable prices',()=>{
 const items=E.catalog();assert.equal(items.length,13);assert.equal(new Set(items.map(i=>i.id)).size,13);
 for(const item of items){assert(item.label.length>3&&item.description.length>20);assert(item.basePrice>0&&Number.isInteger(item.basePrice));assert(item.quantity>0);}
 items[0].basePrice=0;items[0].label='changed';assert.equal(E.catalog()[0].basePrice,24);assert.notEqual(E.catalog()[0].label,'changed');
 assert(items.some(i=>i.label.includes('mitraillette')));assert(items.some(i=>i.label.includes('Double pompe')));assert(items.some(i=>i.label.includes('Lance-roquettes')));assert(items.some(i=>i.label==='Lance-grenades'));
 assert(!items.some(i=>i.kind==='shield'||i.id==='shield'),'the shield left the game and cannot return through the catalog');
});

test('repairs charge proportional positive prices, cap health and never revive a defeated player',()=>{
 for(const hp of [10,80,99,99.99]){
  const state=freeze({...make(),hp}),before=plain(state),q=E.quote(state,'repair'),result=E.transact(state,'repair');
  const amount=Math.min(25,100-hp);assert(q.ok);assert.equal(q.amount,amount);assert.equal(q.cost.credits,Math.max(1,Math.ceil(amount*24/25)));assert.equal(result.state.hp,Math.min(100,hp+25));assert.deepEqual(plain(state),before);assert.equal(result.state.profile.credits,1000-q.cost.credits);
 }
 assert.equal(E.quote({...make(),hp:100},'repair').reason,'full');assert.equal(E.quote({...make(),hp:0},'repair').reason,'defeated');assert.equal(E.quote({...make(),hp:0},'ammo0').reason,'defeated');
});

test('ammunition buys actual quantities at every capacity rank without overfilling',()=>{
 for(let rank=0;rank<=3;rank++)for(let weapon=0;weapon<4;weapon++)for(const space of [1,3,20,200]){
  const state=make();state.profile.upgrades.capacity=rank;state.inventory.weapons=[true,true,true,true];const cap=E.ammoCaps(state.profile)[weapon];state.inventory.ammo[weapon]=Math.max(0,cap-space);
  const item=E.catalog().find(i=>i.id==='ammo'+weapon),q=E.quote(state,item.id),result=E.transact(state,item.id),amount=Math.min(item.quantity,space,cap);
  assert(q.ok);assert.equal(q.amount,amount);assert.equal(q.cost.credits,Math.max(1,Math.ceil(item.basePrice*amount/item.quantity)));assert.equal(result.state.inventory.ammo[weapon],state.inventory.ammo[weapon]+amount);assert(result.state.inventory.ammo[weapon]<=cap);
 }
 const full=make();full.inventory.ammo[0]=180;assert.equal(E.quote(full,'ammo0').reason,'full');assert.equal(E.quote(make(),'ammo1').reason,'locked-weapon');
});

test('emergency weapon purchase has a one-time bounded starter pack and no repeat reward',()=>{
 for(const [weapon,price,ammo] of [[1,150,6],[2,260,2],[3,220,4]]){
  const state=freeze(make()),result=E.transact(state,'weapon'+weapon);assert(result.ok);assert.equal(result.cost.credits,price);assert(result.state.inventory.weapons[weapon]);assert.equal(result.state.inventory.ammo[weapon],ammo);
  const second=E.transact(result.state,'weapon'+weapon);assert(!second.ok);assert.equal(second.reason,'owned');assert.deepEqual(plain(second.state),plain(result.state));assert.notEqual(second.state,result.state);assert.equal(state.inventory.weapons[weapon],false);
  const nearlyFull=make();nearlyFull.inventory.ammo[weapon]=E.ammoCaps(nearlyFull.profile)[weapon]-1;const partial=E.transact(nearlyFull,'weapon'+weapon);assert(partial.ok);assert.equal(partial.amount,1);assert.equal(partial.cost.credits,price);assert.equal(partial.state.inventory.ammo[weapon],E.ammoCaps(nearlyFull.profile)[weapon]);
 }
});

test('the shield cannot be bought, quoted or carried, in classic and campaign states',()=>{
 const state=freeze(make()),result=E.transact(state,'shield');
 assert.equal(result.ok,false);assert.equal(result.reason,'unknown-item');assert.deepEqual(plain(result.state),plain(state));
 assert.equal(E.quote(state,'shield').reason,'unknown-item');
 const campaign={profile:E.campaign(E.fresh()),inventory:{weapons:[true,false,false,false,true],ammo:[0,0,0,0,1]},hp:100};
 assert.equal(E.transact(campaign,'shield',{campaign:true}).reason,'unknown-item');
 assert.equal(E.quote(campaign,'shield',{campaign:true}).reason,'unknown-item');
});

test('legacy three-slot fixtures keep their exact inventory size without granting the new arsenal',()=>{
 const legacy={...make(),inventory:{weapons:[true,false,false],ammo:[48,0,0]}};
 for(const id of ['repair','ammo0','weapon1','weapon2','capacity']){
  const result=E.transact(legacy,id);assert(result.ok);assert.equal(result.state.inventory.weapons.length,3);assert.equal(result.state.inventory.ammo.length,3);assert.deepEqual(Object.keys(result.state.inventory).sort(),['ammo','weapons']);
 }
 for(const id of ['weapon3','ammo3']){const result=E.transact(legacy,id);assert.equal(result.reason,'unsupported-item');assert.deepEqual(plain(result.state),legacy);}
});

test('upgrades spend scarce cores on ranks two and three without repairing or refilling',()=>{
 const prices={vitality:90,armor:120,capacity:100,power:140,cooling:110};
 for(const [id,base] of Object.entries(prices)){
  let state=make(10000,3);const originalAmmo=state.inventory.ammo.slice();
  for(let rank=0;rank<3;rank++){
   const before=plain(state),result=E.transact(state,id);assert(result.ok);assert.equal(result.rank,rank);assert.equal(result.nextRank,rank+1);assert.equal(result.cost.credits,Math.ceil(base*[1,1.6,2.3][rank]));assert.equal(result.cost.cores,rank?1:0);
   assert.equal(result.state.profile.upgrades[id],rank+1);assert.equal(result.state.hp,80);assert.deepEqual(plain(result.state.inventory.ammo),originalAmmo);assert.deepEqual(plain(state),before);state=result.state;
  }
  assert.equal(state.profile.cores,1);assert.equal(E.quote(state,id).reason,'max-rank');
 }
});

test('insufficient credits or cores are atomic failures and stale quote objects cannot authorize purchases',()=>{
 const broke=freeze(make(1)),before=plain(broke),fail=E.transact(broke,'weapon2');assert(!fail.ok);assert.equal(fail.reason,'insufficient-credits');assert.deepEqual(plain(fail.state),before);assert.deepEqual(plain(broke),before);
 const noCore=make(1000,0);noCore.profile.upgrades.power=1;const coreFail=E.transact(noCore,'power');assert.equal(coreFail.reason,'insufficient-cores');assert.equal(coreFail.cost.cores,1);assert.deepEqual(plain(coreFail.state),noCore);
 const honest=make(),quote=E.quote(honest,'weapon2');quote.cost.credits=0;quote.item.basePrice=0;const buy=E.transact(honest,'weapon2');assert.equal(buy.cost.credits,260);assert.equal(buy.state.profile.credits,740);
});

test('malformed state, sparse arrays and out-of-cap inventory are rejected before any debit',()=>{
 const changes=[s=>s.hp=NaN,s=>s.hp=Infinity,s=>s.hp=-1,s=>s.hp=101,s=>s.inventory.weapons[0]=false,s=>s.inventory.weapons[1]=1,s=>delete s.inventory.weapons[1],s=>delete s.inventory.ammo[1],s=>s.inventory.ammo[0]=181,s=>s.inventory.ammo[0]=-1,s=>s.inventory.ammo[0]=1.5,s=>s.inventory.ammo=[1,2],s=>s.inventory.extra=true,s=>s.extra=true,s=>s.inventory.ammo[3]=17,s=>s.inventory.shield=1,s=>s.inventory.weapons.push(true),s=>s.inventory.ammo.shield=1];
 for(const change of changes){const state=make();change(state);const result=E.transact(state,'repair');assert.equal(result.ok,false);assert.equal(result.reason,'invalid-state');assert.equal(result.state,null);}
 assert.equal(E.quote(make(),'__proto__').reason,'unknown-item');assert.equal(E.quote(make(),{}).reason,'unknown-item');
});

test('long mixed purchase sequences conserve currencies and cannot create free supplies',()=>{
 let state=make(5000,3),seed=96;const ids=E.catalog().map(i=>i.id);
 for(let i=0;i<400;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;const id=ids[seed%ids.length];
  if(i%7===0)state.hp=Math.max(1,state.hp-7.5);if(i%5===0)state.inventory.ammo[0]=Math.max(0,state.inventory.ammo[0]-11);
  const before=plain(state),result=E.transact(state,id);assert.deepEqual(plain(state),before);
  if(result.ok){assert(result.cost.credits>=1);assert.equal(result.state.profile.credits,state.profile.credits-result.cost.credits);assert.equal(result.state.profile.cores,state.profile.cores-result.cost.cores);}
  else assert.deepEqual(plain(result.state),before);
  state=result.state;assert(E.validate(state.profile));assert(state.hp>0&&state.hp<=E.stats(state.profile).maxHp);assert(state.inventory.ammo.every((v,w)=>v>=0&&v<=E.ammoCaps(state.profile)[w]));
 }
});
