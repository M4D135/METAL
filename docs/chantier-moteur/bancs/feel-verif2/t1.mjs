// FEEL-01: campaign v2 start equipment and dash vs shield.
import {load} from './L.mjs';
const W=load();
for(const seed of [96,7,1234]){
const w=W.FWorld.create(seed,0,{campaign:true,campaignVersion:2});const sim=W.FSimulation.create(w,{brain:W.FBrain.create({mode:'cpu'})});
const s=sim.state,p=s.player;
const eq=JSON.stringify(s.equipment);const x0=p.x,z0=p.z,e0=s.shield.energy;
sim.step(1/60,{dash:true});const d=p.dashing,ev=s.events.map(e=>e.name).join(',');for(let i=0;i<30;i++)sim.step(1/60,{});
console.log('seed',seed,'equip',eq,'shield owned',s.inventory.shield,'dash->p.dashing',d,'p.dash',p.dash.toFixed(2),'energy',e0,'->',s.shield.energy.toFixed(1),'events',ev,'moved',Math.hypot(p.x-x0,p.z-z0).toFixed(2));
}
