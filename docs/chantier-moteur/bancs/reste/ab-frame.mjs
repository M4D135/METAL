// Paired full-frame A/B in the main realm: two complete scenes advance in LOCKSTEP (same deterministic pilot);
// the dynamic mesh list handed to the renderer is hashed field by field every frame (bit-exact check of the image inputs),
// and models()/draw() times are compared per frame (median of per-frame ratios, robust to preemption).
// usage: node ab-frame.mjs <A> <B> [frames] [kind:idx]    spec: orig | r1 | r1+module:export[+module:export]
import {scene,GLC,resetGL} from './scene.mjs';import {mix,q,mean} from './build.mjs';
async function make(text,world){const [base,...mods]=text.split('+');const patches={};let extra=[];
  for(const m of mods){const [file,exp]=m.split(':');const v=(await import('./'+file+'.mjs'))[exp];const p=typeof v==='function'?v():v;if(Array.isArray(p))extra.push(...p);else for(const k in p){if(k==='simulation')extra.push(...p[k]);else patches[k]=[...(patches[k]||[]),...p[k]];}}
  return scene({variant:base,world,patches,...(base==='r1'?{simSpec:{extra}}:{})});}
const [sa='r1',sb='r1',N='600',w='camp:6']=process.argv.slice(2);const [kind,idx]=w.split(':'),world=[kind,+idx];
const A=await make(sa,world),B=await make(sb,world);
const hs=(h,t)=>{t=String(t);for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);return h;};
function listHash(list){let h=2166136261;for(const m of list){h=hs(h,m.shape);for(const key of ['p','s','r','color']){const v=m[key];if(v)for(let k=0;k<v.length;k++)h=mix(h,v[k]);else h=mix(h,-7);}h=mix(h,m.mat||0);h=mix(h,m.emissive||0);h=mix(h,m.alpha===undefined?-3:m.alpha);h=hs(h,(m.overlay?'o':'')+(m.fx?'f':'')+(m.surface||'')+(m.actorPart||'')+(m.additive?'a':''));}return h>>>0;}
const tm=[[],[]],td=[[],[]],ts=[[],[]];let same=true,divAt=-1,meshes=0;const WARM=120;
for(let i=0;i<+N+WARM;i++){
  const first=i&1?B:A,second=i&1?A:B;
  const s1=first.simPhase(),s2=second.simPhase();const v1=first.viewPhase(),v2=second.viewPhase();
  const a=i&1?v2:v1,b=i&1?v1:v2,simA=i&1?s2:s1,simB=i&1?s1:s2;
  if(same&&(a.list.length!==b.list.length||listHash(a.list)!==listHash(b.list))){same=false;divAt=i;}
  if(i>=WARM){tm[0].push(a.modelsMs);tm[1].push(b.modelsMs);td[0].push(a.drawMs);td[1].push(b.drawMs);ts[0].push(simA);ts[1].push(simB);meshes+=a.list.length;}
}
const ratio=(x,y)=>q(x.map((v,i)=>y[i]/v).filter((v,i)=>x[i]>.01),.5);
const line=(name,x,y)=>name+': median '+(1e3*q(x,.5)).toFixed(0)+' -> '+(1e3*q(y,.5)).toFixed(0)+' us | p10 '+(1e3*q(x,.1)).toFixed(0)+' -> '+(1e3*q(y,.1)).toFixed(0)+' us | median ratio '+ratio(x,y).toFixed(3);
console.log(sa,'vs',sb,w,'frames',N,'| dynamic list identical='+same+(divAt>=0?' (first difference at frame '+divAt+')':'')+' | meshes/frame '+(meshes/+N).toFixed(0));
console.log('  '+line('models()',tm[0],tm[1]));console.log('  '+line('draw()  ',td[0],td[1]));console.log('  '+line('sim.step',ts[0],ts[1]));
