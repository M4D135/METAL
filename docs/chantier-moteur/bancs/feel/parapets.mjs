// Low obstacles (0.43..1.25 m) whose far side is only the fallback substrate (a fatal drop for a jumping player).
import {load} from './load.mjs';
const root=process.argv[2];
const W=load(root,{modules:['renderer','world','destruction','economy','brain','simulation']});
for(const idx of [0,9,17]){
  const w=W.FWorld.create(96,idx,{campaign:true,campaignVersion:2});const sim=W.FSimulation.create(w,{});
  const authored=(x,z)=>{let best=-Infinity;for(const f of w.walkable)if(!f.substrate&&!f.fallback&&Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2)best=Math.max(best,(f.y||0));return best;};
  let low=0,voidEdge=0,dropEdge=0;
  for(const q of w.colliders){
    const sx=q.maxX-q.minX,sz=q.maxZ-q.minZ,cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2;
    const sides=sx<sz?[[q.minX-.6,cz],[q.maxX+.6,cz]]:[[cx,q.minZ-.6],[cx,q.maxZ+.6]];
    const g=sides.map(([x,z])=>authored(x,z));const top=Math.max(...g.filter(Number.isFinite));if(!Number.isFinite(top)||q.minY>top+.5)continue;
    const h=q.maxY-top;if(h<=.43||h>1.25)continue;low++;
    if(g.some(v=>!Number.isFinite(v)))voidEdge++;else if(Math.abs(g[0]-g[1])>.43)dropEdge++;
  }
  console.log(`monde ${idx}: obstacles bas 0.43-1.25 m: ${low}, dont bord de vide (substrat seul derriere): ${voidEdge}, dont rebord vers terrasse inferieure: ${dropEdge}`);
}
// detail: is the far side inside the world bounds (reachable substrate) or outside?
for(const idx of [0]){
  const w=W.FWorld.create(96,idx,{campaign:true,campaignVersion:2});const b=w.bounds;
  const authored=(x,z)=>w.walkable.some(f=>!f.substrate&&!f.fallback&&Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2);
  const substrate=(x,z)=>w.walkable.some(f=>(f.substrate||f.fallback)&&Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2);
  let inside=0,outside=0,sub=0;const ex=[];
  for(const q of w.colliders){const sx=q.maxX-q.minX,sz=q.maxZ-q.minZ,cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2;const sides=sx<sz?[[q.minX-.6,cz],[q.maxX+.6,cz]]:[[cx,q.minZ-.6],[cx,q.maxZ+.6]];
    const h=q.maxY-q.minY;if(h<=.43||h>1.25)continue;for(const [x,z] of sides)if(!authored(x,z)){if(x-.28<b.minX||x+.28>b.maxX||z-.28<b.minZ||z+.28>b.maxZ)outside++;else{inside++;if(substrate(x,z))sub++;if(ex.length<5)ex.push({x:+x.toFixed(1),z:+z.toFixed(1),top:q.maxY,minY:q.minY});}}}
  console.log('monde',idx,'cote non-authored: hors limites',outside,'dans limites',inside,'(dont substrat',sub,')',JSON.stringify(ex),'bounds',JSON.stringify(b));
}
