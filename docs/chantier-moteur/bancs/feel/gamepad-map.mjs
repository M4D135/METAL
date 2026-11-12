// Prototype of the proposed gamepad mapping (pure functions, no DOM), fed into the real simulation input.
// Usage: node gamepad-map.mjs <ferro-root>
import {load,flatWorld} from './load.mjs';
const root=process.argv[2];
export const PAD={inner:.12,outer:.97,expo:1.7,yaw:300,pitch:190,boostAfter:.18,boostRamp:.30,boost:.8,moveInner:.15,sprintAt:.92,trigOn:.30,trigOff:.18,slow:.55};
// radial dead zone with rescale (keeps direction, removes the cross-shaped bias of per-axis dead zones)
export function radial(x,y,inner,outer){const m=Math.hypot(x,y);if(m<=inner)return [0,0,0];const n=Math.min(1,(m-inner)/(outer-inner));return [x/m*n,y/m*n,n];}
export function createPad(P=PAD){
  let hold=0,boostT=0;const trig={rt:false,lt:false};
  return function poll(pad,dt,{onTarget=false,sensitivity=1,invert=false}={}){
    const [mx,my,mm]=radial(pad.axes[0],pad.axes[1],P.moveInner,P.outer);
    const [lx,ly,lm]=radial(pad.axes[2],pad.axes[3],P.inner,P.outer);
    const curve=lm>0?Math.pow(lm,P.expo)/lm:0; // scale vector so its magnitude follows n^expo
    if(lm>.97){hold+=dt;}else{hold=0;}boostT=hold>P.boostAfter?Math.min(1,(hold-P.boostAfter)/P.boostRamp):0;
    const slow=onTarget?P.slow:1,deg=Math.PI/180;
    const yawRate=lx*curve*P.yaw*(1+P.boost*boostT)*slow*sensitivity*deg,pitchRate=-ly*curve*P.pitch*slow*sensitivity*deg*(invert?-1:1);
    const rt=pad.buttons[7].value,lt=pad.buttons[6].value;trig.rt=trig.rt?rt>P.trigOff:rt>P.trigOn;trig.lt=trig.lt?lt>P.trigOff:lt>P.trigOn;
    return {moveX:mx,moveY:-my,lookX:yawRate*dt,lookY:pitchRate*dt,fire:trig.rt,fireLeft:trig.lt,sprint:mm>=P.sprintAt||pad.buttons[10].pressed,yawRate:yawRate/deg,pitchRate:pitchRate/deg};
  };
}
const fake=(lx,ly,rx,ry,rt=0,lt=0)=>({axes:[lx,ly,rx,ry],buttons:Array.from({length:17},(_,i)=>({pressed:false,value:i===7?rt:i===6?lt:0}))});
if(import.meta.url===`file://${process.argv[1]}`){
  const poll=createPad();const rows=[];
  for(const d of [.05,.12,.2,.35,.5,.7,.85,.95,1]){const r=poll(fake(0,0,d,0),1/60);rows.push({'deflexion stick droit':d,'lacet deg/s':+r.yawRate.toFixed(1),'avec ralentissement sur cible':+createPad()(fake(0,0,d,0),1/60,{onTarget:true}).yawRate.toFixed(1)});}
  console.table(rows);
  // time for a 180 deg turn at full deflection, with the turn boost
  {const poll=createPad();let a=0,t=0;while(a<180&&t<3){const r=poll(fake(0,0,1,0),1/120);a+=r.yawRate/120;t+=1/120;}console.log('demi-tour (180 deg) stick a fond:',(t*1000).toFixed(0),'ms (sans boost: '+(180/PAD.yaw*1000).toFixed(0)+' ms)');}
  // fine aim: angular resolution at 20% deflection per 60 Hz frame
  {const r=createPad()(fake(0,0,.2,0),1/60);console.log('visee fine a 20 %:',r.yawRate.toFixed(1),'deg/s soit',(r.yawRate/60).toFixed(3),'deg par image');}
  // integration: feed the sim for 2 s with a half-deflected left stick, then full + sprint
  const W=load(root,{modules:['destruction','economy','simulation']});const sim=W.FSimulation.create(flatWorld(),{});const p2=createPad();
  for(let i=0;i<120;i++)sim.step(1/60,p2(fake(0,-.55,0,0),1/60));const half=sim.state.locomotion.speed;
  for(let i=0;i<120;i++)sim.step(1/60,p2(fake(0,-1,.4,0),1/60));
  console.log('vitesse stick 55 %:',half.toFixed(2),'m/s ; stick a fond (course auto):',sim.state.locomotion.speed.toFixed(2),'m/s ; lacet apres 2 s a 40 %:',(sim.state.player.yaw*180/Math.PI).toFixed(1),'deg');
}
