// Effective fire cadence vs simulation step rate (heat pinned to 0 to isolate the timer quantisation).
import {vload,arena} from './vload.mjs';
const root=process.argv[2];const W=vload(root);const rows={};
for(const [label,weapon,nominal] of [['SMG',0,.125],['pompe',1,.98],['roquette',2,1.25],['grenade',3,.95]]){
  const r={nominalPerS:+(1/nominal).toFixed(2)};
  for(const hz of [30,60,75,120,144,165,240]){const sim=W.FSimulation.create(arena(),{equipment:{right:weapon,left:null,shieldEnergy:100}});const s=sim.state,p=s.player;const n0=s.shots;let t=0;
    while(t<10){sim.step(1/hz,{fire:true,weapon});t+=1/hz;p.heat=0;p.overheated=false;for(const k of [0,1,2,3])s.inventory.ammo[k]=99;}
    r[hz+'Hz']=+((s.shots-n0)/10).toFixed(2);}
  rows[label]=r;
}
console.table(rows);
