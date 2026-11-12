// A/B independant du prototype RCPU (proto.mjs de l'autre agent) : ORDRE ALTERNE a chaque image,
// deux renderers neufs (original exact et prototype), meme camera/liste dynamique/fx, vitesse de rotation reglable.
// usage: node v-ab.mjs <ferro> [frames=2400] [world=camp:17] [flags=grid,sun,cache,pool] [sweep=45] [quality=auto]
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {scene} from '../rcpu/harness.mjs';
import {patchRenderer} from '../rcpu/proto.mjs';
import {counters,fakeGL,makeCanvas,quant} from './lib.mjs';
const root=process.argv[2],frames=+(process.argv[3]||2400),[kind,idx]=(process.argv[4]||'camp:17').split(':');
const flags=(process.argv[5]||'grid,sun,cache,pool').split(','),sweep=+(process.argv[6]||45),quality=process.argv[7]||'auto';
const S=scene(root,{world:[kind,+idx],quality,wrap:false});
S.renderer.draw=()=>{}; // the harness renderer only serves models()/actorFilter; both measured renderers are fresh
const make=(src,tag)=>{const win={innerWidth:1280,innerHeight:720,devicePixelRatio:2};vm.runInThisContext('(function(window){'+src+'\n})',{filename:'renderer-'+tag+'.js'})(win);
  const C=counters(),gl=fakeGL(C),R=win.FRender.create(makeCanvas(gl));R.resize(quality);const d=S.sim.destruction;R.setWorld(d?.meshes||S.world.meshes,d?.lights||S.world.lights,S.world.environment);return {R,C,rev:S.sim.state.destructionRevision??d?.revision,ms:[],up:[],inst:[],tri:[],calls:[],bytes:[]};};
const base=readFileSync(root+'/src/renderer.js','utf8');
const opt={grid:flags.includes('grid'),sun:flags.includes('sun'),cache:flags.includes('cache'),pool:flags.includes('pool'),D:1,THETA:8,SUNM:4};
const A=make(base,'orig'),B=make(patchRenderer(base,opt),'proto');
let seed=12345;const rnd=()=>(seed=(seed*1103515245+12345)>>>0)/4294967296;
for(let i=0;i<frames+120;i++){
  const r=S.frame(1/60,{tour:true,sweep});
  const d=S.sim.destruction,revision=S.sim.state.destructionRevision??d?.revision;
  const order=rnd()<.5?[A,B]:[B,A];
  for(const X of order){
    let up=0;if(revision!==X.rev){const t=performance.now();X.R.updateWorld(d.meshes,revision,d.lights);up=performance.now()-t;X.rev=revision;}
    const c0={...X.C};const t=performance.now();X.R.draw(r.camera,r.list,r.fx);const ms=performance.now()-t;
    if(i>=120){X.ms.push(ms);if(up)X.up.push(up);X.inst.push(X.C.instances-c0.instances);X.tri.push(X.C.triangles-c0.triangles);X.calls.push(X.C.calls-c0.calls);X.bytes.push(X.C.bufferBytes-c0.bufferBytes+X.C.subBytes-c0.subBytes);}
  }
}
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
console.log('world',kind+':'+idx,'quality',quality,'sweep',sweep,'flags',flags.join('+'),'frames',A.ms.length);
for(const [n,X] of [['original',A],['proto',B]])console.log(n.padEnd(9),'draw',JSON.stringify(quant(X.ms)),'| updateWorld',JSON.stringify(quant(X.up)),'| inst/f',avg(X.inst).toFixed(0),'tri/f',(avg(X.tri)/1000).toFixed(1)+'K','gl/f',avg(X.calls).toFixed(0),'uploadKB/f',(avg(X.bytes)/1024).toFixed(1));
// paired ratio (same frame) to remove load noise
const ratio=A.ms.map((a,k)=>B.ms[k]/a).sort((x,y)=>x-y);console.log('paired per-frame ratio proto/original: p25',ratio[ratio.length>>2].toFixed(3),'median',ratio[ratio.length>>1].toFixed(3),'p75',ratio[(ratio.length*3)>>2].toFixed(3),'| sum ratio',(avg(B.ms)/avg(A.ms)).toFixed(3),'| GPU instance ratio',(avg(B.inst)/avg(A.inst)).toFixed(3),'triangle ratio',(avg(B.tri)/avg(A.tri)).toFixed(3));
