// RCPU: A/B of the original renderer vs the in-memory prototype (proto.mjs) on identical frames.
// Both renderers receive the same camera, dynamic list and fx every frame; superset correctness is checked
// for every static pass (main, lamp, sun, torch) by mesh identity.
// usage: node ab.mjs <ferroRoot> [frames=3000] [world=camp:17] [quality=auto] [flags=grid,sun,cache,pool] [D=1] [THETA=8] [SUNM=4]
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {scene,stats,GLC,fakeGL} from './harness.mjs';
import {patchRenderer} from './proto.mjs';
const root=process.argv[2],frames=+(process.argv[3]||3000),[kind,idx]=(process.argv[4]||'camp:17').split(':'),quality=process.argv[5]||'auto';
const flags=(process.argv[6]||'grid,sun,cache,pool').split(','),D=+(process.argv[7]||1),THETA=+(process.argv[8]||8),SUNM=+(process.argv[9]||4),sweep=+(process.argv[10]||45);
const opt={grid:flags.includes('grid'),sun:flags.includes('sun'),cache:flags.includes('cache'),pool:flags.includes('pool'),D,THETA,SUNM,expose:true};
const S=scene(root,{world:[kind,+idx],quality,wrap:false,proto:{grid:false,sun:false,cache:false,pool:false,expose:true}});
const src=patchRenderer(readFileSync(root+'/src/renderer.js','utf8'),opt);
const win={innerWidth:1280,innerHeight:720,devicePixelRatio:2};vm.runInThisContext('(function(window){'+src+'\n})',{filename:'renderer-proto.js'})(win);
const gl2=fakeGL(),canvas2={width:300,height:150,clientWidth:1280,clientHeight:720,getContext:()=>gl2,addEventListener(){},removeEventListener(){}};
const R2=win.FRender.create(canvas2);R2.resize(quality);
const d0=S.sim.destruction;R2.setWorld(d0?.meshes||S.world.meshes,d0?.lights||S.world.lights,S.world.environment);
let rev=S.sim.state.destructionRevision??d0?.revision;
const A=[],B=[],misses=[];let missing={1:0,2:0,3:0,0:0},checked=0;const extra=[0,0,0,0],base=[0,0,0,0];
const grab=()=>({calls:GLC.calls,bufferData:GLC.bufferData,subData:GLC.subData,bytes:GLC.bufferBytes+GLC.subBytes,instances:GLC.instances});
const diff=(a,b)=>Object.fromEntries(Object.keys(a).map(k=>[k,b[k]-a[k]]));
for(let i=0;i<frames+120;i++){
  const g0=grab();const r=S.frame(1/60,{tour:true,sweep});const g1=grab();
  const d=S.sim.destruction,revision=S.sim.state.destructionRevision??d?.revision;let up=0;
  if(revision!==rev){const t=performance.now();R2.updateWorld(d.meshes,revision,d.lights);up=performance.now()-t;rev=revision;}
  const t=performance.now();R2.draw(r.camera,r.list,r.fx);const ms=performance.now()-t;const g2=grab();
  if(i<120)continue;
  A.push({ms:r.drawMs,up:r.updateMs,...diff(g0,g1),upload:S.renderer.stats.uploadBytes,vis:S.renderer.stats.staticVisible});
  B.push({ms,up,...diff(g1,g2),upload:R2.stats.uploadBytes,vis:R2.stats.staticVisible});
  for(const slot of [0,1,2,3]){const a=S.renderer.stats['__slot'+slot],b=R2.stats['__slot'+slot];if(!a||!b)continue;const set=new Set(b.map(e=>e.mesh));base[slot]+=a.length;extra[slot]+=b.length;for(const e of a)if(!set.has(e.mesh)){missing[slot]++;if(slot===0||slot===3)misses.push({e,slot,camera:r.camera,aspect:S.canvas.width/S.canvas.height});}}
  checked++;
}
const col=(X,k)=>X.map(x=>x[k]);
const line=(name,X)=>console.log(name.padEnd(9),'draw',JSON.stringify(stats(col(X,'ms'))),'| uploadKB/f',(X.reduce((n,x)=>n+x.upload,0)/X.length/1024).toFixed(1),'bufferData/f',(X.reduce((n,x)=>n+x.bufferData,0)/X.length).toFixed(2),'subData/f',(X.reduce((n,x)=>n+x.subData,0)/X.length).toFixed(2),'gl/f',(X.reduce((n,x)=>n+x.calls,0)/X.length).toFixed(0),'inst/f',(X.reduce((n,x)=>n+x.instances,0)/X.length).toFixed(0),'staticVisible',(X.reduce((n,x)=>n+x.vis,0)/X.length).toFixed(0),'updateWorld max',Math.max(...col(X,'up')).toFixed(2));
console.log('world',kind+':'+idx,'quality',quality,'frames',A.length,'sweep',sweep,'proto',JSON.stringify(opt));
line('original',A);line('proto',B);
console.log('superset check (entries of original missing from proto):',JSON.stringify(missing),'| proto/original list size per slot',extra.map((v,k)=>(v/Math.max(1,base[k])).toFixed(2)).join(' '));

// Classify main-pass misses: does the missed sphere really intersect the true view frustum (sampled)?
{const ax=c=>{const y=c.yaw||0,p=c.pitch||0,ro=c.roll||0,cy=Math.cos(y),sy=Math.sin(y),cp=Math.cos(p),sp=Math.sin(p),cr=Math.cos(ro),sr=Math.sin(ro),r=[cy,0,sy],u=[-sy*sp,cp,cy*sp];return {right:r.map((v,i)=>v*cr+u[i]*sr),up:u.map((v,i)=>v*cr-r[i]*sr),forward:[sy*cp,sp,-cy*cp]};};
 let real=0,benign=0;const n=6;
 for(const {e,slot,camera,aspect} of misses){const A=ax(camera);let f=1/Math.tan(Math.max(40,Math.min(110,camera.fov||75))*Math.PI/360),h=aspect/f,v=1/f,eye=camera.pos,far=180,nearZ=.045;
   if(slot===3){eye=eye.map((x,i)=>x+A.right[i]*.16-A.up[i]*.08);f=1/Math.tan(108*Math.PI/360);h=v=1/f;far=32;nearZ=.08;}let hit=false;
   for(let i=-n;i<=n&&!hit;i++)for(let j=-n;j<=n&&!hit;j++)for(let k=-n;k<=n&&!hit;k++){const q=[i/n,j/n,k/n];if(Math.hypot(...q)>1)continue;const P=[e.p[0]+q[0]*e.radius,e.p[1]+q[1]*e.radius,e.p[2]+q[2]*e.radius].map((x,t)=>x-eye[t]);
     const z=P[0]*A.forward[0]+P[1]*A.forward[1]+P[2]*A.forward[2],x=P[0]*A.right[0]+P[1]*A.right[1]+P[2]*A.right[2],y=P[0]*A.up[0]+P[1]*A.up[1]+P[2]*A.up[2];if(z>nearZ&&z<far&&Math.abs(x)<=z*h&&Math.abs(y)<=z*v)hit=true;}
   if(hit)real++;else benign++;}
 console.log('main+torch misses:',misses.length,'really intersecting the frustum (sampled):',real,'| original false positives (sphere outside frustum):',benign,'| radius of misses',misses.map(m=>m.e.radius.toFixed(1)).slice(0,12).join(','));
 const ups=col(A,'up').filter(v=>v>0),upsB=col(B,'up').filter(v=>v>0);console.log('updateWorld original',JSON.stringify(stats(ups)),'proto',JSON.stringify(stats(upsB)));}
