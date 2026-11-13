// Lot 01 suite / T2: module lists of tools/realm-loader.mjs, root by root.
//
//   node docs/chantier-moteur/preuves/lot-01s/t2/loader-check.mjs --base <root before the fix> --work <dir> [root] [--out F]
//
// <dir> receives two copies of src/ of root, one without src/fmath.js and one
// without src/brain.js. Expected: the root and the base load with their own list
// (fmath first only where src/fmath.js exists), a world.js that cites FMath
// without src/fmath.js is refused by name, any other missing module still fails
// when it is read, and world.js alone stops on its explicit message. Paths are
// written as <root>, <base> and <work>.
import {readdirSync,copyFileSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);if(i<0)return null;const v=args[i+1];args.splice(i,2);return v;};
const base=flag('--base'),work=flag('--work'),out=flag('--out'),root=resolve(args[0]||fileURLToPath(new URL('../../../../../',import.meta.url)));
if(!base||!work)throw new Error('usage: loader-check.mjs --base <root before the fix> --work <dir> [root] [--out F]');
const {loadRealm,defaultModules}=await import(join(root,'tools/realm-loader.mjs'));
const copy=(name,without)=>{const dir=join(resolve(work),name);rmSync(dir,{recursive:true,force:true});mkdirSync(join(dir,'src'),{recursive:true});
  for(const file of readdirSync(join(root,'src')))if(file.endsWith('.js')&&file!==without)copyFileSync(join(root,'src',file),join(dir,'src',file));return dir;};
const clean=text=>text.split(resolve(work)).join('<work>').split(resolve(base)).join('<base>').split(root).join('<root>');
const cases=[['root (src/fmath.js present)',root],['base before the fix (no src/fmath.js, world.js without FMath)',resolve(base)],
  ['copy of root without src/fmath.js',copy('without-fmath','fmath.js')],['copy of root without src/brain.js',copy('without-brain','brain.js')]];
const rows=cases.map(([label,dir])=>{const row={label,root:clean(dir)};
  try{row.defaultModules=[...defaultModules(dir)];}catch(error){row.defaultModulesError=clean(error.message);}
  try{const loaded=loadRealm({root:dir});row.loaded=loaded.modules;row.exports=Object.keys(loaded.window).filter(k=>/^F[A-Z]/.test(k));}catch(error){row.loadError=clean(error.message);}
  return row;});
let worldAlone;try{loadRealm({root,modules:['world']});worldAlone='loaded';}catch(error){worldAlone=clean(error.message);}
const report={schema:'metal-lot01s-t2-loader-check-v1',node:process.version,rows,explicitWorldWithoutFMath:worldAlone};
const text=JSON.stringify(report,null,1)+'\n';
if(out){mkdirSync(dirname(resolve(out)),{recursive:true});writeFileSync(out,text);}
process.stdout.write(text);
