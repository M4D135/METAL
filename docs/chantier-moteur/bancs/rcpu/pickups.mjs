// RCPU: how many pickup/loot models are built per frame, and how many the renderer's own conservative
// actorFilter (camera + every shadow volume) would keep. Also times supplyModel-equivalent work per pickup.
import {scene} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||3000),[kind,idx]=(process.argv[4]||'camp:17').split(':');
const S=scene(root,{world:[kind,+idx],wrap:false});const s=S.sim.state;
let built=0,kept=0,n=0,parts=0;
for(let i=0;i<frames+120;i++){
  const r=S.frame(1/60,{tour:true});if(i<120)continue;n++;
  const p=s.player,longView=(S.world.environment?.longViewZones||[]).some(a=>Math.abs(p.x-a.x)<=a.w/2+35&&Math.abs(p.z-a.z)<=a.d/2+35),range=longView?100:70;
  const keep=S.renderer.actorFilter(r.camera,{shadows:true});
  for(const c of [...s.pickups,...(s.loot||[])]){if(c.taken)continue;if((c.x-p.x)**2+(c.z-p.z)**2>=(range+3)**2)continue;built++;if(keep(c.x,(c.y||0)+.5,c.z,1.6))kept++;}
}
console.log('world',kind+':'+idx,'pickups+loot modelled per frame',(built/n).toFixed(1),'| kept by actorFilter(camera+shadow volumes, r=1.6 m)',(kept/n).toFixed(1),'('+(100*kept/Math.max(1,built)).toFixed(0)+'%)');
