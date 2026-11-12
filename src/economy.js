/* METAL: deterministic campaign economy. No storage, UI, audio or world mutation. */
(function (G) {
  'use strict';
  const KEYS=['vitality','armor','capacity','power','cooling'],BASE_CAPS=[180,36,12,16];
  const MAX_CREDITS=1000000000,MAX_CORES=999,PERSONAL_RANKS=12,WEAPON_RANKS=8;
  const WEAPONS=['Mitraillette','Double pompe','Lance-roquettes','Lance-grenades','Pistolet'];
  const ITEMS=[
    {id:'repair',kind:'repair',label:'Réparation',description:'Restaure jusqu’à 25 points d’intégrité. Prix réduit si la réparation est partielle.',quantity:25,basePrice:24},
    {id:'ammo0',kind:'ammo',weapon:0,label:'Cellules de mitraillette',description:'Jusqu’à 24 cellules pour la mitraillette Impulse. Le prix suit la quantité reçue.',quantity:24,basePrice:18},
    {id:'ammo1',kind:'ammo',weapon:1,label:'Cartouches de double pompe',description:'Jusqu’à 6 cartouches pour le double pompe Fracture. Le prix suit la quantité reçue.',quantity:6,basePrice:24},
    {id:'ammo2',kind:'ammo',weapon:2,label:'Roquettes',description:'Jusqu’à 2 roquettes pour le lance-roquettes Rupture. Le prix suit la quantité reçue.',quantity:2,basePrice:36},
    {id:'ammo3',kind:'ammo',weapon:3,label:'Grenades',description:'Jusqu’à 4 grenades pour le lance-grenades. Le prix suit la quantité reçue.',quantity:4,basePrice:36},
    {id:'weapon1',kind:'weapon',weapon:1,label:'Double pompe · Fracture',description:'Débloque le double pompe avec 6 cartouches, dans la limite des réserves. Achat unique.',quantity:6,basePrice:150},
    {id:'weapon2',kind:'weapon',weapon:2,label:'Lance-roquettes · Rupture',description:'Débloque le lance-roquettes avec 2 roquettes, dans la limite des réserves. Achat unique.',quantity:2,basePrice:260},
    {id:'weapon3',kind:'weapon',weapon:3,label:'Lance-grenades',description:'Débloque le lance-grenades avec 4 grenades, dans la limite des réserves. Achat unique.',quantity:4,basePrice:220},
    {id:'shield',kind:'shield',label:'Bouclier',description:'Débloque le bouclier pour la main gauche. Achat unique, sans recharge d’énergie offerte.',quantity:1,basePrice:180},
    {id:'vitality',kind:'upgrade',upgrade:'vitality',label:'Vitalité',description:'+20 intégrité maximale par rang. Les dégâts déjà subis restent à réparer.',quantity:1,basePrice:90,maxRank:3},
    {id:'armor',kind:'upgrade',upgrade:'armor',label:'Blindage',description:'Réduit de 8 % supplémentaires les dégâts reçus par rang, jusqu’à 24 %.',quantity:1,basePrice:120,maxRank:3},
    {id:'capacity',kind:'upgrade',upgrade:'capacity',label:'Réserves',description:'+25 % de capacité de base par rang. N’ajoute aucune munition.',quantity:1,basePrice:100,maxRank:3},
    {id:'power',kind:'upgrade',upgrade:'power',label:'Puissance',description:'+10 % de dégâts par rang, jusqu’à +30 %.',quantity:1,basePrice:140,maxRank:3},
    {id:'cooling',kind:'upgrade',upgrade:'cooling',label:'Refroidissement',description:'+20 % de vitesse de refroidissement par rang, jusqu’à +60 %.',quantity:1,basePrice:110,maxRank:3}
  ];
  const MESSAGES={
    'invalid-state':'État de l’équipement invalide.',
    'unknown-item':'Offre inconnue.',
    'defeated':'La réparation nécessite un opérateur vivant.',
    'full':'Capacité déjà pleine.',
    'owned':'Équipement déjà possédé.',
    'unsupported-item':'Cet équipement nécessite l’arsenal complet.',
    'locked-weapon':'Récupérez d’abord cette arme.',
    'trophy-required':'Découvrez cet équipement dans sa salle-trophée.',
    'max-rank':'Rang maximal atteint.',
    'insufficient-credits':'Crédits insuffisants.',
    'insufficient-cores':'Noyau de colosse requis.'
  };
  const own=(o,key)=>Object.prototype.hasOwnProperty.call(o,key);
  function shape(value,keys){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>own(value,key));}
  const integer=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
  function fresh(options={}){return {credits:0,cores:0,upgrades:{vitality:0,armor:0,capacity:0,power:0,cooling:0},...(options.campaignVersion===2?{version:2,weaponUpgrades:[0,0,0,0,0]}:{})};}
  function validate(profile){
    const campaign=profile?.version===2;
    return shape(profile,campaign?['credits','cores','upgrades','version','weaponUpgrades']:['credits','cores','upgrades'])&&integer(profile.credits,MAX_CREDITS)&&integer(profile.cores,MAX_CORES)&&shape(profile.upgrades,KEYS)&&KEYS.every(key=>integer(profile.upgrades[key],campaign?PERSONAL_RANKS:3))&&(!campaign||Array.isArray(profile.weaponUpgrades)&&profile.weaponUpgrades.length===5&&Object.keys(profile.weaponUpgrades).length===5&&Array.from({length:5},(_,i)=>i).every(i=>own(profile.weaponUpgrades,i)&&integer(profile.weaponUpgrades[i],WEAPON_RANKS)));
  }
  function copy(profile){
    if(!validate(profile))return null;
    return {credits:profile.credits,cores:profile.cores,upgrades:Object.fromEntries(KEYS.map(key=>[key,profile.upgrades[key]])),...(profile.version===2?{version:2,weaponUpgrades:profile.weaponUpgrades.slice()}:{})};
  }
  function campaign(profile){const value=copy(profile);return value&&(value.version===2?value:{...value,version:2,weaponUpgrades:[0,0,0,0,0]});}
  function stats(profile){
    if(!validate(profile))return null;const r=profile.upgrades;
    return {maxHp:100+20*r.vitality,damageMultiplier:1+.10*r.power,incomingMultiplier:profile.version===2?Math.max(.5,1-.08*Math.min(3,r.armor)-.026*Math.max(0,r.armor-3)):1-.08*r.armor,coolingMultiplier:1+.20*r.cooling};
  }
  function weaponStats(profile,weapon){const rank=profile?.version===2&&validate(profile)&&Number.isInteger(weapon)&&weapon>=0&&weapon<5?profile.weaponUpgrades[weapon]:0;return {rank,damageMultiplier:1+.40*rank,heatMultiplier:1/(1+.08*rank)};}
  function bossReward(index){
    if(!Number.isInteger(index)||index<0||index>17)return null;
    const weapon=[1,0,3,3,null,2][index]??null,weaponUpgrade=[1,0,3,3,0,2,1,4,3,0,2,1,4,3,0,2,1,4][index],personalUpgrade=KEYS[index%KEYS.length];
    return {rewardIndex:index,weapon,weaponUpgrade,personalUpgrade,weaponUpgradeLabel:'Calibrage · '+WEAPONS[weaponUpgrade],personalUpgradeLabel:ITEMS.find(item=>item.upgrade===personalUpgrade).label};
  }
  function grantBossReward(profile,index){
    const reward=bossReward(index),next=campaign(profile);if(!reward||!next)return null;
    next.weaponUpgrades[reward.weaponUpgrade]=Math.min(WEAPON_RANKS,next.weaponUpgrades[reward.weaponUpgrade]+1);
    next.upgrades[reward.personalUpgrade]=Math.min(PERSONAL_RANKS,next.upgrades[reward.personalUpgrade]+1);
    return next;
  }
  function ammoCaps(profile,options={}){if(!validate(profile))return null;const caps=BASE_CAPS.map(value=>Math.floor(value*(1+.25*profile.upgrades.capacity)));if(options.campaign===true)caps.push(1);return caps;}
  function catalog(){return ITEMS.map(item=>({...item}));}
  function copyState(state,options={}){
    if(!shape(state,['profile','inventory','hp']))return null;
    const profile=copy(state.profile);if(!profile)return null;
    const campaign=options.campaign===true,caps=ammoCaps(profile,options),inventory=state.inventory;
    if(!inventory||!Array.isArray(inventory.weapons)||!Array.isArray(inventory.ammo))return null;
    const slots=inventory.weapons.length,hasShield=own(inventory,'shield');
    if(!(campaign?[5]:[3,4]).includes(slots)||!shape(inventory,hasShield?['weapons','ammo','shield']:['weapons','ammo'])||slots>=4&&!hasShield||hasShield&&typeof inventory.shield!=='boolean'||Object.keys(inventory.weapons).length!==slots||(campaign?!inventory.weapons.some(Boolean):inventory.weapons[0]!==true)||inventory.ammo.length!==slots||Object.keys(inventory.ammo).length!==slots||!Array.from({length:slots},(_,i)=>i).every(i=>own(inventory.weapons,i)&&typeof inventory.weapons[i]==='boolean'&&own(inventory.ammo,i)&&integer(inventory.ammo[i],caps[i])))return null;
    if(!Number.isFinite(state.hp)||state.hp<0||state.hp>stats(profile).maxHp)return null;
    return {profile,inventory:{weapons:inventory.weapons.slice(),ammo:inventory.ammo.slice(),...(hasShield?{shield:inventory.shield}:{})},hp:state.hp};
  }
  function quote(state,itemId,options={}){
    const item=ITEMS.find(item=>item.id===itemId),valid=copyState(state,options);
    const result={ok:false,reason:'',message:'',item:item?{...item}:null,cost:{credits:0,cores:0},amount:0,rank:0,nextRank:0};
    function deny(reason){result.reason=reason;result.message=MESSAGES[reason];return result;}
    if(!valid)return deny('invalid-state');
    if(!item)return deny('unknown-item');
    if(valid.hp<=0)return deny('defeated');
    const profile=valid.profile,inventory=valid.inventory,maxRank=profile.version===2?PERSONAL_RANKS:3;
    if(item.kind==='upgrade'&&profile.version===2){result.item.maxRank=maxRank;if(item.id==='armor')result.item.description='Réduction des dégâts : 8 % par rang jusqu’au rang 3, puis 2,6 % par rang. Le blindage laisse toujours passer au moins la moitié des dégâts.';else result.item.description=item.description.replace('jusqu’à +30 %','jusqu’à +120 %').replace('jusqu’à +60 %','jusqu’à +240 %');}
    if(inventory.weapons.length<4&&(item.weapon===3||item.kind==='shield'))return deny('unsupported-item');
    if(options.campaign===true&&(item.kind==='weapon'&&!inventory.weapons[item.weapon]||item.kind==='shield'&&!inventory.shield))return deny('trophy-required');
    if(item.kind==='repair'){
      result.amount=Math.min(item.quantity,stats(profile).maxHp-valid.hp);
      if(result.amount<=0)return deny('full');
      result.cost.credits=Math.max(1,Math.ceil(item.basePrice*result.amount/item.quantity));
    }else if(item.kind==='ammo'){
      if(!inventory.weapons[item.weapon])return deny('locked-weapon');
      result.amount=Math.min(item.quantity,ammoCaps(profile,options)[item.weapon]-inventory.ammo[item.weapon]);
      if(result.amount<=0)return deny('full');
      result.cost.credits=Math.max(1,Math.ceil(item.basePrice*result.amount/item.quantity));
    }else if(item.kind==='weapon'){
      if(inventory.weapons[item.weapon])return deny('owned');
      result.amount=Math.min(item.quantity,ammoCaps(profile,options)[item.weapon]-inventory.ammo[item.weapon]);
      result.cost.credits=item.basePrice;
    }else if(item.kind==='shield'){
      if(inventory.shield)return deny('owned');
      result.amount=1;result.cost.credits=item.basePrice;
    }else{
      result.rank=profile.upgrades[item.upgrade];result.nextRank=Math.min(maxRank,result.rank+1);
      if(result.rank>=maxRank)return deny('max-rank');
      const rank=result.rank,price=rank<3?[1,1.6,2.3][rank]:2.3+1.15*(rank-2)+.25*(rank-2)**2;
      result.amount=1;result.cost.credits=Math.ceil(item.basePrice*price);result.cost.cores=result.rank>0?1:0;
    }
    if(profile.credits<result.cost.credits)return deny('insufficient-credits');
    if(profile.cores<result.cost.cores)return deny('insufficient-cores');
    result.ok=true;return result;
  }
  function transact(state,itemId,options={}){
    // Always re-quote the current state. A cached UI price is never authority.
    const offer=quote(state,itemId,options),next=copyState(state,options),result={...offer,state:next};
    if(!offer.ok)return result;
    next.profile.credits-=offer.cost.credits;next.profile.cores-=offer.cost.cores;
    const item=offer.item;
    if(item.kind==='repair')next.hp=Math.min(stats(next.profile).maxHp,next.hp+offer.amount);
    else if(item.kind==='ammo')next.inventory.ammo[item.weapon]+=offer.amount;
    else if(item.kind==='weapon'){next.inventory.weapons[item.weapon]=true;next.inventory.ammo[item.weapon]+=offer.amount;}
    else if(item.kind==='shield')next.inventory.shield=true;
    else next.profile.upgrades[item.upgrade]=offer.nextRank;
    return result;
  }
  G.FEconomy={fresh,validate,copy,campaign,stats,weaponStats,bossReward,grantBossReward,ammoCaps,catalog,quote,transact};
})(typeof window!=='undefined'?window:globalThis);
