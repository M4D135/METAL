// Exactness of ray v2 / castProjectile v2 vs original on many rays (Object.is on distance, normal compared exactly).
import {loadFast} from './fast.mjs';import {SCENARIOS,build,drive,makeInput} from './lib.mjs';import {rayPatch,exposeCast} from './ray-v2.mjs';
const A=loadFast({patches:exposeCast}),B=loadFast({patches:rayPatch()});let seed=31337;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296;};
for(const [label,idx,opts] of SCENARIOS){
  const a=build(A,idx,opts),b=build(B,idx,opts),w=a.world,bd=w.bounds;
  // advance both a little so that destruction/doors/traps are in a non-initial state
  for(const sim of [a.sim,b.sim]){const s=sim.state,inp=makeInput();inp.weapon=2;for(let i=0;i<700;i++){drive(i,inp,s);sim.step(1/60,inp);s.events.length=0;if(s.dead)break;}}
  let n=0,bad=0,badCast=0,first=null;const t0={a:0,b:0};
  const dirs=[];for(let i=0;i<60000;i++){let o=[bd.minX+rnd()*(bd.maxX-bd.minX),-1+rnd()*9,bd.minZ+rnd()*(bd.maxZ-bd.minZ)],dd;
    const kind=i%6;if(kind===0)dd=[0,-1,0];else if(kind===1)dd=[1,0,0];else if(kind===2)dd=[0,0,-1];else{const az=rnd()*Math.PI*2,el=(rnd()-.5)*2.4;dd=[Math.cos(az)*Math.cos(el),Math.sin(el),Math.sin(az)*Math.cos(el)];}
    if(i%50===0)o=[bd.minX-5,1,bd.minZ+rnd()*(bd.maxZ-bd.minZ)];dirs.push([o,dd,[.5,3,12,40,80,300][i%6]]);}
  for(const [o,d,f] of dirs){n++;const ra=a.sim.ray(o,d,f),rb=b.sim.ray(o,d,f);if(!Object.is(ra,rb)){bad++;if(!first)first=[o,d,f,ra,rb];}
    const ca=a.sim.__castProjectile(o,d,Math.min(f,40),.17),cb=b.sim.__castProjectile(o,d,Math.min(f,40),.17);if(!Object.is(ca.distance,cb.distance)||ca.normal.some((v,k)=>!Object.is(v,cb.normal[k])))badCast++;}
  let t=performance.now();for(const [o,d,f] of dirs)a.sim.ray(o,d,f);t0.a=performance.now()-t;t=performance.now();for(const [o,d,f] of dirs)b.sim.ray(o,d,f);t0.b=performance.now()-t;
  let tc=performance.now();for(const [o,d,f] of dirs)a.sim.__castProjectile(o,d,Math.min(f,40),.17);const ca=performance.now()-tc;tc=performance.now();for(const [o,d,f] of dirs)b.sim.__castProjectile(o,d,Math.min(f,40),.17);const cb=performance.now()-tc;
  console.log(label+': rays '+n+' ray mismatches '+bad+' castProjectile mismatches '+badCast+(first?' first '+JSON.stringify(first):'')+' | ray us/call '+(t0.a/n*1000).toFixed(2)+' -> '+(t0.b/n*1000).toFixed(2)+' | cast us/call '+(ca/n*1000).toFixed(2)+' -> '+(cb/n*1000).toFixed(2));
}
