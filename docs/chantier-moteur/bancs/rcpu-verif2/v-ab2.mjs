// Contre-verification RCPU-01/03/04/05 : A/B apparie par image, temps CPU du processus (process.cpuUsage, insensible a la preemption)
// + mediane d'horloge ; ordre A/B alterne une image sur deux ; controle qualite : extras du sur-ensemble DANS le frustum exact.
// usage: node v-cache.mjs <root> frames world quality flags sweep speed
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {scene,GLC,fakeGL} from '../rcpu/harness.mjs';
import {patchRenderer} from '../rcpu/proto.mjs';
const [root,framesS='1200',worldS='camp:17',quality='auto',flagsS='cache',sweepS='45',speedS='7']=process.argv.slice(2);
const frames=+framesS,[kind,idx]=worldS.split(':'),flags=flagsS.split(','),sweep=+sweepS,speed=+speedS;
const opt={grid:flags.includes('grid'),sun:flags.includes('sun'),cache:flags.includes('cache'),pool:flags.includes('pool'),D:1,THETA:8,SUNM:4,expose:true};
const S=scene(root,{world:[kind,+idx],quality,wrap:false,proto:{grid:false,sun:false,cache:false,pool:false,expose:true}});
// second ORIGINAL renderer (A) and prototype (B), both outside the scene so that they are timed symmetrically
const mk=o=>{const win={innerWidth:1280,innerHeight:720,devicePixelRatio:2};vm.runInThisContext('(function(window){'+patchRenderer(readFileSync(root+'/src/renderer.js','utf8'),o)+'\n})',{filename:'r-'+(o.cache?'B':'A')+'.js'})(win);
  const gl=fakeGL(),canvas={width:300,height:150,clientWidth:1280,clientHeight:720,getContext:()=>gl,addEventListener(){},removeEventListener(){}};const R=win.FRender.create(canvas);R.resize(quality);
  const d0=S.sim.destruction;R.setWorld(d0?.meshes||S.world.meshes,d0?.lights||S.world.lights,S.world.environment);return {R,canvas};};
const A=mk({grid:false,sun:false,cache:false,pool:false,expose:true}),Bp=mk(opt);
let rev=S.sim.state.destructionRevision??S.sim.destruction?.revision;
const cpu=()=>{const u=process.threadCpuUsage();return u.user+u.system;};
const acc={A:{cpu:0,wall:[],cpus:[],up:0,inst:0,bd:0},B:{cpu:0,wall:[],cpus:[],up:0,inst:0,bd:0}};
const axesOf=c=>{const y=c.yaw||0,p=c.pitch||0,ro=c.roll||0,cy=Math.cos(y),sy=Math.sin(y),cp=Math.cos(p),sp=Math.sin(p),cr=Math.cos(ro),sr=Math.sin(ro),r=[cy,0,sy],u=[-sy*sp,cp,cy*sp];return {right:r.map((v,i)=>v*cr+u[i]*sr),up:u.map((v,i)=>v*cr-r[i]*sr),forward:[sy*cp,sp,-cy*cp]};};
const vis=(e,eye,axes,h,v,far)=>{const x=e.p[0]-eye[0],y=e.p[1]-eye[1],d=e.p[2]-eye[2],f=axes.forward,right=axes.right,up=axes.up;const z=x*f[0]+y*f[1]+d*f[2],r=e.radius;return z+r>.04&&z-r<far&&Math.abs(x*right[0]+y*right[1]+d*right[2])<=z*h+r*Math.sqrt(1+h*h)&&Math.abs(x*up[0]+y*up[1]+d*up[2])<=z*v+r*Math.sqrt(1+v*v);};
let missing=0,extraIn=[0,0,0],extraInFrames=0,baseN=0,protoN=0,rebuilds=0,prevList=null,extraDist=[];
for(let i=0;i<frames+120;i++){
  const r=S.frame(1/60,{tour:true,sweep,speed});
  const d=S.sim.destruction,revision=S.sim.state.destructionRevision??d?.revision;
  if(revision!==rev){A.R.updateWorld(d.meshes,revision,d.lights);Bp.R.updateWorld(d.meshes,revision,d.lights);rev=revision;}
  const order=i%2?[['B',Bp],['A',A]]:[['A',A],['B',Bp]];
  for(const [k,X] of order){const g0=GLC.instances,b0=GLC.bufferData;const c0=cpu(),t0=performance.now();X.R.draw(r.camera,r.list,r.fx);const t1=performance.now(),c1=cpu();
    if(i>=120){const q=acc[k];q.cpu+=c1-c0;q.cpus.push(c1-c0);q.wall.push(t1-t0);q.up+=X.R.stats.uploadBytes;q.inst+=GLC.instances-g0;q.bd+=GLC.bufferData-b0;}}
  if(i<120)continue;
  const a=A.R.stats.__slot0,b=Bp.R.stats.__slot0;if(!a||!b)continue;
  if(b!==prevList){rebuilds++;prevList=b;}
  const setA=new Set(a),setB=new Set(b.map(e=>e.mesh));baseN+=a.length;protoN+=b.length;
  // entries are per-renderer objects: compare by mesh identity
  const meshA=new Set(a.map(e=>e.mesh));for(const e of a)if(!setB.has(e.mesh))missing++;
  const cam=r.camera,ax=axesOf(cam),fov=Math.max(40,Math.min(110,cam.fov||75))*Math.PI/180,f=1/Math.tan(fov*.5),asp=Bp.canvas.width/Bp.canvas.height;
  const t=r.fx.time||0;const eye=cam.pos; // shake=0 in harness
  let any=false;for(const e of b){if(meshA.has(e.mesh))continue;if(vis(e,eye,ax,asp/f,1/f,180)){extraIn[e.detail]++;any=true;if(extraDist.length<4000)extraDist.push([e.detail,Math.hypot(e.p[0]-eye[0],e.p[1]-eye[1],e.p[2]-eye[2])-e.radius]);}}
  if(any)extraInFrames++;
}
const med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1],p99=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length*.99)];
const n=acc.A.wall.length;
for(const k of ['A','B']){const q=acc[k];console.log(k==='A'?'original':'proto   ','cpu µs/img',(q.cpu/n).toFixed(0),'| wall p50 ms',med(q.wall).toFixed(3),'p99',p99(q.wall).toFixed(2),'| uploadKB/img',(q.up/n/1024).toFixed(1),'bufferData/img',(q.bd/n).toFixed(2),'inst/img',(q.inst/n).toFixed(0));}
{const r=acc.A.cpus.map((a,i)=>Math.log((acc.B.cpus[i]+1)/(a+1))).sort((x,y)=>x-y);console.log('main-thread cpu: median A',med(acc.A.cpus),'µs, median B',med(acc.B.cpus),'µs | median paired ratio B/A',Math.exp(r[r.length>>1]).toFixed(3),'| share of frames B<A',(r.filter(x=>x<0).length/r.length).toFixed(2));}
console.log('world',worldS,quality,'flags',flagsS,'sweep',sweep,'speed',speed,'frames',n,'| cpu ratio B/A',(acc.B.cpu/acc.A.cpu).toFixed(3),'| wall p50 ratio',(med(acc.B.wall)/med(acc.A.wall)).toFixed(3));
if(opt.cache){console.log('main list: rebuilds',(rebuilds/n).toFixed(3),'per frame | proto/original size',(protoN/baseN).toFixed(3),'| original entries missing from proto',missing);
  console.log('extras INSIDE exact frustum (drawn on screen, beyond their detail range): per level',extraIn.map(v=>(v/n).toFixed(2)).join(' / '),'per frame | frames with any',(extraInFrames/n).toFixed(3));
  const byL=[0,1,2].map(L=>{const v=extraDist.filter(x=>x[0]===L).map(x=>x[1]);return v.length?[Math.min(...v).toFixed(1),Math.max(...v).toFixed(1)]:null;});console.log('surface distance range of those extras per level (m):',JSON.stringify(byL));}
