// Vérifie qu'une position est bien sous un plafond (salle intérieure) : maillages au-dessus de l'œil.
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
const [root, idx, x, y, z] = process.argv.slice(2).map((v,i)=>i?+v:v);
const ctx={window:{},performance,console,Math,Date}; vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const w=ctx.window.FWorld.create(96,idx,{campaign:true,campaignVersion:2});
const above=w.meshes.filter(m=>{const p=m.p||[0,0,0],s=m.s||[1,1,1];return Math.abs(p[0]-x)<=s[0]/2+.01&&Math.abs(p[2]-z)<=s[2]/2+.01&&p[1]-s[1]/2>y;}).map(m=>({shape:m.shape||'box',mat:m.mat,p:m.p.map(v=>+v.toFixed(2)),s:m.s.map(v=>+v.toFixed(2)),outdoor:m.outdoor}));
console.log('above eye', above.length, JSON.stringify(above.slice(0,6)));
const near=w.lights.filter(l=>Math.hypot(l.p[0]-x,l.p[2]-z)<12).map(l=>({p:l.p.map(v=>+v.toFixed(1)),power:l.power}));
console.log('lights within 12 m', near.length, JSON.stringify(near));
