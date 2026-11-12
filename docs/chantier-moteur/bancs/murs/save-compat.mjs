// Compatibilité des sauvegardes : empreinte de simulation et aller-retour de points de reprise entre
// METAL 673d6b2 (O) et la copie de travail avec la règle (R). Aucune écriture hors de bench/murs.
import {loadFast,loadRoot,loadoutV2,fnv,ROOT} from './lib.mjs';
const WORK=new URL('./work',import.meta.url).pathname;
const O=loadFast(),R=loadRoot(WORK);
function run(W,index,weapon,steps,restoreFrom){
  const world=W.FWorld.create(96,index,{campaign:true,campaignVersion:2}),carry=loadoutV2(W,index);
  const sim=W.FSimulation.create(world,{...carry,armorSystem:true});sim.selectWeapon(weapon);
  let restored=null;if(restoreFrom)restored=sim.restore(JSON.parse(JSON.stringify(restoreFrom)),{recover:true});
  const s=sim.state,p=s.player,input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
  for(let i=0;i<steps;i++){p.hp=Math.max(p.hp,70);input.moveX=Math.sin(i/90);input.fire=(i%20)<12;p.yaw+=.013;if(weapon!==4&&s.inventory.ammo[weapon]<8)s.inventory.ammo[weapon]=sim.ammoCaps[weapon];sim.step(1/60,input);s.events.length=0;}
  return {world,sim,restored};
}
for(const [index,weapon] of [[2,0],[9,0]]){
  const o=run(O,index,weapon,1500),snapO=o.sim.snapshot(),r0=run(R,index,weapon,0);
  const fpO=snapO.fingerprint,fpR=r0.sim.snapshot().fingerprint,sigO=snapO.destruction.signature,sigR=r0.sim.snapshot().destruction.signature;
  const cuts=snapO.destruction.states.filter(s=>s.cuts.length||s.removed).length,partial=snapO.destruction.states.filter(s=>!s.cuts.length&&!s.removed).length;
  // O -> R : un point de reprise de la 0.8 d'origine est-il accepté par la version à règle ?
  const r=run(R,index,weapon,600,snapO),snapR=r.sim.snapshot();
  // R -> O : et dans l'autre sens (retour arrière)
  const back=run(O,index,weapon,0,snapR);
  // témoin négatif : un champ ajouté DANS world.destructibles change l'empreinte
  const worldBad=O.FWorld.create(96,index,{campaign:true,campaignVersion:2});worldBad.destructibles.forEach(g=>{if(g.kind==='wall')g.armor='heavy';});
  const bad=O.FSimulation.create(worldBad,{...loadoutV2(O,index),armorSystem:true}),fpBad=bad.snapshot().fingerprint,badRestore=bad.restore(JSON.parse(JSON.stringify(snapO)),{recover:true});
  // témoins : même version (O -> O), puis les mêmes instantanés sans gravats (le refus des gravats au repos est le défaut LOAD-01 du premier tour)
  const same=run(O,index,weapon,0,snapO).restored,strip=q=>{const c=JSON.parse(JSON.stringify(q));c.state.rubble=[];return c;};
  const noRubbleOO=run(O,index,weapon,0,strip(snapO)).restored,noRubbleOR=run(R,index,weapon,0,strip(snapO)).restored,noRubbleRO=run(O,index,weapon,0,strip(snapR)).restored,noRubbleRR=run(R,index,weapon,0,strip(snapR)).restored;
  console.log(JSON.stringify({témoin_O_vers_O:same,sansGravats:{O_vers_O:noRubbleOO,O_vers_R:noRubbleOR,R_vers_O:noRubbleRO,R_vers_R:noRubbleRR},gravatsO:snapO.state.rubble.length,gravatsR:snapR.state.rubble.length}));
  console.log(JSON.stringify({monde:index+1,arme:weapon,empreinteOrigine:fpO,empreinteRègle:fpR,identiques:fpO===fpR,signatureDestructionIdentique:sigO===sigR,blindés:r0.world.destructibles.filter(g=>r0.sim.destruction.armor(g.id)===1).length,jamais:r0.world.destructibles.filter(g=>r0.sim.destruction.armor(g.id)===2).length,mondeJSONidentique:fnv(JSON.stringify(o.world))===fnv(JSON.stringify(r0.world)),étatsAvecCoupes:cuts,étatsDégâtsPartiels:partial,révisionsOrigine:snapO.destruction.revision,
    restaureO_vers_R:r.restored,révisionsAprès600pas:snapR.destruction.revision,restaureR_vers_O:back.restored,témoin_champDansDestructibles:{empreinte:fpBad,restaure:badRestore}}));
}
