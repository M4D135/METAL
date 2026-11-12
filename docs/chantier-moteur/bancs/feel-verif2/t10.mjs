import {load,flat} from './L.mjs';
const S=load(['destruction','economy','simulation']).FSimulation;
// (A) global overheat: SMG to overheat, then switch weapon / left hand / pistol: delay before next shot
function afterOverheat(label,act){const sim=S.create(flat(),{equipment:{right:0,left:null,shieldEnergy:100}});const s=sim.state,p=s.player;let t=0;
  while(!p.overheated&&t<5){sim.step(1/60,{fire:true,weapon:0});t+=1/60;}
  const tOver=t,n0=s.shots;let wait=null;const inp=act(sim);for(let i=0;i<600&&wait===null;i++){sim.step(1/60,inp);t+=1/60;if(s.shots>n0)wait=t-tOver;}
  console.log(label,'surchauffe a',tOver.toFixed(2),'s ; premier tir possible apres',wait===null?'>10':wait.toFixed(2),'s (arme',s.weapon,'gauche',s.equipment.left,')');}
afterOverheat('SMG maintenu            ',sim=>({fire:true,weapon:0}));
afterOverheat('passage au double pompe ',sim=>({fire:true,weapon:1}));
afterOverheat('passage aux roquettes    ',sim=>({fire:true,weapon:2}));
afterOverheat('pompe en main gauche    ',sim=>{sim.selectLeftWeapon(1);return {fireLeft:true,weapon:0};});
// (B) dash off a 1.6 m ledge vs flat
function dash(label,world,start){const sim=S.create(flat(world),{equipment:{right:0,left:null,shieldEnergy:100}});const s=sim.state,p=s.player;p.z=start;p.yaw=0;
  for(let i=0;i<30;i++)sim.step(1/60,{moveY:1,sprint:true});const z0=p.z;let inv=0,airV=null,vAfterLand=null,t=0,maxStep=0;
  sim.step(1/60,{moveY:1,sprint:true,dash:true});if(p.dashing>0)inv+=1/60;
  for(let i=0;i<70;i++){const was=p.airborne,zb=p.z;sim.step(1/60,{moveY:1,sprint:true});t+=1/60;if(p.dashing>0)inv+=1/60;maxStep=Math.max(maxStep,Math.abs(p.z-zb)*60);if(!was&&p.airborne)airV=Math.hypot(p.airVX,p.airVZ);if(was&&!p.airborne&&vAfterLand===null)vAfterLand=s.locomotion.speed;}
  console.log(label,'| invulnerabilite',(inv*1000).toFixed(0),'ms | vitesse max',maxStep.toFixed(1),'m/s | vitesse en l air',airV===null?'-':airV.toFixed(2),'| parcouru en 1,2 s',Math.abs(p.z-z0).toFixed(2),'m | vitesse a l atterrissage',vAfterLand===null?'-':vAfterLand.toFixed(2));}
dash('dash sur le plat           ',{},0);
for(const off of [.3,.8,1.5])dash(`dash, rebord 1,6 m a ${off} m`,{walkable:[{x:0,y:1.6,z:10,w:40,d:40},{x:0,y:0,z:-30,w:100,d:40}],spawn:{x:0,y:1.6,z:0,yaw:0}},-10+off+30*7.6/60-.2);
