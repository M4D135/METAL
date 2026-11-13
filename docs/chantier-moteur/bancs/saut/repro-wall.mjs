// Direct reproduction on the UNPATCHED 0.8.0 simulation (sim.step only): from the upper lift dock of campaign world 2,
// sprint off the open shaft edge, land on the lower dock's boundary wall, then walk on / off wall tops.
import {loadFast} from './lib.mjs';
const W=loadFast();const world=W.FWorld.create(96,2,{campaign:true,campaignVersion:2});const sim=W.FSimulation.create(world,{}),s=sim.state,p=s.player;
const log=[];const snap=t=>log.push(t+': x '+p.x.toFixed(2)+' y '+p.y.toFixed(2)+' z '+p.z.toFixed(2)+(p.airborne?' (vol)':'')+(s.dead?' MORT':''));
p.x=-2.2;p.y=3.2;p.z=20.6;snap('départ quai haut');
const dir=(dx,dz)=>Math.atan2(dx,-dz);
const AIM=(process.argv[2]||'-1,4.65').split(',').map(Number);p.yaw=dir(AIM[0],AIM[1]);const input={moveX:0,moveY:1,sprint:true};let landed=false;
for(let i=0;i<150&&!s.dead;i++){sim.step(1/60,input);p.hp=sim.stats.maxHp;if(!p.airborne&&p.y<3){snap('atterrissage après '+(i/60).toFixed(2)+' s');landed=true;break;}}
if(landed){input.moveY=0;for(let i=0;i<20;i++)sim.step(1/60,input);snap('arrêt');
  const g=sim.ground(p.x,p.z);log.push('sol sous le joueur '+g.toFixed(2)+' -> perché à '+(p.y-g).toFixed(2)+' m ; zone de sol dessinée ? '+world.walkable.some(f=>!f.substrate&&Math.abs(p.x-f.x)<=f.w/2&&Math.abs(p.z-f.z)<=f.d/2));
  p.yaw=dir(-1,0);input.moveY=1;input.sprint=false;for(let i=0;i<120&&!s.dead;i++){sim.step(1/60,input);p.hp=sim.stats.maxHp;if(i===20)snap('après 0,33 s de marche vers -x');}snap('2 s de marche vers -x');
  log.push('sur le substrat hors zone, vivant : '+(!s.dead&&Math.abs(p.y+.25)<.05&&!world.walkable.some(f=>!f.substrate&&Math.abs(p.x-f.x)<=f.w/2&&Math.abs(p.z-f.z)<=f.d/2)));}
console.log(log.join('\n'));
