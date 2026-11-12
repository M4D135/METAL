// SIM-11 check: same code, same scenario, main realm vs contextified vm sandbox. Interleaved A,B,A,B.
import {loadMain,loadSandbox,make,pilot} from './load.mjs';
const W={main:loadMain(),vm:loadSandbox()};const SC=[[0,false],[9,true]];
for(const [index,campaign] of SC){
  const res={main:{step:[],make:[],ground:[]},vm:{step:[],make:[],ground:[]}};
  for(let rep=0;rep<2;rep++)for(const k of (rep%2?['vm','main']:['main','vm'])){
    let t=performance.now();const {world,sim}=make(W[k],index,campaign);res[k].make.push(performance.now()-t);
    const s=sim.state,inp={};let tot=0;
    for(let i=0;i<1800;i++){pilot(i,inp,s);t=performance.now();sim.step(1/60,inp);tot+=performance.now()-t;s.events.length=0;if(s.dead)break;}
    res[k].step.push(tot/1800);
    const b=world.bounds;let acc=0,n=0;t=performance.now();for(let z=b.minZ;z<b.maxZ;z+=.37)for(let x=b.minX;x<b.maxX;x+=.37){acc+=sim.ground(x,z)||0;n++;}res[k].ground.push((performance.now()-t)/n*1e6);
  }
  const f=a=>a.map(v=>v.toFixed(3)).join('/');
  console.log(`index ${index}${campaign?' campaign':''}: mean step main ${f(res.main.step)} ms vs vm ${f(res.vm.step)} ms | create main ${f(res.main.make)} vs vm ${f(res.vm.make)} ms | ground ns/call main ${f(res.main.ground)} vs vm ${f(res.vm.ground)}`);
}
