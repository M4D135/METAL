// Inventaire des cues audio avant/après le retrait du bouclier.
// Lecture statique des modules : aucune horloge, aucun aléa, reproductible.
// Usage : node inventaire-cues.mjs <racine-avant> <racine-apres>
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const [rootA,rootB]=process.argv.slice(2);
if(!rootA||!rootB)throw new Error('deux racines sont nécessaires');
const files=['src/audio.js','src/soundscape.js'];
const cues=source=>[...source.matchAll(/^ {8}([A-Za-z][A-Za-z0-9]*): function/gm)].map(m=>m[1]);
const personal=source=>{const m=source.match(/const personal=new Set\(\[([^\]]*)\]\)/);return m?m[1].split(',').map(q=>q.trim().replace(/^'|'$/g,'')):[];};
const lines=(source,pattern)=>source.split('\n').filter(line=>pattern.test(line)).map(line=>line.trim());

for(const file of files){
  const a=readFileSync(resolve(rootA,file),'utf8'),b=readFileSync(resolve(rootB,file),'utf8');
  const before=file.endsWith('soundscape.js')?personal(a):cues(a),after=file.endsWith('soundscape.js')?personal(b):cues(b);
  console.log(`\n=== ${file} ===`);
  console.log(`cues avant  : ${before.length} — ${before.join(', ')}`);
  console.log(`cues après  : ${after.length} — ${after.join(', ')}`);
  console.log(`retirés     : ${before.filter(q=>!after.includes(q)).join(', ')||'aucun'}`);
  console.log(`ajoutés     : ${after.filter(q=>!before.includes(q)).join(', ')||'aucun'}`);
  console.log(`mentions « shield » : ${a.split('\n').filter(q=>/shield/i.test(q)).length} → ${b.split('\n').filter(q=>/shield/i.test(q)).length}`);
  for(const pattern of [/duckGain|strength =/, /var urgent =/])for(const line of lines(a,pattern))console.log(`  avant : ${line}`);
  for(const pattern of [/duckGain|strength =/, /var urgent =/])for(const line of lines(b,pattern))console.log(`  après : ${line}`);
}
