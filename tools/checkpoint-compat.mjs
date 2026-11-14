// Vérifie de vraies reprises avec contrôles A/A et B/B, sans réécrire le point.
import assert from 'node:assert/strict';
import {loadRealm,defaultModules} from './realm-loader.mjs';
import {buildScenario,selectScenarios,makeInput,drive,STEP_SECONDS} from './proof/scenarios.mjs';
const [base,head=process.cwd()]=process.argv.slice(2);
if(!base)throw new Error('Usage: node tools/checkpoint-compat.mjs racine-ancienne [racine-nouvelle]');
const modules=root=>defaultModules(root).filter(n=>['fmath','passages','world','renderer','destruction','economy','brain','simulation'].includes(n));
const A=loadRealm({root:base,modules:modules(base)}),B=loadRealm({root:head,modules:modules(head)}),results=[];
const plain=x=>JSON.parse(JSON.stringify(x));
for(const scenario of selectScenarios('legacy-s0,campaign-w10,campaign2-w10')){
 const a=buildScenario(A,scenario,{seed:96}),aa=buildScenario(A,scenario,{seed:96}),b=buildScenario(B,scenario,{seed:96}),bb=buildScenario(B,scenario,{seed:96});
 let legacy;
 try{
  for(let i=0;i<60;i++){const input=makeInput(4);drive(i,input,a.sim.state);a.sim.step(STEP_SECONDS,input);a.sim.state.events.length=0;}
  const saved=plain(a.sim.snapshot()),own=plain(b.sim.snapshot());
  const baseToBase=aa.sim.restore(plain(saved)),headToHead=bb.sim.restore(plain(own)),directToCurrent=b.sim.restore(plain(saved));
  let recovered=directToCurrent,mode=directToCurrent?'current':null,target=b;
  if(!recovered&&a.world.generation===6&&saved.fingerprint!==own.fingerprint){
   legacy=buildScenario(B,{...scenario,options:{...scenario.options,legacyTraps:true}},{seed:96});
   recovered=legacy.sim.restore(plain(saved));if(recovered){mode='pre-massive-traps';target=legacy;}
  }
  if(recovered)assert.deepEqual(plain(target.sim.snapshot()),saved,'entire resumed checkpoint must be retained');
  results.push({scenario:scenario.id,baseToBase,headToHead,directToCurrent,baseToHead:recovered,mode,sameFingerprint:saved.fingerprint===own.fingerprint});
 }finally{for(const x of [a,aa,b,bb,legacy])x?.dispose();}
}
console.log(JSON.stringify({base,head,results},null,2));
if(results.some(r=>!r.baseToBase||!r.headToHead))throw new Error('Contrôle de reprise à version identique invalide');
process.exitCode=results.some(r=>!r.baseToHead)?1:0;
