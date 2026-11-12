// Of the 0.43-1.0 m obstacles, how many are outdoor boundary walls (must stay unjumpable) vs interior?
import {vload} from './vload.mjs';
const root=process.argv[2];const W=vload(root,['renderer','world','destruction','economy','brain','simulation']);
for(const idx of [0,1,2,17]){
  const w=W.FWorld.create(96,idx,{campaign:true,campaignVersion:2});const sim=W.FSimulation.create(w,{});
  const bmesh=new Set((w.outdoorBoundaries||[]).map(b=>b.mesh));const kinds={};let jb=0,ji=0;
  for(const q of w.colliders){const cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2;let g=-Infinity;
    for(const [ox,oz] of [[q.minX-.35,cz],[q.maxX+.35,cz],[cx,q.minZ-.35],[cx,q.maxZ+.35]]){const y=sim.ground(ox,oz);if(Number.isFinite(y))g=Math.max(g,y);}
    if(!Number.isFinite(g)||q.minY>g+.5)continue;const h=q.maxY-g;if(h<=.43||h>1.0)continue;
    if(bmesh.has(q.mesh))jb++;else{ji++;const m=w.meshes[q.mesh];const tag=(m&&(m.tag||m.name||m.kind||m.part))||'?';kinds[tag]=(kinds[tag]||0)+1;}}
  console.log(`monde ${idx}: 0.43-1.0 m = ${jb+ji}, dont limites exterieures ${jb}, interieurs ${ji}`,JSON.stringify(kinds).slice(0,300));
}
