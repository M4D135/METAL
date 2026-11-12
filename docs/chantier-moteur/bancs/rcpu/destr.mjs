// RCPU: cost of a destruction revision on the render side, and an incremental "dirty cell" index update.
// usage: node destr.mjs <ferroRoot> [frames=3000] [world=camp:17]
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {scene,stats} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||3000),[kind,idx]=(process.argv[4]||'camp:17').split(':');
const S=scene(root,{world:[kind,+idx],wrap:false});
// Internals of the original renderer (export added in memory only).
const src=readFileSync(root+'/src/renderer.js','utf8').replace('window.FRender={create,foliageTriangles};','window.FRender={create,foliageTriangles};window.__rx={spatialIndex,metadata,surfaceFlags,environmentInfo};');
const win={innerWidth:1280,innerHeight:720,devicePixelRatio:2};vm.runInThisContext('(function(window){'+src+'\n})',{filename:'renderer-x.js'})(win);
const X=win.__rx,env=X.environmentInfo(S.world.environment);
const events=[];const orig=S.renderer.updateWorld;let current=S.sim.destruction.meshes;
S.renderer.updateWorld=(meshes,revision,lights)=>{events.push({before:current,after:meshes});current=meshes;return orig(meshes,revision,lights);};
const rows=[];for(let i=0;i<frames;i++){const r=S.frame(1/60,{tour:true});rows.push(r);}
const normal=stats(rows.filter(r=>!r.changed).map(r=>r.drawMs)),hit=rows.filter(r=>r.changed);
console.log('world',kind+':'+idx,'destruction revisions',hit.length,'in',frames,'frames');
console.log('renderer.updateWorld ms',JSON.stringify(stats(hit.map(r=>r.updateMs))),'| draw in that frame',JSON.stringify(stats(hit.map(r=>r.drawMs))),'| other frames draw',JSON.stringify(normal));
console.log('sim.step in destruction frames',JSON.stringify(stats(hit.map(r=>r.simMs))),'| other frames',JSON.stringify(stats(rows.filter(r=>!r.changed).map(r=>r.simMs))));
// Incremental index prototype: dense grid of cell arrays + persistent WeakMap, rebuild only dirty cells in mesh order.
function makeIncremental(meshes){
  let x0,z0,nx,nz;{let ax=Infinity,az=Infinity,bx=-Infinity,bz=-Infinity;for(const m of meshes){const p=m.p||[0,0,0],cx=Math.floor(p[0]/8),cz=Math.floor(p[2]/8);if(cx<ax)ax=cx;if(cx>bx)bx=cx;if(cz<az)az=cz;if(cz>bz)bz=cz;}x0=ax-4;z0=az-4;nx=bx-ax+9;nz=bz-az+9;}
  const byMesh=new WeakMap(),cells=[0,1,2].map(()=>new Array(nx*nz).fill(null)),maxRadius=[0,0,0];let entries=[],gen=0;
  const dirty=[0,1,2].map(()=>new Uint8Array(nx*nz));
  const entryFor=mesh=>{let e=byMesh.get(mesh);if(e)return [e,false];e=X.metadata(mesh);const p=e.p,s=mesh.s||[1,1,1],r=mesh.r||[0,0,0],c=mesh.color||[0,0,0];
    e.row=new Float32Array([p[0],p[1],p[2],mesh.mat||0,s[0],s[1],s[2],mesh.emissive||0,r[0],r[1],r[2],X.surfaceFlags(mesh,env),c[0],c[1],c[2],mesh.color?1:0]);
    e.cell=(Math.floor(e.p[0]/8)-x0)*nz+(Math.floor(e.p[2]/8)-z0);byMesh.set(mesh,e);return [e,true];};
  function full(list){gen++;entries=[];for(const c of cells)c.fill(null);for(const m of list){const [e]=entryFor(m);e.gen=gen;entries.push(e);maxRadius[e.detail]=Math.max(maxRadius[e.detail],e.radius);const L=cells[e.detail];(L[e.cell]||(L[e.cell]=[])).push(e);}}
  function update(list){
    gen++;const next=new Array(list.length);let touched=0;
    for(let i=0;i<list.length;i++){const [e,fresh]=entryFor(list[i]);e.gen=gen;next[i]=e;if(fresh){dirty[e.detail][e.cell]=1;touched++;maxRadius[e.detail]=Math.max(maxRadius[e.detail],e.radius);}}
    for(const e of entries)if(e.gen!==gen){dirty[e.detail][e.cell]=1;touched++;}
    if(touched){for(let l=0;l<3;l++){const D=dirty[l],L=cells[l];for(let c=0;c<D.length;c++)if(D[c])L[c]=null;}
      for(const e of next)if(dirty[e.detail][e.cell]){const L=cells[e.detail];(L[e.cell]||(L[e.cell]=[])).push(e);}
      for(const D of dirty)D.fill(0);}
    entries=next;return touched;
  }
  function query(eye,ranges){const result=[];for(let level=0;level<3;level++){const range=ranges[level];if(!(range>0))continue;const radius=range+maxRadius[level],L=cells[level];
    const ax=Math.max(0,Math.floor((eye[0]-radius)/8)-x0),bx=Math.min(nx-1,Math.floor((eye[0]+radius)/8)-x0),az=Math.max(0,Math.floor((eye[2]-radius)/8)-z0),bz=Math.min(nz-1,Math.floor((eye[2]+radius)/8)-z0);
    for(let x=ax;x<=bx;x++)for(let z=az;z<=bz;z++){const b=L[x*nz+z];if(!b)continue;for(const e of b){const dx=e.p[0]-eye[0],dy=e.p[1]-eye[1],dz=e.p[2]-eye[2],r=range+e.radius;if(dx*dx+dy*dy+dz*dz<=r*r)result.push(e);}}}return result;}
  full(meshes);return {update,query,get entries(){return entries;}};
}
const fullMs=[],incMs=[],touchedN=[];let identical=true;
for(const ev of events){
  const prev=X.spatialIndex(ev.before,env);
  let t=performance.now();const next=X.spatialIndex(ev.after,env,prev);fullMs.push(performance.now()-t);
  const inc=makeIncremental(ev.before);
  t=performance.now();const n=inc.update(ev.after);incMs.push(performance.now()-t);touchedN.push(n);
  // same results and order as the original index for a few eyes around the change
  for(const m of ev.after.slice(0,40).concat(ev.after.slice(-40))){const p=m.p||[0,0,0],eye=[p[0]+3,p[1]+1.6,p[2]+3],R=[64,32,13];const a=next.query(eye,R).map(e=>e.mesh),b=inc.query(eye,R).map(e=>e.mesh);if(a.length!==b.length||a.some((x,k)=>x!==b[k])){identical=false;break;}}
}
console.log('spatialIndex full rebuild (original) ms',JSON.stringify(stats(fullMs)));
console.log('incremental dirty-cell update ms',JSON.stringify(stats(incMs)),'entries touched',JSON.stringify(stats(touchedN)),'identical query results+order:',identical);
