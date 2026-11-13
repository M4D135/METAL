import {load} from './load.mjs';
const root=process.argv[2];
const W=load(root,{modules:['renderer','world','destruction','economy','brain','simulation']});
for(const idx of [0,17]){
  const w=W.FWorld.create(96,idx,{campaign:true,campaignVersion:2});const sim=W.FSimulation.create(w,{});
  const hist={};
  for(const q of w.colliders){const cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2;let g=-Infinity;for(const [ox,oz] of [[q.minX-.35,cz],[q.maxX+.35,cz],[cx,q.minZ-.35],[cx,q.maxZ+.35]]){const y=sim.ground(ox,oz);if(Number.isFinite(y))g=Math.max(g,y);}
    if(!Number.isFinite(g)||q.minY>g+.5)continue;const h=Math.round((q.maxY-g)*10)/10;if(h<=.43||h>2.2)continue;const fp=Math.round(Math.max(q.maxX-q.minX,q.maxZ-q.minZ)*2)/2;const k=h+'m';hist[k]=hist[k]||{n:0,sizes:{}};hist[k].n++;hist[k].sizes[fp]=(hist[k].sizes[fp]||0)+1;}
  console.log('monde',idx,Object.entries(hist).sort((a,b)=>parseFloat(a[0])-parseFloat(b[0])).map(([k,v])=>k+':'+v.n+' '+JSON.stringify(v.sizes)).join('\n'));
  console.log('jumpPads',w.jumpPads?.length,'pads flightTime',(w.jumpPads||[]).map(j=>j.flightTime).join(','),'lifts',w.lifts?.length,'doors',w.doors?.length,'encounters',w.encounters?.length);
}
