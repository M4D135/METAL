// SIM-05: bytes allocated per step, original vs full-v2, measured as heapUsed delta over short windows with a
// huge young generation and gc() before each window (no collection inside a window => delta = bytes allocated).
// run: node --expose-gc --max-semi-space-size=256 --min-semi-space-size=256 alloc.mjs
import {loadMain,make} from './load.mjs';import {fullPatch} from '../sim/full-v2.mjs';import {allPatch} from '../sim/all-v2.mjs';
const A=loadMain(),B=loadMain(fullPatch()),C=loadMain(allPatch());
const drive=(i,input,s)=>{input.moveX=Math.sin(i/90);input.moveY=1;input.sprint=true;input.fire=(i%20)<6;input.dash=(i%240)===0;s.player.yaw+=0.01;};
const WIN=25,STEPS=1800;
for(const t of (process.env.SCEN||'0,2,c9,c15').split(',')){
  const campaign=t[0]==='c',index=+(campaign?t.slice(1):t);const out=[];
  for(const [name,W] of [['orig',A],['all-v2',C],['full-v2',B]]){
    let bytes=0,n=0,bad=0;
    for(let rep=0;rep<2;rep++){const {sim}=make(W,index,campaign),s=sim.state,inp={};bytes=0;n=0;bad=0;
      for(let i=0;i<STEPS;i+=WIN){gc();const h0=process.memoryUsage().heapUsed;for(let k=0;k<WIN;k++){drive(i+k,inp,s);sim.step(1/60,inp);s.events.length=0;}const d=process.memoryUsage().heapUsed-h0;if(d<=0)bad++;else{bytes+=d;n+=WIN;}if(s.dead)break;}}
    out.push(`${name} ${(bytes/n/1024).toFixed(0)} Ko/pas (fenêtres rejetées ${bad})`);
  }
  console.log(t.padEnd(4)+' '+out.join(' | '));
}
