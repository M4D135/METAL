// How many static colliders become climbable with a jump of apex H (feet), per campaign world?
// A collider is "jumpable" if its top is between 0.43 m (step) and H above the floor under its centre.
import {load} from './load.mjs';
const root=process.argv[2],H=+process.argv[3]||1.0;
const W=load(root,{modules:['renderer','world','destruction','economy','brain','simulation']});
const rows=[];
for(const idx of [0,3,6,9,12,15,17]){
  const w=W.FWorld.create(96,idx,{campaign:true,campaignVersion:2});
  const sim=W.FSimulation.create(w,{});
  const hist={step:0,jump:0,tall:0};let jumpArea=0;const kinds={};
  for(const q of w.colliders){
    const cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2;let g=-Infinity;
    for(const [ox,oz] of [[q.minX-.35,cz],[q.maxX+.35,cz],[cx,q.minZ-.35],[cx,q.maxZ+.35]]){const y=sim.ground(ox,oz);if(Number.isFinite(y))g=Math.max(g,y);}
    if(!Number.isFinite(g))continue;const h=q.maxY-g;if(q.minY>g+.5)continue; // floating / overhead
    if(h<=.43)hist.step++;else if(h<=H){hist.jump++;jumpArea+=(q.maxX-q.minX)*(q.maxZ-q.minZ);const k=q.kind||q.tag||q.type||'?';kinds[k]=(kinds[k]||0)+1;}else hist.tall++;
  }
  // terrace edges: adjacent walkable rectangles with height difference in (0.43, H]
  let ledges=0;const f=w.walkable||[];for(let i=0;i<f.length;i++)for(let j=i+1;j<f.length;j++){const a=f[i],b=f[j];if(a.slopeX||a.slopeZ||b.slopeX||b.slopeZ||a.substrate||b.substrate)continue;const dy=Math.abs((a.y||0)-(b.y||0));if(dy<=.43||dy>H)continue;const ox=Math.min(a.x+a.w/2,b.x+b.w/2)-Math.max(a.x-a.w/2,b.x-b.w/2),oz=Math.min(a.z+a.d/2,b.z+b.d/2)-Math.max(a.z-a.d/2,b.z-b.d/2);if(ox>=-0.01&&oz>=-0.01&&(ox>0.3||oz>0.3))ledges++;}
  const heights=[...new Set(f.map(a=>Math.round((a.y||0)*100)/100))].sort((a,b)=>a-b);
  rows.push({monde:idx,colliders:w.colliders.length,'<=0.43':hist.step,['0.43-'+H]:hist.jump,['>'+H]:hist.tall,surfaceJumpable_m2:Math.round(jumpArea),rebordsSautables:ledges,hauteursSol:heights.slice(0,8).join(' '),kinds:JSON.stringify(kinds)});
}
console.table(rows);
