// Boss fight exposure with the guard raised: share of damage by attack kind and whether it was blockable.
// Player stands 12 m from the boss, faces it, holds the guard; the boss AI picks its own attacks.
// Usage: node boss-shield.mjs <ferro-root> [seconds]
import {load,hurtProbe} from './load.mjs';
import {protoPatch,PROPOSED} from './proto-patch.mjs';
const root=process.argv[2],T=+process.argv[3]||40,PROTO=process.argv[4]==='proto';
const W=load(root,{modules:['destruction','economy','brain','simulation'],patch:PROTO?protoPatch(PROPOSED):hurtProbe});
console.log(PROTO?'REGLES PROTOTYPE':'REGLES ACTUELLES');
const LINES={940:'explosion (slam / rocketZone / roquette)',1722:'onde/ balayage (ring/sweep)',1928:'balle',1782:'ruee',1820:'env'};
function world(index){const stage=index%3,arena={x:0,y:0,z:0,r:28};
  return {seed:'feel-boss',stage,index,chapter:Math.floor(index/3),campaign:true,campaignVersion:2,generation:6,spawn:{x:0,y:0,z:-12,yaw:Math.PI},bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},walkable:[{x:0,y:0,z:0,w:120,d:120}],meshes:[],lights:[],colliders:[],pickups:[],trophies:[],
    cores:[{x:45,y:0,z:45},{x:48,y:0,z:45},{x:51,y:0,z:45}],exit:{x:54,y:0,z:45},
    enemies:[{x:0,y:0,z:0,type:3,boss:true,bossScale:[5.4,7.2,9][stage],bossKind:['colossus','siegebreaker','custodian'][stage],maxHp:600,arena,deployed:true}],
    progression:{version:1,weaponSlots:5,startWeapons:[false,false,false,false,true],startAmmo:[0,0,0,0,1],startShield:true,ammoCaps:[180,36,12,16,1],maxActive:6}};}
for(const index of [0,1,2]){
  W.__HURTS=[];const sim=W.FSimulation.create(world(index),{brain:W.FBrain.create({mode:'cpu'})});const s=sim.state,p=s.player;
  let t=0;const kinds={};
  while(t<T&&!s.dead){const e=s.enemies[0];p.yaw=Math.atan2(e.x-p.x,-(e.z-p.z));sim.step(1/60,{fireLeft:true});t+=1/60;for(const ev of s.events)if(ev.name==='bossImpact')kinds[ev.kind]=(kinds[ev.kind]||0)+1;s.events.length=0;p.hp=Math.max(p.hp,1);}
  const by={};for(const h of W.__HURTS){const k=LINES[h.line]||'l'+h.line;by[k]=by[k]||{coups:0,bloques:0,brut:0,pv:0};by[k].coups++;by[k].bloques+=h.shield>0;by[k].brut+=h.raw;by[k].pv+=h.hp;}
  const total=Object.values(by).reduce((n,v)=>n+v.pv,0);
  console.log(`boss ${['colossus','siegebreaker','custodian'][index]} (${T} s, garde levee, PV maintenus >=1): attaques`,JSON.stringify(kinds));
  for(const [k,v] of Object.entries(by))console.log(`  ${k}: ${v.coups} coups, ${v.bloques} bloques, ${v.brut.toFixed(0)} bruts -> ${v.pv.toFixed(0)} PV (${(v.pv/total*100).toFixed(0)} % des PV perdus)`);
}
