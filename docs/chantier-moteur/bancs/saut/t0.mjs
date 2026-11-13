import {loadFast} from './lib.mjs';import {physPatches} from './phys.mjs';
const W=loadFast({patches:physPatches({rebound:process.argv[2]==='rebound'})});
function flat(extra={}){return {seed:'saut',stage:0,generation:6,spawn:{x:0,y:0,z:0,yaw:0},bounds:{minX:-200,maxX:200,minZ:-200,maxZ:200},walkable:[{x:0,y:0,z:0,w:400,d:400}],meshes:[],lights:[],colliders:[],enemies:[],pickups:[],cores:[{x:150,z:150},{x:151,z:150},{x:152,z:150}],exit:{x:160,z:150},...extra};}
// 1) single jump from standstill and at sprint: apex, air time, distance
{const sim=W.FSimulation.create(flat(),{}),p=sim.state.player,input={moveX:0,moveY:1,sprint:true};
 for(let i=0;i<120;i++)sim.step(1/60,input);const v0=sim.state.locomotion.speed;const x0=p.x,z0=p.z;
 input.jump=true;let apex=0,t=0,air=0,started=false;for(let i=0;i<120;i++){sim.step(1/60,input);input.jump=false;if(p.airborne){started=true;air+=1/60;apex=Math.max(apex,p.y);}else if(started)break;}
 console.log('sprint jump: v0',v0.toFixed(2),'apex',apex.toFixed(3),'air',air.toFixed(3),'dist',Math.hypot(p.x-x0,p.z-z0).toFixed(2),'speed after',sim.state.locomotion.speed.toFixed(2),'HK',JSON.stringify(sim.__I.HK));}
// 2) bunny-hop with air strafing: speed after N hops (mouse turn synchronised with strafe)
for(const turn of [0,1.2,2.0,3.0]){const sim=W.FSimulation.create(flat(),{}),p=sim.state.player,input={moveX:0,moveY:1,sprint:true};
 for(let i=0;i<60;i++)sim.step(1/60,input);let max=0,grounded=0,hops=0,wasAir=false,dir=1;const sp=[];
 for(let i=0;i<60*20;i++){input.jump=(i%2===0);
   if(p.airborne&&turn){input.moveY=1;input.moveX=dir;input.lookX=dir*turn/60;}else{input.moveX=0;input.lookX=0;}
   sim.step(1/60,input);if(!p.airborne){grounded++;if(wasAir){hops++;dir=-dir;}}wasAir=p.airborne;const v=Math.hypot(p.airVX,p.airVZ)||sim.state.locomotion.speed;max=Math.max(max,v);if(i%60===59)sp.push(v.toFixed(1));}
 console.log('bhop turn',turn,'rad/s: max',max.toFixed(2),'groundedStepEnds',grounded,'hops',hops,'speed/s',sp.join(' '));}
// 3) stop distance / time on ground
{const sim=W.FSimulation.create(flat(),{}),p=sim.state.player,input={moveX:0,moveY:1,sprint:true};for(let i=0;i<120;i++)sim.step(1/60,input);const z0=p.z,x0=p.x;input.moveY=0;let t=0;while(sim.state.locomotion.speed>.05&&t<3){sim.step(1/120,input);t+=1/120;}console.log('stop',t.toFixed(3),'s',Math.hypot(p.x-x0,p.z-z0).toFixed(2),'m');}
