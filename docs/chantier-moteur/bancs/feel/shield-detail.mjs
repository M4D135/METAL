// Per-hit log of the heavy-rush scenario: why are some frontal hits not blocked?
import {load,flatWorld,hurtProbe} from './load.mjs';
const root=process.argv[2];const W=load(root,{modules:['destruction','economy','simulation'],patch:hurtProbe});
const {FSimulation}=W;W.__HURTS=[];
const sim=FSimulation.create(flatWorld({enemies:[[-3,-10,0],[0,-12,2],[3,-9,0],[1,-8,1]].map(([x,z,type])=>({x,z,type}))}),{equipment:{right:0,left:'shield',shieldEnergy:100},armorSystem:true,armor:{version:1,points:0}});
const s=sim.state,p=s.player;let energyLog=[];
for(let i=0;i<60*20&&!s.dead;i++){const before=s.shield.energy,raised=s.shield.raised,n=W.__HURTS.length;sim.step(1/60,{fireLeft:true});
  for(const h of W.__HURTS.slice(n)){const src=h.source;let ang=null,rel=null;if(src){const dx=src.x-p.x,dz=src.z-p.z;ang=Math.round(Math.atan2(dx,-dz)*180/Math.PI);rel={dy:+(src.y-(p.y+1.25)).toFixed(2),dh:+Math.hypot(dx,dz).toFixed(2)};}
    console.log(`t=${s.time.toFixed(2)} ligne ${h.line} brut ${h.raw.toFixed(1)} -> PV ${h.hp.toFixed(1)} | energie avant ${before.toFixed(1)} levee avant ${raised} | azimut source ${ang} deg ${JSON.stringify(rel)} | bloque ${h.shield>0}`);}
  s.events.length=0;}
