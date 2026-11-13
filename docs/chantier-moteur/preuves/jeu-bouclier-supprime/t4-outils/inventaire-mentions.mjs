// Inventaire des mentions du bouclier dans les outils et la documentation vivante.
// Usage : node inventaire-mentions.mjs <racine-avant> <racine-apres>
import {readFileSync,existsSync} from 'node:fs';

const [rootA,rootB]=process.argv.slice(2);
if(!rootA||!rootB)throw new Error('deux racines sont nécessaires');
const files=['tools/campaign-profiles.mjs','tools/campaign-balance.mjs','tools/boss-profiles.mjs','tools/boss-ttk.cjs','CONTRACT.md','README.md','docs/ARCHITECTURE.md'];
const count=root=>file=>existsSync(root+'/'+file)?(readFileSync(root+'/'+file,'utf8').match(/shield|bouclier/gi)||[]).length:'absent';
const lines=root=>file=>readFileSync(root+'/'+file,'utf8').split('\n').map((line,i)=>[i+1,line]).filter(([,line])=>/shield|bouclier/i.test(line));

console.log('fichier'.padEnd(30),'mentions avant','→','après');
for(const file of files)console.log(file.padEnd(30),String(count(rootA)(file)).padStart(3),'→',count(rootB)(file));
for(const file of files){
  const kept=lines(rootB)(file);
  if(!kept.length)continue;
  console.log(`\n=== ${file} — ${kept.length} ligne(s) restante(s) ===`);
  for(const [n,line] of kept)console.log(`${n}: ${line.slice(0,220)}${line.length>220?'…':''}`);
}
