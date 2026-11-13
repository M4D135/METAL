// Lot 02 / T2 (SIM-02) : les vrais appels de ground(). Leurs arguments sont relevés pendant 1 800
// pas de l'avant (source instrumentée en mémoire ; pilote et scénarios de bancs/sim/lib.mjs, plus
// legacy-s2 avec l'arme 2), puis rejoués sur l'avant et sur l'arbre : Object.is sur chaque
// résultat, coût par appel (un passage de chauffe, puis 9 passages alternés, médiane) et chemin
// pris dans l'index de l'arbre (copie instrumentée en mémoire, comptée à part). Les scénarios se
// suivent dans le même processus : --ordre-inverse les rejoue dans l'autre sens, car la boucle
// d'objets de l'avant ralentit à mesure qu'elle voit les sols d'autres mondes.
// usage : node appels-reels.mjs <racine avant> <racine arbre> [--ordre-inverse]
// Les sources sont chargées dans le domaine principal de Node, jamais en node:vm.
import {resolve} from 'node:path';
import {loadFast} from '../../../bancs/load-verif2/lib.mjs';
import {SCENARIOS,build,drive,makeInput} from '../../../bancs/sim/lib.mjs';

const args=process.argv.slice(2),reverse=args.includes('--ordre-inverse'),[rootA,rootB]=args.filter(a=>a!=='--ordre-inverse');
if(!rootA||!rootB){console.error('usage: node appels-reels.mjs <racine avant> <racine arbre> [--ordre-inverse]');process.exit(2);}
const runs=[...SCENARIOS,['legacy-s2 arme 2',2,undefined,2]];if(reverse)runs.reverse();
const anchor='function ground(x,z,activeTraps=trapStates){';
const REC={window:loadFast({srcDir:resolve(rootA,'src'),patches:{simulation:[[anchor,anchor+'if(globalThis.__R){const R=globalThis.__R;if(R.n<R.x.length){R.x[R.n]=x;R.z[R.n]=z;R.n++;}}']]}})};
const V={avant:{window:loadFast({srcDir:resolve(rootA,'src')})},arbre:{window:loadFast({srcDir:resolve(rootB,'src')})}};
// Chemins : constante (plat couvrant), gTop sans plat (cellule vide ou substrat couvrant), plat
// touché, aucun plat puis gTop, balayage de la cellule, hors grille.
const inGrid=`        if(flats)for(let k=gStart[c],end=k+flats;k<end;k++){const i=gCells[k];if(Math.abs(x-gFX[i])<=gHW[i]&&Math.abs(z-gFZ[i])<=gHD[i]){result=gFY[i];break;}}
        if(result!==result){const top=gTop[c];result=top===top?top:groundScan(x,z,gCells,gStart[c],gStart[c+1]);}`;
const counted=inGrid+`
        {const H=globalThis.__H;if(H){let tests=0;if(flats)for(let k=gStart[c],end=k+flats;k<end;k++){tests++;const i=gCells[k];if(Math.abs(x-gFX[i])<=gHW[i]&&Math.abs(z-gFZ[i])<=gHD[i])break;}H.tests+=tests;
          const hit=flats&&tests&&(()=>{const i=gCells[gStart[c]+tests-1];return Math.abs(x-gFX[i])<=gHW[i]&&Math.abs(z-gFZ[i])<=gHD[i];})(),top=gTop[c],flat=gStart[c]<gStart[c+1]&&gFK[gCells[gStart[c]]]===0;
          if(hit)H.flatHit++;else if(top===top){if(flats)H.missTop++;else if(flat)H.constant++;else H.topNoFlat++;}else{H.scan++;H.scanned+=gStart[c+1]-gStart[c];}}}`;
const outside='}else result=groundScan(x,z,gAll,0,floorCount);';
const P={window:loadFast({srcDir:resolve(rootB,'src'),patches:{simulation:[[inGrid,counted],[outside,'}else{if(globalThis.__H)globalThis.__H.outside++;result=groundScan(x,z,gAll,0,floorCount);}']]}})};
const med=a=>a.slice().sort((p,q)=>p-q)[a.length>>1];
const rows=[];
for(const [label,idx,opts,weapon] of runs){
  globalThis.__R=null;const rec=build(REC,idx,opts),s=rec.sim.state,input=makeInput();if(weapon!==undefined)input.weapon=weapon;
  globalThis.__R={n:0,x:new Float64Array(4e6),z:new Float64Array(4e6)};
  for(let i=0;i<1800;i++){drive(i,input,s);rec.sim.step(1/60,input);s.events.length=0;if(s.dead)break;}
  const R=globalThis.__R;globalThis.__R=null;const X=R.x.subarray(0,R.n),Z=R.z.subarray(0,R.n);
  const a=build(V.avant,idx,opts).sim,b=build(V.arbre,idx,opts).sim,p=build(P,idx,opts).sim;
  let diff=0;for(let i=0;i<X.length;i++)if(!Object.is(a.ground(X[i],Z[i]),b.ground(X[i],Z[i])))diff++;
  const H=globalThis.__H={flatHit:0,missTop:0,constant:0,topNoFlat:0,scan:0,scanned:0,outside:0,tests:0};
  for(let i=0;i<X.length;i++)p.ground(X[i],Z[i]);globalThis.__H=null;
  const run=g=>{let acc=0;const t=performance.now();for(let i=0;i<X.length;i++)acc+=g(X[i],Z[i]);const ns=(performance.now()-t)/X.length*1e6;globalThis.__sink=acc;return ns;};
  run(a.ground);run(b.ground);const ta=[],tb=[];
  for(let k=0;k<9;k++){if(k%2){tb.push(run(b.ground));ta.push(run(a.ground));}else{ta.push(run(a.ground));tb.push(run(b.ground));}}
  const n=X.length,pc=v=>+(100*v/n).toFixed(1),row={id:label,calls:n,mismatches:diff,nsPerCall:{avant:+med(ta).toFixed(1),arbre:+med(tb).toFixed(1)},ratio:+(med(tb)/med(ta)).toFixed(3),
    pathsPercent:{constante:pc(H.constant),gTopSansPlat:pc(H.topNoFlat),platTouche:pc(H.flatHit),aucunPlatPuisGTop:pc(H.missTop),balayage:pc(H.scan),horsGrille:pc(H.outside)},
    flatTestsPerCall:+(H.tests/n).toFixed(2),candidatesPerScan:+(H.scanned/Math.max(1,H.scan)).toFixed(2)};
  rows.push(row);
  console.log(label.padEnd(16),'appels',n,'écarts',diff,'| ns/appel avant',row.nsPerCall.avant,'arbre',row.nsPerCall.arbre,'ratio',row.ratio,'| chemins %',JSON.stringify(row.pathsPercent),'| tests de plats/appel',row.flatTestsPerCall,'| candidats/balayage',row.candidatesPerScan);
}
process.exitCode=rows.some(r=>r.mismatches)?1:0;
