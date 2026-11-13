// Lot 01 suite / T4 — guards of `tools/platform-math.mjs worlds --fixture`.
// Each case runs the command in a disposable copy (src/, checks/ and tools/ of
// the root, never the repository itself):
//   check            the copy as it is: exit 0, 108/108;
//   check-altered    one digest of the fixture altered (V2, seed 2026, world 18): exit 1, that world named;
//   write-seeds      write with --seeds 1,96: refused before any world is generated;
//   write-pre-t2     write with the world.js of before T2 (--pre-t2 C, a commit; Math, no FMath): refused;
//   write-native     write with FMath replaced by the Math of the engine in world.js: refused on an
//                    arm64 host, whose classic worlds then differ from legacyHashes (on x86-64 the bits,
//                    hence the file, would be the same);
//   write            write on the copy as it is: the file comes out byte for byte the same.
//   node docs/chantier-moteur/preuves/lot-01s/t4/fixture-guards.mjs --work W [--pre-t2 71eca61 | --pre-t2-tree DIR] [--report F]
import {mkdirSync,rmSync,cpSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..');
const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const work=resolve(flag('--work')||'.'),reportFile=flag('--report'),preCommit=flag('--pre-t2'),preTree=flag('--pre-t2-tree');
const FIXTURE='checks/campaign-world-digests.json',sha=text=>createHash('sha256').update(text).digest('hex'),original=readFileSync(join(root,FIXTURE),'utf8');

function copy(name){
  const dir=join(work,name);rmSync(dir,{recursive:true,force:true});mkdirSync(dir,{recursive:true});
  for(const sub of ['src','checks','tools'])cpSync(join(root,sub),join(dir,sub),{recursive:true});
  return dir;
}
function edit(file,from,to){
  const text=readFileSync(file,'utf8'),at=text.indexOf(from);
  if(at<0||text.indexOf(from,at+from.length)>=0)throw new Error('anchor missing or ambiguous in '+file+': '+from);
  writeFileSync(file,text.slice(0,at)+to+text.slice(at+from.length));
}
function run(dir,extra=[]){
  const started=process.hrtime.bigint(),r=spawnSync(process.execPath,['tools/platform-math.mjs','worlds','.','--out','worlds.json',...extra],{cwd:dir,encoding:'utf8',maxBuffer:1<<26});
  let summary=null;try{summary=JSON.parse(r.stdout.trim().split('\n').pop()).fixture??null;}catch{}
  const error=(r.stderr||'').split('\n').find(l=>/^Error: |^checks\/campaign-world-digests\.json: /.test(l))?.trim()??null;
  return {exitCode:r.status,seconds:Math.round(Number(process.hrtime.bigint()-started)/1e8)/10,fixture:summary,stderr:error,generated:existsSync(join(dir,'worlds.json'))};
}
const fixtureSha=dir=>sha(readFileSync(join(dir,FIXTURE),'utf8'));
const cases=[];
function record(name,expectation,result,pass,extra={}){cases.push({case:name,expectation,pass,...result,...extra});console.error(`${name}: ${pass?'as expected':'UNEXPECTED'} (exit ${result.exitCode})`);}

{const dir=copy('check'),r=run(dir,['--fixture','check']);
  record('check','exit 0, 108/108 equal, legacyHashes 6/6',r,r.exitCode===0&&r.fixture?.equal===108&&r.fixture?.of===108&&r.fixture?.legacyHashes==='6/6');}
{const dir=copy('check-altered'),file=join(dir,FIXTURE),j=JSON.parse(readFileSync(file,'utf8')),old=j.v2['2026'][17];
  j.v2['2026'][17]=old.slice(0,-1)+(old.endsWith('0')?'1':'0');writeFileSync(file,JSON.stringify(j,null,1)+'\n');
  const r=run(dir,['--fixture','check']),out=JSON.parse(readFileSync(join(dir,'worlds.json'),'utf8')).fixture;
  record('check-altered','exit 1, 107/108, the altered world named',r,r.exitCode===1&&out.equal===107&&out.differing.length===1&&out.differing[0].kind==='v2'&&out.differing[0].seed===2026&&out.differing[0].world===18,{differing:out.differing.map(d=>`${d.kind}:${d.seed}:${d.world}`)});}
{const dir=copy('write-seeds'),r=run(dir,['--fixture','write','--seeds','1,96']);
  record('write-seeds','refused before generation, fixture untouched',r,r.exitCode!==0&&!r.generated&&/seeds of the test/.test(r.stderr||'')&&fixtureSha(dir)===sha(original));}
if(preCommit||preTree){
  const dir=copy('write-pre-t2'),world=join(dir,'src/world.js');
  if(preCommit)writeFileSync(world,execFileSync('git',['-C',root,'show',preCommit+':src/world.js'],{maxBuffer:1<<26}));else cpSync(join(resolve(preTree),'src/world.js'),world);
  const r=run(dir,['--fixture','write']);
  record('write-pre-t2','refused before generation, fixture untouched',r,r.exitCode!==0&&!r.generated&&/must take its trigonometry from FMath/.test(r.stderr||'')&&fixtureSha(dir)===sha(original),{worldJs:preCommit?preCommit+':src/world.js':'--pre-t2-tree'});
}
{const dir=copy('write-native');
  edit(join(dir,'src/world.js'),'  const FMath = window.FMath;','  const FMath = { sin: Math.sin, cos: Math.cos, atan: Math.atan, atan2: Math.atan2, hypot2: Math.hypot, hypot3: Math.hypot };');
  const r=run(dir,['--fixture','write']),x64=process.arch==='x64';
  record('write-native',x64?'accepted on x86-64 (same bits as FMath), file unchanged':'refused on arm64: the classic worlds differ from legacyHashes, fixture untouched',r,
    x64?r.exitCode===0&&fixtureSha(dir)===sha(original):r.exitCode!==0&&/differ from the golden legacyHashes/.test(r.stderr||'')&&fixtureSha(dir)===sha(original));}
{const dir=copy('write'),r=run(dir,['--fixture','write']);
  record('write','exit 0, file rewritten byte for byte',r,r.exitCode===0&&fixtureSha(dir)===sha(original),{writtenSha256:fixtureSha(dir)});}

const report={schema:'metal-lot01s-t4-fixture-guards-v1',environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},work:'$W',
  fixture:{file:FIXTURE,sha256:sha(original),bytes:Buffer.byteLength(original)},allAsExpected:cases.every(c=>c.pass),cases};
const text=JSON.stringify(report,null,1)+'\n';
if(reportFile){mkdirSync(dirname(resolve(reportFile)),{recursive:true});writeFileSync(reportFile,text);console.log(JSON.stringify({report:resolve(reportFile),allAsExpected:report.allAsExpected,cases:cases.map(c=>c.case+':'+(c.pass?'ok':'NO'))}));}
else process.stdout.write(text);
if(!report.allAsExpected)process.exitCode=1;
