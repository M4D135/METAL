// Lot 02 / T2 (SIM-02) : les deux tests neufs de ground() voient-ils une faute ? Chaque variante
// copie src/ et checks/simulation.test.mjs de l'arbre dans un dossier temporaire, y remplace une
// chaîne exacte de src/simulation.js (une seule occurrence exigée), puis lance les deux tests.
// L'arbre intact doit passer, chaque variante doit échouer. Avec <racine avant>, les mêmes tests
// sont aussi lancés sur l'avant : le premier y passe, le second échoue sur le sol ajouté.
// usage : node mutations.mjs <racine arbre> <dossier temporaire> [<racine avant>]
import {cpSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const [tree,out,before]=process.argv.slice(2).map(p=>p&&resolve(p));
if(!tree||!out){console.error('usage: node mutations.mjs <racine arbre> <dossier temporaire> [<racine avant>]');process.exit(2);}
const source=readFileSync(tree+'/src/simulation.js','utf8');
const variants={
  'intact':[],
  'marge nulle':[['m=1e-6,big=16777216','m=0,big=16777216']],
  'cellule par x/2':[['const gx=Math.floor(x/8*4)-gGX,gz=Math.floor(z/8*4)-gGZ','const gx=Math.floor(x/2)-gGX,gz=Math.floor(z/2)-gGZ']],
  'plats non finis admis':[['else if(clean&&flats<256)','else if(flats<256)']],
  'tout sol jugé serré':[['const tight=i=>Math.abs(fx[i])+Math.abs(hw[i])<big&&Math.abs(fz[i])+Math.abs(hd[i])<big','const tight=i=>true']],
  'rampe avant plat':[['return Number.isFinite(flat)?flat:Number.isFinite(y)?y:fallback;','return Number.isFinite(y)?y:Number.isFinite(flat)?flat:fallback;']],
  'plats du plus bas au plus haut':[['while(j>from&&fy[list[j-1]]<fy[i])','while(j>from&&fy[list[j-1]]>fy[i])']],
  'substrat sans couverture':[['if(!held)under=NaN;','']],
  'substrat malgré les rampes':[['let under=inside&&!ramps&&level?low:NaN;','let under=inside&&level?low:NaN;']],
  'pièges : longueur seule':[['if(activeTraps!==trapList||activeTraps.length!==trapCount)','if(activeTraps.length!==trapCount)']],
  'pièges : identité seule':[['if(activeTraps!==trapList||activeTraps.length!==trapCount)','if(activeTraps!==trapList)']],
  'sols : identité seule':[['if(floors.length!==floorCount||floors!==floorList)indexFloors();','if(floors!==floorList)indexFloors();']],
  'sans retour à 0':[['if(!floorCount)return 0;','']],
  'bord strict':[['if(Math.abs(x-gFX[i])<=gHW[i]&&Math.abs(z-gFZ[i])<=gHD[i]){result=gFY[i];break;}','if(Math.abs(x-gFX[i])<gHW[i]&&Math.abs(z-gFZ[i])<gHD[i]){result=gFY[i];break;}']],
  'rien hors grille':[['}else result=groundScan(x,z,gAll,0,floorCount);','}else result=-Infinity;']],
};
const run=(dir,src)=>{
  rmSync(dir,{recursive:true,force:true});mkdirSync(dir+'/checks',{recursive:true});cpSync(src+'/src',dir+'/src',{recursive:true});
  cpSync(tree+'/checks/simulation.test.mjs',dir+'/checks/simulation.test.mjs');
  let text;try{text=execFileSync(process.execPath,['--test','--test-name-pattern=^ground\\(\\)',dir+'/checks/simulation.test.mjs'],{encoding:'utf8',stdio:'pipe'});}catch(e){text=String(e.stdout);}
  const lines=text.split('\n'),seen=new Set();
  return lines.filter(l=>/^[✔✖] ground\(\)/.test(l)).map(l=>l.replace(/ \([\d.]+ms\)$/,'')).filter(l=>!seen.has(l)&&seen.add(l)).map(l=>(l[0]==='✔'?'passe : ':'ÉCHOUE : ')+l.slice(2,60)+'…');
};
let wrong=0;
for(const [name,patches] of Object.entries(variants)){
  const dir=out+'/'+name.replace(/[^a-z0-9]+/gi,'-');let s=source;
  for(const [a,b] of patches){const n=s.split(a).length-1;if(n!==1)throw new Error(name+' : '+n+' occurrences de l\'ancre');s=s.replace(a,()=>b);}
  mkdirSync(dir,{recursive:true});const copy=dir+'-src';rmSync(copy,{recursive:true,force:true});cpSync(tree+'/src',copy+'/src',{recursive:true});writeFileSync(copy+'/src/simulation.js',s);
  const result=run(dir,copy),failed=result.some(l=>l.startsWith('ÉCHOUE'));if(failed!==(name!=='intact'))wrong++;
  console.log(name.padEnd(32),name==='intact'?(failed?'ÉCHEC INATTENDU':'référence'):(failed?'détectée':'NON DÉTECTÉE'),'|',result.join(' | '));
}
if(before)console.log('avant'.padEnd(32),'|',run(out+'/avant',before).join(' | '));
process.exitCode=wrong?1:0;
