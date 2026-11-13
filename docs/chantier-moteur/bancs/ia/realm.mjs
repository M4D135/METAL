// Step-time statistics of the unmodified simulation, vm realm vs main realm.
// usage: node realm.mjs <repo> vm|main [steps] [scenarioFilter]
import {load,drive} from './load.mjs'; import {loadMain} from './loadmain.mjs';
const root=process.argv[2],realm=process.argv[3]||'vm',STEPS=+process.argv[4]||1800,filter=process.argv[5]||'';
const G=realm==='main'?loadMain(root):load(root);const {FWorld,FSimulation,FBrain}=G.window;
const SC=[['legacy-s0',0,undefined],['legacy-s2',2,undefined],['v2-w01',0,{campaign:true,campaignVersion:2}],['v2-w06',5,{campaign:true,campaignVersion:2}],['v2-w10',9,{campaign:true,campaignVersion:2}],['v2-w16',15,{campaign:true,campaignVersion:2}],['v2-w18',17,{campaign:true,campaignVersion:2}]].filter(s=>s[0].includes(filter));
const out={};
for(const [label,idx,opts] of SC){
  let t=performance.now();const w=FWorld.create(96,idx,opts);const gen=performance.now()-t;
  t=performance.now();const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});const init=performance.now()-t;
  const s=sim.state,input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0},times=[];
  for(let i=0;i<STEPS;i++){drive(i,input,s);const t0=performance.now();sim.step(1/60,input);times.push(performance.now()-t0);s.events.length=0;if(s.dead)break;}
  const sorted=times.slice().sort((a,b)=>a-b),q=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
  out[label]={genMs:+gen.toFixed(0),simInitMs:+init.toFixed(0),avg:+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(3),p50:+q(.5).toFixed(3),p99:+q(.99).toFixed(2),max:+sorted.at(-1).toFixed(2),over4ms:times.filter(v=>v>4).length,over8ms:times.filter(v=>v>8).length,spikeSteps:times.map((v,i)=>[i,v]).filter(x=>x[1]>3*q(.99)&&x[1]>2).map(x=>x[0]+':'+x[1].toFixed(1)).slice(0,8).join(' ')};
}
console.log(realm,JSON.stringify(out,null,0).replace(/},"/g,'},\n"'));
