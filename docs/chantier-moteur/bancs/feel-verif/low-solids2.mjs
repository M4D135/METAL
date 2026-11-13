import {vload} from './vload.mjs';
const root=process.argv[2];const W=vload(root,['renderer','world','destruction','economy','brain','simulation']);
const w=W.FWorld.create(96,0,{campaign:true,campaignVersion:2});const sim=W.FSimulation.create(w,{});
const near=(x,z,list,lbl)=>list.filter(o=>o&&Math.hypot(o.x-x,o.z-z)<3).map(()=>lbl);
for(const q of w.colliders){const cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2,g=sim.ground(q.minX-.35,cz);const h=q.maxY-Math.max(g,sim.ground(q.maxX+.35,cz));if(q.minY>g+.06||h<=.06||h>.43)continue;
  const m=w.meshes[q.mesh];console.log(JSON.stringify({c:[+cx.toFixed(1),+cz.toFixed(1)],w:+(q.maxX-q.minX).toFixed(2),d:+(q.maxZ-q.minZ).toFixed(2),h:+h.toFixed(2),shape:m?.shape,mat:m?.mat,region:m?.region,tags:[...near(cx,cz,w.cores,'core'),...near(cx,cz,[w.exit],'exit'),...near(cx,cz,w.shops||[],'shop'),...near(cx,cz,w.jumpPads||[],'pad'),...near(cx,cz,w.pickups||[],'pickup')]}));}
console.log('--- colliders stacked above the low solids');
for(const q of w.colliders){const cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2,g=sim.ground(q.minX-.35,cz),h=q.maxY-g;if(q.minY>g+.06||h<=.06||h>.43)continue;
  const above=w.colliders.filter(o=>o!==q&&o.minX<q.maxX&&o.maxX>q.minX&&o.minZ<q.maxZ&&o.maxZ>q.minZ&&o.maxY>q.maxY+.05);
  const cover=above.reduce((a,o)=>a+Math.max(0,Math.min(o.maxX,q.maxX)-Math.max(o.minX,q.minX))*Math.max(0,Math.min(o.maxZ,q.maxZ)-Math.max(o.minZ,q.minZ)),0)/((q.maxX-q.minX)*(q.maxZ-q.minZ));
  console.log(JSON.stringify({c:[+cx.toFixed(1),+cz.toFixed(1)],h:+h.toFixed(2),stacked:above.length,coverFraction:+cover.toFixed(2),aboveTop:above.map(o=>+o.maxY.toFixed(2))}));}
