import {readFileSync} from 'node:fs'; import vm from 'node:vm';
const root=(process.env.METAL_ROOT||process.cwd());
const ctx={window:{},performance,console,Math,Date}; vm.createContext(ctx);
for(const n of ['renderer','world'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
for(let i=0;i<18;i++){const w=ctx.window.FWorld.create(96,i,{campaign:true,campaignVersion:2});const e=w.environment;
  const mats={};for(const m of w.meshes)mats[m.mat||0]=(mats[m.mat||0]||0)+1;
  console.log(i,e&&e.biome,'fog',e&&e.fogDensity,'meshes',w.meshes.length,'lights',w.lights.length,'zones',e&&e.outdoorZones.length,'sun',e&&e.sunColor.map(v=>+v.toFixed(2)).join('/'),'mats',JSON.stringify(mats));}
