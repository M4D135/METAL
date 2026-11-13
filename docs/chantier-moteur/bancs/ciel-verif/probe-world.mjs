// CIEL : inspection des mondes de METAL (lecture seule) dans le domaine principal de Node.
import {readFileSync} from 'node:fs';
const root=process.argv[2];
globalThis.window=globalThis;
(0,eval)(readFileSync(root+'/src/world.js','utf8'));
for(const i of [0,1,2,3,4,5,17]){
  const w=FWorld.create('ciel',i,{campaign:true});
  const e=w.environment;
  console.log(i,w.title,'stage',w.stage,'biome',e.biome,'sun',e.sunDirection.map(v=>+v.toFixed(3)),'top',e.skyTop,'bot',e.skyBottom,'fog',e.fog,'fd',e.fogDensity,'amb',e.ambient,'sunC',e.sunColor,'wind',e.wind,'weather',e.weather);
  console.log('   spawn',JSON.stringify(w.spawn),'arena',JSON.stringify(w.bossArena),'zones',e.outdoorZones.length,'first',JSON.stringify(e.outdoorZones[0]),'meshes',w.meshes.length);
}
