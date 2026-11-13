// (g) Enemy accuracy against a fast target (IA-11): player moved kinematically on a 14 m circle around a mixed squad at a fixed
// tangential speed, grounded or hopping (6.2 m/s, g 20). Paired: baseline observed-velocity clamp (±6) vs widened (±11).
import {loadFast} from './lib.mjs';
const A=loadFast(),B=loadFast({patches:{simulation:[["e.observedVX=clamp((p.x-e.lastSeenX)/interval,-6,6);e.observedVZ=clamp((p.z-e.lastSeenZ)/interval,-6,6);","e.observedVX=clamp((p.x-e.lastSeenX)/interval,-11,11);e.observedVZ=clamp((p.z-e.lastSeenZ)/interval,-11,11);"]]}});
function world(){const enemies=[];for(let k=0;k<6;k++)enemies.push({x:Math.cos(k)*2.2,z:Math.sin(k)*2.2,type:k<3?0:k<5?2:1});
  return {seed:'aim',stage:0,generation:6,spawn:{x:14,y:0,z:0,yaw:0},bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},walkable:[{x:0,y:0,z:0,w:120,d:120}],meshes:[],lights:[],colliders:[],enemies,pickups:[],cores:[{x:50,z:50},{x:52,z:50},{x:54,z:50}],exit:{x:56,z:50}};}
function run(Wn,speed,hop,radius=14,secs=60,pattern='circle'){
  const sim=Wn.FSimulation.create(world(),{}),s=sim.state,p=s.player;let shots=0,hits=0,dmg=0,ang=0,t=0,jt=0,dir=1;
  for(let i=0;i<secs*60;i++){
    const dt=1/60;t+=dt;if(pattern==='zigzag'&&Math.floor(t/1.2)!==Math.floor((t-dt)/1.2))dir=-dir;ang+=dir*speed/radius*dt;jt=(jt+dt)%.62;
    p.x=Math.cos(ang)*radius;p.z=Math.sin(ang)*radius;p.y=hop?Math.max(0,6.2*jt-10*jt*jt):0;p.airborne=false;p.airVX=p.airVY=p.airVZ=0;
    const hp=p.hp;sim.step(dt,{});if(p.hp<hp){hits++;dmg+=hp-p.hp;}p.hp=sim.stats.maxHp;s.dead=false;
    for(const e of s.events)if(e.name==='enemyShot')shots++;s.events.length=0;
  }
  return {shots,hits,dmg:Math.round(dmg)};
}
const rows=[];
for(const pattern of ['circle','zigzag'])for(const hop of [false,true])for(const speed of [5.4,7.6,10.5]){
  const a=run(A,speed,hop,14,60,pattern),b=run(B,speed,hop,14,60,pattern);
  rows.push({trajectoire:pattern,saut:hop?'oui':'non','vitesse m/s':speed,'tirs (±6)':a.shots,'touches (±6)':a.hits,'% (±6)':+(100*a.hits/Math.max(1,a.shots)).toFixed(1),'dégâts/min (±6)':a.dmg,'tirs (±11)':b.shots,'touches (±11)':b.hits,'% (±11)':+(100*b.hits/Math.max(1,b.shots)).toFixed(1),'dégâts/min (±11)':b.dmg});
}
console.table(rows);
