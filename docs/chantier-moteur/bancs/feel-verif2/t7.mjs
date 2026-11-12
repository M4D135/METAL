// FEEL-08 independent movement metrics on the real sim + step-up snap + ledge landing.
import {load,flat} from './L.mjs';
const S=load(['destruction','economy','simulation']).FSimulation;
function mk(extra){const sim=S.create(flat(extra),{equipment:{right:0,left:null,shieldEnergy:100}});return sim;}
for(const hz of [60,120,144]){
  const sim=mk(),s=sim.state,p=s.player;let t=0,t90=null,prev={x:p.x,z:p.z};
  const sp=()=>s.locomotion.speed;
  while(t<1){sim.step(1/hz,{moveY:1,sprint:true});t+=1/hz;if(t90===null&&sp()>=.9*7.6)t90=t;}
  const vmax=sp();const x0=p.x,z0=p.z;let ts=0,stopT=null;while(ts<1){sim.step(1/hz,{});ts+=1/hz;if(stopT===null&&sp()<.076)stopT=ts;}
  const stopD=Math.hypot(p.x-x0,p.z-z0);
  // reversal
  for(let i=0;i<hz;i++)sim.step(1/hz,{moveY:1,sprint:true});let tr=0,revT=null;while(tr<1){sim.step(1/hz,{moveY:-1,sprint:true});tr+=1/hz;if(revT===null&&s.locomotion.forward<=-.9*7.6)revT=tr;}
  console.log(`${hz} Hz: vmax ${vmax.toFixed(2)} t90 ${(t90*1000).toFixed(0)} ms, arret <1% en ${(stopT*1000).toFixed(0)} ms sur ${stopD.toFixed(3)} m, inversion 90% en ${(revT*1000).toFixed(0)} ms`);
}
// ledge: terrace 1.6 m then ground
{const world=flat({walkable:[{x:0,y:1.6,z:0,w:20,d:20},{x:0,y:0,z:-30,w:100,d:40}],spawn:{x:0,y:1.6,z:-5,yaw:0}});
 const sim=mk({walkable:world.walkable,spawn:world.spawn}),s=sim.state,p=s.player;let t=0,air0=null,airT=0,vBefore=0,vAfter=null,zAir=null;
 for(let i=0;i<400;i++){const was=p.airborne;sim.step(1/60,{moveY:1,sprint:true});t+=1/60;if(!was&&p.airborne){air0=t;vBefore=Math.hypot(p.airVX,p.airVZ);zAir=p.z;}if(p.airborne)airT+=1/60;if(was&&!p.airborne){vAfter=s.locomotion.speed;console.log(`chute 1.6 m: en l'air ${(airT*1000).toFixed(0)} ms, vitesse au decollage ${vBefore.toFixed(2)} m/s, parcourus ${Math.abs(p.z-zAir).toFixed(2)} m, vitesse image d'atterrissage ${vAfter.toFixed(2)}`);
   const z1=p.z;sim.step(1/60,{moveY:1,sprint:true});console.log('  image suivante: vitesse',s.locomotion.speed.toFixed(2),'(90% retrouve apres ~77 ms)');break;}}
}
// step-up: a 0.40 m solid in the path; camera height jump per frame
{const sim=mk({colliders:[{minX:-2,maxX:2,minZ:-8,maxZ:-4,minY:0,maxY:.4}]}),s=sim.state,p=s.player;let prev=p.y,maxJ=0,ev=[];for(let i=0;i<120;i++){sim.step(1/60,{moveY:1,sprint:true});const dy=p.y-prev;if(Math.abs(dy)>1e-6)ev.push(`${(i/60).toFixed(2)}s:${dy.toFixed(2)}`);maxJ=Math.max(maxJ,Math.abs(dy));prev=p.y;}
 console.log('marche 0.40 m: sauts de p.y par image',ev.join(' '),'max',maxJ.toFixed(2),'m en 1 image (camera = p.y+1.62, game.js:720, aucun lissage)');}
