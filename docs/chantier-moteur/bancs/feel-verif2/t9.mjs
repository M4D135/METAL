import {load} from './L.mjs';
const W=load();const S=W.FSimulation;
const w=W.FWorld.create(96,0,{campaign:true,campaignVersion:2});const sim=S.create(w,{});
let k=0;for(const q of w.colliders){const cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2;let g=-Infinity;for(const [ox,oz] of [[q.minX-.35,cz],[q.maxX+.35,cz],[cx,q.minZ-.35],[cx,q.maxZ+.35]]){const y=sim.ground(ox,oz);if(Number.isFinite(y))g=Math.max(g,y);}
  const h=q.maxY-g;if(h>.06&&h<=.43&&q.minY<=g+.5&&k++<6)console.log(JSON.stringify({...q,g,gs:[[q.minX-.35,cz],[q.maxX+.35,cz],[cx,q.minZ-.35],[cx,q.maxZ+.35]].map(([x,z])=>+sim.ground(x,z).toFixed(2)),gc:+sim.ground(cx,cz).toFixed(2)}).slice(0,420));}
// rubble: does the simulation expose solids from destruction? list state keys
console.log(Object.keys(sim.state).join(','));console.log(Object.keys(sim).join(','));
