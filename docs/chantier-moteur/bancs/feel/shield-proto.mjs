// Compares the current guard with a prototype guard (in-memory patch only, repo untouched).
// Usage: node shield-proto.mjs <ferro-root> [seconds] [seeds]
import {load,flatWorld,hurtProbe} from './load.mjs';
import {protoPatch,PROPOSED as P2} from './proto-patch.mjs';
const root=process.argv[2],T=+process.argv[3]||20,SEEDS=+process.argv[4]||6;
const CURRENT={arc:.55,direct:.8,blast:.55,cost:1.5,delay:2.2,breakDelay:2.2,raise:8,drain:2.5,recharge:18,holdRegen:0,quiet:false};
const PROPOSED=P2;
const LINES={940:'explosion',1722:'boss',1782:'ruee',1820:'env',1898:'sol',1928:'balle'};
function run(P,{layout,guard,track,seconds=T,jitter=0}){
  const W=P?load(root,{modules:['destruction','economy','simulation'],patch:protoPatch(P)}):load(root,{modules:['destruction','economy','simulation'],patch:hurtProbe});
  W.__HURTS=[];
  const sim=W.FSimulation.create(flatWorld({enemies:layout.map(([x,z,type],i)=>({x:x+jitter*Math.sin(i*7.1),z:z+jitter*Math.cos(i*3.3),type}))}),{equipment:{right:0,left:'shield',shieldEnergy:100},armorSystem:true,armor:{version:1,points:0}});
  const s=sim.state,p=s.player;let t=0;
  while(t<seconds&&!s.dead){
    if(track){let best=null,bd=1e9;for(const e of s.enemies)if(e.hp>0){const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<bd){bd=d;best=e;}}if(best)p.yaw=Math.atan2(best.x-p.x,-(best.z-p.z));}
    sim.step(1/60,{fireLeft:guard});t+=1/60;s.events.length=0;
  }
  const blocked=W.__HURTS.filter(h=>h.shield>0).length;
  return {t:+t.toFixed(2),dead:s.dead,hp:+(100-p.hp).toFixed(1),hits:W.__HURTS.length,blocked};
}
const layouts={front:[[-3,-10,0],[0,-12,2],[3,-9,0]],heavy:[[-3,-10,0],[0,-12,2],[3,-9,0],[1,-8,1]],flank:[[-2,-10,0],[2,-10,2],[-9,-3,0],[9,-3,2]]};
const out=[];
for(const [lname,layout] of Object.entries(layouts))for(const track of [false,true]){
  const agg={};
  for(const [pname,P,guard] of [['sans garde',null,false],['garde actuelle',null,true],['garde proposee',PROPOSED,true]]){
    let dead=0,t=0,hp=0,hits=0,blocked=0;
    for(let k=0;k<SEEDS;k++){const r=run(P,{layout,guard,track,jitter:k*.6});dead+=r.dead;t+=r.t;hp+=r.hp;hits+=r.hits;blocked+=r.blocked;}
    agg[pname]=`${dead}/${SEEDS} morts, survie moy ${(t/SEEDS).toFixed(1)} s, PV perdus moy ${(hp/SEEDS).toFixed(0)}, ${blocked}/${hits} coups bloques`;
  }
  out.push({scenario:lname+(track?' (le joueur suit la menace la plus proche)':' (joueur fixe)'),...agg});
}
for(const r of out)console.log(JSON.stringify(r,null,1));
