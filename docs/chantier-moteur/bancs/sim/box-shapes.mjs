// Distinct V8 hidden classes among the arrays the hot loops read (node --allow-natives-syntax box-shapes.mjs).
// V8 inline caches stay polymorphic up to 4 maps; 5+ maps => megamorphic loads (and a fresh HeapNumber per double field read).
import {loadFast} from './fast.mjs';import {SCENARIOS,build} from './lib.mjs';
const same=new Function('a','b','return %HaveSameMap(a,b)');
const maps=list=>{const reps=[];for(const o of list)if(o&&typeof o==='object'&&!reps.some(r=>same(r,o)))reps.push(o);return reps.length;};
const keysets=list=>new Set(list.map(o=>Object.keys(o).join(','))).size;
const ctx=loadFast();
for(const [label,idx,opts] of SCENARIOS){const {world,sim}=build(ctx,idx,opts);const col=sim.destruction.colliders,s=sim.state;
  console.log(label.padEnd(13)+' walkable '+world.walkable.length+' -> '+maps(world.walkable)+' maps | solids (destruction.colliders) '+col.length+' -> '+maps(col)+' maps / '+keysets(col)+' key-sets | world.colliders '+maps(world.colliders||[])+' maps | enemies '+s.enemies.length+' -> '+maps(s.enemies)+' maps | doors '+(s.doors||[]).length+' -> '+maps(s.doors||[])+' maps');}
