// Lot 02 / T3 : somme des compteurs du rejeu instrumenté de tools/ab2 (counterReplay), avant
// (a) et arbre (b), par scénario. Le rejeu vérifie aussi l'identité d'état pas à pas.
// usage : node compteurs.mjs <rapport ab2.json> [...]
import {readFileSync} from 'node:fs';
const out=[];
for(const file of process.argv.slice(2)){
  const j=JSON.parse(readFileSync(file,'utf8'));
  for(const s of j.scenarios){
    const c=s.counterReplay,sum=side=>{const t={};for(const row of c[side].rows)for(const [k,v] of Object.entries(row.counters||{}))t[k]=(t[k]||0)+v;return t;};
    const a=sum('a'),b=sum('b');
    out.push({id:s.id,weapon:j.method.weapon,steps:c.a.steps,identical:c.identical,chain:[c.a.chainHash,c.b.chainHash],a,b,groundRatio:+(b.ground/a.ground).toFixed(4)});
  }
}
console.log(JSON.stringify({schema:'lot02-t3-compteurs-v1',rows:out},null,1));
