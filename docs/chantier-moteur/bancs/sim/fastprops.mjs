// Checks V8 fast/dictionary property mode of objects scanned in hot loops (node --allow-natives-syntax).
import vm from 'node:vm';import {load,SCENARIOS,build} from './lib.mjs';
const ctx=load();
for(const [label,idx,opts] of SCENARIOS.slice(0,1).concat(SCENARIOS.slice(2,3))){
  const {world,sim}=build(ctx,idx,opts);ctx.__w=world;ctx.__s=sim.state;
  const r=vm.runInContext(`(()=>{const f=(list)=>{let fast=0,dict=0;for(const o of list){if(%HasFastProperties(o))fast++;else dict++;}return fast+'/'+dict;};
   return {walkable:f(__w.walkable),colliders:f(__w.colliders),simTraps:f(__s.traps),simEnemies:f(__s.enemies),doors:f(__s.doors),lifts:f(__s.lifts),pickups:f(__s.pickups),worldEnemies:f(__w.enemies),meshes:f(__w.meshes.slice(0,2000))};})()`,ctx);
  console.log(label,'fast/dictionary:',JSON.stringify(r));
}
