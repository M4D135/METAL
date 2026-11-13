// RCPU-01/03/05 contre-verification sur les VRAIES fonctions du renderer (exportees en memoire),
// avec des traces de camera de vitesses de rotation differentes.
// usage: node v-static.mjs <ferro> [world=camp:17] [frames=1500] [profiles=sweep45,sweep12,flick,still]
import {load,cameraTrace,quant,makeWorld} from './lib.mjs';
const root=process.argv[2],spec=process.argv[3]||'camp:17',frames=+(process.argv[4]||1500),profiles=(process.argv[5]||'sweep45,sweep12,flick,still').split(',');
const win=load(root,{internals:true});const X=win.__x;
const {world,sim}=makeWorld(win,spec);
const env=X.environmentInfo(world.environment),meshes=sim.destruction?.meshes||world.meshes;
const index=X.spatialIndex(meshes,env);
const W=1789,H=1006,aspect=W/H; // backing store of the harness (1280x720 css, dpr 2, auto)
console.log('world',spec,'entries',index.entries.length,'levels',[0,1,2].map(l=>index.entries.filter(e=>e.detail===l).length).join('/'));
const sun=env.sunDirection,sfw=sun.map(v=>-v),slen=Math.hypot(sfw[0],sfw[2]),SR=slen>.0001?[-sfw[2]/slen,0,sfw[0]/slen]:[1,0,0],SU=[SR[1]*sfw[2]-SR[2]*sfw[1],SR[2]*sfw[0]-SR[0]*sfw[2],SR[0]*sfw[1]-SR[1]*sfw[0]];
function frameInfo(cam){
  const axes=X.cameraAxes(cam),fov=Math.max(40,Math.min(110,cam.fov||75))*Math.PI/180,f=1/Math.tan(fov*.5);
  const ranges=X.detailRanges('auto');ranges[0]=X.extendedDistance(ranges[0],env,cam.pos);
  const eye=cam.pos.slice(),h=aspect/f,v=1/f;
  const extent=28,center=[eye[0]+axes.forward[0]*8,eye[1]+1.4,eye[2]+axes.forward[2]*8];
  const texel=extent*2/512,dot=a=>a[0]*center[0]+a[1]*center[1]+a[2]*center[2];
  const xs=Math.round(dot(SR)/texel)*texel-dot(SR),ys=Math.round(dot(SU)/texel)*texel-dot(SU);for(let k=0;k<3;k++)center[k]+=SR[k]*xs+SU[k]*ys;
  const sp=center.map((x,k)=>x+sun[k]*55);
  const torch=eye.map((x,i)=>x+axes.right[i]*.16-axes.up[i]*.08);
  return {cam,axes,f,h,v,ranges,eye,center,sp,torch};
}
const exactMain=q=>index.query(q.eye,q.ranges).filter(e=>X.visible(e,q.eye,q.axes,q.h,q.v,q.ranges[0]));
const sunFilterOrig=(q,list)=>list.filter(e=>{const d=e.p.map((v,k)=>v-q.sp[k]),along=a=>d[0]*a[0]+d[1]*a[1]+d[2]*a[2],z=along(sfw);return Math.abs(along(SR))<28+e.radius&&Math.abs(along(SU))<28+e.radius&&z+e.radius>1&&z-e.radius<115;});
function sunFilterScalar(q,list,out){out.length=0;const px=q.sp[0],py=q.sp[1],pz=q.sp[2];for(let i=0;i<list.length;i++){const e=list[i],p=e.p,dx=p[0]-px,dy=p[1]-py,dz=p[2]-pz,r=e.radius,z=dx*sfw[0]+dy*sfw[1]+dz*sfw[2];if(Math.abs(dx*SR[0]+dy*SR[1]+dz*SR[2])<28+r&&Math.abs(dx*SU[0]+dy*SU[1]+dz*SU[2])<28+r&&z+r>1&&z-r<115)out.push(e);}return out;}
// ---- dense CSR grid, written independently; same cell order as the Map (insertion order inside a cell)
function csr(entries){
  let ax=Infinity,az=Infinity,bx=-Infinity,bz=-Infinity;for(const e of entries){const cx=Math.floor(e.p[0]/8),cz=Math.floor(e.p[2]/8);if(cx<ax)ax=cx;if(cx>bx)bx=cx;if(cz<az)az=cz;if(cz>bz)bz=cz;}
  const nx=bx-ax+1,nz=bz-az+1,maxR=[0,0,0];
  const L=[0,1,2].map(level=>{const start=new Int32Array(nx*nz+1);let n=0;for(const e of entries)if(e.detail===level){start[(Math.floor(e.p[0]/8)-ax)*nz+Math.floor(e.p[2]/8)-az+1]++;n++;maxR[level]=Math.max(maxR[level],e.radius);}
    for(let c=1;c<start.length;c++)start[c]+=start[c-1];const fill=start.slice(),order=new Array(n),px=new Float64Array(n),py=new Float64Array(n),pz=new Float64Array(n),pr=new Float64Array(n);
    for(const e of entries)if(e.detail===level){const k=fill[(Math.floor(e.p[0]/8)-ax)*nz+Math.floor(e.p[2]/8)-az]++;order[k]=e;px[k]=e.p[0];py[k]=e.p[1];pz[k]=e.p[2];pr[k]=e.radius;}
    return {start,order,px,py,pz,pr};});
  return function query(eye,ranges,out){out.length=0;const ex=eye[0],ey=eye[1],ez=eye[2];
    for(let level=0;level<3;level++){const range=ranges[level];if(!(range>0))continue;const G=L[level],rad=range+maxR[level];
      const x0=Math.max(0,Math.floor((ex-rad)/8)-ax),x1=Math.min(nx-1,Math.floor((ex+rad)/8)-ax),z0=Math.max(0,Math.floor((ez-rad)/8)-az),z1=Math.min(nz-1,Math.floor((ez+rad)/8)-az);
      for(let x=x0;x<=x1;x++){const row=x*nz;for(let z=z0;z<=z1;z++){const c=row+z;for(let k=G.start[c],end=G.start[c+1];k<end;k++){const dx=G.px[k]-ex,dy=G.py[k]-ey,dz=G.pz[k]-ez,r=range+G.pr[k];if(dx*dx+dy*dy+dz*dz<=r*r)out.push(G.order[k]);}}}}
    return out;};
}
const tb=performance.now();const cq=csr(index.entries);const csrBuild=performance.now()-tb;
// ---- caches: cone (proto RCPU-01) and inflated frustum (alternative)
function rotAngle(a,b){const tr=a.right[0]*b.right[0]+a.right[1]*b.right[1]+a.right[2]*b.right[2]+a.up[0]*b.up[0]+a.up[1]*b.up[1]+a.up[2]*b.up[2]+a.forward[0]*b.forward[0]+a.forward[1]*b.forward[1]+a.forward[2]*b.forward[2];return Math.acos(Math.max(-1,Math.min(1,(tr-1)/2)));}
function coneCache(D,TH){let q=null;return {name:'cone D='+D+' th='+(TH*180/Math.PI).toFixed(0),get(I){
  const half=Math.atan(Math.hypot(I.h,I.v)),fw=I.axes.forward;
  if(q){const dx=I.eye[0]-q.eye[0],dy=I.eye[1]-q.eye[1],dz=I.eye[2]-q.eye[2],c=fw[0]*q.fw[0]+fw[1]*q.fw[1]+fw[2]*q.fw[2];
    if(dx*dx+dy*dy+dz*dz<=D*D&&Math.acos(Math.max(-1,Math.min(1,c)))+half<=q.half&&I.ranges.every((v,k)=>v<=q.ranges[k]))return [q.list,false];}
  const H=half+TH,cosH=Math.cos(H),list=[];
  for(const e of index.query(I.eye,I.ranges.map(v=>v>0?v+D:v))){const x=e.p[0]-I.eye[0],y=e.p[1]-I.eye[1],z=e.p[2]-I.eye[2],d=Math.sqrt(x*x+y*y+z*z),rr=e.radius+D;if(d<=rr){list.push(e);continue;}const c=(x*fw[0]+y*fw[1]+z*fw[2])/d;if(c>=cosH||Math.acos(Math.max(-1,Math.min(1,c)))<=H+Math.asin(Math.min(1,rr/d)))list.push(e);}
  q={eye:I.eye.slice(),fw:fw.slice(),half:H,ranges:I.ranges.slice(),list};return [list,true];}};}
function frustumCache(D,TH){let q=null;const S=2*Math.sin(TH/2);return {name:'frustum D='+D+' th='+(TH*180/Math.PI).toFixed(0),get(I){
  if(q){const dx=I.eye[0]-q.eye[0],dy=I.eye[1]-q.eye[1],dz=I.eye[2]-q.eye[2];
    if(dx*dx+dy*dy+dz*dz<=D*D&&rotAngle(I.axes,q.axes)<=TH&&I.h<=q.h&&I.v<=q.v&&I.ranges.every((v,k)=>v<=q.ranges[k]))return [q.list,false];}
  const {right:r,up:u,forward:f}=I.axes,h=I.h,v=I.v,nh=Math.sqrt(1+h*h),nv=Math.sqrt(1+v*v),far=I.ranges[0],list=[];
  for(const e of index.query(I.eye,I.ranges.map(x=>x>0?x+D:x))){const x=e.p[0]-I.eye[0],y=e.p[1]-I.eye[1],d=e.p[2]-I.eye[2],L=Math.sqrt(x*x+y*y+d*d),m=e.radius+D+S*L;
    const z=x*f[0]+y*f[1]+d*f[2],xr=x*r[0]+y*r[1]+d*r[2],yu=x*u[0]+y*u[1]+d*u[2];
    if(z+m>.04&&z-m<far&&(Math.abs(xr)-z*h)/nh<=m&&(Math.abs(yu)-z*v)/nv<=m)list.push(e);}
  q={eye:I.eye.slice(),axes:{right:r.slice(),up:u.slice(),forward:f.slice()},h,v,ranges:I.ranges.slice(),list};return [list,true];}};}
for(const profile of profiles){
  const cams=cameraTrace(world,sim,{frames,profile});const I=cams.map(frameInfo);
  // angular speed stats
  const ang=[];for(let i=1;i<I.length;i++)ang.push(rotAngle(I[i].axes,I[i-1].axes)*180/Math.PI*60);
  const exact=I.map(exactMain);
  let changes=0;for(let i=1;i<exact.length;i++){const a=exact[i],b=exact[i-1];if(a.length!==b.length||a.some((e,k)=>e!==b[k]))changes++;}
  console.log('\n== profile',profile,'| camera angular speed deg/s',JSON.stringify(quant(ang)),'| exact main list changes on',(100*changes/(I.length-1)).toFixed(1)+'% of frames, mean size',(exact.reduce((n,a)=>n+a.length,0)/exact.length).toFixed(0));
  for(const mk of [()=>coneCache(1,8*Math.PI/180),()=>frustumCache(1,8*Math.PI/180),()=>frustumCache(1,4*Math.PI/180),()=>frustumCache(.5,4*Math.PI/180)]){
    const C=mk();let rebuilds=0,size=0,miss=0;
    for(let i=0;i<I.length;i++){const [list,rb]=C.get(I[i]);if(rb)rebuilds++;size+=list.length;if(i%5===0){const set=new Set(list);for(const e of exact[i])if(!set.has(e)){miss++;}}}
    const ex=exact.reduce((n,a)=>n+a.length,0);
    console.log('  ',C.name.padEnd(22),'rebuild',(100*rebuilds/I.length).toFixed(1).padStart(5)+'%','size x'+(size/ex).toFixed(3),'misses(sampled 1/5, incl. original false positives)',miss);
  }
  if(profile!==profiles[0])continue;
  // ---- timing, interleaved, 7 reps: query Map vs CSR (main, sun, torch), sun filter closure vs scalar
  const out=[],out2=[],T={qMap:[],qCSR:[],sunMap:[],sunCSR:[],torchMap:[],torchCSR:[],sunF0:[],sunF1:[],mainF:[]};
  let same=true;for(const q of I.slice(0,300)){const a=index.query(q.eye,q.ranges),b=cq(q.eye,q.ranges,out);if(a.length!==b.length||a.some((e,k)=>e!==b[k])){same=false;break;}const c=index.query(q.center,[52,26,0]),d=cq(q.center,[52,26,0],out);if(c.length!==d.length||c.some((e,k)=>e!==d[k])){same=false;break;}}
  let sameSun=true;for(const q of I.slice(0,300)){const c=index.query(q.center,[52,26,0]),a=sunFilterOrig(q,c),b=sunFilterScalar(q,c,out2);if(a.length!==b.length||a.some((e,k)=>e!==b[k])){sameSun=false;break;}}
  const time=(fn)=>{const t=performance.now();fn();return (performance.now()-t)/I.length*1000;};
  const sunCand=I.map(q=>index.query(q.center,[52,26,0]));
  for(let rep=0;rep<7;rep++){
    const order=rep%2?['b','a']:['a','b'];
    for(const o of order){
      if(o==='a'){T.qMap.push(time(()=>{for(const q of I)index.query(q.eye,q.ranges);}));T.sunMap.push(time(()=>{for(const q of I)index.query(q.center,[52,26,0]);}));T.torchMap.push(time(()=>{for(const q of I)index.query(q.torch,[32,18,0]);}));T.sunF0.push(time(()=>{for(let i=0;i<I.length;i++)sunFilterOrig(I[i],sunCand[i]);}));}
      else{T.qCSR.push(time(()=>{for(const q of I)cq(q.eye,q.ranges,out);}));T.sunCSR.push(time(()=>{for(const q of I)cq(q.center,[52,26,0],out);}));T.torchCSR.push(time(()=>{for(const q of I)cq(q.torch,[32,18,0],out);}));T.sunF1.push(time(()=>{for(let i=0;i<I.length;i++)sunFilterScalar(I[i],sunCand[i],out2);}));}
    }
    T.mainF.push(time(()=>{for(let i=0;i<I.length;i++){const q=I[i];index.query(q.eye,q.ranges).filter(e=>X.visible(e,q.eye,q.axes,q.h,q.v,q.ranges[0]));}}));
  }
  const med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1];
  console.log('  timing (median of 7 reps, us/frame): main query Map',med(T.qMap).toFixed(1),'CSR',med(T.qCSR).toFixed(1),'| sun query Map',med(T.sunMap).toFixed(1),'CSR',med(T.sunCSR).toFixed(1),'| torch query Map',med(T.torchMap).toFixed(1),'CSR',med(T.torchCSR).toFixed(1));
  console.log('  sun filter closure',med(T.sunF0).toFixed(1),'scalar',med(T.sunF1).toFixed(1),'| main query+filter(visible)',med(T.mainF).toFixed(1),'| CSR identical order',same,'sun filter identical',sameSun,'| CSR build ms',csrBuild.toFixed(2),'| sun candidates/frame',(sunCand.reduce((n,a)=>n+a.length,0)/sunCand.length).toFixed(0));
}
