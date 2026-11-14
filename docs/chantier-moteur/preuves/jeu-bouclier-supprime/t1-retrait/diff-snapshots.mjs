// Compare la simulation avant/après le retrait du bouclier : chaîne d'étapes,
// empreintes par pas et différence précise du point de reprise sérialisé.
// Usage : node diff-snapshots.mjs <racine-avant> <racine-apres> [scénario]
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {loadRealm} from '../../../../../tools/realm-loader.mjs';
import {selectScenarios} from '../../../../../tools/proof/scenarios.mjs';
import {createRun,advance,finishRun} from '../../../../../tools/proof/run.mjs';

const [rootA,rootB,wanted]=process.argv.slice(2);
if(!rootA||!rootB)throw new Error('deux racines sont nécessaires');
const A=loadRealm({root:resolve(rootA),realm:'main'}),B=loadRealm({root:resolve(rootB),realm:'main'});
const steps=1800;

function replay(loaded,scenario){
  const run=createRun(loaded,scenario,{});
  try{
    for(let i=0;i<steps;i++){advance(run,i,{timed:false});if(run.sim.state.dead||run.sim.state.won)break;}
    const raw=run.sim.snapshot();
    return {...finishRun(run),raw};
  }
  catch(error){run.dispose();throw error;}
}
function leaves(value,trail=[],out=new Map()){
  if(value&&typeof value==='object'){for(const key of Object.keys(value))leaves(value[key],[...trail,key],out);}
  else out.set(trail.join('.'),JSON.stringify(value));
  return out;
}
function diff(a,b){
  const left=leaves(a),right=leaves(b),onlyA=[],onlyB=[],changed=[];
  for(const [key,value] of left){if(!right.has(key))onlyA.push(key);else if(right.get(key)!==value)changed.push(`${key} : ${value} → ${right.get(key)}`);}
  for(const key of right.keys())if(!left.has(key))onlyB.push(key);
  return {onlyA,onlyB,changed};
}

let allStepsMatch=true,allChainsMatch=true;
for(const scenario of selectScenarios(wanted||'all')){
  const a=replay(A,scenario),b=replay(B,scenario);
  const chain=a.chainHash===b.chainHash;
  const stepsMatch=a.rows.length===b.rows.length&&a.rows.every((row,i)=>row.stateHash===b.rows[i]?.stateHash);
  const d=diff(a.raw,b.raw);
  allChainsMatch&&=chain;allStepsMatch&&=stepsMatch;
  console.log(`\n=== ${scenario.id} ===`);
  console.log(`pas simulés        : ${a.rows.length} / ${b.rows.length}`);
  console.log(`chaîne d'étapes    : ${a.chainHash} vs ${b.chainHash} → ${chain?'identique':'DIFFÉRENTE'}`);
  console.log(`empreintes par pas : ${stepsMatch?'identiques sur tous les pas':'DIFFÉRENTES'}`);
  console.log(`empreinte du point : ${a.snapshot.sha256.slice(0,16)}… vs ${b.snapshot.sha256.slice(0,16)}… (${a.snapshot.bytes} → ${b.snapshot.bytes} octets)`);
  console.log(`champs seuls avant: ${d.onlyA.length}`);
  for(const key of d.onlyA)console.log(`  - ${key}`);
  console.log(`champs seuls après : ${d.onlyB.length}`);
  for(const key of d.onlyB)console.log(`  + ${key}`);
  console.log(`valeurs modifiées  : ${d.changed.length}`);
  for(const line of d.changed.slice(0,20))console.log(`  ~ ${line}`);
}
console.log(`\nrésultat : chaîne identique sur tous les scénarios = ${allChainsMatch} ; empreintes par pas identiques = ${allStepsMatch}`);
console.log(fileURLToPath(import.meta.url));
