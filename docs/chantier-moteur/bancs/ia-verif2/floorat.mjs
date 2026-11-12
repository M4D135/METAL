// Which walkable rectangles cover given points? usage: node floorat.mjs <repo> <scenario> x,z [x,z...]
import {loadSet,pickScen} from './lib.mjs';
const [root,filter,...pts]=process.argv.slice(2);
const W=loadSet(root);const [label,idx,opts]=pickScen(filter)[0];const w=W.FWorld.create(96,idx,opts);
console.log(label,'floors',w.walkable.length,'bounds',JSON.stringify(w.bounds));
for(const p of pts){const [x,z]=p.split(',').map(Number);
  const hits=w.walkable.filter(f=>Math.abs(x-f.x)<=f.w/2+1e-7&&Math.abs(z-f.z)<=f.d/2+1e-7).map(f=>({x:f.x,z:f.z,w:f.w,d:f.d,y:f.y,sub:!!f.substrate,fb:!!f.fallback,slope:[f.slopeX||0,f.slopeZ||0]}));
  console.log(p,JSON.stringify(hits));}
const sub=w.walkable.filter(f=>f.substrate||f.fallback);console.log('substrate/fallback floors',JSON.stringify(sub.map(f=>({x:f.x,z:f.z,w:f.w,d:f.d,y:f.y}))));
