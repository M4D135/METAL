// CPU profile target. usage: node --cpu-prof --cpu-prof-dir=out --cpu-prof-interval 60 prof.mjs <sim|frame> <orig|r1> [frames]
import {loadAll,simSource,SCENARIOS,build,drive,makeInput} from './build.mjs';import {scene} from './scene.mjs';
const [mode='sim',variant='r1',N='3000']=process.argv.slice(2);
if(mode==='sim'){
  const win=loadAll({sim:variant==='r1'?{}:null,names:['renderer','world','destruction','economy','brain','simulation']});
  let total=0,steps=0;
  for(const [label,idx,opts] of SCENARIOS){const {sim}=build(win,idx,opts),s=sim.state,input=makeInput();
    for(let i=0;i<+N;i++){drive(i,input,s);if(s.player.hp<50)s.player.hp=100;const t=performance.now();sim.step(1/60,input);total+=performance.now()-t;steps++;s.events.length=0;}}
  console.log('sim',variant,'steps',steps,'mean us',(1e3*total/steps).toFixed(1));
}else{
  for(const spec of [['camp',6],['camp',12],['legacy',0]]){const sc=scene({variant,world:spec});for(let i=0;i<+N;i++)sc.frame();
    const T=sc.T;console.log('frame',variant,spec.join(''),Object.entries(T).map(([k,v])=>k+' '+(1e3*v/+N).toFixed(0)+'us').join(' | '));}
}
