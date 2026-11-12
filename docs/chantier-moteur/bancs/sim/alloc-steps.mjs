// Allocation per simulation step (main realm), measured by V8's own GC counters through gc-harness.mjs.
// Each scenario runs twice on a fresh sim: pass 1 = cold (includes JIT warm-up), pass 2 = warm.
// usage: node gc-harness.mjs alloc-steps.mjs [patchModule exportName]
import {loadFast} from './fast.mjs';import {SCENARIOS,drive,makeInput,build} from './lib.mjs';
const mod=process.argv[2],exp=process.argv[3];const fn=mod?(await import('./'+mod))[exp]:null;
const ctx=loadFast(fn?{patches:typeof fn==='function'?fn():fn}:{});const tag=mod?exp:'original';
for(const pass of [1,2])for(const [label,idx,opts] of SCENARIOS){
  const {sim}=build(ctx,idx,opts),s=sim.state,input=makeInput();let n=0;
  globalThis.gc();console.log('##BEGIN '+tag+'/'+label+'/p'+pass);
  for(let i=0;i<1800;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;n++;if(s.dead)break;}
  console.log('##TAIL');globalThis.gc();console.log('##END '+n);
}
