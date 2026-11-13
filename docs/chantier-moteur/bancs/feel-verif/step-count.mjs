// Real worlds: walk a grid of probe segments and count height discontinuities the camera would snap through (0.02-0.43 m).
import {vload} from './vload.mjs';
const root=process.argv[2];const W=vload(root,['renderer','world','destruction','economy','brain','simulation']);
for(const index of [0,1,2,17]){
  const w=W.FWorld.create(96,index,{campaign:true,campaignVersion:2});const sim=W.FSimulation.create(w,{});const b=w.bounds;
  let snaps=0,big=0,len=0;const hist={};
  for(let z=b.minZ+1;z<b.maxZ-1;z+=4)for(let x=b.minX+1;x<b.maxX-1;x+=.1){const a=sim.ground(x,z),c=sim.ground(x+.1,z);if(!Number.isFinite(a)||!Number.isFinite(c))continue;len+=.1;const d=Math.abs(c-a);if(d>.02&&d<=.43){snaps++;const k=d.toFixed(2);hist[k]=(hist[k]||0)+1;}}
  console.log(`monde ${index}: ${snaps} marches franchissables (0,02-0,43 m) sur ${Math.round(len)} m de lignes de sonde ; hauteurs ${JSON.stringify(hist)}`);
}
