// Read-only statistics on generated METAL worlds (main realm loader of bench/sim): static colliders, destructible
// kinds, crate-sized solid props that could become dynamic bodies, room areas (prop density planning).
import {loadFast} from '../sim/fast.mjs';
const ctx=loadFast(),{FWorld}=ctx.window;
for(const [label,idx,opts] of [['classic-0',0,undefined],['classic-2',2,undefined],['campaign-0',0,{campaign:true}],['campaign-9',9,{campaign:true}],['campaign-15',15,{campaign:true}]]){
  const w=FWorld.create(96,idx,opts),kinds={};for(const g of w.destructibles||[])kinds[g.kind]=(kinds[g.kind]||0)+1;
  const b=w.bounds,area=(w.rooms||[]).reduce((a,r)=>a+(r.w||0)*(r.d||0),0);
  let crate=0,low=0,thin=0;const sizes=[];
  for(const g of w.destructibles||[])if(g.kind==='prop'&&g.colliders.length===1){const c=w.colliders[g.colliders[0]],sx=c.maxX-c.minX,sy=c.maxY-c.minY,sz=c.maxZ-c.minZ;sizes.push([sx,sy,sz]);if(Math.max(sx,sy,sz)<=1.8&&Math.min(sx,sy,sz)>=.3)crate++;if(sy<=1.0)low++;if(Math.min(sx,sz)<.3)thin++;}
  const cats={};for(const c of w.colliders){const m=w.meshes[c.mesh],k=m.category||'none';cats[k]=(cats[k]||0)+1;}
  console.log(`${label}: bounds ${(b.maxX-b.minX).toFixed(0)}x${(b.maxZ-b.minZ).toFixed(0)} m, colliders ${w.colliders.length}, meshes ${w.meshes.length}, rooms ${w.rooms.length} (floor area ${area.toFixed(0)} m2), walkable rects ${(w.walkable||[]).length} (sloped ${(w.walkable||[]).filter(f=>f.slopeX||f.slopeZ).length}), enemies ${w.enemies.length}`);
  console.log(`   destructible kinds ${JSON.stringify(kinds)} | single-collider props ${sizes.length}: crate-sized (0.3..1.8 m) ${crate}, low (h<=1 m) ${low}, thin ${thin}`);
  console.log(`   collider categories ${JSON.stringify(Object.fromEntries(Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,12)))}`);
}
