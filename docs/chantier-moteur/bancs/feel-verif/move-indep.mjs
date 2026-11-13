// Independent movement metrics on the real simulation (flat arena, campaign-like arsenal profile).
import {vload,arena} from './vload.mjs';
const root=process.argv[2];const W=vload(root);
function run(HZ){
  const dt=1/HZ,res={};
  // 1) start from rest, sprint forward
  let sim=W.FSimulation.create(arena(),{equipment:{right:0,left:null,shieldEnergy:100}}),s=sim.state,p=s.player;
  let t=0,t90=null,t50=null;const vmax=7.6;
  while(t<1){sim.step(dt,{moveY:1,sprint:true});t+=dt;const v=s.locomotion.speed;if(t50===null&&v>=.5*vmax)t50=t;if(t90===null&&v>=.9*vmax)t90=t;}
  res.t50ms=Math.round(t50*1000);res.t90ms=Math.round(t90*1000);
  // 2) release: stop time (speed<0.05) and slide distance
  const z0=p.z;t=0;let tstop=null;while(t<1){sim.step(dt,{});t+=dt;if(tstop===null&&s.locomotion.speed<.05)tstop=t;}
  res.stopMs=Math.round(tstop*1000);res.slideM=+Math.abs(p.z-z0).toFixed(3);
  // 3) reversal: from full sprint forward to full sprint backward, time to 90% backward speed
  for(let i=0;i<HZ;i++)sim.step(dt,{moveY:1,sprint:true});t=0;let trev=null;while(t<1){sim.step(dt,{moveY:-1,sprint:true});t+=dt;const fwd=s.locomotion.forward;if(trev===null&&fwd<=-.9*vmax)trev=t;}
  res.reverseMs=Math.round(trev*1000);
  // 4) strafe 90deg change: forward sprint then strafe right sprint, time to 90% lateral
  for(let i=0;i<HZ;i++)sim.step(dt,{moveY:1,sprint:true});t=0;let tlat=null;while(t<1){sim.step(dt,{moveX:1,sprint:true});t+=dt;if(tlat===null&&s.locomotion.strafe>=.9*vmax)tlat=t;}
  res.turn90Ms=Math.round(tlat*1000);
  // 5) dash distance & invulnerability
  sim=W.FSimulation.create(arena(),{equipment:{right:0,left:null,shieldEnergy:100}});s=sim.state;p=s.player;const x0=p.x,zz=p.z;let inv=0;sim.step(dt,{dash:true});if(p.dashing>0)inv+=dt;for(let i=0;i<HZ;i++){sim.step(dt,{});if(p.dashing>0)inv+=dt;}
  res.dashM=+Math.hypot(p.x-x0,p.z-zz).toFixed(2);res.invulnMs=Math.round(inv*1000);
  return res;
}
console.table({'60 Hz':run(60),'120 Hz':run(120),'144 Hz':run(144),'30 Hz':run(30)});
