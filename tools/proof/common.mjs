import {cpus,loadavg,platform,arch,release} from 'node:os';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {DEFAULT_ROOT} from '../realm-loader.mjs';

export const quantile=(values,p)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]:null;};
export function summarize(values){return {samples:values.length,totalUs:values.reduce((a,b)=>a+b,0),meanUs:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,medianUs:quantile(values,.5),p95Us:quantile(values,.95),p99Us:quantile(values,.99),maxUs:values.length?values.reduce((a,b)=>Math.max(a,b),-Infinity):null};}
export function environment(){return {node:process.version,v8:process.versions.v8,platform:platform(),arch:arch(),release:release(),cpu:cpus()[0]?.model||'unknown',logicalCpus:cpus().length,loadAverage:loadavg()};}
export function cpuStep(sim,dt,input){const begin=process.cpuUsage();sim.step(dt,input);const used=process.cpuUsage(begin);return {userUs:used.user,systemUs:used.system,cpuUs:used.user+used.system};}
export function fingerprint(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function outputReport(report,path){const text=JSON.stringify(report,null,2)+'\n';if(path){mkdirSync(dirname(resolve(path)),{recursive:true});writeFileSync(path,text);console.log(JSON.stringify({output:resolve(path),checksum:report.checksum,identical:report.identical}));}else process.stdout.write(text);}
export function verifySources(loaded){for(const [name,expected] of Object.entries(loaded.sourceSha256)){const actual=createHash('sha256').update(readFileSync(resolve(loaded.root,'src',name+'.js'))).digest('hex');if(actual!==expected)throw new Error(`Source changed during the run: ${loaded.root}/src/${name}.js`);}}

export function parseArgs(argv,{paired=false}={}) {
  const out={roots:[],scenario:'all',steps:1800,reps:2,warmups:1,seed:96,realm:'main',counters:true,minCpuUs:5};
  const integer=new Set(['steps','reps','warmups','seed','weapon','probes']);
  for(let i=0;i<argv.length;i++){
    const item=argv[i];if(!item.startsWith('--')){out.roots.push(resolve(item));continue;}
    if(item==='--help'){out.help=true;continue;}if(item==='--no-counters'){out.counters=false;continue;}
    const mapping={'--scenario':'scenario','--steps':'steps','--reps':'reps','--warmups':'warmups','--seed':'seed','--weapon':'weapon','--realm':'realm','--out':'out','--patch-a':'patchA','--patch-b':'patchB','--min-cpu-us':'minCpuUs','--probes':'probes'};
    const key=mapping[item];if(!key||i+1>=argv.length||argv[i+1].startsWith('--'))throw new Error('Unknown or incomplete option: '+item);
    const value=argv[++i];out[key]=integer.has(key)||key==='minCpuUs'?Number(value):value;
  }
  if(out.roots.length>(paired?2:1))throw new Error('Too many repository roots');
  if(!out.roots.length)out.roots.push(DEFAULT_ROOT);if(paired&&out.roots.length===1)out.roots.push(out.roots[0]);
  for(const key of integer)if(out[key]!==undefined&&(!Number.isSafeInteger(out[key])||out[key]<(key==='seed'||key==='weapon'?0:1)))throw new Error('Invalid positive integer: '+key);
  if(!Number.isFinite(out.minCpuUs)||out.minCpuUs<1)throw new Error('min-cpu-us must be at least 1');
  if(!['main','vm'].includes(out.realm))throw new Error('realm must be main or vm');
  return out;
}

export async function loadPatch(spec){
  if(!spec)return {};
  const hashAt=spec.lastIndexOf('#'),file=hashAt<0?spec:spec.slice(0,hashAt),name=hashAt<0?'default':spec.slice(hashAt+1);
  const module=await import(pathToFileURL(resolve(file)).href),value=module[name],patches=typeof value==='function'?await value():value;
  if(!patches||typeof patches!=='object')throw new Error(`Patch export ${name} must be an object or a factory returning one`);
  return patches;
}

// Preserve the historical optional output argument of existing report tools.
export function parseToolArgs(argv) {
  let root=DEFAULT_ROOT,output;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--root'||argv[i]==='--out'){
      const key=argv[i++];if(!argv[i]||argv[i].startsWith('--'))throw new Error('Missing value for '+key);
      if(key==='--root')root=resolve(argv[i]);else output=argv[i];
    }else if(!argv[i].startsWith('--')&&output===undefined)output=argv[i];
    else throw new Error('Unknown or duplicate argument: '+argv[i]);
  }
  return {root,output};
}
