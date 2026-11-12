// The allocation fix (doubles through a typed scratch instead of call arguments) must not change the simulation.
import {SCENES as A} from './scenes.mjs';import {SCENES as B} from './scenes.v1.mjs';
for(const [name,steps] of [['rubble300',700],['blast200',700],['pyramid55',200]]){const a=A[name]({}).w,b=B[name]({}).w;let same=true;
  for(let i=0;i<steps;i++){if(name==='blast200'&&i===240){a.explode(0,.5,0,14,900);b.explode(0,.5,0,14,900);}a.step(1/120,1);b.step(1/120,1);if(i%100===99&&a.hash()!==b.hash())same=false;}
  console.log(name,'boxed-args kernel vs scratch kernel after',steps,'steps:',same&&a.hash()===b.hash()?'IDENTICAL '+a.hash():'DIFFERENT');}
