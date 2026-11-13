// LOAD-03 / T4 : un instantane pris dans l'image peut-il etre serialise plus tard ?
// (1) objets et tableaux de l'instantane atteignables depuis l'etat vivant
//     (sim, sim.state, sim.destruction, contenus des Map et Set compris) ;
// (2) JSON.stringify du meme objet, refait apres M pas de simulation : meme texte ?
// node $W snap-shared.mjs <racine> <scenario[:arme],...> <K,K2,...> <M>
import {loadRealm} from '../../../../../tools/realm-loader.mjs';
import {buildScenario,makeInput,drive,selectScenarios} from '../../../../../tools/proof/scenarios.mjs';
import {createHash} from 'node:crypto';
const [root='.',ids='legacy-s2',ks='300,900',ms='120']=process.argv.slice(2);
const L=loadRealm({root});
const isObj=v=>v!==null&&(typeof v==='object'||typeof v==='function');
const children=v=>v instanceof Map?[...v.keys(),...v.values()]:v instanceof Set?[...v]:ArrayBuffer.isView(v)||v instanceof WeakMap||v instanceof WeakSet?[]:Object.keys(v).map(k=>v[k]);
function collect(value){const seen=new Set(),stack=[value];while(stack.length){const v=stack.pop();if(!isObj(v)||seen.has(v))continue;seen.add(v);stack.push(...children(v));}return seen;}
function sharedPaths(live,snapSet){
  const seen=new Set(),out=[],stack=[[live,'live']];
  while(stack.length){const [v,path]=stack.pop();if(!isObj(v)||seen.has(v))continue;seen.add(v);if(snapSet.has(v)){out.push(path);continue;}
    if(v instanceof Map){let n=0;for(const [k,x] of v){stack.push([k,path+'<key'+n+'>'],[x,path+'<'+n+'>']);n++;}continue;}
    if(v instanceof Set){let n=0;for(const x of v)stack.push([x,path+'{'+(n++)+'}']);continue;}
    if(ArrayBuffer.isView(v)||v instanceof WeakMap||v instanceof WeakSet)continue;
    for(const k of Object.keys(v))stack.push([v[k],path+'.'+k]);}
  return {paths:out,visited:seen.size};
}
const sha=t=>createHash('sha256').update(t).digest('hex').slice(0,12);
const rows=[];
for(const id of ids.split(',')){
  const [name,w]=id.split(':'),weapon=w===undefined?undefined:+w;
  for(const K of ks.split(',').map(Number)){
    const sc=selectScenarios(name)[0],run=buildScenario(L,sc),input=makeInput(weapon),s=run.sim.state;let i=0;
    for(;i<K;i++){drive(i,input,s);run.sim.step(1/60,input);s.events.length=0;if(s.dead||s.won)break;}
    const snap=run.sim.snapshot(),textA=JSON.stringify(snap),snapSet=collect(snap);
    const live=sharedPaths({sim:run.sim,state:s,destruction:run.sim.destruction},snapSet);
    const M=+ms;let j=0;for(;j<M;j++){drive(i+j,input,s);run.sim.step(1/60,input);s.events.length=0;if(s.dead||s.won)break;}
    const textB=JSON.stringify(snap),textC=JSON.stringify(run.sim.snapshot());
    const trapBoxes=live.paths.filter(p=>/\.traps\.\d+\.box$/.test(p)),other=live.paths.filter(p=>!/\.traps\.\d+\.box$/.test(p));
    rows.push({scenario:id,K:i,M:j,chars:textA.length,sha:sha(textA),snapObjects:snapSet.size,liveVisited:live.visited,sharedTrapBoxes:trapBoxes.length,sharedOther:other,sameTextAfterSteps:textA===textB,stateMovedOn:textC!==textA,rubble:snap.state.rubble.length,revision:s.destructionRevision});
    run.dispose();
  }
}
console.log(JSON.stringify({tool:'snap-shared',root,M:+ms,rows,sameTextEverywhere:rows.every(r=>r.sameTextAfterSteps),onlyTrapBoxesShared:rows.every(r=>r.sharedOther.length===0)}));
