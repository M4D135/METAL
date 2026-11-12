// Colossus shockwave ring: can the player avoid it with a timed dash? Shield in left hand vs empty left hand.
import {load,hurtProbe} from './load.mjs';
const root=process.argv[2],T=60;
const W=load(root,{modules:['destruction','economy','brain','simulation'],patch:hurtProbe});
function world(){const arena={x:0,y:0,z:0,r:28};return {seed:'feel-ring',stage:0,index:0,chapter:0,campaign:true,campaignVersion:2,generation:6,spawn:{x:0,y:0,z:-12,yaw:Math.PI},bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},walkable:[{x:0,y:0,z:0,w:120,d:120}],meshes:[],lights:[],colliders:[],pickups:[],trophies:[],cores:[{x:45,y:0,z:45},{x:48,y:0,z:45},{x:51,y:0,z:45}],exit:{x:54,y:0,z:45},enemies:[{x:0,y:0,z:0,type:3,boss:true,bossScale:5.4,bossKind:'colossus',maxHp:600,arena,deployed:true}],progression:{version:1,weaponSlots:5,startWeapons:[false,false,false,false,true],startAmmo:[0,0,0,0,1],startShield:true,ammoCaps:[180,36,12,16,1],maxActive:6}};}
for(const [label,left,tryDash] of [['bouclier en main gauche, Espace au passage de l onde','shield',true],['main gauche vide, esquive au passage de l onde',null,true],['bouclier, aucune esquive','shield',false]]){
  W.__HURTS=[];const sim=W.FSimulation.create(world(),{brain:W.FBrain.create({mode:'cpu'})});sim.selectLeftWeapon(left);const s=sim.state,p=s.player;let t=0,rings=0,dashes=0,bashes=0;
  const seen=new Set();
  while(t<T){const e=s.enemies[0];p.yaw=Math.atan2(e.x-p.x,-(e.z-p.z));let dash=false;
    for(const a of s.bossAttacks)if(a.kind==='ring'&&a.active){if(!seen.has(a.id)){seen.add(a.id);rings++;}const d=Math.hypot(p.x-a.x,p.z-a.z);if(tryDash&&a.currentRadius<d&&d-a.currentRadius<1.4&&!a.hitPlayer)dash=true;}
    sim.step(1/60,{dash,moveX:dash?1:0});t+=1/60;for(const ev of s.events){if(ev.name==='dash')dashes++;if(ev.name==='shieldBash')bashes++;}s.events.length=0;p.hp=100;
  }
  const ringHits=W.__HURTS.filter(h=>h.line===1722);
  console.log(`${label}: ondes ${rings}, touches par l onde ${ringHits.filter(h=>h.hp>0).length} (${ringHits.reduce((n,h)=>n+h.hp,0).toFixed(0)} PV), esquives ${dashes}, coups de bouclier ${bashes}`);
}
