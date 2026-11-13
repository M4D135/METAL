// RESTE-P3: hidden-class / elements-kind diversity of the dynamic mesh list, and what it costs in pack().
// usage: node --allow-natives-syntax shapes.mjs [frames] [kind:idx]
import {scene} from './scene.mjs';import {q} from './build.mjs';
const [N='420',w='camp:6']=process.argv.slice(2);const [kind,idx]=w.split(':');
const S=scene({variant:'r1',world:[kind,+idx],patches:{renderer:[['  window.FRender={create,foliageTriangles};','  window.FRender={create,foliageTriangles,__pack:pack};']],motion:(await import('./motionfast.mjs')).motionFast.motion}});
const pack=S.win.FRender.__pack,env=S.world.environment;
const sameMap=new Function('a','b','return %HaveSameMap(a,b)'),kindOf=new Function('a','return %HasSmiElements(a)?"smi":%HasDoubleElements(a)?"double":%HasObjectElements(a)?"object":"other"'),holey=new Function('a','return %HasHoleyElements(a)');
const canon=(m)=>({shape:m.shape||'box',p:[+m.p[0],+m.p[1],+m.p[2]],s:[+m.s[0],+m.s[1],+m.s[2]],mat:m.mat||0,r:m.r?[+m.r[0],+m.r[1],+m.r[2]]:[0,0,0],emissive:m.emissive||0,color:m.color?[+m.color[0],+m.color[1],+m.color[2]]:undefined,surface:m.surface,overlay:!!m.overlay,fx:!!m.fx,alpha:m.alpha,additive:m.additive,actorPart:m.actorPart,outdoor:m.outdoor,indoor:m.indoor,structural:m.structural});
// force double elements even when the three values are integers
const dbl=a=>{const o=[0.5,0.5,0.5];o[0]=a[0];o[1]=a[1];o[2]=a[2];return o;};
const canon2=m=>{const c=canon(m);c.p=dbl(c.p);c.s=dbl(c.s);c.r=dbl(c.r);if(c.color)c.color=dbl(c.color);return c;};
const lists=[];let maps=0,frames=0;const kinds={p:{},s:{},r:{}};let holeyCount=0,total=0;
for(let i=0;i<+N;i++){const f=S.frame();if(i>=120&&i%4===0){const list=f.list.filter(m=>!m.fx&&!m.overlay);lists.push(list);
  if(i%40===0){const reps=[];for(const m of list){let hit=false;for(const r of reps)if(sameMap(r,m)){hit=true;break;}if(!hit)reps.push(m);for(const k of ['p','s','r']){const a=m[k];if(!a)continue;const kk=kindOf(a)+(holey(a)?'-holey':'');kinds[k][kk]=(kinds[k][kk]||0)+1;}total++;}maps+=reps.length;frames++;}}}
console.log('ordinary dynamic meshes/frame',(lists.reduce((n,l)=>n+l.length,0)/lists.length).toFixed(0),'| distinct hidden classes per list (mean)',(maps/frames).toFixed(1),'| elements kinds',JSON.stringify(kinds));
const norm=lists.map(l=>l.map(canon2)),sA={data:new Float32Array(1024*16),counts:new Int32Array(7),starts:new Int32Array(7),codes:new Int8Array(1024)},sB={data:new Float32Array(1024*16),counts:new Int32Array(7),starts:new Int32Array(7),codes:new Int8Array(1024)};
// identical packed bytes?
let same=true;for(let k=0;k<lists.length;k++){const a=pack(lists[k],env,true,sA),b=pack(norm[k],env,true,sB);if(a.values.length!==b.values.length){same=false;break;}for(let j=0;j<a.values.length;j++)if(a.values[j]!==b.values[j]&&!(a.values[j]!==a.values[j]&&b.values[j]!==b.values[j])){same=false;break;}}
const ta=[],tb=[];for(let rep=0;rep<40;rep++)for(let k=0;k<lists.length;k++){let x,y;
  if((rep+k)&1){let t=performance.now();pack(norm[k],env,true,sB);y=performance.now()-t;t=performance.now();pack(lists[k],env,true,sA);x=performance.now()-t;}
  else{let t=performance.now();pack(lists[k],env,true,sA);x=performance.now()-t;t=performance.now();pack(norm[k],env,true,sB);y=performance.now()-t;}
  if(rep>=5){ta.push(x);tb.push(y);}}
console.log('pack(as built) vs pack(canonical shape, double elements): packed rows identical='+same+' | median '+(1e3*q(ta,.5)).toFixed(1)+' -> '+(1e3*q(tb,.5)).toFixed(1)+' us | p10 '+(1e3*q(ta,.1)).toFixed(1)+' -> '+(1e3*q(tb,.1)).toFixed(1)+' us | median ratio '+q(ta.map((v,i)=>tb[i]/v),.5).toFixed(3)+' | n='+ta.length);
