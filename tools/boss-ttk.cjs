// Controlled open-arena simulation, not a human playthrough.
// Same boss HP/kind/scale and reward rules as the v2 progression checks.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{performance}=require('node:perf_hooks');
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing value for '+name);return path.resolve(args[i+1]);};
const ROOT=option('--root',path.resolve(__dirname,'..')),OUT=option('--out-dir',path.resolve(ROOT,'docs/qa-v08')),G={},hashes={};
for(const name of ['destruction','economy','simulation']){const s=fs.readFileSync(ROOT+'/src/'+name+'.js','utf8');hashes[name]=crypto.createHash('sha256').update(s).digest('hex');new Function('window',s)(G);}
const {FEconomy:E,FSimulation:S}=G,HP=[600,850,1200,1550,1900,2400,2900,3400,4000,4650,5300,6050,6850,7700,8600,9600,10800,12000];
const rankFactor=null; // Always measure the unmodified release code.
const test=fs.readFileSync(ROOT+'/checks/boss-progression.test.mjs','utf8'),worldCode=test.slice(test.indexOf('function world('),test.indexOf('function aimCore('));
const world=new Function('HP',worldCode+';return world;')(HP);
function core(e){return [e.x+Math.sin(e.yaw)*.9*e.bossScale,e.baseY+1.93*e.bossScale,e.z-Math.cos(e.yaw)*.9*e.bossScale];}
function aim(sim){const p=sim.state.player,c=core(sim.state.enemies[0]),dx=c[0]-p.x,dz=c[2]-p.z;p.yaw=Math.atan2(dx,-dz);p.pitch=Math.atan2(c[1]-p.y-1.62,Math.hypot(dx,dz));return Math.hypot(dx,dz,c[1]-p.y-1.62);}
function loadout(index,maxed=false){let economy=E.fresh({campaignVersion:2});const weapons=[false,false,false,false,true];for(let n=0;n<index;n++){economy=E.grantBossReward(economy,n);const r=E.bossReward(n);if(r.weapon!==null)weapons[r.weapon]=true;}if(maxed){for(const key of Object.keys(economy.upgrades))economy.upgrades[key]=12;economy.weaponUpgrades.fill(8);weapons.fill(true);}const caps=E.ammoCaps(economy,{campaign:true});return {economy,inventory:{weapons,ammo:caps.map((q,i)=>weapons[i]?q:0),shield:true},campaign:{version:2,discovered:[['pistol',4],['shield',-1],['smg',0],['shotgun',1],['grenade',3],['rocket',2]].filter(([key,i])=>i<0||weapons[i]).map(q=>q[0]),claimedBossRewards:Array.from({length:index},(_,i)=>i)}};}
function run(index,strategy,{maxSeconds=1800,maxed=false,onlyWeapon=null}={}){
 const options=loadout(index,maxed),sim=S.create(world(index),options),e=sim.state.enemies[0],p=sim.state.player,dt=.025,start=performance.now(),shots=[0,0,0,0,0],damage=[0,0,0,0,0],milestones=[];
 const initialAmmo=sim.state.inventory.ammo.slice();let opened=0,overheated=0,lastShot=-1,ammoEmptyAt=null,unusedAtEmpty=null,phase=-1,t=0,missing=0;
 for(;t<maxSeconds&&e.hp>0&&!sim.state.dead;t+=dt){
   // Perfect aim and a fixed arena station isolate damage/heat/cadence from aim and dodging skill.
   // HP is restored, but weapon heat, cooldowns, finite ammunition and actual core cycles are untouched.
   p.hp=sim.state.maxHp;p.x=0;p.y=0;p.z=-24;
   const distance=aim(sim);let weapon=4,fire=false;
   if(strategy==='pistol')fire=true;
   else if(strategy==='weapon') {weapon=onlyWeapon;fire=e.weakPointOpen&&(weapon!==2||e.weakTimer>distance/24+.12);}
   else if(e.weakPointOpen){
     const order=[2,1,0,3];weapon=order.find(w=>sim.state.inventory.weapons[w]&&sim.state.inventory.ammo[w]>0&&(w!==2||e.weakTimer>distance/24+.12)&&(w!==1||distance<24))??4;fire=true;
   }else fire=p.heat<.28;
   if(weapon!==sim.state.weapon)sim.selectWeapon(weapon);
   const beforeHp=e.hp,beforeShots=sim.state.shots;
   sim.step(dt,{fire});
   if(sim.state.shots>beforeShots){shots[weapon]+=sim.state.shots-beforeShots;lastShot=weapon;}
   if(e.hp<beforeHp)damage[weapon]+=beforeHp-e.hp;
   if(e.weakPointOpen)opened+=dt;if(p.overheated)overheated+=dt;
   if(phase!==e.phase){phase=e.phase;milestones.push({time:+t.toFixed(3),phase,hp:e.hp,ammo:sim.state.inventory.ammo.slice()});}
   if(ammoEmptyAt===null&&sim.state.inventory.ammo.slice(0,4).every(q=>q===0)){ammoEmptyAt=t;unusedAtEmpty=e.hp;}
   if(Math.floor((t+dt)/60)>Math.floor(t/60))milestones.push({time:+(t+dt).toFixed(1),hp:+e.hp.toFixed(2),ammo:sim.state.inventory.ammo.slice()});
 }
 const row={boss:index+1,initialHP:e.maxHp,strategy,maxed,onlyWeapon,seconds:+t.toFixed(3),killed:e.hp<=0,remainingHP:+e.hp.toFixed(3),remainingAmmo:sim.state.inventory.ammo.slice(),initialAmmo,shots,damageAttributedToWeaponHeldAtImpact:damage.map(x=>+x.toFixed(2)),ammoEmptyAt,remainingHPAtAmmoEmpty:unusedAtEmpty,coreOpenFraction:opened/t,overheatFraction:overheated/t,playerDead:sim.state.dead,profile:options.economy,milestones,wallMs:performance.now()-start};sim.dispose();return row;
}
const cases=process.argv.slice(2).length?JSON.parse(process.argv[2]):[[0,'pistol'],[5,'arsenal'],[17,'arsenal']];
const rows=[];for(const args of cases){const row=run(...args);rows.push(row);process.stdout.write(JSON.stringify(row)+'\n');fs.writeFileSync(OUT+'/'+'boss-ttk-final.json',JSON.stringify({method:'Controlled 40 Hz simulation in unobstructed synthetic arena; perfect core aim; stationary station restored each tick; player HP restored; real HP, heat, cooldowns, finite ammunition and actual core windows; no mid-fight pickups. Impact attribution is approximate for delayed ordnance; TTK/ammo are exact for these controls. Not human playtest.',hashes,rankFactorOverride:rankFactor,rows},null,2));}
