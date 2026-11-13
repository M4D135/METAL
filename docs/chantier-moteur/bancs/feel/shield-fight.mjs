// Real AI shooters in front of a static player: HP lost with the guard raised vs lowered.
// Usage: node shield-fight.mjs <ferro-root> [seconds]
import {load,flatWorld,hurtProbe} from './load.mjs';
const root=process.argv[2],T=+process.argv[3]||20;
const W=load(root,{modules:['destruction','economy','simulation'],patch:hurtProbe});
const {FSimulation}=W;
const LINES={940:'explosion',1722:'boss ring/sweep',1782:'ruée',1820:'environnement',1898:'danger au sol',1928:'balle'};
function fight({guard,layout,label,armor=0,dashEvery=0,seconds=T}){
  W.__HURTS=[];
  const w=flatWorld({enemies:layout.map(([x,z,type])=>({x,z,type})),progression:{version:1,weaponSlots:4,startWeapons:[true,true,true,true],startAmmo:[180,36,12,16],startShield:true,ammoCaps:[180,36,12,16],maxActive:8}});
  const sim=FSimulation.create(w,{equipment:{right:0,left:'shield',shieldEnergy:100},armorSystem:true,armor:{version:1,points:armor}});
  const s=sim.state,p=s.player;p.yaw=0;p.pitch=0;
  let t=0,deadAt=null,broken=0,blocks=0,raisedTime=0,steps=0;
  while(t<seconds){
    const input={fireLeft:guard,dash:dashEvery&&steps%dashEvery===0};
    sim.step(1/60,input);t+=1/60;steps++;if(s.shield.raised)raisedTime+=1/60;
    for(const e of s.events){if(e.name==='shieldBlock'){blocks++;if(e.broken)broken++;}}
    s.events.length=0;
    // keep the player alive to measure the full exposure; record first death time
    if(s.dead){deadAt=deadAt??+t.toFixed(2);break;}
  }
  const by={};for(const h of W.__HURTS){const k=LINES[h.line]||('l'+h.line);by[k]=by[k]||{n:0,raw:0,hp:0,blocked:0};by[k].n++;by[k].raw+=h.raw;by[k].hp+=h.hp;by[k].blocked+=h.shield>0?1:0;}
  return {label,guard,hpLost:+(100-p.hp).toFixed(1),armorLost:+(armor-(s.armor?.points??0)).toFixed(1),deadAt,blocks,broken,raisedPct:+(raisedTime/t*100).toFixed(0),energy:+s.shield.energy.toFixed(0),hits:W.__HURTS.length,by:Object.fromEntries(Object.entries(by).map(([k,v])=>[k,`${v.n} coups, ${v.blocked} bloqués, ${v.raw.toFixed(0)} bruts -> ${v.hp.toFixed(1)} PV`]))};
}
const layouts={
  'front 3 (types 0,2,0) a 9-12 m':[[-3,-10,0],[0,-12,2],[3,-9,0]],
  'front 4 + heavy (0,2,0,1)':[[-3,-10,0],[0,-12,2],[3,-9,0],[1,-8,1]],
  'flanc: 2 devant + 2 a 70 deg':[[-2,-10,0],[2,-10,2],[-9,-3,0],[9,-3,2]],
};
const rows=[];
for(const [label,layout] of Object.entries(layouts))for(const guard of [false,true])rows.push(fight({guard,layout,label}));
for(const r of rows){console.log(JSON.stringify(r));}
