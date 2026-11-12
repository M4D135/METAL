// Real worlds: open edges (drop > 0.42 m, no blocking collider at the edge) where a dash would go airborne.
import {vload} from './vload.mjs';
const root=process.argv[2];const W=vload(root,['renderer','world','destruction','economy','brain','simulation']);
for(const index of [0,1,2,17]){
  const w=W.FWorld.create(96,index,{campaign:true,campaignVersion:2});const sim=W.FSimulation.create(w,{});const b=w.bounds;let open=0,guarded=0;const drops={};
  for(const dir of [0,1])for(let a=(dir?b.minX:b.minZ)+1;a<(dir?b.maxX:b.maxZ)-1;a+=3)for(let c=(dir?b.minZ:b.minX)+1;c<(dir?b.maxZ:b.maxX)-1;c+=.15){
    const x=dir?a:c,z=dir?c:a,nx=dir?x:x+.15,nz=dir?z+.15:z;const y=sim.ground(x,z),y2=sim.ground(nx,nz);if(!Number.isFinite(y)||!Number.isFinite(y2))continue;
    for(const [hy,lx,lz] of [[y-y2,nx,nz],[y2-y,x,z]]){if(hy<=.42)continue;const ux=hy===y-y2?x:nx,uz=hy===y-y2?z:nz,top=Math.max(y,y2);
      // walking from the high side toward the low side: blocked at the edge by a collider at standing height?
      if(sim.blocked(lx,lz,.28,top))guarded++;else{open++;const k=hy>=1.5?'>=1.5':hy.toFixed(1);drops[k]=(drops[k]||0)+1;}}}
  console.log(`monde ${index}: bords avec chute >0,42 m sur lignes de sonde (pas 3 m): ouverts ${open}, gardes par un collider ${guarded} ; chutes ouvertes ${JSON.stringify(drops)}`);
}
