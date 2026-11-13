// MD-2 (DEMO-08) : coût et allocations de FDemo.schema, schéma METAL, domaine principal de Node.
// Compare src/demo.js d'une révision (par défaut le relais 66e5577) et celui de l'arbre de travail.
// - Temps : un seul processus, passes alternées, médianes, temps processeur du fil.
// - Allocations : un processus par cas, jeune génération fixée à 16 Mio, ramassages pendant 10 000 000 d'opérations.
// Entrées « jeu » : l'objet input de src/game.js (ligne 20), réécrit en place à chaque pas ; « boîte » : ses quatre
// flottants créés à null, ce qui oblige V8 à les ranger en boîte.
//   node docs/chantier-moteur/preuves/module-demo/MD-2/schema-alloc.mjs [--before <rév>] [--passes P] [--out F]
import {loadRealm,DEFAULT_ROOT} from '../../../../../tools/realm-loader.mjs';
import {PerformanceObserver,performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {relative} from 'node:path';
import os from 'node:os';

const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:fallback;};
const BEFORE=arg('--before','66e5577977fa9cfe73925c138c0c1490a9d3feab'),PASSES=+arg('--passes',9),OUT=arg('--out',null);
const SELF=fileURLToPath(import.meta.url),SEMI_MIB=16,ALLOC_OPS=1e7,TIME_OPS=1e6;
const METAL_FIELDS=[
  {name:'moveX',type:'i8',scale:127},{name:'moveY',type:'i8',scale:127},
  {name:'lookX',type:'i16',scale:8192},{name:'lookY',type:'i16',scale:8192},
  {name:'buttons',type:'bits',names:['fire','fireLeft','dash','pulse','melee','interact','sprint','assist']},
  {name:'weapon',type:'u8'}];
const source=version=>version==='before'?execFileSync('git',['-C',DEFAULT_ROOT,'show',BEFORE+':src/demo.js'],{encoding:'utf8'})
  :readFileSync(new URL('../../../../../src/demo.js',import.meta.url),'utf8');

// Les boucles d'un cas : fill (le jeu écrit ses entrées), encode (fill puis encode), decode, step (fill, encode, decode).
function setup(text,shape){
  const sc=loadRealm({modules:['demo'],transform:()=>text}).window.FDemo.schema(METAL_FIELDS);
  const input=shape==='boite'?{moveX:null,moveY:null,lookX:null,lookY:null,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:false,assist:false}
    :{moveX:0,moveY:0,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:false,assist:false};
  const move=new Float64Array(1024).map((_,i)=>Math.sin(i*.013)*1.3),look=new Float64Array(1024).map((_,i)=>.02*Math.sin(i*.07)+.004);
  const fill=i=>{input.moveX=move[i&1023];input.moveY=move[i+300&1023];input.lookX=look[i&1023];input.lookY=look[i+77&1023];input.fire=(i&7)<3;};
  const view=new DataView(new ArrayBuffer(8)),records=new DataView(new ArrayBuffer(8*1024)),out={};
  for(let i=0;i<1024;i++){fill(i);sc.encode(input,records,i*8);}
  return {
    fill:n=>{for(let i=0;i<n;i++)fill(i);},
    encode:n=>{for(let i=0;i<n;i++){fill(i);sc.encode(input,view,0);}},
    decode:n=>{for(let i=0;i<n;i++)sc.decode(records,(i&1023)*8,out);},
    step:n=>{for(let i=0;i<n;i++){fill(i);sc.encode(input,view,0);sc.decode(view,0,out);}},
  };
}
const KINDS=['fill','encode','decode','step'],SHAPES=['jeu','boite'],VERSIONS=['before','after'];
const settle=async()=>{for(let k=0;k<4;k++)await new Promise(r=>setImmediate(r));};

if(process.argv.includes('--case')){
  // Processus fils : un seul cas, pour que la forme des objets d'un cas ne dépende pas des autres.
  const [version,shape,kind]=arg('--case').split(':'),loop=setup(source(version),shape)[kind];
  loop(5e5);gc();
  const starts=[],observer=new PerformanceObserver(list=>{for(const e of list.getEntries())starts.push(e.startTime);});
  observer.observe({entryTypes:['gc']});await settle();
  const t0=performance.now();loop(ALLOC_OPS);const t1=performance.now();
  await settle();observer.disconnect();
  const n=starts.filter(t=>t>=t0&&t<=t1).length;
  process.stdout.write(JSON.stringify({gc:n,bytesPerOp:+(n*SEMI_MIB*1048576/ALLOC_OPS).toFixed(1)}));
}else{
  const allocations=[];
  for(const shape of SHAPES)for(const version of VERSIONS)for(const kind of KINDS){
    const flags=['--expose-gc','--min-semi-space-size='+SEMI_MIB,'--max-semi-space-size='+SEMI_MIB];
    const r=JSON.parse(execFileSync(process.execPath,[...flags,SELF,'--case',version+':'+shape+':'+kind,'--before',BEFORE],{encoding:'utf8'}));
    allocations.push({inputs:shape,version,kind,ops:ALLOC_OPS,...r});
  }
  const variants=VERSIONS.map(version=>({version,loops:setup(source(version),'jeu'),ns:Object.fromEntries(KINDS.map(k=>[k,[]]))}));
  const cpu=()=>{const u=process.threadCpuUsage();return u.user+u.system;};
  for(const v of variants)for(const k of KINDS)v.loops[k](TIME_OPS);
  for(let p=0;p<PASSES;p++)for(const k of KINDS)for(const v of p&1?[...variants].reverse():variants){
    await settle();const c0=cpu();v.loops[k](TIME_OPS);v.ns[k].push((cpu()-c0)*1000/TIME_OPS);
  }
  const median=a=>[...a].sort((x,y)=>x-y)[a.length>>1];
  const result={schema:'fdemo-md2-schema-alloc-v2',command:['node',relative(DEFAULT_ROOT,SELF),...process.argv.slice(2)].join(' '),before:BEFORE,
    sourceSha256:Object.fromEntries(VERSIONS.map(v=>[v,createHash('sha256').update(source(v)).digest('hex')])),
    environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,cores:os.cpus().length,loadavg:os.loadavg().map(x=>+x.toFixed(2))},
    allocation:{method:'ramassages pendant '+ALLOC_OPS+' opérations, jeune génération fixée à '+SEMI_MIB+' Mio, un processus par cas ; octets/op ≈ ramassages × '+SEMI_MIB+' Mio / opérations',cases:allocations},
    timing:{method:'temps processeur du fil, '+TIME_OPS+' opérations par passe, '+PASSES+' passes alternées dans un même processus, entrées « jeu »',
      nsPerOp:variants.map(v=>({version:v.version,...Object.fromEntries(KINDS.map(k=>[k,{median:+median(v.ns[k]).toFixed(1),min:+Math.min(...v.ns[k]).toFixed(1)}]))}))}};
  const text=JSON.stringify(result,null,1)+'\n';
  if(OUT)writeFileSync(OUT,text);
  process.stdout.write(text);
}
