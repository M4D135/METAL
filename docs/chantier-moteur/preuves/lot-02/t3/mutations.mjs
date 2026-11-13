// Lot 02 / T3 (SIM-03) : les tests neufs « Rubble sleep » voient-ils une faute du sommeil ?
// Chaque variante copie src/ et checks/simulation.test.mjs de l'arbre dans un dossier
// temporaire, y remplace une chaîne exacte de src/simulation.js (une seule occurrence exigée),
// puis lance les tests dont le nom commence par « Rubble sleep » et le test de plateforme
// d'origine. L'arbre intact doit passer, chaque variante doit échouer. Avec <racine avant>,
// les mêmes tests sont aussi lancés sur l'avant, qui n'a pas de sommeil : ils y passent.
// usage : node mutations.mjs <racine arbre> <dossier temporaire> [<racine avant>]
import {cpSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const [tree,out,before]=process.argv.slice(2).map(p=>p&&resolve(p));
if(!tree||!out){console.error('usage: node mutations.mjs <racine arbre> <dossier temporaire> [<racine avant>]');process.exit(2);}
const source=readFileSync(tree+'/src/simulation.js','utf8');
const variants={
  'intact':[],
  'sommeil sur tout appui':[['if(sleepy&&debrisStaticSupport(q,h,boxes))debrisSleep.set','if(sleepy)debrisSleep.set']],
  'sommeil sans révision':[['debrisSleep.get(q)===seenDestructionRevision','debrisSleep.has(q)']],
  'sommeil malgré un piège de sol':[["let sleepy=true;for(let k=0;k<trapStates.length;k++)if(trapStates[k].kind==='floor'){sleepy=false;break;}",'let sleepy=true;']],
  'mémo du sol gardé entre deux pas':[['      dfX0=dfX1=NaN;\n','']],
  'appui statique : boîtes dynamiques comprises':[['for(let k=debrisStaticFrom;k<boxes.length;k++)','for(let k=0;k<boxes.length;k++)']],
};
const PATTERN='^(Rubble sleep|settled wreckage wakes)';
const run=(dir,src)=>{
  rmSync(dir,{recursive:true,force:true});mkdirSync(dir+'/checks',{recursive:true});cpSync(src+'/src',dir+'/src',{recursive:true});
  cpSync(tree+'/checks/simulation.test.mjs',dir+'/checks/simulation.test.mjs');
  let text;try{text=execFileSync(process.execPath,['--test','--test-name-pattern='+PATTERN,dir+'/checks/simulation.test.mjs'],{encoding:'utf8',stdio:'pipe'});}catch(e){text=String(e.stdout);}
  const lines=text.split('\n'),seen=new Set();
  return lines.filter(l=>/^[✔✖] (Rubble sleep|settled wreckage wakes)/.test(l)).map(l=>l.replace(/ \([\d.]+ms\)$/,'')).filter(l=>!seen.has(l)&&seen.add(l)).map(l=>(l[0]==='✔'?'passe : ':'ÉCHOUE : ')+l.slice(2,58)+'…');
};
let wrong=0;
for(const [name,patches] of Object.entries(variants)){
  const dir=out+'/'+name.normalize('NFD').replace(/[^a-z0-9]+/gi,'-');let s=source;
  for(const [a,b] of patches){const n=s.split(a).length-1;if(n!==1)throw new Error(name+' : '+n+' occurrences de l\'ancre');s=s.replace(a,()=>b);}
  mkdirSync(dir,{recursive:true});const copy=dir+'-src';rmSync(copy,{recursive:true,force:true});cpSync(tree+'/src',copy+'/src',{recursive:true});writeFileSync(copy+'/src/simulation.js',s);
  const result=run(dir,copy),failed=result.some(l=>l.startsWith('ÉCHOUE'));if(failed!==(name!=='intact'))wrong++;
  console.log(name.padEnd(46),name==='intact'?(failed?'ÉCHEC INATTENDU':'référence'):(failed?'détectée':'NON DÉTECTÉE'),'|',result.filter(l=>name==='intact'||l.startsWith('ÉCHOUE')).join(' | '));
}
if(before)console.log('avant (sans sommeil)'.padEnd(46),'|',run(out+'/avant',before).join(' | '));
process.exitCode=wrong?1:0;
