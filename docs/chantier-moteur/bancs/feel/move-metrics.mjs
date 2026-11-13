// Movement feel metrics: current METAL locomotion (real simulation) vs a Q3-style model
// (original re-implementation of the published concepts, in metres) and a proposed METAL tuning.
// Usage: node move-metrics.mjs <ferro-root>
import {load,flatWorld} from './load.mjs';
const root=process.argv[2];
const W=load(root,{modules:['destruction','economy','simulation']});
const HZ=120,DT=1/HZ;
// ---------- current model, measured on the real simulation ----------
function real(){
  const mk=(extra={})=>{const sim=W.FSimulation.create(flatWorld({walkable:[{x:0,y:0,z:0,w:80,d:80}],...extra}),{equipment:{right:0,left:null,shieldEnergy:100}});sim.state.player.yaw=0;return sim;};
  const out={};
  // accel to 90% of sprint
  let sim=mk(),t=0;while(sim.state.locomotion.speed<.9*7.6&&t<2){sim.step(DT,{moveY:1,sprint:true});t+=DT;}out.t90_sprint_ms=+(t*1000).toFixed(0);
  // stop from sprint
  for(let i=0;i<120;i++)sim.step(DT,{moveY:1,sprint:true});let z0=sim.state.player.z;t=0;while(sim.state.locomotion.speed>.05&&t<2){sim.step(DT,{});t+=DT;}out.stop_ms=+(t*1000).toFixed(0);out.stop_m=+Math.abs(sim.state.player.z-z0).toFixed(3);
  // reverse: from +sprint to -sprint, time to reach 90% the other way
  sim=mk();for(let i=0;i<120;i++)sim.step(DT,{moveY:1,sprint:true});t=0;while(sim.state.locomotion.forward>-.9*7.6&&t<2){sim.step(DT,{moveY:-1,sprint:true});t+=DT;}out.reverse90_ms=+(t*1000).toFixed(0);
  // 90 degree turn of the wish direction (forward -> strafe right): time until lateral speed reaches 90%
  sim=mk();for(let i=0;i<120;i++)sim.step(DT,{moveY:1,sprint:true});t=0;while(sim.state.locomotion.strafe<.9*7.6&&t<2){sim.step(DT,{moveX:1,sprint:true});t+=DT;}out.turn90_ms=+(t*1000).toFixed(0);
  // ledge: walk off a 1.6 m terrace at sprint; measure horizontal speed in air and right after landing
  sim=mk({walkable:[{x:0,y:1.6,z:0,w:6,d:6},{x:0,y:0,z:0,w:80,d:80}],spawn:{x:0,y:1.6,z:0,yaw:0}});
  let air=0,airV=0,land=null,maxLat=0;for(let i=0;i<240;i++){const p=sim.state.player,before=p.airborne;sim.step(DT,{moveY:1,moveX:air>0?1:0,sprint:true});if(p.airborne){air++;airV=Math.hypot(p.airVX,p.airVZ);maxLat=Math.max(maxLat,p.x);}if(before&&!p.airborne&&land===null){land=sim.state.locomotion.speed;}}
  out.ledge_air_ms=+(air*DT*1000).toFixed(0);out.ledge_air_speed=+airV.toFixed(2);out.ledge_air_lateral_m=+maxLat.toFixed(2);out.speed_after_landing=land===null?null:+land.toFixed(2);
  // dash
  sim=mk();let x0=sim.state.player.z;sim.step(DT,{dash:true});for(let i=0;i<30;i++)sim.step(DT,{});out.dash_m=+Math.abs(sim.state.player.z-x0).toFixed(2);out.dash_cooldown_s=1.7;
  return out;
}
// ---------- Q3-style model (concepts: wishdir accel with projection cap, friction w/ stop speed, air accel) ----------
function model(P){
  // v = [vx,vz]; wish = unit dir; speed = wishspeed; ground bool
  function friction(v,h){const s=Math.hypot(v[0],v[1]);if(s<1e-4){v[0]=v[1]=0;return;}const control=Math.max(s,P.stop),drop=control*P.friction*h,ns=Math.max(0,s-drop);v[0]*=ns/s;v[1]*=ns/s;}
  function accel(v,wish,ws,rate,h){const cur=v[0]*wish[0]+v[1]*wish[1],add=ws-cur;if(add<=0)return;const a=Math.min(rate*ws*h,add);v[0]+=a*wish[0];v[1]+=a*wish[1];}
  const out={};
  let v=[0,0],t=0;while(v[1]<.9*P.run&&t<2){friction(v,DT);accel(v,[0,1],P.run,P.accel,DT);t+=DT;}out.t90_sprint_ms=+(t*1000).toFixed(0);
  v=[0,P.run];t=0;let d=0;while(Math.hypot(...v)>.05&&t<3){friction(v,DT);d+=v[1]*DT;t+=DT;}out.stop_ms=+(t*1000).toFixed(0);out.stop_m=+d.toFixed(3);
  v=[0,P.run];t=0;while(v[1]>-.9*P.run&&t<2){friction(v,DT);accel(v,[0,-1],P.run,P.accel,DT);t+=DT;}out.reverse90_ms=+(t*1000).toFixed(0);
  v=[0,P.run];t=0;while(v[0]<.9*P.run&&t<2){friction(v,DT);accel(v,[1,0],P.run,P.accel,DT);t+=DT;}out.turn90_ms=+(t*1000).toFixed(0);
  // jump: apex and air time
  out.jump_apex_m=+(P.jump*P.jump/(2*P.g)).toFixed(2);out.jump_air_ms=+(2*P.jump/P.g*1000).toFixed(0);
  // air strafe: from run speed forward, hold strafe right for one jump: lateral displacement
  v=[0,P.run];let x=0;for(let i=0;i<Math.round(2*P.jump/P.g*HZ);i++){accel(v,[1,0],P.run,P.airAccel,DT);x+=v[0]*DT;}out.air_lateral_m=+x.toFixed(2);out.air_speed_end=+Math.hypot(...v).toFixed(2);
  // strafe-jump gain: 10 hops, wish dir kept at 'optimal' angle to velocity (concept test of the cap), no friction on landing frame
  v=[0,P.run];for(let hop=0;hop<10;hop++){for(let i=0;i<Math.round(2*P.jump/P.g*HZ);i++){const s=Math.hypot(...v),ux=v[0]/s,uz=v[1]/s,ang=Math.acos(Math.max(-1,Math.min(1,(P.run-P.airAccel*P.run*DT)/s)));const c=Math.cos(ang),sn=Math.sin(ang);accel(v,[ux*c-uz*sn,ux*sn+uz*c],P.run,P.airAccel,DT);}
    const s=Math.hypot(...v);if(P.airCap&&s>P.airCap){v[0]*=P.airCap/s;v[1]*=P.airCap/s;}}
  out.speed_after_10_hops=+Math.hypot(...v).toFixed(2);
  return out;
}
const Q3={run:320*.0254,accel:10,friction:6,stop:100*.0254,airAccel:1,jump:270*.0254,g:800*.0254,airCap:0};
const PROPOSED={run:7.6,accel:12,friction:10,stop:2.5,airAccel:1.1,jump:6.2,g:20,airCap:10.5};
const rows={'METAL actuel (sim reelle)':real(),'Q3 converti (modele)':model(Q3),'proposition METAL (modele)':model(PROPOSED)};
console.log(JSON.stringify({Q3,PROPOSED},null,0));
console.table(rows);
