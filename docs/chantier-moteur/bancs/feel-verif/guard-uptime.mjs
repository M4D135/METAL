// Guard uptime while the player HOLDS the guard under frontal fire (current rules): time raised, re-raises, energy range.
import {vload,arena} from './vload.mjs';
const root=process.argv[2],T=+process.argv[3]||20;const W=vload(root);
for(const [name,layout] of Object.entries({front:[[-3,-10,0],[0,-12,2],[3,-9,0]],calme:[]})){
  const sim=W.FSimulation.create(arena({enemies:layout.map(([x,z,type])=>({x,z,type}))}),{equipment:{right:0,left:'shield',shieldEnergy:100},armorSystem:true,armor:{version:1,points:0}});
  const s=sim.state,p=s.player;let t=0,up=0,raises=0,blocks=0,breaks=0,emin=1e9,emax=-1,firstBreak=null;const trace=[];
  while(t<T&&!s.dead){sim.step(1/60,{fireLeft:true});t+=1/60;p.hp=100;if(s.shield.raised)up+=1/60;for(const e of s.events){if(e.name==='shieldRaise')raises++;if(e.name==='shieldBlock'){blocks++;if(e.broken){breaks++;if(firstBreak===null)firstBreak=t;}}}s.events.length=0;
    if(t>5){emin=Math.min(emin,s.shield.energy);emax=Math.max(emax,s.shield.energy);}if(Math.abs(t%1)<1/60)trace.push(Math.round(s.shield.energy));}
  console.log(`${name}: garde levee ${(up/t*100).toFixed(0)} % du temps, ${raises} levees, ${blocks} blocages, ${breaks} ruptures (1re a ${firstBreak?.toFixed(1)} s), energie apres 5 s entre ${emin.toFixed(1)} et ${emax.toFixed(1)}; energie chaque seconde: ${trace.join(' ')}`);
}
