// Paired A/B cost of FWorld.create between two repository roots (lot 01 suite T2).
// Main Node realm (tools/realm-loader.mjs, never node:vm). Each root keeps its own
// module list (fmath before world when the root has it). An independent second
// load of root A runs as an A/A control in the same process, so every report
// carries its own noise. Each world is warmed up per variant, then the three
// variants are timed in a rotating order (all six permutations), and the
// per-repetition ratios B/A and A'/A are reduced to medians.
//
//   node tools/gen-ab.mjs <rootA> <rootB> [--reps 15] [--warm 3] [--seed 96] [--out F] spec...
//   spec: l:<sector> (classic), v1:<index> (campaign V1), c:<index> (campaign V2)
//
// Clock: thread CPU time of the main thread (process.threadCpuUsage), else
// process CPU time; wall time is reported too. Worlds are not compared across
// roots for identity here: use tools/platform-math.mjs worlds for that.
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cpus,loadavg} from 'node:os';
import {loadRealm,defaultModules} from './realm-loader.mjs';

const ORDERS=[['a','b','aa'],['b','aa','a'],['aa','a','b'],['a','aa','b'],['aa','b','a'],['b','a','aa']];
const median=values=>{const s=values.slice().sort((x,y)=>x-y),n=s.length;return n?n%2?s[n>>1]:(s[n/2-1]+s[n/2])/2:null;};
const threadClock=typeof process.threadCpuUsage==='function';
const cpuNow=()=>{const u=threadClock?process.threadCpuUsage():process.cpuUsage();return (u.user+u.system)/1000;};

export function parseSpec(spec){
  const m=/^(l|v1|c):(\d+)$/.exec(spec);
  if(!m)throw new Error('spec must be l:<sector>, v1:<index> or c:<index>: '+spec);
  const index=Number(m[2]);
  return {spec,index,options:m[1]==='l'?undefined:m[1]==='v1'?{campaign:true}:{campaign:true,campaignVersion:2}};
}

export function worldOf(root){
  const modules=defaultModules(root).filter(name=>name==='fmath'||name==='passages'||name==='world'),loaded=loadRealm({root,modules});
  return {FWorld:loaded.window.FWorld,modules,sourceSha256:loaded.sourceSha256};
}

export function genAB(rootA,rootB,{specs,reps=15,warm=3,seed=96}={}){
  if(!specs?.length)throw new Error('at least one spec is required');
  if(!(Number.isSafeInteger(reps)&&reps>=5))throw new Error('--reps must be at least 5');
  if(!(Number.isSafeInteger(warm)&&warm>=1))throw new Error('--warm must be at least 1');
  const a=worldOf(rootA),aa=worldOf(rootA),b=worldOf(rootB),variants={a,b,aa},rows=[];
  for(const parsed of specs.map(parseSpec)){
    const make=v=>variants[v].FWorld.create(seed,parsed.index,parsed.options&&{...parsed.options});
    for(let i=0;i<warm;i++)for(const v of ORDERS[i%ORDERS.length])make(v);
    const cpu={a:[],b:[],aa:[]},wall={a:[],b:[],aa:[]},ratioBA=[],ratioAA=[],sizes={};
    for(let rep=0;rep<reps;rep++){
      const sample={};
      for(const v of ORDERS[rep%ORDERS.length]){
        const c0=cpuNow(),w0=performance.now(),world=make(v),w1=performance.now(),c1=cpuNow();
        sample[v]=c1-c0;cpu[v].push(c1-c0);wall[v].push(w1-w0);sizes[v]??=world.meshes.length;
      }
      ratioBA.push(sample.b/sample.a);ratioAA.push(sample.aa/sample.a);
    }
    const ms=list=>+median(list).toFixed(2);
    rows.push({spec:parsed.spec,meshesA:sizes.a,meshesB:sizes.b,cpuMs:{a:ms(cpu.a),b:ms(cpu.b),aa:ms(cpu.aa)},wallMs:{a:ms(wall.a),b:ms(wall.b),aa:ms(wall.aa)},
      ratioBA:+median(ratioBA).toFixed(3),ratioAA:+median(ratioAA).toFixed(3),ratioBARange:[+Math.min(...ratioBA).toFixed(3),+Math.max(...ratioBA).toFixed(3)],ratioAARange:[+Math.min(...ratioAA).toFixed(3),+Math.max(...ratioAA).toFixed(3)]});
  }
  return {schema:'metal-gen-ab-v1',environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,cpu:cpus()[0]?.model||'unknown',logicalCpus:cpus().length,loadAverage:loadavg()},
    roots:{a:resolve(rootA),b:resolve(rootB)},modules:{a:a.modules,b:b.modules},sourceSha256:{a:a.sourceSha256,b:b.sourceSha256},
    method:{seed,reps,warm,realm:'main',clock:threadClock?'process.threadCpuUsage (main thread), ms':'process.cpuUsage (process), ms',
      order:'per repetition, one of the six permutations of A, B and A\' (a second independent load of root A), in turn',
      reduction:'medians of the per-repetition ratios B/A and A\'/A; A\'/A is the noise of this run'},
    rows};
}

function parse(argv){
  const out={roots:[],specs:[],reps:15,warm:3,seed:96};
  for(let i=0;i<argv.length;i++){
    const item=argv[i];
    if(item==='--help'){out.help=true;continue;}
    if(['--reps','--warm','--seed','--out'].includes(item)){if(i+1>=argv.length)throw new Error('missing value for '+item);const value=argv[++i];out[item.slice(2)]=item==='--out'?value:Number(value);continue;}
    if(item.startsWith('--'))throw new Error('unknown option '+item);
    if(/^(l|v1|c):/.test(item))out.specs.push(item);else out.roots.push(resolve(item));
  }
  return out;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options=parse(process.argv.slice(2));
  if(options.help||options.roots.length!==2||!options.specs.length){console.log('Usage: node tools/gen-ab.mjs <rootA> <rootB> [--reps 15] [--warm 3] [--seed 96] [--out F] l:<sector>|v1:<index>|c:<index> ...');process.exit(options.help?0:2);}
  const report=genAB(options.roots[0],options.roots[1],options),text=JSON.stringify(report,null,1)+'\n';
  if(options.out){mkdirSync(dirname(resolve(options.out)),{recursive:true});writeFileSync(options.out,text);}
  console.log(JSON.stringify({rows:report.rows.map(r=>({spec:r.spec,cpuMsA:r.cpuMs.a,cpuMsB:r.cpuMs.b,ratioBA:r.ratioBA,ratioAA:r.ratioAA})),...(options.out?{output:resolve(options.out)}:{})}));
}
