// DRAW : volume d'appels GL par image, par fonction et par passe, et part redondante (etat deja en place).
// usage : node glstat.mjs [monde=camp:6] [images=900] [qualite=auto]
import {scene,mapObj} from './h.mjs';
const [kind,idx]=(process.argv[2]||'camp:6').split(':'),frames=+(process.argv[3]||900),quality=process.argv[4]||'auto';
const S=scene({world:[kind,+idx],quality});
for(let i=0;i<120;i++)S.frame();
S.T.reset();
let drawMs=0,changed=0;
for(let i=0;i<frames;i++){const r=S.frame();drawMs+=r.drawMs;if(r.changed)changed++;}
const T=S.T,per=v=>+(v/frames).toFixed(2);
const total=[...T.byFn.values()].reduce((a,b)=>a+b,0),red=[...T.red.values()].reduce((a,b)=>a+b,0);
const fam=n=>n.startsWith('uniform')?'uniform*':n;
const byFam=new Map(),redFam=new Map();
for(const [k,v] of T.byFn)byFam.set(fam(k),(byFam.get(fam(k))||0)+v);
for(const [k,v] of T.red)redFam.set(fam(k),(redFam.get(fam(k))||0)+v);
const out={monde:kind+':'+idx,qualite:quality,images:frames,destructions:changed,drawMsMoyen:per(drawMs),appelsParImage:per(total),redondantsParImage:per(red),partRedondante:+(red/total).toFixed(3),
  parFonction:Object.fromEntries([...byFam].sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,per(v)+' (redondants '+per(redFam.get(k)||0)+')'])),
  parPasse:{},uniformes:{}};
for(const [p,m] of T.byPass){
  const tot=[...m.values()].reduce((a,b)=>a+b,0),rp=T.redPass.get(p),rt=rp?[...rp.values()].reduce((a,b)=>a+b,0):0;
  const f=new Map();for(const [k,v] of m)f.set(fam(k),(f.get(fam(k))||0)+v);
  out.parPasse[p]={appels:per(tot),redondants:per(rt),draws:per(T.draws.get(p)||0),instances:per(T.inst.get(p)||0),triangles:Math.round((T.tris.get(p)||0)/frames),envoiKo:+(((T.upload.get(p)?.get('bytes'))||0)/frames/1024).toFixed(1),bufferData:per(T.uploadCalls.get(p)?.get('n')||0),
    detail:[...f].sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+per(v)).join(', ')};
}
for(const [p,m] of T.uniNames)out.uniformes[p]=[...m].map(([k,v])=>k+'×'+per(v)).join(' ');
console.log(JSON.stringify(out,null,1));
