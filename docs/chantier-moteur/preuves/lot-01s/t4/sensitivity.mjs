// Lot 01 suite / T4 — sensitivity witness of the golden campaign digests.
// Each witness edits src/world.js in a disposable copy (never in the repository),
// then checks/campaign-world.test.mjs runs whole in that copy (node --test, TAP).
// A side is a commit (git archive of src/ and checks/) or a directory (its src/
// and checks/ copied). Witnesses:
//   none         control: world.js as it is;
//   v2-armor     armor:'heavy' on the wall groups of the V2 worlds only, the field
//                of the MURS-06 witness (bancs/murs/save-compat.mjs, l. 23);
//   v1-armor     the same field on the V1 campaign worlds only;
//   native-trig  FMath replaced by the Math of the engine (sin, cos, atan, atan2,
//                hypot): the generation of before T2 on this machine (MURS-V1).
//   node docs/chantier-moteur/preuves/lot-01s/t4/sensitivity.mjs --work W (--before C | --before-tree DIR)
//        (--after C | --after-tree DIR) [--witness none,v2-armor,v1-armor,native-trig] [--jobs 4] [--report F]
import {mkdirSync,rmSync,cpSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../../..');
const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const work=resolve(flag('--work')||'.'),reportFile=flag('--report'),jobs=Number(flag('--jobs')||4);
const side=name=>flag('--'+name)?{commit:flag('--'+name)}:flag('--'+name+'-tree')?{tree:resolve(flag('--'+name+'-tree'))}:null,sides={before:side('before'),after:side('after')};
if(!sides.before||!sides.after)throw new Error('--before C (or --before-tree DIR) and --after C (or --after-tree DIR) are required');
const EXPORT='  window.FWorld = { create, validate, isWalkable, floorHeight };',FMATH='  const FMath = window.FMath;';
const wrap=test=>`  window.FWorld = { create: (seed, stage, options) => { const w = create(seed, stage, options); if (${test}) for (const g of w.destructibles) if (g.kind === 'wall') g.armor = 'heavy'; return w; }, validate, isWalkable, floorHeight };`;
const WITNESSES={
  none:null,
  'v2-armor':[EXPORT,wrap('w.campaignVersion === 2')],
  'v1-armor':[EXPORT,wrap('w.campaign === true && w.campaignVersion !== 2')],
  'native-trig':[FMATH,'  const FMath = { sin: Math.sin, cos: Math.cos, atan: Math.atan, atan2: Math.atan2, hypot2: Math.hypot, hypot3: Math.hypot };'],
};
const witnesses=(flag('--witness')||Object.keys(WITNESSES).join(',')).split(',');
for(const w of witnesses)if(!(w in WITNESSES))throw new Error('unknown witness '+w);
const sha=text=>createHash('sha256').update(text).digest('hex');

function prepare(side,witness){
  const dir=join(work,side+'-'+witness),source=sides[side];
  rmSync(dir,{recursive:true,force:true});mkdirSync(dir,{recursive:true});
  if(source.commit){const tar=execFileSync('git',['-C',repo,'archive',source.commit,'src','checks'],{maxBuffer:1<<30});execFileSync('tar',['-x','-C',dir],{input:tar});}
  else for(const sub of ['src','checks'])cpSync(join(source.tree,sub),join(dir,sub),{recursive:true});
  const file=join(dir,'src/world.js'),original=readFileSync(file,'utf8');let text=original;
  if(WITNESSES[witness]){
    const [from,to]=WITNESSES[witness],at=text.indexOf(from);
    if(at<0||text.indexOf(from,at+from.length)>=0)throw new Error(`${side}: witness anchor missing or ambiguous in src/world.js: ${from}`);
    text=text.slice(0,at)+to+text.slice(at+from.length);writeFileSync(file,text);
  }
  return {dir,worldSha256:sha(original),witnessWorldSha256:sha(text),fixture:existsSync(join(dir,'checks/campaign-world-digests.json'))};
}

// Top-level TAP results of node --test: name, ok, and the first line of the error.
function parseTap(text){
  const lines=text.split('\n'),rows=[];
  for(let i=0;i<lines.length;i++){
    const m=/^(ok|not ok) \d+ - (.*)$/.exec(lines[i]);if(!m)continue;
    const row={name:m[2],ok:m[1]==='ok'};
    if(!row.ok)for(let j=i+1;j<lines.length&&!/^(ok|not ok) \d+ - |^# Subtest: /.test(lines[j]);j++){
      const e=/^  error: (?:\|-)?\s*'?(.*?)'?$/.exec(lines[j]);
      if(e){row.error=e[1]||(lines[j+1]||'').trim();break;}
    }
    rows.push(row);
  }
  const count=key=>Number((new RegExp('^# '+key+' (\\d+)$','m').exec(text)||[])[1]);
  return {tests:count('tests'),pass:count('pass'),fail:count('fail'),rows};
}

function run(dir){
  return new Promise((done,fail)=>{
    const started=process.hrtime.bigint(),child=spawn(process.execPath,['--test','--test-reporter=tap','checks/campaign-world.test.mjs'],{cwd:dir,stdio:['ignore','pipe','pipe']});
    let out='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',()=>{});
    child.on('error',fail);child.on('close',code=>done({code,seconds:Number(process.hrtime.bigint()-started)/1e9,tap:out}));
  });
}

const tasks=[];
for(const witness of witnesses)for(const side of ['before','after'])tasks.push({side,witness});
const results=new Array(tasks.length);let next=0;
async function worker(){
  while(next<tasks.length){
    const i=next++,{side,witness}=tasks[i],copy=prepare(side,witness),r=await run(copy.dir),tap=parseTap(r.tap);
    writeFileSync(join(copy.dir,'campaign-world.tap'),r.tap);
    results[i]={side,witness,exitCode:r.code,seconds:Math.round(r.seconds*10)/10,worldSha256:copy.worldSha256,witnessWorldSha256:copy.witnessWorldSha256,fixtureInCopy:copy.fixture,tests:tap.tests,pass:tap.pass,fail:tap.fail,
      failing:tap.rows.filter(t=>!t.ok).map(t=>({name:t.name,error:t.error??null}))};
    console.error(`${side} ${witness}: ${tap.pass}/${tap.tests} pass, ${tap.fail} fail, ${results[i].seconds} s`);
  }
}
await Promise.all(Array.from({length:Math.max(1,jobs)},worker));

const byWitness={};
for(const witness of witnesses){
  const b=results.find(r=>r.witness===witness&&r.side==='before'),a=results.find(r=>r.witness===witness&&r.side==='after'),beforeFailing=new Set(b.failing.map(f=>f.name));
  const group=name=>/^legacy seed |^campaign mode is strictly|^the first three campaign worlds/.test(name)?'historical':/^campaign world /.test(name)?'v1Loop':/^boss campaign world /.test(name)?'v2Loop':'other';
  const tally=rows=>rows.reduce((t,f)=>(t[group(f.name)]=(t[group(f.name)]||0)+1,t),{});
  byWitness[witness]={before:{pass:b.pass,fail:b.fail,failingByGroup:tally(b.failing)},after:{pass:a.pass,fail:a.fail,failingByGroup:tally(a.failing)},
    newlyFailingAfter:a.failing.filter(f=>!beforeFailing.has(f.name)).length,failingBeforeOnly:b.failing.filter(f=>!a.failing.some(x=>x.name===f.name)).map(f=>f.name)};
}
const report={schema:'metal-lot01s-t4-sensitivity-v1',environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},
  before:sides.before.commit?{commit:sides.before.commit}:{tree:'--before-tree (src/, checks/)'},after:sides.after.commit?{commit:sides.after.commit}:{tree:'--after-tree (src/, checks/)'},work:'$W',
  note:'Each copy holds src/ and checks/ of its side; the witness edits src/world.js only (anchors exact and unique), then node --test --test-reporter=tap checks/campaign-world.test.mjs runs whole in the copy. historical = the 6 legacy fingerprints, campaign mode opt-in, first three campaign worlds; v1Loop/v2Loop = the 18 + 18 campaign loops.',
  witnesses:Object.fromEntries(witnesses.map(w=>[w,WITNESSES[w]?{anchor:WITNESSES[w][0].trim(),replacement:WITNESSES[w][1].trim()}:null])),byWitness,runs:results};
const text=JSON.stringify(report,null,1)+'\n';
if(reportFile){mkdirSync(dirname(resolve(reportFile)),{recursive:true});writeFileSync(reportFile,text);console.log(JSON.stringify({report:resolve(reportFile),byWitness}));}
else process.stdout.write(text);
