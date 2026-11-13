// Lot 02 / T1 : pas où la file de navigation travaille (aiStats.navUpdates > 0) et cellules évaluées,
// avant (METAL_ROOT) et après (cet arbre), pilote du banc du plan (bancs/sim/lib.mjs), 300 et 1 800 pas.
// Explique le ratio médian par pas : seuls ces pas changent de coût.
// usage : METAL_ROOT=<racine-avant> node pump-steps.mjs
import {loadFast} from '../../../bancs/sim/fast.mjs';
import {build,drive,makeInput} from '../../../bancs/sim/lib.mjs';
import {treeSimulation} from './tree-patch.mjs';
const V={avant:loadFast(),'après':loadFast({patches:treeSimulation()})};
const SC={'legacy-s0':[0,undefined],'legacy-s2':[2,undefined],'campaign-w10':[9,{campaign:true}],'campaign-w16':[15,{campaign:true}]};
for(const [id,[index,options]] of Object.entries(SC)){
  const out=[];
  for(const [label,win] of Object.entries(V)){
    const r={...build(win,index,options),input:makeInput()};let steps300=0,steps=0,cells300=0,cells=0;
    for(let i=0;i<1800;i++){drive(i,r.input,r.sim.state);r.sim.step(1/60,r.input);r.sim.state.events.length=0;const u=r.sim.state.aiStats.navUpdates||0;if(u){steps++;cells+=u;if(i<300){steps300++;cells300+=u;}}if(r.sim.state.dead)break;}
    out.push(`${label} : ${steps300}/300 pas (${cells300} cellules), ${steps}/1800 pas (${cells} cellules)`);
  }
  console.log(`${id.padEnd(13)} ${out.join(' | ')}`);
}
