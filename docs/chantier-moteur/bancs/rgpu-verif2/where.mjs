import {readFileSync} from 'node:fs'; import vm from 'node:vm';
const root=process.argv[2];
for(const idx of [0,17]){
const ctx={window:{},performance,console,Math,Date}; vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const w=ctx.window.FWorld.create(96,idx,{campaign:true,campaignVersion:2});
const env=w.environment;
const outdoorAt=p=>env.outdoorZones.some(z=>Math.abs(p[0]-z.x)<=z.w*.5+.08&&Math.abs(p[2]-z.z)<=z.d*.5+.08);
console.log('world',idx,env.biome,'zones',env.outdoorZones.length,'spawn',JSON.stringify(w.spawn),'in@[1.5,4.82,.5] outdoor?',outdoorAt([1.5,4.82,.5]));
const L=w.lights.map(l=>({p:l.p.map(v=>+v.toFixed(1)),pw:l.power,r:l.range,d:+Math.hypot(l.p[0]-1.5,l.p[1]-4.82,l.p[2]-.5).toFixed(1)})).sort((a,b)=>a.d-b.d);
console.log(' lights near inPos',JSON.stringify(L.slice(0,6)));
console.log(' power hist',JSON.stringify(w.lights.map(l=>l.power).sort((a,b)=>a-b)),' high(y>=2.5&&p>=7):',w.lights.filter(l=>l.p[1]>=2.5&&l.power>=7).length,' y>=2.5:',w.lights.filter(l=>l.p[1]>=2.5).length);
// indoor meshes bbox
let n=0,bb=[1e9,1e9,-1e9,-1e9];for(const m of w.meshes){const o=m.outdoor===undefined?((m.mat||0)>=8||outdoorAt(m.p||[0,0,0])):!!m.outdoor;if(!o){n++;bb[0]=Math.min(bb[0],m.p[0]);bb[1]=Math.min(bb[1],m.p[2]);bb[2]=Math.max(bb[2],m.p[0]);bb[3]=Math.max(bb[3],m.p[2]);}}
console.log(' indoor meshes',n,'bbox',bb.map(v=>+v.toFixed(0)));
}
