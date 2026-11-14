// Banc de génération pure : crée des mondes de campagne sans jamais simuler,
// pour que le profileur ne voie que le travail de FWorld.create.
// Usage : node banc-profil.mjs <racine> [passes]
import {loadRealm} from '../../../../../tools/realm-loader.mjs';

const root=process.argv[2]||'.',passes=Number(process.argv[3]||3);
const {FWorld}=loadRealm({root,realm:'main'}).window;
let meshes=0;
for(let pass=0;pass<passes;pass++)for(let index=0;index<18;index++){
  const w=FWorld.create(96,index,{campaign:true,campaignVersion:2});
  meshes+=w.meshes.length;
}
process.stdout.write(JSON.stringify({passes,worlds:passes*18,meshes})+'\n');
