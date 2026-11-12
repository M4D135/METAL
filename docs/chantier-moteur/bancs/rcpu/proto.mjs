// RCPU prototype: in-memory patch of src/renderer.js (commit 673d6b2) implementing the proposed CPU-side plan.
// Nothing in the repository is modified; scene({proto:...}) evaluates the patched text instead of the original.
// Flags: grid (dense CSR spatial grid), sun (allocation-free sun filter), cache (temporal margin caches for
// main/sun/torch static lists), pool (persistent typed arrays + capacity buffers with bufferSubData).
export function patchRenderer(src,{grid=true,sun=true,cache=true,pool=true,D=1,THETA=8,SUNM=4,expose=false}={}){
  const rep=(a,b)=>{const n=src.split(a).length-1;if(n!==1)throw new Error('proto: snippet found '+n+' times: '+a.slice(0,80));src=src.replace(a,()=>b);};
  if(expose)rep(`    function renderStatic(entries,slot,shadow=false){
      const cache=staticCaches[slot];`,`    function renderStatic(entries,slot,shadow=false){
      const cache=staticCaches[slot];stats['__slot'+slot]=entries;`);
  if(grid){
    rep(`  function spatialIndex(meshes,environment,previous){
    const levels=[new Map(),new Map(),new Map()],maxRadius=[0,0,0],entries=[],byMesh=new WeakMap();
    for(const mesh of meshes||[]){`,`  function spatialIndex(meshes,environment,previous){
    const maxRadius=[0,0,0],entries=[],byMesh=new WeakMap();
    for(const mesh of meshes||[]){`);
    rep(`      const retained=previous&&previous.byMesh.get(mesh),e=retained||metadata(mesh),key=Math.floor(e.p[0]/8)+','+Math.floor(e.p[2]/8),map=levels[e.detail];
      if(!map.has(key))map.set(key,[]);map.get(key).push(e);maxRadius[e.detail]=Math.max(maxRadius[e.detail],e.radius);`,
`      const retained=previous&&previous.byMesh.get(mesh),e=retained||metadata(mesh);maxRadius[e.detail]=Math.max(maxRadius[e.detail],e.radius);`);
    rep(`    function query(eye,ranges){
      const result=[];
      for(let level=0;level<3;level++){
        const range=ranges[level];if(!(range>0))continue;
        const radius=range+maxRadius[level];
        for(let x=Math.floor((eye[0]-radius)/8);x<=Math.floor((eye[0]+radius)/8);x++)for(let z=Math.floor((eye[2]-radius)/8);z<=Math.floor((eye[2]+radius)/8);z++){
          const bucket=levels[level].get(x+','+z);if(!bucket)continue;
          for(const e of bucket){const d=(e.p[0]-eye[0])**2+(e.p[1]-eye[1])**2+(e.p[2]-eye[2])**2;if(d<=(range+e.radius)**2)result.push(e);}
        }
      }
      return result;
    }`,`    // Dense CSR grid: 8 m cells, x-major then z, mesh order inside a cell = the former Map bucket order.
    let x0=0,z0=0,nx=0,nz=0;{let ax=Infinity,az=Infinity,bx=-Infinity,bz=-Infinity;for(const e of entries){const cx=Math.floor(e.p[0]/8),cz=Math.floor(e.p[2]/8);if(!Number.isFinite(cx)||!Number.isFinite(cz))continue;if(cx<ax)ax=cx;if(cx>bx)bx=cx;if(cz<az)az=cz;if(cz>bz)bz=cz;}if(ax<=bx){x0=ax;z0=az;nx=bx-ax+1;nz=bz-az+1;}}
    const levels=[0,1,2].map(level=>{const start=new Uint32Array(nx*nz+1),cellOf=new Int32Array(entries.length);let count=0;
      for(let i=0;i<entries.length;i++){const e=entries[i],cx=Math.floor(e.p[0]/8)-x0,cz=Math.floor(e.p[2]/8)-z0;cellOf[i]=-1;if(e.detail!==level||!(cx>=0&&cz>=0&&cx<nx&&cz<nz))continue;cellOf[i]=cx*nz+cz;start[cellOf[i]+1]++;count++;}
      for(let c=1;c<start.length;c++)start[c]+=start[c-1];
      const fill=start.slice(0,nx*nz),order=new Array(count),px=new Float64Array(count),py=new Float64Array(count),pz=new Float64Array(count),pr=new Float64Array(count);
      for(let i=0;i<entries.length;i++){const c=cellOf[i];if(c<0)continue;const k=fill[c]++,e=entries[i];order[k]=e;px[k]=e.p[0];py[k]=e.p[1];pz[k]=e.p[2];pr[k]=e.radius;}
      return {start,order,px,py,pz,pr,count};});
    function query(eye,ranges){
      const result=[];
      for(let level=0;level<3;level++){
        const range=ranges[level];if(!(range>0))continue;const L=levels[level];if(!L.count)continue;
        const radius=range+maxRadius[level],ex=eye[0],ey=eye[1],ez=eye[2];
        const ax=Math.max(0,Math.floor((ex-radius)/8)-x0),bx=Math.min(nx-1,Math.floor((ex+radius)/8)-x0),az=Math.max(0,Math.floor((ez-radius)/8)-z0),bz=Math.min(nz-1,Math.floor((ez+radius)/8)-z0);
        for(let x=ax;x<=bx;x++){const row=x*nz;for(let z=az;z<=bz;z++){const c=row+z;for(let k=L.start[c],end=L.start[c+1];k<end;k++){const dx=L.px[k]-ex,dy=L.py[k]-ey,dz=L.pz[k]-ez,r=range+L.pr[k];if(dx*dx+dy*dy+dz*dz<=r*r)result.push(L.order[k]);}}}
      }
      return result;
    }`);
  }
  if(pool){
    // Persistent per-call-site scratch rows; values are a subarray of a grow-only Float32Array.
    rep(`  function pack(meshes,environment,objects=false) {
    const grouped=names.map(()=>[]);
    for(const mesh of meshes||[]) {
      const i=names.indexOf(mesh.shape||'box');
      if(i>=0) grouped[i].push(mesh);
    }
    const count=grouped.reduce((n,g)=>n+g.length,0),values=new Float32Array(count*16),groups=[];
    let offset=0;
    for(let i=0;i<names.length;i++) {
      const list=grouped[i];
      if(list.length) groups.push({name:names[i],offset:offset*4,count:list.length});
      for(const mesh of list) {
        const p=mesh.p||[0,0,0],s=mesh.s||[1,1,1],r=mesh.r||[0,0,0],c=mesh.color||[0,0,0];
        values.set([p[0],p[1],p[2],mesh.mat||0,s[0],s[1],s[2],mesh.emissive||0,r[0],r[1],r[2],surfaceFlags(mesh,environment,objects),c[0],c[1],c[2],mesh.color?1:0],offset);
        offset+=16;
      }
    }
    return {values,groups};
  }`,`  const SHAPE={box:0,sphere:1,cylinder:2,octa:3,ring:4,bevel:5,foliage:6},ZERO3=[0,0,0],ONE3=[1,1,1];
  function scratchRows(){return {data:new Float32Array(1024*16),counts:new Int32Array(7),starts:new Int32Array(7),codes:new Int8Array(1024)};}
  function rowsFor(scratch,count){if(scratch.data.length<count*16){let n=scratch.data.length/16;while(n<count)n*=2;scratch.data=new Float32Array(n*16);scratch.codes=new Int8Array(n);}return scratch.data;}
  function pack(meshes,environment,objects=false,scratch=null) {
    const list=meshes||[];if(!scratch)scratch=scratchRows();
    if(scratch.codes.length<list.length)rowsFor(scratch,list.length);
    const counts=scratch.counts,starts=scratch.starts;counts.fill(0);let count=0;
    for(let k=0;k<list.length;k++){const code=SHAPE[list[k].shape||'box'];const c=code===undefined?-1:code;scratch.codes[k]=c;if(c>=0){counts[c]++;count++;}}
    const data=rowsFor(scratch,count),groups=[];let offset=0;
    for(let i=0;i<7;i++){starts[i]=offset;if(counts[i])groups.push({name:names[i],offset:offset*64,count:counts[i]});offset+=counts[i];}
    for(let k=0;k<list.length;k++){const c=scratch.codes[k];if(c<0)continue;const mesh=list[k],j=(starts[c]++)*16,p=mesh.p||ZERO3,s=mesh.s||ONE3,r=mesh.r||ZERO3,col=mesh.color;
      data[j]=p[0];data[j+1]=p[1];data[j+2]=p[2];data[j+3]=mesh.mat||0;data[j+4]=s[0];data[j+5]=s[1];data[j+6]=s[2];data[j+7]=mesh.emissive||0;data[j+8]=r[0];data[j+9]=r[1];data[j+10]=r[2];data[j+11]=surfaceFlags(mesh,environment,objects);
      if(col){data[j+12]=col[0];data[j+13]=col[1];data[j+14]=col[2];data[j+15]=1;}else{data[j+12]=data[j+13]=data[j+14]=data[j+15]=0;}}
    return {values:data.subarray(0,count*16),groups};
  }`);
    rep(`  function outdoorAt(p,environment){
    return !!environment&&environment.outdoorZones.some(zone=>Math.abs(p[0]-zone.x)<=zone.w*.5+.08&&Math.abs(p[2]-zone.z)<=zone.d*.5+.08);
  }`,`  function outdoorAt(p,environment){
    if(!environment)return false;const zones=environment.outdoorZones;
    for(let i=0;i<zones.length;i++){const zone=zones[i];if(Math.abs(p[0]-zone.x)<=zone.w*.5+.08&&Math.abs(p[2]-zone.z)<=zone.d*.5+.08)return true;}return false;
  }`);
    rep(`  function packIndexed(entries){
    const buckets=names.map(()=>[]);for(const e of entries){const i=names.indexOf(e.mesh.shape||'box');if(i>=0)buckets[i].push(e);}
    const values=new Float32Array(entries.length*16),groups=[];let offset=0;
    for(let i=0;i<names.length;i++)if(buckets[i].length){groups.push({name:names[i],offset:offset*4,count:buckets[i].length});for(const e of buckets[i]){values.set(e.row,offset);offset+=16;}}
    return {values,groups};
  }`,`  function packIndexed(entries,scratch=null){
    if(!scratch)scratch=scratchRows();const counts=scratch.counts,starts=scratch.starts;counts.fill(0);let count=0;
    for(const e of entries){if(e.shapeCode===undefined)e.shapeCode=SHAPE[e.mesh.shape||'box']??-1;if(e.shapeCode>=0){counts[e.shapeCode]++;count++;}}
    const data=rowsFor(scratch,count),groups=[];let offset=0;
    for(let i=0;i<7;i++){starts[i]=offset;if(counts[i])groups.push({name:names[i],offset:offset*64,count:counts[i]});offset+=counts[i];}
    for(const e of entries)if(e.shapeCode>=0)data.set(e.row,(starts[e.shapeCode]++)*16);
    return {values:data.subarray(0,count*16),groups};
  }`);
    // Capacity-managed uploads: grow-only bufferData(size) then bufferSubData(0, rows).
    rep(`    function renderBatch(batch,buffer,upload,shadowPass=false) {
      if(!batch.groups.length) return;
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      if(upload){gl.bufferData(gl.ARRAY_BUFFER,batch.values,gl.DYNAMIC_DRAW);stats.uploadBytes+=batch.values.byteLength;}`,
`    const capacity=new Map();
    function uploadRows(buffer,values){
      let cap=capacity.get(buffer)||0;
      if(values.byteLength>cap){cap=Math.max(65536,values.byteLength,cap*2);gl.bufferData(gl.ARRAY_BUFFER,cap,gl.DYNAMIC_DRAW);capacity.set(buffer,cap);}
      gl.bufferSubData(gl.ARRAY_BUFFER,0,values);stats.uploadBytes+=values.byteLength;
    }
    const dynamicRows=scratchRows(),overlayRows=scratchRows();
    function renderBatch(batch,buffer,upload,shadowPass=false) {
      if(!batch.groups.length) return;
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      if(upload)uploadRows(buffer,batch.values);`);
    rep(`      const same=cache.entries.length===entries.length&&entries.every((entry,i)=>entry===cache.entries[i]);
      if(!same){cache.entries=entries;cache.batch=packIndexed(entries);}`,`      const same=cache.entries===entries||cache.entries.length===entries.length&&entries.every((entry,i)=>entry===cache.entries[i]);
      if(!same){cache.entries=entries;cache.batch=packIndexed(entries,cache.rows||(cache.rows=scratchRows()));}`);
    rep(`      if(stats.contextLost||disposed) return;
      gl.bindBuffer(gl.ARRAY_BUFFER,worldBuffer);gl.bufferData(gl.ARRAY_BUFFER,worldBatch.values,gl.STATIC_DRAW);`,`      if(stats.contextLost||disposed) return;
      gl.bindBuffer(gl.ARRAY_BUFFER,worldBuffer);gl.bufferData(gl.ARRAY_BUFFER,worldBatch.values,gl.STATIC_DRAW);capacity.delete(worldBuffer);`);
    rep(`      const dynamicBatch=pack(ordinary,environment,true);`,`      const dynamicBatch=pack(ordinary,environment,true,dynamicRows);`);
    rep(`      if(dynamicBatch.values.length){gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,dynamicBatch.values,gl.DYNAMIC_DRAW);stats.uploadBytes+=dynamicBatch.values.byteLength;}`,
        `      if(dynamicBatch.values.length){gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);uploadRows(dynamicBuffer,dynamicBatch.values);}`);
    rep(`if(overlay.length)renderBatch(pack(overlay,environment,true),overlayBuffer,true);`,`if(overlay.length)renderBatch(pack(overlay,environment,true,overlayRows),overlayBuffer,true);`);
  }
  if(sun||cache){
    rep(`      const casters=worldIndex.query(center,[extent+24,26,0]).filter(e=>{
        const d=e.p.map((v,k)=>v-p[k]),along=a=>d[0]*a[0]+d[1]*a[1]+d[2]*a[2],z=along(fw);
        return Math.abs(along(r))<extent+e.radius&&Math.abs(along(u))<extent+e.radius&&z+e.radius>near&&z-e.radius<far;
      });`,cache?`      // Superset reused while the snapped centre moves less than M along each light axis.
      const M=${SUNM};let casters;const q=sunCache,dc=q&&[center[0]-q.center[0],center[1]-q.center[1],center[2]-q.center[2]];
      if(q&&q.revision===worldRevision&&q.extent===extent&&Math.abs(dc[0]*r[0]+dc[1]*r[1]+dc[2]*r[2])<=M&&Math.abs(dc[0]*u[0]+dc[1]*u[1]+dc[2]*u[2])<=M&&Math.abs(dc[0]*fw[0]+dc[1]*fw[1]+dc[2]*fw[2])<=M)casters=q.list;
      else{casters=[];const grow=M*1.74;for(const e of worldIndex.query(center,[extent+24+grow,26+grow,0])){const dx=e.p[0]-p[0],dy=e.p[1]-p[1],dz=e.p[2]-p[2],rr=e.radius,z=dx*fw[0]+dy*fw[1]+dz*fw[2];
        if(Math.abs(dx*r[0]+dy*r[1]+dz*r[2])<extent+M+rr&&Math.abs(dx*u[0]+dy*u[1]+dz*u[2])<extent+M+rr&&z+rr>near-M&&z-rr<far+M)casters.push(e);}
        sunCache={revision:worldRevision,extent,center:center.slice(),list:casters};}`:
`      const casters=[];for(const e of worldIndex.query(center,[extent+24,26,0])){const dx=e.p[0]-p[0],dy=e.p[1]-p[1],dz=e.p[2]-p[2],rr=e.radius,z=dx*fw[0]+dy*fw[1]+dz*fw[2];
        if(Math.abs(dx*r[0]+dy*r[1]+dz*r[2])<extent+rr&&Math.abs(dx*u[0]+dy*u[1]+dz*u[2])<extent+rr&&z+rr>near&&z-rr<far)casters.push(e);}`);
  }
  if(cache){
    rep(`    let staticCaches=[],lampCasters=[],actorLightPlan=null;`,`    let staticCaches=[],lampCasters=[],actorLightPlan=null,sunCache=null,torchCache=null,mainCache=null;
    const MARGIN=${D},TURN=${THETA}*Math.PI/180;
    // Conservative cone superset: sphere(c, r+MARGIN) against cone(eye, forward, half+TURN). Valid for any camera
    // within MARGIN metres and TURN radians of the build pose (translation covered by the radius inflation).
    function coneSelect(list,eye,forward,half,out){
      const cosH=Math.cos(half);
      for(const e of list){const x=e.p[0]-eye[0],y=e.p[1]-eye[1],z=e.p[2]-eye[2],d=Math.sqrt(x*x+y*y+z*z),rr=e.radius+MARGIN;
        if(d<=rr){out.push(e);continue;}const c=(x*forward[0]+y*forward[1]+z*forward[2])/d;
        if(c>=cosH||Math.acos(Math.max(-1,Math.min(1,c)))<=half+Math.asin(Math.min(1,rr/d)))out.push(e);}
      return out;
    }
    function coneValid(q,eye,forward,half){
      if(!q||q.revision!==worldRevision)return false;const dx=eye[0]-q.eye[0],dy=eye[1]-q.eye[1],dz=eye[2]-q.eye[2];
      if(dx*dx+dy*dy+dz*dz>MARGIN*MARGIN)return false;const c=forward[0]*q.forward[0]+forward[1]*q.forward[1]+forward[2]*q.forward[2];
      return Math.acos(Math.max(-1,Math.min(1,c)))+half<=q.half;
    }`);
    rep(`      const casters=stable?previous.entries:worldIndex.query(p,[32,18,0]).filter(e=>visible(e,p,shadowAxes,tangent,tangent,32));`,
`      let casters;
      if(stable)casters=previous.entries;
      else if(torchAxes){const half=Math.atan(Math.SQRT2*tangent);
        if(coneValid(torchCache,p,fw,half))casters=torchCache.list;
        else{casters=coneSelect(worldIndex.query(p,[32+MARGIN,18+MARGIN,0]),p,fw,half+TURN,[]);torchCache={revision:worldRevision,eye:p.slice(),forward:fw.slice(),half:half+TURN,list:casters};}}
      else casters=worldIndex.query(p,[32,18,0]).filter(e=>visible(e,p,shadowAxes,tangent,tangent,32));`);
    rep(`      const candidates=worldIndex.query(eye,ranges);
      const shown=candidates.filter(e=>visible(e,eye,axes,canvas.width/canvas.height/f,1/f,ranges[0]));`,
`      let shown;{const half=Math.atan(Math.hypot(canvas.width/canvas.height/f,1/f)),q=mainCache;
        if(coneValid(q,eye,forward,half)&&ranges.every((v,k)=>v<=q.ranges[k]))shown=q.list;
        else{shown=coneSelect(worldIndex.query(eye,ranges.map(v=>v>0?v+MARGIN:v)),eye,forward,half+TURN,[]);mainCache={revision:worldRevision,eye:eye.slice(),forward:forward.slice(),half:half+TURN,ranges:ranges.slice(),list:shown};}}`);
  }
  return src;
}
