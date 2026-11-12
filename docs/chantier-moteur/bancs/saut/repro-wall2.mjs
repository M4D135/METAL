// Unpatched 0.8.0, sim.step only: sprint off the upper lift dock (campaign world 2) and strafe towards the side wall in the air.
import {loadFast} from './lib.mjs';
const W=loadFast();const world=W.FWorld.create(96,2,{campaign:true,campaignVersion:2});
const authored=(x,z)=>world.walkable.some(f=>!f.substrate&&Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2);
let found=null,tries=0;
for(const x0 of [-2.2,-2.5,-2.7,2.2,2.5,2.7])for(const z0 of [20.6,19.5,18])for(const strafeAt of [0,6,12,18,24])for(const side of [1,-1]){
  const sim=W.FSimulation.create(world,{}),s=sim.state,p=s.player;p.x=x0;p.y=3.2;p.z=z0;p.yaw=Math.PI;const input={moveX:0,moveY:1,sprint:true};tries++;let air=0,trace=[];
  for(let i=0;i<200&&!s.dead;i++){if(p.airborne){air++;input.moveX=air>=strafeAt?side:0;}sim.step(1/60,input);p.hp=sim.stats.maxHp;if(air>0&&!p.airborne){trace.push([+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)]);break;}}
  if(s.dead||!trace.length||Math.abs(p.y-1)>.05)continue;
  // perched on the 1 m dock wall: now walk outwards
  const perch=trace[0];input.moveX=0;input.moveY=0;for(let i=0;i<15;i++)sim.step(1/60,input);
  p.yaw=side>0?Math.atan2(-1,0):Math.atan2(1,0);input.moveY=1;input.sprint=false;let out=null;
  for(let i=0;i<240&&!s.dead;i++){sim.step(1/60,input);p.hp=sim.stats.maxHp;if(!p.airborne&&!authored(p.x,p.z)&&Math.abs(p.y+.25)<.05){out=[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)];break;}}
  found={x0,z0,strafeAt,side,perch,out,dead:s.dead};if(out)break;
}
console.log('essais',tries,JSON.stringify(found));
