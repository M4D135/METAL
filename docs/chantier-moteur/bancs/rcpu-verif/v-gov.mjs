// RCPU-08 : simulation independante du VRAI resolutionGovernor (renderer.js:746-764) exporte en memoire.
// Modele : temps GPU = T1*scale^2 (+ bruit gaussien 6 %), presentation quantifiee sur la periode vsync
// (intervalle = ceil(T/P)*P), ou VRR (intervalle = max(T, Pmin)). 60 s simulees par profil.
import {loadRendererOnly} from './lib.mjs';
const root=process.argv[2];const X=loadRendererOnly(root,{internals:true}).__x;
let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)>>>0)/4294967296;const gauss=()=>{let u=0;for(let i=0;i<6;i++)u+=rnd();return (u-3)/Math.sqrt(.5);};
function run(T1,mode,P,seconds=60){
  const g=X.resolutionGovernor();let t=0,scale=1,changes=0,frames=0,late=0,prev=1;const scales=new Map();
  while(t<seconds*1000){
    const gpu=T1*scale*scale*(1+.06*gauss());
    const interval=mode==='vrr'?Math.max(gpu,P):Math.max(1,Math.ceil(gpu/P-1e-9))*P;
    t+=interval;frames++;if(interval>P*1.5)late++;
    scale=g.update({adaptive:true,frameMs:interval},'auto');
    if(scale!==prev){changes++;prev=scale;}
    scales.set(scale,(scales.get(scale)||0)+interval);
  }
  const dominant=[...scales.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([s,ms])=>s+':'+(100*ms/t).toFixed(0)+'%').join(' ');
  return {T1,mode,P:+P.toFixed(2),fps:+(frames/(t/1000)).toFixed(1),changesPerMin:+(changes/(t/60000)).toFixed(1),latePct:+(100*late/frames).toFixed(1),finalScale:scale,timeAtScale:dominant};
}
for(const [mode,P] of [['vsync',1000/60],['vsync',1000/120],['vrr',1000/144]])
  for(const T1 of [14,17,19,21,24,27,30,36])console.log(JSON.stringify(run(T1,mode,P)));
