// A frontal bullet fully inside the guard: which feedback signals fire?
import {load,flatWorld} from './load.mjs';
const root=process.argv[2];const W=load(root,{modules:['destruction','economy','simulation']});
const sim=W.FSimulation.create(flatWorld(),{equipment:{right:0,left:'shield',shieldEnergy:100}});const s=sim.state,p=s.player;
s.combo=3;s.comboTime=4;sim.step(1/60,{fireLeft:true});s.events.length=0;
s.bullets.push({x:0,y:1.45,z:-1.2,dx:0,dy:0,dz:7.7,life:2,damage:8,kind:0,owner:1});
for(let i=0;i<20&&s.bullets.length;i++)sim.step(1/60,{fireLeft:true});
console.log(JSON.stringify({events:s.events.map(e=>e.name),hpLost:+(100-p.hp).toFixed(2),damageOverlay:+s.damage.toFixed(2),overlayOpacity:+(s.damage*.45).toFixed(2),combo:s.combo,shieldEnergy:+s.shield.energy.toFixed(1)}));
