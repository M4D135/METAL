// Campaign v2 start: is the dash (with invulnerability frames) available while the shield is in the left hand?
import {load} from './load.mjs';
const root=process.argv[2];const W=load(root);
const w=W.FWorld.create(96,0,{campaign:true,campaignVersion:2});const sim=W.FSimulation.create(w,{brain:W.FBrain.create({mode:'cpu'})});
const s=sim.state,p=s.player;
console.log('equipement initial',JSON.stringify(s.equipment),'bouclier possede',s.inventory.shield,'energie',s.shield.energy);
const z0=p.z,x0=p.x;sim.step(1/60,{dash:true});const dashing=p.dashing,dashTimer=p.dash,energy=s.shield.energy,ev=s.events.map(e=>e.name);
for(let i=0;i<20;i++)sim.step(1/60,{});
console.log('apres Espace: p.dashing',dashing,'p.dash',dashTimer,'energie bouclier',energy.toFixed(1),'evenements',JSON.stringify(ev),'deplacement',Math.hypot(p.x-x0,p.z-z0).toFixed(2),'m');
// with the left hand empty
sim.selectLeftWeapon(null);for(let i=0;i<120;i++)sim.step(1/60,{});const x1=p.x,z1=p.z;sim.step(1/60,{dash:true});const d2=p.dashing;for(let i=0;i<20;i++)sim.step(1/60,{});
console.log('main gauche vide: p.dashing',d2.toFixed(3),'deplacement',Math.hypot(p.x-x1,p.z-z1).toFixed(2),'m');
