// RESTE: how often is an actor's model list identical to the one built on the previous frame (upper bound for retained reuse)?
// and how many FActors.build / supplyModel / FEffects meshes per frame. usage: node actors-reuse.mjs [frames] [kind:idx]
import {scene} from './scene.mjs';import {mix} from './build.mjs';
const [N='360',w='camp:6']=process.argv.slice(2);const [kind,idx]=w.split(':');
const hs=(h,t)=>{t=String(t);for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);return h;};
const H=list=>{let h=2166136261;for(const m of list){h=hs(h,m.shape);for(const key of ['p','s','r','color']){const v=m[key];if(v)for(let k=0;k<v.length;k++)h=mix(h,v[k]);}h=mix(h,m.mat||0);h=mix(h,m.emissive||0);}return h>>>0;};
const prev=new Map();let calls=0,same=0,meshes=0,sameMeshes=0,ms=0,on=false,timeIndep=0;
const S=scene({variant:'r1',world:[kind,+idx],gameHook(env){const real=env.FActors.build;env.FActors={build(e,o){const t=performance.now();const out=real(e,o);ms+=performance.now()-t;if(on){const h=H(out);calls++;meshes+=out.length;if(prev.get(e.id)===h){same++;sameMeshes+=out.length;}prev.set(e.id,h);if(H(real(e,{...o,time:o.time+.5}))===h)timeIndep++;}return out;}};}});
let frames=0,dyn=0;for(let i=0;i<+N+240;i++){on=i>=240;const f=S.frame();if(on){frames++;dyn+=f.list.length;}}
console.log(w,'frames',frames,'| dynamic meshes/frame',(dyn/frames).toFixed(0),'| FActors.build calls/frame',(calls/frames).toFixed(1),'meshes/frame',(meshes/frames).toFixed(0),'| identical to previous frame: '+(100*same/calls).toFixed(1)+'% of calls ('+(100*sameMeshes/meshes).toFixed(1)+'% of actor meshes) | output independent of time: '+(100*timeIndep/calls).toFixed(1)+'% of calls');
