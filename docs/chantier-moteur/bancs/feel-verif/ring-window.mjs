// Colossus ring vs dash timing offset (left hand free). Hit rate per offset relative to predicted contact.
import {vload} from './vload.mjs';
const root=process.argv[2];const W=vload(root,['destruction','economy','brain','simulation']);
const world=()=>({seed:'verif-ring',stage:0,index:0,chapter:0,campaign:true,campaignVersion:2,generation:6,spawn:{x:0,y:0,z:-12,yaw:Math.PI},bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},walkable:[{x:0,y:0,z:0,w:120,d:120}],meshes:[],lights:[],colliders:[],pickups:[],trophies:[],cores:[{x:45,y:0,z:45},{x:48,y:0,z:45},{x:51,y:0,z:45}],exit:{x:54,y:0,z:45},enemies:[{x:0,y:0,z:0,type:3,boss:true,bossScale:5.4,bossKind:'colossus',maxHp:600,arena:{x:0,y:0,z:0,r:28},deployed:true}],progression:{version:1,weaponSlots:5,startWeapons:[false,false,false,false,true],startAmmo:[0,0,0,0,1],startShield:true,ammoCaps:[180,36,12,16,1],maxActive:6}});
const out=[];
for(const off of [-.30,-.25,-.20,-.183,-.17,-.15,-.10,-.05,-.02,0,.02]){
  const sim=W.FSimulation.create(world(),{brain:W.FBrain.create({mode:'cpu'})});sim.selectLeftWeapon(null);const s=sim.state,p=s.player;let rings=0,hits=0;const done=new Set();
  for(let t=0;t<60;t+=1/60){const e=s.enemies[0];p.yaw=Math.atan2(e.x-p.x,-(e.z-p.z));let dash=false;
    for(const a of s.bossAttacks)if(a.kind==='ring'&&!done.has(a.id)){const D=Math.hypot(p.x-a.x,p.z-a.z),contact=a.tell+Math.max(0,D-.28)/a.radius*a.activeDuration;if(a.age>=contact+off-1e-9&&p.dash<=0){dash=true;done.add(a.id);}}
    const hp=p.hp;sim.step(1/60,{dash,moveX:dash?1:0});for(const ev of s.events)if(ev.name==='hurt'&&p.hp<hp)hits++;s.events.length=0;p.hp=100;}
  for(const a of done)rings++;out.push({decalage_s:off,ondes:rings,touches:hits});
}
console.table(out);
