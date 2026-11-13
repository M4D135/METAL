// Lot 02 / T1, risque de SIM-V1 (a) : un ennemi qui planifie sur le statique traverse-t-il le
// balayage d'une lame, ou reste-t-il bloqué (minuteur stuck) ? Mur percé d'une ouverture de 2,2 m,
// lame balayant l'ouverture ; ennemi au sud (z = -7), joueur au nord (z = 11), au-delà de la portée
// d'attaque : l'ennemi doit franchir l'ouverture (z > 1,5). 16 réglages de la lame, 30 s au plus.
// L'ennemi de type 0 de ce décor a 3 PV : un coup de lame le tue.
// usage : node blade-crossing.mjs <racine-avant> <racine-après> [sortie.json]
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {loadRealm} from '../../../../../tools/realm-loader.mjs';
const [before,after,output]=process.argv.slice(2);
if(!before||!after)throw new Error('usage: node blade-crossing.mjs <racine-avant> <racine-après> [sortie.json]');
const V={avant:loadRealm({root:resolve(before)}).window,apres:loadRealm({root:resolve(after)}).window};
const wall=(minX,maxX)=>({minX,maxX,minY:0,maxY:4,minZ:-.7,maxZ:.7});
const world=(travel,period,phase)=>({seed:'test',stage:0,generation:5,spawn:{x:0,z:11,yaw:Math.PI},bounds:{minX:-20,maxX:20,minZ:-12,maxZ:12},
  colliders:[wall(-20,-1.1),wall(1.1,20)],enemies:[{x:0,z:-7,type:0}],pickups:[],cores:[{id:0,x:15,z:9},{id:1,x:17,z:9},{id:2,x:19,z:9}],exit:{x:18,z:-9},
  walkable:[{x:0,z:0,w:40,d:24,y:0}],lights:[],traps:[{id:'blade',kind:'blade',x:0,y:.8,z:0,w:.3,d:1.35,h:.3,axis:'x',travel,period,active:period*.66,warning:Math.min(1.2,period*.3),phase,damage:18}]});
const rows=[];
for(const travel of [.6,.9])for(const period of [3,7])for(const phase of [0,.25,.5,.75]){
  const row={travel,period,phase};
  for(const [label,win] of Object.entries(V)){
    const sim=win.FSimulation.create(world(travel,period,phase)),e=sim.state.enemies[0],hp=e.hp;let crossed=null,stuckMax=0;
    sim.fire();// Le tir réveille l'ennemi, qui chasse le joueur.
    for(let i=0;i<1200&&crossed===null;i++){e.cooldown=30;sim.state.player.hp=Math.max(sim.state.player.hp,50);sim.step(.025);stuckMax=Math.max(stuckMax,e.stuck);if(e.z>1.5)crossed=+((i+1)*.025).toFixed(3);}
    row[label]={crossedAfterSeconds:crossed,finalZ:+e.z.toFixed(2),neverMoved:Math.abs(e.z+7)<1e-9,stuckMaxSeconds:+stuckMax.toFixed(2),hpLost:+(hp-e.hp).toFixed(1),killed:e.hp<=0,tactic:e.tactic};
  }
  rows.push(row);
  const f=r=>`${r.crossedAfterSeconds===null?'non traversé':'traversé en '+r.crossedAfterSeconds+' s'}, z final ${r.finalZ}${r.neverMoved?' (immobile, tactique '+r.tactic+')':''}${r.killed?' (tué par la lame)':''}, bloqué au plus ${r.stuckMaxSeconds} s`;
  console.log(`course ${travel} m, période ${period} s, phase ${phase} | avant : ${f(row.avant)} | après : ${f(row.apres)}`);
}
const total=k=>({crossed:rows.filter(r=>r[k].crossedAfterSeconds!==null).length,neverMoved:rows.filter(r=>r[k].neverMoved).length,killed:rows.filter(r=>r[k].killed).length,stuckMaxSeconds:Math.max(...rows.map(r=>r[k].stuckMaxSeconds))});
const totals={avant:total('avant'),apres:total('apres')};
console.log(`total ${rows.length} réglages | avant : ${totals.avant.crossed} traversées, ${totals.avant.killed} tués, ${totals.avant.neverMoved} immobiles, blocage max ${totals.avant.stuckMaxSeconds} s | après : ${totals.apres.crossed} traversées, ${totals.apres.killed} tués, ${totals.apres.neverMoved} immobiles, blocage max ${totals.apres.stuckMaxSeconds} s`);
if(output)writeFileSync(output,JSON.stringify({schema:'metal-lot02-t1-blade-crossing-v1',rows,totals},null,1)+'\n');
