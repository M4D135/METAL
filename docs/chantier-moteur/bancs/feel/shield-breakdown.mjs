// Where the HP go in the "heavy" layout (3 shooters + 1 rusher), current guard vs prototype guard.
// Groups hurt() calls by caller line (prototype patch shifts lines after shieldFacing by -1).
// Usage: node shield-breakdown.mjs <ferro-root> [seconds] [seeds]
import {load,flatWorld,hurtProbe} from './load.mjs';
import {protoPatch,PROPOSED} from './proto-patch.mjs';
const root=process.argv[2],T=+process.argv[3]||20,SEEDS=+process.argv[4]||6;
const layout=[[-3,-10,0],[0,-12,2],[3,-9,0],[1,-8,1]];
const label=(line,proto)=>({1928:'balle',1782:'ruee',940:'explosion'})[proto?line+1:line]||('l'+line);
for(const [name,P] of [['garde actuelle',null],['garde proposee',PROPOSED]]){
  const by={};let dist=[];
  for(let k=0;k<SEEDS;k++){
    const W=load(root,{modules:['destruction','economy','simulation'],patch:P?protoPatch(P):hurtProbe});W.__HURTS=[];
    const sim=W.FSimulation.create(flatWorld({enemies:layout.map(([x,z,type],i)=>({x:x+k*.6*Math.sin(i*7.1),z:z+k*.6*Math.cos(i*3.3),type}))}),{equipment:{right:0,left:'shield',shieldEnergy:100},armorSystem:true,armor:{version:1,points:0}});
    const s=sim.state,p=s.player;let t=0;
    while(t<T&&!s.dead){let best=null,bd=1e9;for(const e of s.enemies)if(e.hp>0){const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<bd){bd=d;best=e;}}if(best)p.yaw=Math.atan2(best.x-p.x,-(best.z-p.z));sim.step(1/60,{fireLeft:true});t+=1/60;s.events.length=0;}
    for(const h of W.__HURTS){const k2=label(h.line,!!P);by[k2]=by[k2]||{coups:0,bloques:0,pv:0};by[k2].coups++;by[k2].bloques+=h.shield>0;by[k2].pv+=h.hp;
      if(k2==='ruee'&&h.source)dist.push(Math.hypot(h.source.x-(h.px??0),h.source.z-(h.pz??0)));}
  }
  console.log(name+` (${SEEDS} variantes, ${T} s, le joueur suit la menace la plus proche)`);
  for(const [k,v] of Object.entries(by))console.log(`  ${k}: ${v.coups} coups, ${v.bloques} bloques, ${v.pv.toFixed(0)} PV perdus`);
}
