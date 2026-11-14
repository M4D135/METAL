// Banc apparié de génération de mondes : avant/après, alterné, médianes.
// Processus principal Node, jamais node:vm. Comparaison rendue par loadRealm.
// Usage : node banc-generation.mjs <racine-avant> <racine-apres> [--reps 11] [--worlds 18] [--seed 96]
import {loadRealm} from '../../../../../tools/realm-loader.mjs';

const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:Number(args[i+1]);};
const positional=args.filter((q,i)=>!q.startsWith('--')&&!args[i-1]?.startsWith('--'));
const [rootA,rootB]=positional;
const reps=option('--reps',11),count=option('--worlds',18),seed=option('--seed',96);
if(!rootA||!rootB)throw new Error('deux racines sont requises');
const A=loadRealm({root:rootA,realm:'main'}).window,B=loadRealm({root:rootB,realm:'main'}).window;
const median=list=>[...list].sort((x,y)=>x-y)[Math.floor(list.length/2)];
function pass(F){
  const start=process.cpuUsage(),t0=process.hrtime.bigint();let meshes=0,colliders=0,groups=0;
  for(let index=0;index<count;index++){const w=F.FWorld.create(seed,index,{campaign:true,campaignVersion:2});meshes+=w.meshes.length;colliders+=w.colliders.length;groups+=(w.destructibles||[]).length;}
  const cpu=process.cpuUsage(start),wall=Number(process.hrtime.bigint()-t0)/1e6;
  return {cpuUs:cpu.user+cpu.system,wallMs:wall,meshes,colliders,groups};
}
pass(A);pass(B);
const rows=[],digests=[];
for(let rep=0;rep<reps;rep++){const a=pass(A),b=pass(B);rows.push({rep,avant:a.cpuUs,apres:b.cpuUs});digests.push([a,b].map(q=>[q.meshes,q.colliders,q.groups].join('/')).join(' | '));}
const avant=rows.map(q=>q.avant),apres=rows.map(q=>q.apres);
const mA=median(avant),mB=median(apres);
console.log(JSON.stringify({
  schema:'metal-banc-generation-v1',seed,worlds:count,reps,
  avant:{medianeUs:mA,medianeMs:+(mA/1000).toFixed(1),minUs:Math.min(...avant),maxUs:Math.max(...avant)},
  apres:{medianeUs:mB,medianeMs:+(mB/1000).toFixed(1),minUs:Math.min(...apres),maxUs:Math.max(...apres)},
  gainPourcent:+(100*(mA-mB)/mA).toFixed(2),
  ratios:rows.map(q=>+(q.apres/q.avant).toFixed(4)),
  quantitesIdentiques:new Set(digests).size===1,digeste:new Set(digests).size===1?digests[0]:digests,
},null,1));
