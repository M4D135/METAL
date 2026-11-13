// Lot 02 / T2 (SIM-02) : taille et coût de l'index de ground(). Sur les 42 mondes générés (6
// classiques, 18 de la campagne V1, 18 de la V2, graine 96) : cellules de 2 m, candidats, octets
// des tableaux typés et répartition des cellules. Sur les quatre scénarios historiques : durée de
// indexFloors() et de FSimulation.create, avant contre arbre, 12 créations alternées dont les
// deux premières sont écartées (médianes), puis une première création dans un processus neuf.
// usage : node index.mjs <racine avant> <racine arbre>
// Les sources sont chargées dans le domaine principal de Node, jamais en node:vm.
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadFast} from '../../../bancs/load-verif2/lib.mjs';
import {SCENARIOS} from '../../../bancs/sim/lib.mjs';

const [rootA,rootB,cold]=process.argv.slice(2);
if(!rootA||!rootB){console.error('usage: node index.mjs <racine avant> <racine arbre>');process.exit(2);}
const timed='    {const t0=performance.now();indexFloors();if(globalThis.__I)globalThis.__I.push(performance.now()-t0);}\n';
const sizes='if(globalThis.__S)globalThis.__S.push({cells:gStart.length-1,candidates:gCells.length,floors:floorCount,constant:gTop.reduce((n,v,c)=>n+(v===v&&!gFlats[c]?1:0),0),flatsFirst:gFlats.reduce((n,v)=>n+(v?1:0),0),scan:gTop.reduce((n,v,c)=>n+(v!==v&&!gFlats[c]?1:0),0)});';
if(cold){// Processus neuf : une seule création, avant ou arbre.
  globalThis.__I=[];const W=loadFast({srcDir:resolve(cold==='arbre'?rootB:rootA,'src'),patches:cold==='arbre'?{simulation:[['    indexFloors();\n',timed]]}:{}});
  const w=W.FWorld.create(96,2),t0=performance.now();W.FSimulation.create(w);console.log(JSON.stringify({create:performance.now()-t0,index:globalThis.__I[0]??null}));process.exit(0);
}
const T=loadFast({srcDir:resolve(rootB,'src'),patches:{simulation:[['    indexFloors();\n',timed.replace('\n',sizes+'\n')]]}});
const specs=[];for(let i=0;i<6;i++)specs.push(['legacy-s'+i,i,undefined]);for(let n=1;n<=18;n++)specs.push(['campaign-w'+n,n-1,{campaign:true}]);for(let n=1;n<=18;n++)specs.push(['campaign2-w'+n,n-1,{campaign:true,campaignVersion:2}]);
const rows=[];
for(const [id,i,o] of specs){globalThis.__S=[];T.FSimulation.create(T.FWorld.create(96,i,o));const s=globalThis.__S[0];globalThis.__S=null;
  // Float64 x7 et Uint8, Int32 par sol ; Int32 de début, Uint8 et Float64 par cellule ; Int32 par candidat.
  rows.push({id,...s,bytes:s.floors*(7*8+1+4)+(s.cells+1)*4+s.cells*(1+8)+s.candidates*4});}
for(const r of rows)console.log(r.id.padEnd(14),'sols',r.floors,'cellules',r.cells,'candidats',r.candidates,'| réponse directe',r.constant,'plats d\'abord',r.flatsFirst,'balayage',r.scan,'| octets',r.bytes);
const span=k=>[Math.min(...rows.map(r=>r[k])),Math.max(...rows.map(r=>r[k]))];
console.log('42 mondes : octets',span('bytes').join(' à '),'| cellules',span('cells').join(' à '),'| candidats',span('candidates').join(' à '),'| sols',span('floors').join(' à '));
const A=loadFast({srcDir:resolve(rootA,'src')}),med=a=>a.slice().sort((p,q)=>p-q)[a.length>>1];
for(const [label,idx,opts] of SCENARIOS){
  const wa=A.FWorld.create(96,idx,opts),wb=T.FWorld.create(96,idx,opts),ta=[],tb=[];globalThis.__I=[];
  for(let k=0;k<12;k++)for(const [W,w,t] of k%2?[[T,wb,tb],[A,wa,ta]]:[[A,wa,ta],[T,wb,tb]]){const t0=performance.now();W.FSimulation.create(w);t.push(performance.now()-t0);}
  const I=globalThis.__I.slice(2);globalThis.__I=null;
  console.log(label.padEnd(13),'create avant',med(ta.slice(2)).toFixed(2),'ms, arbre',med(tb.slice(2)).toFixed(2),'ms | indexFloors médiane',med(I).toFixed(3),'ms, max',Math.max(...I).toFixed(3),'ms');
}
const self=fileURLToPath(import.meta.url),first=which=>JSON.parse(execFileSync(process.execPath,[...process.execArgv,self,rootA,rootB,which],{encoding:'utf8'}));
const cA=[],cB=[];for(let k=0;k<3;k++){cA.push(first('avant'));cB.push(first('arbre'));}
console.log('processus neuf, legacy-s2, 3 fois : create avant',cA.map(c=>c.create.toFixed(1)).join(' / '),'ms ; arbre',cB.map(c=>c.create.toFixed(1)).join(' / '),'ms, dont indexFloors',cB.map(c=>c.index.toFixed(2)).join(' / '),'ms');
