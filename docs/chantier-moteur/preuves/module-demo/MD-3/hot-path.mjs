// MD-3 (DEMO-08, DEMO-V4) : coût et allocations de rec.step et play.next, schéma METAL, domaine principal de Node.
// « avant » : src/demo.js de l'étape 2 (a0d00e1), qui n'a que le schéma ; son pas encode + decode est ce que rec.step
// ajoute au jeu sans FDemo.recorder. « après » : l'arbre de travail.
// - Temps : un seul processus, passes alternées, médianes, temps processeur du fil.
// - Allocations : un processus par cas, jeune génération fixée à 16 Mio, ramassages pendant 10 000 000 d'opérations.
// Entrées « jeu » de MD-2 (objet input de src/game.js réécrit en place) ; dt en boîte, comme ceux que rend le navigateur.
//   node docs/chantier-moteur/preuves/module-demo/MD-3/hot-path.mjs [--before <rév>] [--passes P] [--out F]
import {loadRealm,DEFAULT_ROOT} from '../../../../../tools/realm-loader.mjs';
import {PerformanceObserver,performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {relative} from 'node:path';
import os from 'node:os';

const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:fallback;};
const BEFORE=arg('--before','a0d00e18ac1a9489f49e51825e2c62a878b0c681'),PASSES=+arg('--passes',9),OUT=arg('--out',null);
const SELF=fileURLToPath(import.meta.url),SEMI_MIB=16,ALLOC_OPS=1e7,TIME_OPS=1e6,WARM=5e5;
const METAL_FIELDS=[
  {name:'moveX',type:'i8',scale:127},{name:'moveY',type:'i8',scale:127},
  {name:'lookX',type:'i16',scale:8192},{name:'lookY',type:'i16',scale:8192},
  {name:'buttons',type:'bits',names:['fire','fireLeft','dash','pulse','melee','interact','sprint','assist']},
  {name:'weapon',type:'u8'}];
const source=version=>version==='before'?execFileSync('git',['-C',DEFAULT_ROOT,'show',BEFORE+':src/demo.js'],{encoding:'utf8'})
  :readFileSync(new URL('../../../../../src/demo.js',import.meta.url),'utf8');

// Chaque cas : prepare(n) hors mesure (enregistreur neuf ou retour au début de la scène), puis run(n).
function setup(text,ops){
  const F=loadRealm({modules:['demo'],transform:()=>text}).window.FDemo,sc=F.schema(METAL_FIELDS);
  const input={moveX:0,moveY:0,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:false,assist:false};
  const move=new Float64Array(1024).map((_,i)=>Math.sin(i*.013)*1.3),look=new Float64Array(1024).map((_,i)=>.02*Math.sin(i*.07)+.004);
  const dts=new Array(1024).fill(null);for(let i=0;i<1024;i++)dts[i]=(16.7+4*Math.sin(1.7*i))/1000;
  const fill=i=>{input.moveX=move[i&1023];input.moveY=move[i+300&1023];input.lookX=look[i&1023];input.lookY=look[i+77&1023];input.fire=(i&7)<3;};
  const view=new DataView(new ArrayBuffer(8)),records=new DataView(new ArrayBuffer(8*1024)),out={},none=()=>{};
  for(let i=0;i<1024;i++){fill(i);sc.encode(input,records,i*8);}
  const loops={
    schema:{prepare:none,run:n=>{for(let i=0;i<n;i++){fill(i);sc.encode(input,view,0);sc.decode(view,0,out);}}},
    decode:{prepare:none,run:n=>{for(let i=0;i<n;i++)sc.decode(records,(i&1023)*8,out);}},
  };
  if(!F.recorder)return loops;
  const fixed={game:'metal',simHash:'banc',fields:METAL_FIELDS},ticks={...fixed,dtTicks:48000};
  const recording=(header,options)=>{
    let rec=null;
    return {prepare:n=>{rec=F.recorder(header,{maxBytes:2**30,initialSteps:n,...options});rec.scene({});},
      run:n=>{for(let i=0;i<n;i++){fill(i);rec.step(input,dts[i&1023]);if(rec.checksumDue())rec.checksum(i);}}};
  };
  const playing=header=>{
    const rec=F.recorder(header,{maxBytes:2**30,initialSteps:ops});rec.scene({});
    for(let i=0;i<ops;i++){fill(i);rec.step(input,dts[i&1023]);if(rec.checksumDue())rec.checksum(i);}
    const play=F.player(rec.end());
    return {prepare:()=>{play.select(0);},run:n=>{for(let i=0;i<n&&play.next(out);i++){const k=play.step,want=play.expected(k);play.verify(k,want===undefined?0:want);}}};
  };
  return Object.assign(loops,{record:recording(fixed),recordTicks:recording(ticks),recordFull:recording(fixed,{maxBytes:0}),play:playing(fixed),playTicks:playing(ticks)});
}
const KINDS={before:['schema','decode'],after:['schema','decode','record','recordTicks','recordFull','play','playTicks']},VERSIONS=['before','after'];
const settle=async()=>{for(let k=0;k<4;k++)await new Promise(r=>setImmediate(r));};

if(process.argv.includes('--case')){
  // Processus fils : un seul cas, pour que la forme des objets d'un cas ne dépende pas des autres.
  const [version,kind]=arg('--case').split(':'),loop=setup(source(version),ALLOC_OPS)[kind];
  loop.prepare(WARM);loop.run(WARM);loop.prepare(ALLOC_OPS);gc();
  const starts=[],observer=new PerformanceObserver(list=>{for(const e of list.getEntries())starts.push(e.startTime);});
  observer.observe({entryTypes:['gc']});await settle();
  const t0=performance.now();loop.run(ALLOC_OPS);const t1=performance.now();
  await settle();observer.disconnect();
  const n=starts.filter(t=>t>=t0&&t<=t1).length;
  process.stdout.write(JSON.stringify({gc:n,bytesPerOp:+(n*SEMI_MIB*1048576/ALLOC_OPS).toFixed(1)}));
}else{
  const allocations=[];
  for(const version of VERSIONS)for(const kind of KINDS[version]){
    const flags=['--expose-gc','--min-semi-space-size='+SEMI_MIB,'--max-semi-space-size='+SEMI_MIB];
    const r=JSON.parse(execFileSync(process.execPath,[...flags,SELF,'--case',version+':'+kind,'--before',BEFORE],{encoding:'utf8',maxBuffer:1<<20}));
    allocations.push({version,kind,ops:ALLOC_OPS,...r});
  }
  const variants=VERSIONS.map(version=>({version,loops:setup(source(version),TIME_OPS),ns:Object.fromEntries(KINDS[version].map(k=>[k,[]]))}));
  const cpu=()=>{const u=process.threadCpuUsage();return u.user+u.system;};
  for(const v of variants)for(const k of KINDS[v.version]){v.loops[k].prepare(TIME_OPS);v.loops[k].run(TIME_OPS);}
  for(let p=0;p<PASSES;p++)for(const k of KINDS.after)for(const v of p&1?[...variants].reverse():variants){
    if(!v.loops[k])continue;
    v.loops[k].prepare(TIME_OPS);await settle();
    const c0=cpu();v.loops[k].run(TIME_OPS);v.ns[k].push((cpu()-c0)*1000/TIME_OPS);
  }
  const median=a=>[...a].sort((x,y)=>x-y)[a.length>>1];
  const result={schema:'fdemo-md3-hot-path-v1',command:['node',relative(DEFAULT_ROOT,SELF),...process.argv.slice(2)].join(' '),before:BEFORE,
    sourceSha256:Object.fromEntries(VERSIONS.map(v=>[v,createHash('sha256').update(source(v)).digest('hex')])),
    environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,cores:os.cpus().length,loadavg:os.loadavg().map(x=>+x.toFixed(2))},
    allocation:{method:'ramassages pendant '+ALLOC_OPS+' opérations, jeune génération fixée à '+SEMI_MIB+' Mio, un processus par cas ; octets/op ≈ ramassages × '+SEMI_MIB+' Mio / opérations',cases:allocations},
    timing:{method:'temps processeur du fil, '+TIME_OPS+' opérations par passe, '+PASSES+' passes alternées dans un même processus ; record* : pas + checksumDue (+ checksum tous les 600 pas) ; play* : next + expected + verify',
      nsPerOp:variants.map(v=>({version:v.version,...Object.fromEntries(KINDS[v.version].map(k=>[k,{median:+median(v.ns[k]).toFixed(1),min:+Math.min(...v.ns[k]).toFixed(1)}]))}))}};
  const text=JSON.stringify(result,null,1)+'\n';
  if(OUT)writeFileSync(OUT,text);
  process.stdout.write(text);
}
