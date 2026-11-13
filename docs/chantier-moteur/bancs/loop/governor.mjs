// Gouverneur de résolution (renderer.js:746) alimenté par frameMs = intervalle rAF (game.js:677,722).
// Montre qu'un plafond 30 Hz (mode économie d'énergie) ou un affichage à 50 Hz fait chuter l'échelle
// alors que le GPU n'est pas saturé. node governor.mjs <ferro>
import {readFileSync} from 'node:fs';
const src=readFileSync(process.argv[2]+'/src/renderer.js','utf8');
const a=src.indexOf('  function resolutionGovernor(){'),b=src.indexOf('  function metadata(mesh){');
const resolutionGovernor=new Function(src.slice(a,b)+'\nreturn resolutionGovernor;')();
const cases={'60 Hz, travail 9 ms':()=>16.667,'59,94 Hz':()=>16.683,'50 Hz (TV/PAL), travail 9 ms':()=>20,'30 Hz plafonné (économie), travail 9 ms':()=>33.333,'60 Hz avec 1 image sur 3 ratée':(k)=>k%3===0?33.3:16.7,'40 fps réel (GPU saturé)':()=>25.5};
for(const [name,f] of Object.entries(cases)){const g=resolutionGovernor();let scale=1,t=0,trace=[];for(let k=0;t<20000;k++){const ms=f(k);t+=ms;scale=g.update({adaptive:true,frameMs:ms},'auto');if(trace.at(-1)?.[1]!==scale)trace.push([+(t/1000).toFixed(1),scale]);}
  console.log(name.padEnd(42),'échelle finale',scale,' changements',JSON.stringify(trace));}
