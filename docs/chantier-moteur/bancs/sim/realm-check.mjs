// Does passing the OUTER realm's Math/Date into the vm context (as bench.mjs does) distort timings?
import vm from 'node:vm';import {readFileSync} from 'node:fs';import {ROOT,MODULES,SCENARIOS,build} from './lib.mjs';
function mk(shareMath){const ctx=shareMath?{window:{},performance,console,Math,Date}:{window:{},performance,console};vm.createContext(ctx);for(const n of MODULES)vm.runInContext(readFileSync(ROOT+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});return ctx;}
for(const share of [true,false]){
  const ctx=mk(share);const [label,idx,opts]=SCENARIOS[0];const {world,sim}=build(ctx,idx,opts);const b=world.bounds,N=1e6,xs=new Float64Array(N),zs=new Float64Array(N);
  let seed=12345;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296;};
  for(let i=0;i<N;i++){xs[i]=b.minX+rnd()*(b.maxX-b.minX);zs[i]=b.minZ+rnd()*(b.maxZ-b.minZ);}
  // Also time an in-context loop, to exclude the cross-realm call itself.
  ctx.__xs=xs;ctx.__zs=zs;ctx.__g=sim.ground;
  const inner=vm.runInContext('(()=>{let acc=0;for(let i=0;i<2e5;i++)acc+=__g(__xs[i],__zs[i]);const r=[];for(let k=0;k<5;k++){const t=performance.now();for(let i=0;i<__xs.length;i++)acc+=__g(__xs[i],__zs[i]);r.push((performance.now()-t)/__xs.length*1e6);}r.sort((a,b)=>a-b);return r[2];})()',ctx);
  console.log('shareOuterMath='+share,'in-context ground ns/call',inner.toFixed(1),' Math is outer:',vm.runInContext('Math',ctx)===Math);
}
