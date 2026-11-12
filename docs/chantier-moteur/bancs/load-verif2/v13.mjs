// LOAD-13 in the main realm (no vm sandbox): FX bank per-name cost and FMusic.warmup slices. Min over 3 passes.
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {ROOT} from './lib.mjs';
const now=()=>performance.now();let sliceStart=0;const slices=[];
const win={};win.setTimeout=(fn,ms)=>{slices.push(now()-sliceStart);return setTimeout(()=>{sliceStart=now();fn();},ms||0);};
globalThis.window=win;const realST=globalThis.setTimeout;
for(const n of ['music','audio'])vm.runInThisContext(readFileSync(ROOT+'/src/'+n+'.js','utf8'),{filename:n+'.js'});
const W=win,out={};
// does music.js use window.setTimeout or bare setTimeout? patch global too
globalThis.setTimeout=(fn,ms,...a)=>{slices.push(now()-sliceStart);return realST(()=>{sliceStart=now();fn(...a);},ms||0);};
slices.length=0;sliceStart=now();let t0=now();const info=await W.FMusic.warmup(0);slices.push(now()-sliceStart);
out.warmup0={totalMs:+(now()-t0).toFixed(1),slices:slices.length,maxSliceMs:+Math.max(...slices).toFixed(1),slicesMs:slices.map(v=>+v.toFixed(1))};
globalThis.setTimeout=realST;
const names=W.FAudio.effectNames,best=new Map();let bytes=0;
for(let pass=0;pass<3;pass++)for(const name of names){const t=now();const variants=name.indexOf('motor:')===0?1:2;let b=0;for(let v=0;v<variants;v++)b+=W.FAudio.synthesize(name,v,22050).byteLength;const d=now()-t;best.set(name,Math.min(best.get(name)??Infinity,d));if(pass===0)bytes+=b;}
const per=[...best].map(([name,ms])=>({name,ms:+ms.toFixed(1)}));const batches=[];for(let i=0;i<per.length;i+=2)batches.push(+(per[i].ms+(per[i+1]?.ms||0)).toFixed(1));
out.fx={names:names.length,totalKB:Math.round(bytes/1024),totalMsMin:+per.reduce((n,q)=>n+q.ms,0).toFixed(1),maxBatchMs:Math.max(...batches),top:per.sort((a,b)=>b.ms-a.ms).slice(0,6)};
console.log(JSON.stringify(out));
