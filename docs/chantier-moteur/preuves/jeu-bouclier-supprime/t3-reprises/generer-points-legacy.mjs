// Fabrique de vrais points de reprise écrits AVANT le retrait du bouclier.
// Charge la base du lot dans un processus Node, simule quelques centaines de
// pas avec des entrées réelles, puis consigne snapshot() et exportLoadout().
// Usage : node generer-points-legacy.mjs <racine-base> <dossier-de-sortie>
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {loadRealm} from '../../../../../tools/realm-loader.mjs';

const [rootBase,outDir]=process.argv.slice(2);
if(!rootBase||!outDir)throw new Error('racine de base et dossier de sortie requis');
const W=loadRealm({root:resolve(rootBase),realm:'main'}).window;
mkdirSync(resolve(outDir),{recursive:true});
const cases=[
  {name:'classique-s0',seed:96,index:0,options:undefined,inventory:{weapons:[true,true,false,false],ammo:[120,10,0,0],shield:true},equipment:{right:0,left:'shield',shieldEnergy:64},armorSystem:true,armor:{version:1,points:150}},
  {name:'campagne-v1-w7',seed:96,index:6,options:{campaign:true},inventory:{weapons:[true,false,false,false,true],ammo:[48,0,0,0,1],shield:true},equipment:{right:0,left:'shield',shieldEnergy:100}},
  {name:'campagne-v2-w16',seed:96,index:15,options:{campaign:true,campaignVersion:2},inventory:{weapons:[true,true,true,true,true],ammo:[180,36,12,16,1],shield:true},equipment:{right:1,left:'shield',shieldEnergy:42}},
];
const manifest=[];
for(const spec of cases){
  const world=W.FWorld.create(spec.seed,spec.index,spec.options);
  const sim=W.FSimulation.create(world,{inventory:spec.inventory,equipment:spec.equipment,...(spec.armorSystem?{armorSystem:true,armor:spec.armor}:{})});
  const input={fire:false,fireLeft:false,moveX:0,moveY:0,dash:false,sprint:false};
  for(let step=0;step<600;step++){
    input.fire=step%7<3;input.fireLeft=step%11<2;input.moveY=step%40<24?1:-1;input.moveX=step%23<10?1:0;input.dash=step%97===0;
    sim.step(1/60,input);
    sim.state.events.length=0;
    if(sim.state.dead||sim.state.won)break;
  }
  const snapshot=sim.snapshot(),loadout=sim.exportLoadout();
  writeFileSync(join(resolve(outDir),spec.name+'.json.gz'),gzipSync(JSON.stringify({world:{seed:spec.seed,index:spec.index,options:spec.options},snapshot,loadout})));
  manifest.push({nom:spec.name,seed:spec.seed,index:spec.index,options:spec.options??null,pas:sim.state.elapsed,
    empreinte:snapshot.fingerprint,versionPoint:snapshot.campaignVersion??null,economie:snapshot.economyVersion??null,
    bouclierDansLePoint:snapshot.state.shield??null,inventaireBouclier:snapshot.state.inventory.shield??null,
    mainGauche:snapshot.state.equipment?.left??null,armure:snapshot.state.armor??null,
    decouvertes:snapshot.state.campaign?.discovered??null});
  sim.dispose?.();
}
writeFileSync(join(resolve(outDir),'manifeste.json'),JSON.stringify(manifest,null,1));
console.log(JSON.stringify(manifest,null,1));
