// Cost of one sim.ray() (main realm) for short/long rays, and how many boxes a 8 m-cell DDA would visit.
import {loadFast} from './fast.mjs';import {SCENARIOS,build} from './lib.mjs';
const ctx=loadFast();let seed=99;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296;};
for(const [label,idx,opts] of SCENARIOS){
  const {world,sim}=build(ctx,idx,opts),b=world.bounds;const rays=[];
  for(let i=0;i<20000;i++){const o=[b.minX+rnd()*(b.maxX-b.minX),.5+rnd()*2,b.minZ+rnd()*(b.maxZ-b.minZ)],a=rnd()*Math.PI*2,e=(rnd()-.5)*.6,d=[Math.cos(a)*Math.cos(e),Math.sin(e),Math.sin(a)*Math.cos(e)];rays.push([o,d,[2,10,30,80][i%4]]);}
  let acc=0;for(const [o,d,f] of rays)acc+=sim.ray(o,d,f);
  const t=performance.now();for(let r=0;r<5;r++)for(const [o,d,f] of rays)acc+=sim.ray(o,d,f);const us=(performance.now()-t)/(rays.length*5)*1000;
  console.log(label,'colliders',world.colliders.length,'floors',world.walkable.length,'ray us/call',us.toFixed(2),'checksum',acc.toFixed(1));
}
