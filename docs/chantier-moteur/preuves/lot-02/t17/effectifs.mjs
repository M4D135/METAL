// Lot 02 / T17 (SIM-13) : effectif world.enemies.length, qui borne state.loot, pour 5 graines
// et les 39 mondes (3 secteurs classiques, 18 mondes de campagne V1, 18 de campagne V2).
// usage (depuis la racine du dépôt) : node $W effectifs.mjs <racine> [graines]
import {loadRealm} from '../../../../../tools/realm-loader.mjs';
const [root='.',seedsArg='1,7,96,31337,123456']=process.argv.slice(2),seeds=seedsArg.split(',').map(Number);
const {FWorld}=loadRealm({root}).window,out={root,seeds,bySeed:{}};
for(const seed of seeds)out.bySeed[seed]={
  classic:[0,1,2].map(i=>FWorld.create(seed,i).enemies.length),
  campaign:Array.from({length:18},(_,i)=>FWorld.create(seed,i,{campaign:true}).enemies.length),
  campaign2:Array.from({length:18},(_,i)=>FWorld.create(seed,i,{campaign:true,campaignVersion:2}).enemies.length),
};
const rows=Object.values(out.bySeed),key=r=>JSON.stringify(r);
out.sameForAllSeeds=rows.every(r=>key(r)===key(rows[0]));
out.max=Math.max(...rows.flatMap(r=>[...r.classic,...r.campaign,...r.campaign2]));
out.ranges=Object.fromEntries(['classic','campaign','campaign2'].map(k=>[k,[Math.min(...rows.flatMap(r=>r[k])),Math.max(...rows.flatMap(r=>r[k]))]]));
console.log(JSON.stringify(out));
