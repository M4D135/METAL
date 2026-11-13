// Lot 01 suite / T3 — do the FMath tests catch real mistakes in hypot, hypot2 and
// hypot3? Each mutation is applied to a copy of src/fmath.js in a work directory,
// next to copies of src/world.js, checks/fmath.test.mjs and the two vector
// tables; the repository is untouched. The test file is run with node --test.
//   node docs/chantier-moteur/preuves/lot-01s/t3/mutation-check.mjs [work-dir] [--report F]
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,copyFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const args=process.argv.slice(2),reportAt=args.indexOf('--report'),reportFile=reportAt>=0?resolve(args.splice(reportAt,2)[1]):null;
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..'),work=args[0]?resolve(args[0]):mkdtempSync(join(tmpdir(),'fmath-hypot-mutation-'));
mkdirSync(join(work,'src'),{recursive:true});mkdirSync(join(work,'checks'),{recursive:true});
for(const f of ['fmath.test.mjs','fmath-vectors.txt','fmath-hypot-vectors.txt'])copyFileSync(join(root,'checks',f),join(work,'checks',f));
copyFileSync(join(root,'src/world.js'),join(work,'src/world.js'));
const original=readFileSync(join(root,'src/fmath.js'),'utf8');
const mutations=[
  ['none (control)',null,null],
  ['hypot3 without the Kahan compensation','return sqrt(s+(c*c-((s-a2)-b2)))*max;','return sqrt(s+c*c)*max;'],
  ['hypot3 compensation of the other order','return sqrt(s+(c*c-((s-a2)-b2)))*max;','return sqrt(s+(c*c-((s-b2)-a2)))*max;'],
  ['hypot3 sums y before x','const a=x/max,b=y/max,c=z/max,','const a=y/max,b=x/max,c=z/max,'],
  ['hypot3 Infinity tested on max only','if(x===INF||y===INF||z===INF)return INF;\n    let max=x;\n    if(y>max)max=y;\n    if(z>max)max=z;','let max=x;\n    if(y>max)max=y;\n    if(z>max)max=z;\n    if(max===INF)return INF;'],
  ['hypot3 returns 0 for zeros beside NaN','if(max===0)return x+y+z;','if(max===0)return 0;'],
  ['hypot2 as sqrt(x*x+y*y)','const r=min/max; /* NaN when an argument is NaN */\n    return sqrt(1+r*r)*max;','return sqrt(x*x+y*y);'],
  ['equivalent, not a mistake: hypot2 in the literal form of V8 (two quotients, 0+p*p+q*q)','const r=min/max; /* NaN when an argument is NaN */\n    return sqrt(1+r*r)*max;','const p=x/max,q=y/max;return sqrt((0+p*p)+q*q)*max;'],
  ['hypot2 NaN before Infinity','if(max===INF||min===INF)return INF;','if(max!==max||min!==min)return NAN;if(max===INF||min===INF)return INF;'],
  ['hypot2 returns 0 for 0 beside NaN','if(max===0)return min; /* +0, or NaN */','if(max===0)return 0;'],
  ['hypot2 converts y before x','x=fabs(x);y=fabs(y);\n    const max=y>x?y:x,min=y>x?x:y;','y=fabs(y);x=fabs(x);\n    const max=y>x?y:x,min=y>x?x:y;'],
  ['hypot2 converts x twice','x=fabs(x);y=fabs(y);\n    const max=y>x?y:x,min=y>x?x:y;','const x0=x;x=fabs(x);y=fabs(y);fabs(x0);\n    const max=y>x?y:x,min=y>x?x:y;'],
  ['hypot (any arity) NaN before Infinity','if(max===INF)return INF;\n    if(nan)return NAN;','if(nan)return NAN;\n    if(max===INF)return INF;'],
  ['hypot (any arity) without compensation','summand=q*q-compensation,','summand=q*q,'],
  ['hypot (one argument) keeps the sign','return n===0?0:fabs(arguments[0]);','return n===0?0:+arguments[0];'],
];
const results=[];
for(const [name,from,to] of mutations){
  let text=original;
  if(from!==null){if(text.split(from).length!==2)throw new Error('mutation anchor missing or ambiguous: '+name);text=text.replace(from,to);}
  writeFileSync(join(work,'src/fmath.js'),text);
  const run=spawnSync(process.execPath,['--test','--test-reporter=tap',join(work,'checks/fmath.test.mjs')],{cwd:work,encoding:'utf8',maxBuffer:1<<26});
  const failed=[...run.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map(m=>m[1]).filter(t=>!t.endsWith('fmath.test.mjs'));
  const counts=Object.fromEntries(['tests','pass','fail'].map(k=>[k,Number((new RegExp(`^# ${k} (\\d+)`,'m').exec(run.stdout)||[])[1])]));
  const equivalent=name.startsWith('equivalent');
  results.push({mutation:name,...counts,expected:from===null?'control':equivalent?'equivalent: every test passes':'caught',caught:from===null||equivalent?null:counts.fail>0,failedTests:failed});
  console.error(`${name}: ${counts.fail} failing`);
}
const report={schema:'metal-lot01s-t3-mutation-v1',environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},
  note:'Each mutant src/fmath.js runs checks/fmath.test.mjs (with copies of src/world.js and both vector tables). caught = at least one failing test.',
  mutants:results.filter(r=>r.expected==='caught').length,caught:results.filter(r=>r.caught).length,controlPasses:results[0].fail===0,
  equivalentPass:results.filter(r=>r.expected.startsWith('equivalent')).every(r=>r.fail===0),results};
const text=JSON.stringify(report,null,1)+'\n';
if(reportFile){mkdirSync(dirname(reportFile),{recursive:true});writeFileSync(reportFile,text);console.log(JSON.stringify({report:reportFile,mutants:report.mutants,caught:report.caught,controlPasses:report.controlPasses,equivalentPass:report.equivalentPass}));}
else process.stdout.write(text);
