// Real worlds: crossable height steps (0.05-0.43 m) not blocked by colliders, on probe lines every 2 m in X and Z,
// and whether each sits on the navigable area (reachable from spawn through the nav grid).
import {vload} from './vload.mjs';
const root=process.argv[2];const W=vload(root,['renderer','world','destruction','economy','brain','simulation']);
for(const index of [0,1,2,17]){
  const w=W.FWorld.create(96,index,{campaign:true,campaignVersion:2});const sim=W.FSimulation.create(w,{});const b=w.bounds;
  const nav=sim.nav,dist=nav.dist;const reach=(x,z)=>{const c=nav.cell(x,z);return c>=0&&Number.isFinite(dist?.[c])&&dist[c]<1e8;};
  let cross=0,reachable=0;const hist={};
  for(const dir of [0,1])for(let a=(dir?b.minX:b.minZ)+1;a<(dir?b.maxX:b.maxZ)-1;a+=2)for(let c=(dir?b.minZ:b.minX)+1;c<(dir?b.maxZ:b.maxX)-1;c+=.1){
    const x=dir?a:c,z=dir?c:a,nx=dir?x:x+.1,nz=dir?z+.1:z;const y=sim.ground(x,z),y2=sim.ground(nx,nz);if(!Number.isFinite(y)||!Number.isFinite(y2))continue;const d=Math.abs(y2-y);
    if(d<.05||d>.43)continue;if(sim.blocked(x,z,.28,y)||sim.blocked(nx,nz,.28,y2))continue;cross++;const k=d.toFixed(2);hist[k]=(hist[k]||0)+1;if(reach(x,z)||reach(nx,nz))reachable++;}
  console.log(`monde ${index}: marches franchissables non bloquees ${cross} (dont sur cellules nav atteignables ${reachable}) ; ${JSON.stringify(hist)}`);
}
