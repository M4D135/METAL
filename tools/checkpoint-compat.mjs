// Vérifie de vraies reprises avec contrôles A/A et B/B. Exit 1 si la compatibilité A/B échoue.
import {loadRealm,defaultModules} from "./realm-loader.mjs";
import {buildScenario,selectScenarios,makeInput,drive,STEP_SECONDS} from "./proof/scenarios.mjs";
const [base, head = process.cwd()] = process.argv.slice(2);
if (!base) throw new Error("Usage: node tools/checkpoint-compat.mjs racine-ancienne [racine-nouvelle]");
const modules=root=>defaultModules(root).filter(n=>["fmath","passages","world","renderer","destruction","economy","brain","simulation"].includes(n));
const A=loadRealm({root:base,modules:modules(base)}),B=loadRealm({root:head,modules:modules(head)});const results=[];
for(const scenario of selectScenarios("legacy-s0,campaign-w10,campaign2-w10")){
 const a=buildScenario(A,scenario,{seed:96}),aa=buildScenario(A,scenario,{seed:96}),b=buildScenario(B,scenario,{seed:96}),bb=buildScenario(B,scenario,{seed:96});
 for(let i=0;i<60;i++){const input=makeInput(4);drive(i,input,a.sim.state);a.sim.step(STEP_SECONDS,input);a.sim.state.events.length=0;}
 const saved=JSON.parse(JSON.stringify(a.sim.snapshot())),own=JSON.parse(JSON.stringify(b.sim.snapshot()));
 results.push({scenario:scenario.id,baseToBase:aa.sim.restore(structuredClone(saved)),baseToHead:b.sim.restore(structuredClone(saved)),headToHead:bb.sim.restore(structuredClone(own)),sameFingerprint:saved.fingerprint===own.fingerprint});
 for(const x of [a,aa,b,bb])x.dispose();
}
console.log(JSON.stringify({base,head,results},null,2));

if(results.some(r=>!r.baseToBase||!r.headToHead))throw new Error("Contrôle de reprise à version identique invalide");
process.exitCode=results.some(r=>!r.baseToHead)?1:0;
