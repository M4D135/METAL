// Rays per step (max steps, with callers), main realm, via wrapper counters.
import vm from 'node:vm';import {source,MODULES,SCENARIOS,drive,makeInput,build} from './lib.mjs';import {wrapFunctions,tracker} from './instrument.mjs';
const NAMES=['ray','castProjectile','hitRay','sight','safeEntry','blastExposure','barrel','perceive','updateBrain','reactToShot','collectSupplies','fireArsenal','fire','explode','updateEncounters','canShoot','attack','burst','projectile','playerMuzzle','launchRocket','nearestInteraction','pulse','hear','updateEnvironment','step'];
for(const [label,idx,opts] of SCENARIOS){
  const T=tracker();globalThis.__T=T;const win={};globalThis.window=win;for(const n of MODULES){let src=source(n);if(n==='simulation')src=wrapFunctions(src,NAMES);vm.runInThisContext(src,{filename:n+'.js'});}delete globalThis.window;
  const {sim}=build({window:win},idx,opts);T.parents.clear();T.perStep.clear();T.cur.clear();T.step=0;const s=sim.state,input=makeInput();
  const per=[];for(let i=0;i<1800;i++){drive(i,input,s);const before=new Map(T.parents);sim.step(1/60,input);s.events.length=0;const r=T.cur.get('ray')||0,c=T.cur.get('castProjectile')||0;const diff=[...T.parents].filter(([k])=>k.startsWith('ray <- ')).map(([k,v])=>[k.slice(7),v-(before.get(k)||0)]).filter(([,v])=>v>0);per.push([i,r,c,diff]);T.endStep();if(s.dead)break;}
  const tot=per.reduce((a,x)=>a+x[1],0);console.log(label+': rays total '+tot+' ('+(tot/per.length).toFixed(2)+'/step), castProjectile '+per.reduce((a,x)=>a+x[2],0));
  for(const [i,r,c,d] of per.sort((a,b)=>b[1]-a[1]).slice(0,5))console.log('   step '+i+' rays '+r+' cast '+c+' :: '+d.map(([k,v])=>k+' '+v).join(', '));
}
