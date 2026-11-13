// Per-piece cost of updateDebris (main realm): resting vs moving, by shape; counts over the run.
import {loadFast} from './fast.mjs';import {SCENARIOS,build,drive,makeInput,mean,q as quant} from './lib.mjs';
const OLD="      for(const q of s.debris){\n        q.age=Math.min(1e7,q.age+dt);";
const NEW="      for(const q of s.debris){const __t0=performance.now(),__rest=!!q.resting;try{\n        q.age=Math.min(1e7,q.age+dt);";
const END="          else q.settleTime=0;\n        }\n      }\n      s.debris=s.debris.filter(";
const END2="          else q.settleTime=0;\n        }\n      }finally{__DC.rec(q,__rest,performance.now()-__t0);}}\n      s.debris=s.debris.filter(";
globalThis.__DC={rows:[],rec(q,rest,ms){this.rows.push([rest?(q.resting?'rest->rest':'rest->wake'):(!q.structural&&q.age>=q.life?'expired':'moving'),q.shape||'chip',ms]);}};
const ctx=loadFast({patches:{simulation:[[OLD,NEW],[END,END2]]}});
for(const [label,idx,opts] of SCENARIOS.concat([['legacy-s2-rockets',2,undefined]])){
  __DC.rows=[];const {sim}=build(ctx,idx,opts),s=sim.state,input=makeInput();if(label.endsWith('rockets'))input.weapon=2;let steps=0;
  for(let i=0;i<1800;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;steps++;if(s.dead)break;}
  const by=new Map();for(const [k,shape,ms] of __DC.rows){const key=k;let a=by.get(key);if(!a)by.set(key,a=[]);a.push(ms*1000);}
  const tot=__DC.rows.reduce((a,r)=>a+r[2],0);
  console.log(label+': piece-steps '+__DC.rows.length+' ('+(__DC.rows.length/steps).toFixed(1)+'/step), updateDebris loop '+(tot/steps*1000).toFixed(1)+' us/step');
  for(const [k,a] of [...by].sort((x,y)=>y[1].length-x[1].length))console.log('   '+k.padEnd(11)+' n '+String(a.length).padStart(7)+' mean '+mean(a).toFixed(2)+' us  p99 '+quant(a,.99).toFixed(1)+' us  share '+(100*a.reduce((x,y)=>x+y,0)/1000/tot).toFixed(0)+'%');
  const sh=new Map();for(const [k,shape,ms] of __DC.rows)if(k==='moving'){let a=sh.get(shape);if(!a)sh.set(shape,a=[]);a.push(ms*1000);}
  console.log('   moving by shape: '+[...sh].map(([k,a])=>k+' n'+a.length+' '+mean(a).toFixed(1)+'us').join(' | '));
}
