// Lot 02 / T1 (SIM-01, SIM-V1) : copie adaptée de bancs/sim-verif2/stale.mjs.
// A = code d'avant, B = code d'après, chargés depuis deux racines dans le domaine principal
// (tools/realm-loader.mjs), avancés en lockstep avec le pilote du contre-vérificateur.
// Tous les 30 pas, chaque arête en cache est rejugée deux fois : avec le prédicat propre de la
// variante (segmentFree, pièges compris pour A) et avec le prédicat statique (pièges retirés).
// On compte aussi, quand la file est vide, les cellules différentes d'un recalcul complet.
// usage : node stale-static.mjs <racine-avant> <racine-après>   env : SCEN=2,c9,0,c15,v1,v5 STEPS=1800 JSON_OUT=f.json
import {resolve} from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadRealm} from '../../../../../tools/realm-loader.mjs';
import {pilot,digest} from '../../../bancs/sim-verif2/load.mjs';
const [before,after]=process.argv.slice(2).map(p=>resolve(p));
if(!before||!after)throw new Error('usage: node stale-static.mjs <racine-avant> <racine-après>');
const ANCHOR='    function pumpNav(limit=768){';
const HOOK=`    (window.__navProbe=window.__navProbe||[]).push(()=>{
      const judge=()=>{const out=[];for(let i=0;i<nav.length;i++){if(!edgeKnown[i])continue;const ix=i%nx,nb=[ix?i-1:-1,ix<nx-1?i+1:-1,i-nx,i+nx];for(let k=0;k<4;k++){const m=1<<k,j=nb[k];if(!(edgeKnown[i]&m)||j<0||j>=nav.length)continue;out.push(!!(edgeOpen[i]&m)!==segmentFree(...coord(i),...coord(j),.4));}}return out;};
      const own=judge(),saved=trapBoxes.splice(0),fixed=judge();trapBoxes.push(...saved);
      let cells=0;for(let i=0;i<nav.length;i++){const [x,z]=coord(i);if(nav[i]!==(blocked(x,z,.4,ground(x,z),doorBoxes,solids,[])?0:1))cells++;}
      return {known:own.length,staleOwn:own.filter(Boolean).length,staleStatic:fixed.filter(Boolean).length,cells,pending:navPending};
    });
`;
const variant=root=>loadRealm({root,patches:{simulation:[[ANCHOR,HOOK+ANCHOR]]}}).window;
const A=variant(before),B=variant(after),STEPS=+process.env.STEPS||1800;
function make(win,label){
  // 2 = monde classique 2 ; c9 = campagne V1, monde d'indice 9 ; v5 = campagne V2, monde 5 (indice 4, comme campaign2-w5).
  const kind=label[0],index=kind==='c'?+label.slice(1):kind==='v'?+label.slice(1)-1:+label;
  const world=win.FWorld.create(96,index,kind==='c'?{campaign:true}:kind==='v'?{campaign:true,campaignVersion:2}:undefined);
  const brain=win.FBrain.create({mode:'cpu'}),sim=win.FSimulation.create(world,{brain});return {sim,probe:win.__navProbe.at(-1)};
}
const rows=[];
for(const label of (process.env.SCEN||'2,c9,0').split(',')){
  const a=make(A,label),b=make(B,label),sa=a.sim.state,sb=b.sim.state,ia={},ib={};
  const stat=()=>({checks:0,known:0,staleOwn:0,staleOwnMax:0,staleStatic:0,staleStaticMax:0,restChecks:0,restCells:0,navUpdates:0});
  const SA=stat(),SB=stat();let ha=1,hb=1,div=-1,gridSteps=0,gridMax=0,steps=0;
  const add=(S,x)=>{S.checks++;S.known+=x.known;S.staleOwn+=x.staleOwn;S.staleStatic+=x.staleStatic;S.staleOwnMax=Math.max(S.staleOwnMax,x.staleOwn);S.staleStaticMax=Math.max(S.staleStaticMax,x.staleStatic);if(!x.pending){S.restChecks++;S.restCells+=x.cells;}};
  for(let i=0;i<STEPS;i++){
    pilot(i,ia,sa,[2,0,3,1]);pilot(i,ib,sb,[2,0,3,1]);if(sa.player.hp<40)sa.player.hp=100;if(sb.player.hp<40)sb.player.hp=100;
    a.sim.step(1/60,ia);b.sim.step(1/60,ib);steps++;SA.navUpdates+=sa.aiStats.navUpdates||0;SB.navUpdates+=sb.aiStats.navUpdates||0;
    ha=digest(sa,ha);hb=digest(sb,hb);if(ha!==hb&&div<0)div=i;sa.events.length=0;sb.events.length=0;
    const ca=a.sim.nav.cells,cb=b.sim.nav.cells;let d=0;for(let k=0;k<ca.length;k++)if(ca[k]!==cb[k])d++;if(d){gridSteps++;gridMax=Math.max(gridMax,d);}
    if(i%30===29){add(SA,a.probe());add(SB,b.probe());}
    if(sa.dead||sb.dead)break;
  }
  const show=S=>`known ${(S.known/S.checks).toFixed(0)} | périmées (prédicat propre) ${(S.staleOwn/S.checks).toFixed(2)} max ${S.staleOwnMax} | périmées (prédicat statique) ${(S.staleStatic/S.checks).toFixed(2)} max ${S.staleStaticMax} | cellules ≠ recalcul au repos ${S.restCells} sur ${S.restChecks} contrôles | cellules évaluées par pumpNav ${S.navUpdates}`;
  const row={scenario:label,traps:sa.traps.map(q=>q.kind),steps,stateDivergesAt:div,gridDifferentSteps:gridSteps,gridDifferentMaxCells:gridMax,before:SA,after:SB};rows.push(row);
  console.log(`${label}: pièges=[${row.traps}] pas=${steps} état diverge au pas ${div} | grilles différentes ${gridSteps} pas (max ${gridMax} cellules)\n  avant : ${show(SA)}\n  après : ${show(SB)}`);
}
// Les racines sont identifiées par l'empreinte de leur simulation, sans chemin absolu.
const sha=root=>createHash('sha256').update(readFileSync(resolve(root,'src/simulation.js'))).digest('hex');
if(process.env.JSON_OUT)writeFileSync(process.env.JSON_OUT,JSON.stringify({schema:'metal-lot02-t1-stale-static-v1',beforeSimulationSha256:sha(before),afterSimulationSha256:sha(after),steps:STEPS,rows},null,1)+'\n');
