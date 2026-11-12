// Sustained fire per weapon (arsenal rules, real simulation): shots, overheat lockouts, duty cycle.
// Usage: node weapon-cadence.mjs <ferro-root> [seconds]
import {load,flatWorld} from './load.mjs';
const root=process.argv[2],T=+process.argv[3]||10;
const W=load(root,{modules:['destruction','economy','simulation']});
const names=['mitraillette','double pompe','lance-roquettes','lance-grenades','pistolet'];
function run(weapon,{left=null,campaign=false,leftFire=false}={}){
  const w=campaign?flatWorld({campaign:true,index:0,chapter:0,progression:{version:1,weaponSlots:5,startWeapons:[true,true,true,true,true],startAmmo:[180,36,12,16,1],startShield:false,ammoCaps:[180,36,12,16,1],maxActive:4}}):flatWorld();
  const sim=W.FSimulation.create(w,campaign?{}:{equipment:{right:weapon,left,shieldEnergy:100}});
  if(campaign){sim.selectWeapon(weapon);}
  const s=sim.state,p=s.player;p.pitch=.3; // aim at the sky: no scenery hits
  s.inventory.ammo=s.inventory.ammo.map((a,i)=>sim.ammoCaps[i]);
  let shots0=s.shots,over=0,overTime=0,firstOver=null;
  for(let i=0;i<T*60;i++){sim.step(1/60,{fire:true,fireLeft:leftFire,weapon});if(p.overheated){overTime+=1/60;if(firstOver===null)firstOver=+(i/60).toFixed(2);}for(const e of s.events)if(e.name==='overheat')over++;s.events.length=0;s.inventory.ammo=s.inventory.ammo.map((a,i)=>sim.ammoCaps[i]);}
  const shots=s.shots-shots0;return {arme:names[weapon]+(leftFire?' + main gauche':''),tirs:shots,'tirs/s':+(shots/T).toFixed(2),surchauffes:over,'1re surchauffe (s)':firstOver,'temps bloqué %':+(overTime/T*100).toFixed(0)};
}
const rows=[0,1,2,3].map(w=>run(w));
rows.push(run(4,{campaign:true}));
rows.push(run(0,{left:1,leftFire:true}));
console.table(rows);
