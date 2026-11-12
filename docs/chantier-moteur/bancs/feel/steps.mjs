// Vertical camera snaps: per-step changes of the player's feet height while grounded, on real campaign worlds,
// walking a straight scripted path (forward + slow turn). Reports the distribution of |dy| per 1/60 s step.
import {load} from './load.mjs';
const root=process.argv[2];
const W=load(root,{modules:['renderer','world','destruction','economy','brain','simulation']});
for(const idx of [0,9,17]){
  const w=W.FWorld.create(96,idx,{campaign:true,campaignVersion:2});
  const slopes=w.walkable.filter(f=>f.slopeX||f.slopeZ).length,stairs=w.walkable.filter(f=>!f.slopeX&&!f.slopeZ&&!f.substrate&&(f.w<1.2||f.d<1.2)).length;
  const sim=W.FSimulation.create(w,{});const s=sim.state,p=s.player;
  // freeze enemies so the walk is not interrupted
  for(const e of s.enemies){e.hp=0;}
  let snaps=[],last=p.y,grounded=0;
  for(let i=0;i<60*60;i++){const inp={moveY:1,sprint:true,lookX:Math.sin(i/200)*.012};sim.step(1/60,inp);if(s.dead)break;if(!p.airborne&&!s.player.airborne){const dy=p.y-last;if(Math.abs(dy)>.01)snaps.push(dy);grounded++;}last=p.y;}
  const up=snaps.filter(d=>d>.05),down=snaps.filter(d=>d<-.05);
  console.log(`monde ${idx}: rampes ${slopes}, petites dalles ${stairs}; sur ${grounded} pas au sol: ${up.length} montees >5 cm (max ${Math.max(0,...up).toFixed(2)} m), ${down.length} descentes >5 cm (min ${Math.min(0,...down).toFixed(2)} m)`);
}
