// Sonde T4 : prépare un vrai point de reprise lourd pour la page du jeu.
// Même enveloppe et mêmes options que game.js (armorSystem, cerveau), monde legacy
// secteur 3 (graine 96) après 900 pas du pilote d'audit aux roquettes.
// node $W chrome-sauvegarde.mjs <racine> <sortie.js> [scénario] [arme] [pas]
import {writeFileSync} from 'node:fs';
import {loadRealm} from '../../../../../tools/realm-loader.mjs';
import {makeInput,drive,selectScenarios} from '../../../../../tools/proof/scenarios.mjs';
const [root,out,id='legacy-s2',weaponArg='2',stepsArg='900']=process.argv.slice(2);
const L=loadRealm({root}),{FWorld,FSimulation,FBrain}=L.window,sc=selectScenarios(id)[0];
const world=FWorld.create(96,sc.index,sc.options?{...sc.options}:undefined),brain=FBrain.create({mode:'cpu'});
const sim=FSimulation.create(world,{armorSystem:true,brain}),s=sim.state,input=makeInput(weaponArg===''?undefined:+weaponArg);
let i=0;for(;i<+stepsArg;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;if(s.dead||s.won)break;}
const campaign=!!world.campaign,checkpoint=sim.snapshot();
const run={version:campaign?3:2,...(campaign?{campaign:true,index:sc.index,...(world.campaignVersion===2?{campaignRevision:2}:{})}:{}),generation:world.generation||3,seed:96,stage:campaign?world.stage:sc.index,runStats:{time:0,kills:0,shots:0,hits:0,score:0},entryLoadout:null,checkpoint};
const text=JSON.stringify(run);
writeFileSync(out,'window.__T4SAVE='+JSON.stringify(text)+';\n');
console.log(JSON.stringify({id,steps:i,chars:text.length,relays:s.relays,coresLeft:s.cores.filter(c=>!c.taken).length,rubble:checkpoint.state.rubble.length,enemies:s.enemies.length,dead:s.dead}));
sim.dispose();brain.dispose();
