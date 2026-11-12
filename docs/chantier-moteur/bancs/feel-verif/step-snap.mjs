// Camera height continuity when walking onto a step (solid box 0.40 m, then 0.25 m authored floor step).
import {vload,arena} from './vload.mjs';
const root=process.argv[2];const W=vload(root);
function walk(world,label,HZ=60){
  const sim=W.FSimulation.create(world,{equipment:{right:0,left:null,shieldEnergy:100}});const s=sim.state,p=s.player;p.yaw=0;
  let prev=p.y,maxJump=0,changes=[],t=0;
  for(let i=0;i<HZ*2;i++){sim.step(1/HZ,{moveY:1,sprint:true});t+=1/HZ;const dy=p.y-prev;if(Math.abs(dy)>1e-6)changes.push({t:+t.toFixed(3),dy:+dy.toFixed(3)});maxJump=Math.max(maxJump,Math.abs(dy));prev=p.y;}
  console.log(`${label} @${HZ} Hz: plus grand saut de camera en une image ${(maxJump*100).toFixed(1)} cm ; variations: ${JSON.stringify(changes.slice(0,6))} ; airborne=${p.airborne} y final ${p.y.toFixed(2)}`);
}
const box=arena({colliders:[{minX:-3,maxX:3,minZ:-12,maxZ:-5,minY:0,maxY:.4}]});
walk(box,'caisse 0,40 m');walk(box,'caisse 0,40 m',144);
const terrace=arena({walkable:[{x:0,y:0,z:20,w:100,d:60},{x:0,y:.25,z:-30,w:100,d:40}]});
walk(terrace,'sol +0,25 m');
const down=arena({walkable:[{x:0,y:.4,z:20,w:100,d:60},{x:0,y:0,z:-30,w:100,d:40}]});
walk(down,'descente -0,40 m');
