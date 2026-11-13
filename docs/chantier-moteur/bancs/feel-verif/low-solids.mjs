// Low static solids (0.06-0.43 m above the floor) that block the player although they are below the 0.42 m step height.
import {vload} from './vload.mjs';
const root=process.argv[2];const W=vload(root,['renderer','world','destruction','economy','brain','simulation']);
for(const index of [0,1,2,17]){
  const w=W.FWorld.create(96,index,{campaign:true,campaignVersion:2});const sim=W.FSimulation.create(w,{});const cats={};let n=0;
  for(const q of w.colliders){const cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2;let g=-Infinity;for(const [ox,oz] of [[q.minX-.35,cz],[q.maxX+.35,cz],[cx,q.minZ-.35],[cx,q.maxZ+.35]]){const y=sim.ground(ox,oz);if(Number.isFinite(y))g=Math.max(g,y);}
    if(!Number.isFinite(g)||q.minY>g+.06)continue;const h=q.maxY-g;if(h<=.06||h>.43)continue;n++;const m=w.meshes[q.mesh];const k=(m?.category||'?')+'@'+h.toFixed(2);cats[k]=(cats[k]||0)+1;}
  console.log(`monde ${index}: ${n} solides bas bloquants ;`,JSON.stringify(cats));
}
