// Hold the trigger for T seconds per weapon (arsenal rules), count shots, first overheat, locked share.
// usage: node heat-indep.mjs <root> [T=10] [hz=60]
import {vload,arena} from './vload.mjs';
const root=process.argv[2],T=+process.argv[3]||10,HZ=+process.argv[4]||60;const W=vload(root);
const rows={};
for(const [label,right,left] of [['SMG',0,null],['pompe',1,null],['roquette',2,null],['grenade',3,null],['SMG+pompe G',0,1]]){
  const sim=W.FSimulation.create(arena(),{equipment:{right,left,shieldEnergy:100}});const s=sim.state,p=s.player;
  let t=0,shots0=s.shots,first=null,locked=0;const dt=1/HZ;
  while(t<T){sim.step(dt,{fire:true,fireLeft:left!==null,weapon:right});t+=dt;if(p.overheated){locked+=dt;if(first===null)first=t;}for(const k of [0,1,2,3])s.inventory.ammo[k]=Math.max(s.inventory.ammo[k],10);}
  rows[label]={tirs:s.shots-shots0,premiereSurchauffe:first===null?'-':+first.toFixed(2),bloque:+(locked/T*100).toFixed(0)+'%',arsenal:!!s.equipment};
}
console.table(rows);
