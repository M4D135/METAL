// Lot 01 suite / T1 — are the published campaign profiles sensitive to the Math of
// the platform? Runs tools/campaign-profiles.mjs, tools/campaign-balance.mjs and
// tools/boss-profiles.mjs on this machine, in a temporary directory, and compares
// their JSON with the reports archived by the lot 00 under Linux x86-64
// (docs/chantier-moteur/preuves/lot-00/*.json.gz). Nothing in the repository is
// written.
//   node docs/chantier-moteur/preuves/lot-01s/t1/profiles-check.mjs [--work DIR] [--out FILE]
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..');
const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const work=flag('--work')?resolve(flag('--work')):mkdtempSync(join(tmpdir(),'metal-profiles-'));
mkdirSync(work,{recursive:true});
const sha=data=>createHash('sha256').update(data).digest('hex');
function differences(a,b,path,out){
  if(out.length>=20)return out;
  if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
    for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[k],b[k],path+'.'+k,out);
  }else if(!Object.is(a,b))out.push(path);
  return out;
}
const rows=[];
for(const tool of ['campaign-profiles','campaign-balance','boss-profiles']){
  const file=join(work,tool+'.json'),run=spawnSync(process.execPath,[join(root,'tools',tool+'.mjs'),'--root',root,'--out',file],{cwd:root,encoding:'utf8'});
  if(run.status!==0)throw new Error(tool+' failed: '+run.stderr);
  const mine=readFileSync(file),archive=gunzipSync(readFileSync(join(root,'docs/chantier-moteur/preuves/lot-00',tool+'.json.gz')));
  const identical=mine.equals(archive),diff=identical?[]:differences(JSON.parse(mine),JSON.parse(archive),'$',[]);
  rows.push({tool:'tools/'+tool+'.mjs',archive:'docs/chantier-moteur/preuves/lot-00/'+tool+'.json.gz',bytes:mine.length,archiveBytes:archive.length,sha256:sha(mine),archiveSha256:sha(archive),bytesIdentical:identical,differingPaths:diff,
    onlySourceHashesDiffer:diff.length>0&&diff.every(p=>p.startsWith('$.sourceSha256.'))});
}
const result={schema:'metal-profiles-platform-check-v1',node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,
  note:'The lot 00 archives were produced under Linux x86-64 (Node 24.22.1) from 63668ac; sourceSha256 records the source files, of which src/simulation.js changed in the lot 01.',
  rows};
const text=JSON.stringify(result,null,1)+'\n';
if(flag('--out'))writeFileSync(flag('--out'),text);
process.stdout.write(text);
