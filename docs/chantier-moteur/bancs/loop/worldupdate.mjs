// Coût CPU de renderer.updateWorld() déclenché par game.js:152 syncDestruction() à chaque révision de
// destruction : spatialIndex() (renderer.js:768) sur tous les maillages + pack() (renderer.js:678) du lot statique.
// node worldupdate.mjs <ferro>
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const root=process.argv[2];const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation']){let src=readFileSync(root+'/src/'+n+'.js','utf8');
  if(n==='renderer')src=src.replace('window.FRender={create,foliageTriangles};','window.FRender={create,foliageTriangles,spatialIndex,environmentInfo,pack,packIndexed};');
  vm.runInContext(src,ctx,{filename:n+'.js'});}
const {FWorld,FSimulation,FRender}=ctx.window;const now=()=>performance.now();
for(const [label,idx,opts] of [['classic-0',0],['campaign-9',9,{campaign:true,campaignVersion:2}],['campaign-17',17,{campaign:true,campaignVersion:2}]]){
  const world=FWorld.create(96,idx,opts),sim=FSimulation.create(world,{armorSystem:true});const env=FRender.environmentInfo(world.environment);
  let meshes=sim.destruction?.meshes||world.meshes;let t=now();let index=FRender.spatialIndex(meshes,env);const full=now()-t;
  t=now();const packed=FRender.pack(meshes,env);const packMs=now()-t;
  const p=sim.state.player,costs=[];
  for(let k=0;k<6;k++){const rev=sim.destruction.revision;sim.destruction.blast([p.x+3+k,(p.y||0)+1,p.z-2-k],3.5,80);sim.step(1/60,{});if(sim.destruction.revision===rev)continue;
    meshes=sim.destruction.meshes;t=now();index=FRender.spatialIndex(meshes,env,index);costs.push(+(now()-t).toFixed(1));}
  console.log(label.padEnd(12),'maillages',meshes.length,'spatialIndex complet ms',full.toFixed(1),'| après destruction (index précédent réutilisé) ms',JSON.stringify(costs),'| pack() de tous les statiques ms',packMs.toFixed(1),'octets',packed.values?.byteLength);
}
