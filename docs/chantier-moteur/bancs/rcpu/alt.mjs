// RCPU: micro-benchmarks of current renderer internals vs. proposed replacements, on real cameras from a tour.
// usage: node alt.mjs <ferroRoot> [world=camp:17] [frames=1500]
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {scene} from './harness.mjs';
const root=process.argv[2],[kind,idx]=(process.argv[3]||'camp:17').split(':'),frames=+(process.argv[4]||1500);
// 1) Real cameras + dynamic lists from the tour.
const S=scene(root,{world:[kind,+idx],wrap:false});
const cams=[],dyns=[];
for(let i=0;i<frames;i++){const r=S.frame(1/60,{tour:true});if(i>=60){cams.push(r.camera);if(i%10===0)dyns.push(S.game.models(S.sim.state.time,true,r.camera));}}
// 2) Renderer internals (same source, export patched in memory only).
const src=readFileSync(root+'/src/renderer.js','utf8').replace('window.FRender={create,foliageTriangles};','window.FRender={create,foliageTriangles};window.__rx={spatialIndex,visible,pack,packIndexed,packEffects,surfaceFlags,outdoorAt,environmentInfo,cameraAxes,detailRanges,extendedDistance,names};');
const win={innerWidth:1280,innerHeight:720,devicePixelRatio:2};vm.runInThisContext('(function(window){'+src+'\n})',{filename:'renderer-x.js'})(win);
const X=win.__rx,env=X.environmentInfo(S.world.environment),meshes=S.sim.destruction?.meshes||S.world.meshes;
const index=X.spatialIndex(meshes,env);
const aspect=S.canvas.width/S.canvas.height;
const bench=(label,fn,reps=3)=>{let best=Infinity,out;for(let r=0;r<reps;r++){const t=performance.now();out=fn();best=Math.min(best,performance.now()-t);}console.log(label.padEnd(58),(best/cams.length*1000).toFixed(2).padStart(8),'us/frame');return out;};
const info=cam=>{const p=cam.pos,axes=X.cameraAxes(cam),fov=Math.max(40,Math.min(110,cam.fov||75))*Math.PI/180,f=1/Math.tan(fov*.5),ranges=X.detailRanges('auto');ranges[0]=X.extendedDistance(ranges[0],env,p);return {eye:[p[0],p[1],p[2]],axes,f,ranges};};
const I=cams.map(info);
// ---- A. spatial query: current string-keyed Map vs dense CSR grid (identical result ORDER).
function denseIndex(entries,cell=8,bigRadius=Infinity){
  let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;for(const e of entries){minX=Math.min(minX,e.p[0]);maxX=Math.max(maxX,e.p[0]);minZ=Math.min(minZ,e.p[2]);maxZ=Math.max(maxZ,e.p[2]);}
  const x0=Math.floor(minX/cell),z0=Math.floor(minZ/cell),nx=Math.floor(maxX/cell)-x0+1,nz=Math.floor(maxZ/cell)-z0+1;
  const levels=[0,1,2].map(level=>{const list=entries.filter(e=>e.detail===level&&e.radius<=bigRadius),big=entries.filter(e=>e.detail===level&&e.radius>bigRadius);
    const count=new Uint32Array(nx*nz+1);const cellOf=e=>(Math.floor(e.p[0]/cell)-x0)*nz+(Math.floor(e.p[2]/cell)-z0);
    for(const e of list)count[cellOf(e)+1]++;for(let i=1;i<count.length;i++)count[i]+=count[i-1];
    const fill=count.slice(),order=new Array(list.length),px=new Float32Array(list.length),py=new Float32Array(list.length),pz=new Float32Array(list.length),pr=new Float32Array(list.length);
    for(const e of list){const k=fill[cellOf(e)]++;order[k]=e;px[k]=e.p[0];py[k]=e.p[1];pz[k]=e.p[2];pr[k]=e.radius;}
    let maxR=0;for(const e of list)maxR=Math.max(maxR,e.radius);
    return {start:count,order,px,py,pz,pr,maxR,big};});
  function query(eye,ranges,result=[]){
    result.length=0;
    for(let level=0;level<3;level++){const range=ranges[level];if(!(range>0))continue;const L=levels[level],radius=range+L.maxR;
      const ax=Math.max(0,Math.floor((eye[0]-radius)/cell)-x0),bx=Math.min(nx-1,Math.floor((eye[0]+radius)/cell)-x0),az=Math.max(0,Math.floor((eye[2]-radius)/cell)-z0),bz=Math.min(nz-1,Math.floor((eye[2]+radius)/cell)-z0);
      for(let x=ax;x<=bx;x++)for(let z=az;z<=bz;z++){const c=x*nz+z;for(let k=L.start[c],end=L.start[c+1];k<end;k++){const dx=L.px[k]-eye[0],dy=L.py[k]-eye[1],dz=L.pz[k]-eye[2],r=range+L.pr[k];if(dx*dx+dy*dy+dz*dz<=r*r)result.push(L.order[k]);}}
      for(const e of L.big){const dx=e.p[0]-eye[0],dy=e.p[1]-eye[1],dz=e.p[2]-eye[2],r=range+e.radius;if(dx*dx+dy*dy+dz*dz<=r*r)result.push(e);}
    }
    return result;
  }
  return {query,levels};
}
const dense=denseIndex(index.entries);
const big4=denseIndex(index.entries,8,4);
console.log('entries',index.entries.length,'radius>4m',index.entries.filter(e=>e.radius>4).length,'maxR per level',dense.levels.map(l=>l.maxR.toFixed(1)).join('/'),'-> with big list',big4.levels.map(l=>l.maxR.toFixed(1)).join('/'));
let A=bench('A0 current query(eye,ranges) [string keys]',()=>{let n=0;for(const q of I)n+=index.query(q.eye,q.ranges).length;return n;});
let B=bench('A1 dense CSR grid, same order',()=>{let n=0;const out=[];for(const q of I)n+=dense.query(q.eye,q.ranges,out).length;return n;});
let C=bench('A2 dense CSR grid + separate list for r>4 m',()=>{let n=0;const out=[];for(const q of I)n+=big4.query(q.eye,q.ranges,out).length;return n;});
// A3: dense array of per-cell JS arrays (supports incremental dirty-cell rebuild after destruction).
function cellArrays(entries,cell=8){let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;for(const e of entries){minX=Math.min(minX,e.p[0]);maxX=Math.max(maxX,e.p[0]);minZ=Math.min(minZ,e.p[2]);maxZ=Math.max(maxZ,e.p[2]);}
  const x0=Math.floor(minX/cell),z0=Math.floor(minZ/cell),nx=Math.floor(maxX/cell)-x0+1,nz=Math.floor(maxZ/cell)-z0+1,cells=[0,1,2].map(()=>new Array(nx*nz).fill(null)),maxR=[0,0,0];
  for(const e of entries){const L=cells[e.detail],c=(Math.floor(e.p[0]/cell)-x0)*nz+(Math.floor(e.p[2]/cell)-z0);(L[c]||(L[c]=[])).push(e);maxR[e.detail]=Math.max(maxR[e.detail],e.radius);}
  return {query(eye,ranges,result=[]){result.length=0;for(let level=0;level<3;level++){const range=ranges[level];if(!(range>0))continue;const radius=range+maxR[level],L=cells[level],ex=eye[0],ey=eye[1],ez=eye[2];
    const ax=Math.max(0,Math.floor((ex-radius)/cell)-x0),bx=Math.min(nx-1,Math.floor((ex+radius)/cell)-x0),az=Math.max(0,Math.floor((ez-radius)/cell)-z0),bz=Math.min(nz-1,Math.floor((ez+radius)/cell)-z0);
    for(let x=ax;x<=bx;x++)for(let z=az;z<=bz;z++){const b=L[x*nz+z];if(b===null)continue;for(let k=0;k<b.length;k++){const e=b[k],p=e.p,dx=p[0]-ex,dy=p[1]-ey,dz=p[2]-ez,r=range+e.radius;if(dx*dx+dy*dy+dz*dz<=r*r)result.push(e);}}}return result;}};}
const arrays=cellArrays(index.entries);
bench('A3 dense array of cell arrays (incremental-friendly)',()=>{let n=0;const out=[];for(const q of I)n+=arrays.query(q.eye,q.ranges,out).length;return n;});
{const t=performance.now();for(let k=0;k<5;k++)cellArrays(index.entries);console.log('   A3 build',((performance.now()-t)/5).toFixed(2),'ms');}
{const t=performance.now();for(let k=0;k<5;k++)denseIndex(index.entries);console.log('   A1 CSR build',((performance.now()-t)/5).toFixed(2),'ms');}
// order/identity check
{let same=true;const out=[];for(const q of I.slice(0,200)){const a=index.query(q.eye,q.ranges),b=dense.query(q.eye,q.ranges,out);if(a.length!==b.length||a.some((e,i)=>e!==b[i])){same=false;break;}}console.log('   A1 identical order:',same,' totals',A,B,C);}
// ---- B. visible() filter of the main pass.
const vis=(q,c)=>c.filter(e=>X.visible(e,q.eye,q.axes,aspect/q.f,1/q.f,q.ranges[0]));
const cand=I.map(q=>index.query(q.eye,q.ranges));
bench('B0 current candidates.filter(visible)',()=>{let n=0;for(let i=0;i<I.length;i++)n+=vis(I[i],cand[i]).length;return n;});
bench('B1 inlined plane test into reused array',()=>{let n=0;const out=[];for(let i=0;i<I.length;i++){const q=I[i],{forward:f,right:r,up:u}=q.axes,h=aspect/q.f,v=1/q.f,sh=Math.sqrt(1+h*h),sv=Math.sqrt(1+v*v),far=q.ranges[0],e0=q.eye[0],e1=q.eye[1],e2=q.eye[2];out.length=0;for(const e of cand[i]){const x=e.p[0]-e0,y=e.p[1]-e1,d=e.p[2]-e2,z=x*f[0]+y*f[1]+d*f[2],rr=e.radius;if(z+rr>.04&&z-rr<far&&Math.abs(x*r[0]+y*r[1]+d*r[2])<=z*h+rr*sh&&Math.abs(x*u[0]+y*u[1]+d*u[2])<=z*v+rr*sv)out.push(e);}n+=out.length;}return n;});
// ---- C. sun shadow caster filter (renderer.js:1454-1457) current vs inline.
const sun=env.sunDirection,fw=sun.map(v=>-v),len=Math.hypot(fw[0],fw[2]),R=len>.0001?[-fw[2]/len,0,fw[0]/len]:[1,0,0],U=[R[1]*fw[2]-R[2]*fw[1],R[2]*fw[0]-R[0]*fw[2],R[0]*fw[1]-R[1]*fw[0]];
const extent=28,near=1,far=115;
const sunIn=I.map(q=>{const center=[q.eye[0]+q.axes.forward[0]*8,q.eye[1]+1.4,q.eye[2]+q.axes.forward[2]*8];return {center,p:center.map((v,k)=>v+sun[k]*55)};});
const sunCand=sunIn.map(s=>index.query(s.center,[extent+24,26,0]));
bench('C0 sun query only (current)',()=>{let n=0;for(const s of sunIn)n+=index.query(s.center,[extent+24,26,0]).length;return n;});
bench('C0b sun query only (dense grid)',()=>{let n=0;const out=[];for(const s of sunIn)n+=dense.query(s.center,[extent+24,26,0],out).length;return n;});
const c0=bench('C1 sun filter current (e.p.map + closure)',()=>{let n=0;for(let i=0;i<sunIn.length;i++){const p=sunIn[i].p;n+=sunCand[i].filter(e=>{const d=e.p.map((v,k)=>v-p[k]),along=a=>d[0]*a[0]+d[1]*a[1]+d[2]*a[2],z=along(fw);return Math.abs(along(R))<extent+e.radius&&Math.abs(along(U))<extent+e.radius&&z+e.radius>near&&z-e.radius<far;}).length;}return n;});
const c1=bench('C2 sun filter inline scalars',()=>{let n=0;const out=[];for(let i=0;i<sunIn.length;i++){const p=sunIn[i].p;out.length=0;for(const e of sunCand[i]){const dx=e.p[0]-p[0],dy=e.p[1]-p[1],dz=e.p[2]-p[2],r=e.radius,z=dx*fw[0]+dy*fw[1]+dz*fw[2];if(Math.abs(dx*R[0]+dy*R[1]+dz*R[2])<extent+r&&Math.abs(dx*U[0]+dy*U[1]+dz*U[2])<extent+r&&z+r>near&&z-r<far)out.push(e);}n+=out.length;}return n;});
console.log('   C identical counts',c0===c1,c0/sunIn.length|0,'casters/frame');
// ---- D. temporal coherence: how often does the main visible SET change, and how often would a margin cache be invalidated?
{let setChanges=0,orderOnly=0,prev=null;for(let i=0;i<I.length;i++){const s=vis(I[i],cand[i]);if(prev){const same=s.length===prev.length&&s.every((e,k)=>e===prev[k]);if(!same){setChanges++;const A=new Set(prev);if(s.length===prev.length&&s.every(e=>A.has(e)))orderOnly++;}}prev=s;}
 console.log('D0 main visible list changes on',(100*setChanges/(I.length-1)).toFixed(1)+'% of frames (order-only changes:',orderOnly+')');}
function marginCache(d,theta){
  // Reuse a superset list while |eye-eye0|<=d and angle(forward,forward0)<=theta; superset = sphere-vs-cone test with inflated margins.
  let cache=null,rebuilds=0,sizes=0,exact=0;const out=[];
  for(let i=0;i<I.length;i++){const q=I[i],f=q.axes.forward;
    const half=Math.atan(Math.hypot(aspect/q.f,1/q.f));
    const ok=cache&&Math.hypot(q.eye[0]-cache.eye[0],q.eye[1]-cache.eye[1],q.eye[2]-cache.eye[2])<=d&&Math.acos(Math.max(-1,Math.min(1,f[0]*cache.f[0]+f[1]*cache.f[1]+f[2]*cache.f[2])))+half<=cache.half;
    if(!ok){rebuilds++;const ranges=q.ranges.map(r=>r>0?r+d:r),list=index.query(q.eye,ranges),H=half+theta,cosH=Math.cos(H),sinH=Math.sin(H),sel=[];
      for(const e of list){const x=e.p[0]-q.eye[0],y=e.p[1]-q.eye[1],z=e.p[2]-q.eye[2],dist=Math.hypot(x,y,z),r=e.radius+d;if(dist<=r){sel.push(e);continue;}const along=(x*f[0]+y*f[1]+z*f[2])/dist,ang=Math.acos(Math.max(-1,Math.min(1,along)));if(ang<=H+Math.asin(Math.min(1,r/dist)))sel.push(e);}
      cache={eye:q.eye.slice(),f:f.slice(),half:H,list:sel};}
    sizes+=cache.list.length;exact+=vis(q,cand[i]).length;
    // conservative check: every exactly-visible entry must be in the cached superset
    if(i%25===0){const set=new Set(cache.list);for(const e of vis(q,cand[i]))if(!set.has(e)){console.log('   !! margin cache MISSED an entry at frame',i);break;}}
  }
  console.log(('D1 margin cache d='+d+'m theta='+(theta*180/Math.PI).toFixed(0)+'deg').padEnd(40),'rebuild rate',(100*rebuilds/I.length).toFixed(1)+'%','instances x'+(sizes/exact).toFixed(2),'vs exact');
}
for(const [d,t] of [[1,8],[2,12],[3,15],[4,20]])marginCache(d,t*Math.PI/180);
// ---- E. dynamic pack(): current vs. pooled direct write with cached outdoor flag.
bench('E0 current pack(dynamic) (avg '+Math.round(dyns.reduce((n,d)=>n+d.length,0)/dyns.length)+' meshes, every 10th frame list)',()=>{let n=0;for(let k=0;k<I.length;k++){const d=dyns[k%dyns.length];n+=X.pack(d.filter(m=>!m.overlay&&!m.fx),env,true).values.length;}return n;});
{const order=['box','sphere','cylinder','octa','ring','bevel','foliage'],code={box:0,sphere:1,cylinder:2,octa:3,ring:4,bevel:5,foliage:6};let cap=1024,buf=new Float32Array(cap*16);const counts=new Int32Array(7),starts=new Int32Array(7);
 const zones=env.outdoorZones;const outdoor=p=>{for(let i=0;i<zones.length;i++){const z=zones[i];if(Math.abs(p[0]-z.x)<=z.w*.5+.08&&Math.abs(p[2]-z.z)<=z.d*.5+.08)return true;}return false;};
 bench('E1 pooled counting-sort pack, no per-mesh arrays/closures',()=>{let n=0;for(let k=0;k<I.length;k++){const d=dyns[k%dyns.length];counts.fill(0);let total=0;for(const m of d){if(m.overlay||m.fx)continue;const c=code[m.shape||'box'];if(c===undefined)continue;counts[c]++;total++;}
   if(total>cap){while(cap<total)cap*=2;buf=new Float32Array(cap*16);}let o=0;for(let i=0;i<7;i++){starts[i]=o;o+=counts[i];}
   for(const m of d){if(m.overlay||m.fx)continue;const c=code[m.shape||'box'];if(c===undefined)continue;const j=(starts[c]++)*16,p=m.p||[0,0,0],s=m.s||[1,1,1],r=m.r||[0,0,0],col=m.color;
     const flags=(m.overlay?1:0)+((m.outdoor===undefined?((m.mat||0)>=8||outdoor(p)):!!m.outdoor)?2:0)+((m.overlay||m.surface==='object'||m.surface!=='architecture')?4:0);
     buf[j]=p[0];buf[j+1]=p[1];buf[j+2]=p[2];buf[j+3]=m.mat||0;buf[j+4]=s[0];buf[j+5]=s[1];buf[j+6]=s[2];buf[j+7]=m.emissive||0;buf[j+8]=r[0];buf[j+9]=r[1];buf[j+10]=r[2];buf[j+11]=flags;
     if(col){buf[j+12]=col[0];buf[j+13]=col[1];buf[j+14]=col[2];buf[j+15]=1;}else{buf[j+12]=buf[j+13]=buf[j+14]=buf[j+15]=0;}}
   n+=total*16;}return n;});}
{const zones=env.outdoorZones;let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;for(const e of index.entries){minX=Math.min(minX,e.p[0]);maxX=Math.max(maxX,e.p[0]);minZ=Math.min(minZ,e.p[2]);maxZ=Math.max(maxZ,e.p[2]);}
 const ox=Math.floor(minX)-2,oz=Math.floor(minZ)-2,gw=Math.ceil(maxX-minX)+5,gd=Math.ceil(maxZ-minZ)+5;
 // NOTE: a 1 m raster is only exact away from zone borders; the real fix stores the flag per actor/model root (see finding).
 const grid=new Uint8Array(gw*gd);for(let x=0;x<gw;x++)for(let z=0;z<gd;z++){const px=ox+x+.5,pz=oz+z+.5;grid[x*gd+z]=zones.some(q=>Math.abs(px-q.x)<=q.w*.5+.08&&Math.abs(pz-q.z)<=q.d*.5+.08)?1:0;}
 const code={box:0,sphere:1,cylinder:2,octa:3,ring:4,bevel:5,foliage:6};let cap=1024,buf=new Float32Array(cap*16);const counts=new Int32Array(7),starts=new Int32Array(7);
 const outdoor=p=>{const x=Math.floor(p[0])-ox,z=Math.floor(p[2])-oz;return x>=0&&z>=0&&x<gw&&z<gd&&grid[x*gd+z]===1;};
 bench('E2 pooled pack + O(1) outdoor raster lookup',()=>{let n=0;for(let k=0;k<I.length;k++){const d=dyns[k%dyns.length];counts.fill(0);let total=0;for(const m of d){if(m.overlay||m.fx)continue;const c=code[m.shape||'box'];if(c===undefined)continue;counts[c]++;total++;}
   if(total>cap){while(cap<total)cap*=2;buf=new Float32Array(cap*16);}let o=0;for(let i=0;i<7;i++){starts[i]=o;o+=counts[i];}
   for(const m of d){if(m.overlay||m.fx)continue;const c=code[m.shape||'box'];if(c===undefined)continue;const j=(starts[c]++)*16,p=m.p||[0,0,0],s=m.s||[1,1,1],r=m.r||[0,0,0],col=m.color;
     const flags=(m.overlay?1:0)+((m.outdoor===undefined?((m.mat||0)>=8||outdoor(p)):!!m.outdoor)?2:0)+((m.overlay||m.surface==='object'||m.surface!=='architecture')?4:0);
     buf[j]=p[0];buf[j+1]=p[1];buf[j+2]=p[2];buf[j+3]=m.mat||0;buf[j+4]=s[0];buf[j+5]=s[1];buf[j+6]=s[2];buf[j+7]=m.emissive||0;buf[j+8]=r[0];buf[j+9]=r[1];buf[j+10]=r[2];buf[j+11]=flags;
     if(col){buf[j+12]=col[0];buf[j+13]=col[1];buf[j+14]=col[2];buf[j+15]=1;}else{buf[j+12]=buf[j+13]=buf[j+14]=buf[j+15]=0;}}
   n+=total*16;}return n;});
 bench('E3 only the outdoorAt() calls of current pack (zones.some per mesh)',()=>{let n=0;for(let k=0;k<I.length;k++){const d=dyns[k%dyns.length];for(const m of d){if(m.overlay||m.fx)continue;if(m.outdoor===undefined&&!((m.mat||0)>=8)&&X.outdoorAt(m.p||[0,0,0],env))n++;}}return n;});}
// ---- F. packIndexed (static rows) current vs persistent buffer.
const shown=I.map((q,i)=>vis(q,cand[i]));
bench('F0 current packIndexed(shown) (new Float32Array + 7 buckets)',()=>{let n=0;for(const s of shown)n+=X.packIndexed(s).values.length;return n;});
{let cap=4096,buf=new Float32Array(cap*16);const counts=new Int32Array(7),starts=new Int32Array(7),code={box:0,sphere:1,cylinder:2,octa:3,ring:4,bevel:5,foliage:6};
 for(const e of index.entries)e.shapeCode=code[e.mesh.shape||'box']??-1;
 bench('F1 persistent buffer, counting sort by cached shape code',()=>{let n=0;for(const s of shown){counts.fill(0);for(const e of s)if(e.shapeCode>=0)counts[e.shapeCode]++;let o=0;for(let i=0;i<7;i++){starts[i]=o;o+=counts[i];}if(o>cap){while(cap<o)cap*=2;buf=new Float32Array(cap*16);}for(const e of s)if(e.shapeCode>=0)buf.set(e.row,(starts[e.shapeCode]++)*16);n+=o*16;}return n;});
 bench('F2 index indirection: Uint32 instance ids only (4 B/instance)',()=>{let n=0;const ids=new Uint32Array(1<<15);for(const s of shown){counts.fill(0);for(const e of s)if(e.shapeCode>=0)counts[e.shapeCode]++;let o=0;for(let i=0;i<7;i++){starts[i]=o;o+=counts[i];}for(const e of s)if(e.shapeCode>=0)ids[starts[e.shapeCode]++]=e.row[0];n+=o;}return n;});}
// ---- G. spatialIndex rebuild cost (updateWorld path) vs generation-stamp diff.
const once=(label,fn,reps=7)=>{let best=Infinity;for(let r=0;r<reps;r++){const t=performance.now();fn();best=Math.min(best,performance.now()-t);}console.log(label.padEnd(58),best.toFixed(2).padStart(8),'ms/call');};
once('G0 spatialIndex(meshes, env, previous) full rebuild',()=>X.spatialIndex(meshes,env,index));
{const m2=meshes.slice();once('G1 O(N) identity diff only (byMesh lookups, no buckets)',()=>{let changed=0;for(const m of m2)if(!index.byMesh.get(m))changed++;return changed;});
 let gen=0;for(const e of index.entries)e.gen=0;once('G2 O(N) generation stamp diff (e.gen=g, then sweep old)',()=>{gen++;let added=0,removed=0;for(const m of m2){const e=index.byMesh.get(m);if(e)e.gen=gen;else added++;}for(const e of index.entries)if(e.gen!==gen)removed++;return added+removed;});}
