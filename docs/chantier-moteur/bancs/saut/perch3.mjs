// (e) Controlled perch test: 4 pure rushers (type 1, no ordnance) + 2 shooters around a box of height h. Player passive on the box
// centre, or on the ground at the same place in the same world without the box. 30 s, deterministic. Baseline AI vs parade (P1+P2).
import {loadFast} from './lib.mjs';
const mk=(RUSHV,REACH)=>({simulation:[
  ["const path=route(e,x,z);if(!path)return false;\n      e.goalX=x;e.goalZ=z;e.path=path;","if(blocked(x,z,radius(e))){const bx=e.x-x,bz=e.z-z,bd=Math.hypot(bx,bz)||1;for(let k=1;k<=10;k++){const nx=x+bx/bd*k*.35,nz=z+bz/bd*k*.35;if(!blocked(nx,nz,radius(e))){x=nx;z=nz;break;}}}\n      const path=route(e,x,z);if(!path)return false;\n      e.goalX=x;e.goalZ=z;e.path=path;"],
  ["if(!e.airborne&&d<11.5&&d>1&&Math.abs(e.aimY-1.45-e.baseY)<.65&&segmentFree(e.x,e.z,e.aimX,e.aimZ,.38)){",`const dyR=e.aimY-1.45-e.baseY;if(!e.airborne&&d<11.5&&d>1&&(Math.abs(dyR)<.65&&segmentFree(e.x,e.z,e.aimX,e.aimZ,.38)||dyR>=.65&&dyR<${RUSHV}&&d>1.6&&segmentFree(e.x,e.z,e.aimX-dx/d*1.3,e.aimZ-dz/d*1.3,.38))){`],
  ["if(!e.rushHit&&Math.abs(e.baseY-p.y)<.9&&Math.hypot(e.x-p.x,e.z-p.z)<.9&&",`if(!e.rushHit&&(Math.abs(e.baseY-p.y)<.9&&Math.hypot(e.x-p.x,e.z-p.z)<.9||p.y-e.baseY>=.9&&p.y-e.baseY<${RUSHV}&&Math.hypot(e.x-p.x,e.z-p.z)<${REACH})&&`]]});
const AMP=+process.argv[2]||.8,PERIOD=+process.argv[3]||1.2;const A=loadFast(),B=loadFast({patches:mk(1.7,1.5)});
function world(h,size){const enemies=[];for(let k=0;k<4;k++)enemies.push({x:Math.cos(k*1.57+.4)*8,z:Math.sin(k*1.57+.4)*8,type:1});enemies.push({x:12,z:3,type:0},{x:-11,z:-5,type:2});
  return {seed:'perch',stage:0,generation:6,spawn:{x:0,y:h,z:0,yaw:0},bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40},walkable:[{x:0,y:0,z:0,w:80,d:80}],meshes:[],lights:[],colliders:h>0?[{minX:-size/2,maxX:size/2,minZ:-size/2,maxZ:size/2,minY:0,maxY:h}]:[],enemies,pickups:[],cores:[{x:30,z:30},{x:32,z:30},{x:34,z:30}],exit:{x:36,z:30}};}
function run(Wn,h,size,secs=30){const sim=Wn.FSimulation.create(world(h,size),{}),s=sim.state,p=s.player;let dmg=0,rushes=0,hits=0,wait=0,tot=0,shots=0;const was=new Map();
  for(let i=0;i<secs*60;i++){const hp=p.hp;sim.step(1/60,{});dmg+=Math.max(0,hp-p.hp);p.hp=sim.stats.maxHp;s.dead=false;p.x=AMP*Math.sin(i/60*2*Math.PI/PERIOD);p.z=0;
    for(const ev of s.events)if(ev.name==='enemyShot')shots++;s.events.length=0;
    for(const e of s.enemies){if(!(e.hp>0)||!e.hasMemory)continue;tot++;if(e.moveSpeed===0&&e.path.length===0&&!(e.windup>0||e.burstLeft>0||e.rushTime>0))wait++;const r=e.rushTime>0;if(r&&!was.get(e.id))rushes++;if(r&&e.rushHit&&!was.get('h'+e.id)){hits++;was.set('h'+e.id,true);}if(!r)was.set('h'+e.id,false);was.set(e.id,r);}}
  return {dmg:Math.round(dmg),rushes,hits,shots,wait:tot?Math.round(100*wait/tot):0};}
const rows=[];
for(const size of [2.4])for(const h of [0,.72,.96,1.2,1.6]){const a=run(A,h,size),b=run(B,h,size);
  rows.push({'boîte m':size,'hauteur m':h,'dégâts base':a.dmg,'ruées base':a.rushes,'touches ruée base':a.hits,'tirs base':a.shots,'attente % base':a.wait,'dégâts parade':b.dmg,'ruées parade':b.rushes,'touches ruée parade':b.hits,'tirs parade':b.shots,'attente % parade':b.wait});}
console.table(rows);
