// RCPU-04 : octets alloues par phase d'une image complete (sim.step, models(), draw original, draw prototype),
// mesures par delta de heapUsed avec un semi-espace geant (aucun scavenge pendant la mesure, verifie).
// usage: node --max-semi-space-size=1024 --min-semi-space-size=1024 --expose-gc v-alloc.mjs <ferro> [frames=600] [world=camp:17]
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PerformanceObserver} from 'node:perf_hooks';
import {scene} from '../rcpu/harness.mjs';
import {patchRenderer} from '../rcpu/proto.mjs';
import {counters,fakeGL,makeCanvas} from './lib.mjs';
const root=process.argv[2],frames=+(process.argv[3]||600),[kind,idx]=(process.argv[4]||'camp:17').split(':');
let gcs=0;new PerformanceObserver(l=>{gcs+=l.getEntries().length;}).observe({entryTypes:['gc']});
const S=scene(root,{world:[kind,+idx],wrap:false});const realDraw=S.renderer.draw;S.renderer.draw=()=>{};
const base=readFileSync(root+'/src/renderer.js','utf8');
const make=(src,tag)=>{const win={innerWidth:1280,innerHeight:720,devicePixelRatio:2};vm.runInThisContext('(function(window){'+src+'\n})',{filename:'r-'+tag+'.js'})(win);const C=counters(),R=win.FRender.create(makeCanvas(fakeGL(C)));R.resize('auto');const d=S.sim.destruction;R.setWorld(d?.meshes||S.world.meshes,d?.lights||S.world.lights,S.world.environment);return {R,rev:S.sim.state.destructionRevision??d?.revision,bytes:0,n:0};};
const A=make(base,'a'),B=make(patchRenderer(base,{grid:true,sun:true,cache:true,pool:true}),'b'),P=make(patchRenderer(base,{grid:false,sun:false,cache:false,pool:true}),'p');
const used=()=>process.memoryUsage().heapUsed;
const acc={frame:0,draws:0};let n=0,skipped=0;
for(let i=0;i<frames+60;i++){
  if(i%100===0&&global.gc){global.gc();}
  const g0=gcs,h0=used();
  const r=S.frame(1/60,{tour:true});
  const h1=used();
  const d=S.sim.destruction,revision=S.sim.state.destructionRevision??d?.revision;
  const hs=[];
  for(const X of [A,B,P]){if(revision!==X.rev){X.R.updateWorld(d.meshes,revision,d.lights);X.rev=revision;}const a=used();X.R.draw(r.camera,r.list,r.fx);hs.push(used()-a);}
  if(i<60)continue;
  if(gcs!==g0){skipped++;continue;}
  acc.frame+=h1-h0;A.bytes+=hs[0];B.bytes+=hs[1];P.bytes+=hs[2];n++;
}
const kb=v=>(v/n/1024).toFixed(0)+' KB';
console.log('world',kind+':'+idx,'frames measured',n,'(skipped with GC:',skipped+')');
console.log('sim.step+destruction sync+models() per frame',kb(acc.frame),'| draw original',kb(A.bytes),'| draw proto(grid+sun+cache+pool)',kb(B.bytes),'| draw pool only',kb(P.bytes));
const full=acc.frame+A.bytes,fullB=acc.frame+B.bytes;console.log('full frame original',kb(full),'proto',kb(fullB),'-> allocation ratio',(fullB/full).toFixed(2));
