// Sustained-fire duty cycle: current heat rules vs proposed table (in-memory patch only).
import {load,flatWorld} from './load.mjs';
const root=process.argv[2],T=10;
const HEAT_OLD="(handgun?.06:rocket?.48:grenade?.38:shotgun?shells===2?.47:.32:.09)",COOL_OLD="p.heat=Math.max(0,p.heat-dt*(fireWait>0?.1:.35)*stats.coolingMultiplier);if(p.overheated&&p.heat<.3)";
const variants={
  actuel:null,
  propose:{heat:"(handgun?.06:rocket?.34:grenade?.28:shotgun?shells===2?.36:.26:.055)",cool:"p.heat=Math.max(0,p.heat-dt*(fireWait>0?.22:.55)*stats.coolingMultiplier);if(p.overheated&&p.heat<.55)"},
};
const names=['mitraillette','double pompe','lance-roquettes','lance-grenades'];
const rows=[];
for(const [label,v] of Object.entries(variants)){
  const W=load(root,{modules:['destruction','economy','simulation'],patch:v?(n,s)=>{if(n!=='simulation')return s;if(!s.includes(HEAT_OLD)||!s.includes(COOL_OLD))throw new Error('anchor');return s.replace(HEAT_OLD,v.heat).replace(COOL_OLD,v.cool);}:null});
  for(const [weapon,left] of [[0,null],[1,null],[2,null],[3,null],[0,1]]){
    const sim=W.FSimulation.create(flatWorld(),{equipment:{right:weapon,left,shieldEnergy:100}});const s=sim.state,p=s.player;p.pitch=.3;
    let lock=0,first=null;const shots0=s.shots;
    for(let i=0;i<T*60;i++){sim.step(1/60,{fire:true,fireLeft:left!==null,weapon});s.inventory.ammo=s.inventory.ammo.map((a,k)=>sim.ammoCaps[k]);if(p.overheated){lock++;if(first===null)first=i/60;}s.events.length=0;}
    rows.push({regles:label,arme:names[weapon]+(left!==null?' + pompe main G':''),'tirs en 10 s':s.shots-shots0,'1re surchauffe s':first===null?'jamais':+first.toFixed(2),'bloque %':Math.round(lock/(T*60)*100)});
  }
}
console.table(rows);
