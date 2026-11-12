import {vload,arena} from './vload.mjs';
const root=process.argv[2];const W=vload(root);
const w=arena({walkable:[{x:0,y:0,z:20,w:100,d:60},{x:0,y:.25,z:-30,w:100,d:40}]});const sim=W.FSimulation.create(w,{});
for(const z of [-10.2,-10.05,-9.95,-9.8])console.log(z,'ground',sim.ground(0,z),'blocked@ground',sim.blocked(0,z,.28,sim.ground(0,z)));
