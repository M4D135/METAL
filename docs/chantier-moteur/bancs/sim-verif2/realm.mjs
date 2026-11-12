// SIM-11: same code main realm vs contextified vm sandbox; CPU time (machine heavily loaded), interleaved.
import {loadMain,loadSandbox,make} from './load.mjs';
const W={main:loadMain(),vm:loadSandbox()};const cpu=()=>{const c=process.cpuUsage();return (c.user+c.system)/1000;};
const drive=(i,input,s)=>{input.moveX=Math.sin(i/90);input.moveY=1;input.sprint=true;input.fire=(i%20)<6;input.dash=(i%240)===0;s.player.yaw+=0.01;};
for(const [index,campaign] of [[0,false],[9,true]]){
  const res={main:{step:[],ground:[],sum:[]},vm:{step:[],ground:[],sum:[]}};
  for(let rep=0;rep<3;rep++)for(const k of (rep%2?['vm','main']:['main','vm'])){
    const {world,sim}=make(W[k],index,campaign);const s=sim.state,inp={};let t=cpu();
    for(let i=0;i<1200;i++){drive(i,inp,s);sim.step(1/60,inp);s.events.length=0;if(s.dead)break;}
    res[k].step.push((cpu()-t)/1200);
    const b=world.bounds;let acc=0,n=0;t=cpu();for(let z=b.minZ;z<b.maxZ;z+=.31)for(let x=b.minX;x<b.maxX;x+=.31){acc+=sim.ground(x,z)||0;n++;}res[k].ground.push((cpu()-t)/n*1e6);res[k].sum.push(acc);
  }
  const f=a=>a.map(v=>v.toFixed(3)).join('/');
  console.log(`index ${index}${campaign?' campaign':''}: step CPU ms main ${f(res.main.step)} vs vm ${f(res.vm.step)} (x${(res.vm.step.at(-1)/res.main.step.at(-1)).toFixed(1)}) | ground ns/call main ${f(res.main.ground)} vs vm ${f(res.vm.ground)} (x${(res.vm.ground.at(-1)/res.main.ground.at(-1)).toFixed(1)}) | checksum equal ${res.main.sum[0]===res.vm.sum[0]}`);
}
