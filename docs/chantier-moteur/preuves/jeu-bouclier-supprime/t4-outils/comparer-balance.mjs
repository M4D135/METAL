// Compare deux sorties de tools/campaign-balance.mjs (avant / après le retrait).
// Usage : node comparer-balance.mjs <avant.json> <apres.json>
import {readFileSync} from 'node:fs';

const [pathA,pathB]=process.argv.slice(2);
if(!pathA||!pathB)throw new Error('deux sorties de campaign-balance sont requises');
const A=JSON.parse(readFileSync(pathA,'utf8')),B=JSON.parse(readFileSync(pathB,'utf8'));
const fields=x=>JSON.stringify([x.outcome,x.seconds,x.kills,x.enemies,x.damageTaken,x.shots,x.hits,x.ammoConsumed,x.distanceMoved,x.peakCombat]);
let same=0,diff=0;
for(let index=0;index<A.rows.length;index++){
  for(let scenario=0;scenario<2;scenario++){
    const a=A.rows[index].combats[scenario],b=B.rows[index].combats[scenario];
    if(fields(a)===fields(b)){same++;continue;}
    diff++;
    console.log(`monde ${index+1} — ${a.scenario}`);
    console.log(`  avant : ${fields(a)}`);
    console.log(`  après : ${fields(b)}`);
  }
}
const total=A.rows.length*2;
console.log(`\ncombats comparés : ${total} — identiques ${same} — différents ${diff}`);
for(const [nom,rows] of [['avant',A.rows],['après',B.rows]])for(const scenario of ['nominal','pistol-only']){
  const list=rows.map(w=>w.combats.find(c=>c.scenario===scenario));
  console.log(`${nom} / ${scenario} : tués ${list.filter(c=>c.outcome==='cleared').length}, morts ${list.filter(c=>c.outcome==='dead').length}, expirés ${list.filter(c=>c.outcome==='timeout').length}, dégât moyen ${(list.reduce((n,c)=>n+c.damageTaken,0)/list.length).toFixed(2)}`);
}
