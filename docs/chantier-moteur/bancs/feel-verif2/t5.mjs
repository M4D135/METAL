// FEEL-09: of the "jumpable" colliders (top 0.43..1.0 m), how many are the outdoor boundary walls themselves?
import {load} from './L.mjs';
const W=load();
for(const idx of [0,5,9,17]){
  const w=W.FWorld.create(96,idx,{campaign:true,campaignVersion:2});const sim=W.FSimulation.create(w,{});
  const ob=w.outdoorBoundaries||[];
  const isB=q=>ob.some(o=>{const sx=o.alongX?o.length:o.thickness,sz=o.alongX?o.thickness:o.length;return Math.abs((q.minX+q.maxX)/2-o.x)<.06&&Math.abs((q.minZ+q.maxZ)/2-o.z)<.06&&Math.abs((q.maxX-q.minX)-sx)<.2&&Math.abs((q.maxZ-q.minZ)-sz)<.2;});
  let jump=0,jb=0,jo=0;const kinds={};const hs={};
  for(const q of w.colliders){const cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2;let g=-Infinity;
    for(const [ox,oz] of [[q.minX-.35,cz],[q.maxX+.35,cz],[cx,q.minZ-.35],[cx,q.maxZ+.35]]){const y=sim.ground(ox,oz);if(Number.isFinite(y))g=Math.max(g,y);}
    if(!Number.isFinite(g))continue;const h=q.maxY-g;if(q.minY>g+.5)continue;
    if(h>.43&&h<=1.0){jump++;if(isB(q))jb++;else{jo++;const k=h.toFixed(2);hs[k]=(hs[k]||0)+1;}}}
  console.log('monde',idx,'stage',w.stage,'colliders',w.colliders.length,'outdoorBoundaries',ob.length,'heights',[...new Set(ob.map(o=>o.height))].join('/'),'| 0.43-1.0:',jump,'dont murets de bordure',jb,'autres',jo,JSON.stringify(hs).slice(0,300));
}
