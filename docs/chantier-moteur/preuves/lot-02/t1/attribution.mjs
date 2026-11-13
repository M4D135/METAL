// Lot 02 / T1 : attribution d'une divergence d'état entre l'avant et l'après.
// A = code d'avant, B = code d'après, C = code d'avant + SIM-V1 seul (segmentFree sur le statique,
// sans l'invalidation locale de SIM-01). Mêmes scénario, pilote et pas que tools/ab2.mjs.
// Si C diverge de A au même pas que B et que B = C partout, la divergence vient de SIM-V1 seul.
// Ensuite, juste avant le premier pas divergent, liste les arêtes en cache de A dont la valeur
// diffère du prédicat statique (pièges retirés) : ce sont celles que SIM-V1 rend statiques.
// usage : node attribution.mjs <racine-avant> <racine-après>   env : SCENARIO=legacy-s2 WEAPON=2 STEPS=1800
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {loadRealm} from '../../../../../tools/realm-loader.mjs';
import {buildScenario,makeInput,drive,STEP_SECONDS,selectScenarios} from '../../../../../tools/proof/scenarios.mjs';
import {stateDigest} from '../../../../../tools/proof/digest.mjs';
const [before,after]=process.argv.slice(2).map(p=>resolve(p));
if(!before||!after)throw new Error('usage: node attribution.mjs <racine-avant> <racine-après>');
const SIM_V1=[
  ['      if(blocked(ax,az,r)||blocked(bx,bz,r))return false;','      if(blocked(ax,az,r,ground(ax,az),doorBoxes,solids,[])||blocked(bx,bz,r,ground(bx,bz),doorBoxes,solids,[]))return false;'],
  ['if(!Number.isFinite(y)||Math.abs(y-previous)>.42||blocked(x,z,r,y))return false;','if(!Number.isFinite(y)||Math.abs(y-previous)>.42||blocked(x,z,r,y,doorBoxes,solids,[]))return false;'],
];
const ROUTE=['    function route(e,x,z){\n','    function route(e,x,z){const out=route0(e,x,z);window.__routes.push({enemy:e.id,from:[e.x,e.z].map(v=>+v.toFixed(3)),to:[x,z].map(v=>+v.toFixed(3)),path:out&&out.map(i=>coord(i).map(v=>+v.toFixed(2)))});return out;}\n    function route0(e,x,z){\n'];
const PROBE=['    function pumpNav(limit=768){',`    window.__trapEdges=()=>{const out=[];for(let i=0;i<nav.length;i++){if(!edgeKnown[i])continue;const ix=i%nx,nb=[ix?i-1:-1,ix<nx-1?i+1:-1,i-nx,i+nx];for(let k=0;k<4;k++){const m=1<<k,j=nb[k];if(!(edgeKnown[i]&m)||j<0||j>=nav.length)continue;const saved=trapBoxes.splice(0),fixed=segmentFree(...coord(i),...coord(j),.4);trapBoxes.push(...saved);if(!!(edgeOpen[i]&m)!==fixed)out.push({from:coord(i).map(v=>+v.toFixed(2)),to:coord(j).map(v=>+v.toFixed(2)),cachedOpen:!!(edgeOpen[i]&m),staticOpen:fixed});}}return out;};
    function pumpNav(limit=768){`];
const loaded={A:loadRealm({root:before,patches:{simulation:[ROUTE,PROBE]}}),B:loadRealm({root:after,patches:{simulation:[ROUTE]}}),C:loadRealm({root:before,patches:{simulation:[...SIM_V1,ROUTE]}})};
const scenario=selectScenarios(process.env.SCENARIO||'legacy-s2')[0],weapon=process.env.WEAPON===undefined?2:+process.env.WEAPON,STEPS=+process.env.STEPS||1800;
const runs=Object.fromEntries(Object.entries(loaded).map(([k,v])=>[k,{...buildScenario(v,scenario,{seed:96}),input:makeInput(weapon),win:v.window}]));
const pairs=[['A','B'],['A','C'],['B','C']],firstState={},firstRoute={},routes={};let trapEdges=null,steps=0;
for(let i=0;i<STEPS;i++){
  if(trapEdges===null){const pending=pairs.some(([x,y])=>firstState[x+y]===undefined);if(pending)runs.A.edges=runs.A.win.__trapEdges();}
  for(const r of Object.values(runs)){r.win.__routes=[];drive(i,r.input,r.sim.state);r.sim.step(STEP_SECONDS,r.input);r.digest=stateDigest(r.sim.state);r.routes=JSON.stringify(r.win.__routes);r.sim.state.events.length=0;}
  steps++;
  for(const [x,y] of pairs){const key=x+y;
    if(firstState[key]===undefined&&runs[x].digest!==runs[y].digest)firstState[key]=i;
    if(firstRoute[key]===undefined&&runs[x].routes!==runs[y].routes){firstRoute[key]=i;routes[key]={step:i,[x]:JSON.parse(runs[x].routes),[y]:JSON.parse(runs[y].routes)};if(key==='AB')trapEdges=runs.A.edges;}
  }
  if(Object.values(runs).some(r=>r.sim.state.dead||r.sim.state.won))break;
}
const result={schema:'metal-lot02-t1-attribution-v1',scenario:scenario.id,weapon,steps,firstStateDifference:Object.fromEntries(pairs.map(([x,y])=>[x+y,firstState[x+y]??null])),
  firstRouteDifference:Object.fromEntries(pairs.map(([x,y])=>[x+y,firstRoute[x+y]??null])),routes,trapDependentEdgesInABeforeFirstRouteDifference:trapEdges,
  traps:runs.A.sim.state.traps.map(t=>({kind:t.kind,x:t.x,z:t.z,axis:t.axis,travel:t.travel}))};
if(process.env.JSON_OUT)writeFileSync(process.env.JSON_OUT,JSON.stringify(result,null,1)+'\n');
console.log(`${scenario.id} arme ${weapon}, ${steps} pas | premier pas d'état différent : A/B ${result.firstStateDifference.AB}, A/C ${result.firstStateDifference.AC}, B/C ${result.firstStateDifference.BC} | première route différente : A/B ${result.firstRouteDifference.AB}, A/C ${result.firstRouteDifference.AC}, B/C ${result.firstRouteDifference.BC} | arêtes de A dépendant d'un piège juste avant : ${trapEdges?trapEdges.length:'-'}`);
