// Lot 02 / T2 (SIM-02) : ground() d'un arbre A contre celui d'un arbre B, Object.is sur chaque
// résultat (-0 et NaN compris). Copie à deux racines de bancs/sim/ground-equiv.mjs : mêmes
// points, mêmes listes de pièges, même générateur pseudo-aléatoire, dans le même ordre, sur les
// quatre scénarios historiques. S'y ajoutent, avec un générateur séparé pour ne pas déplacer
// cette suite : coordonnées minuscules et sous-normales, les 18 mondes de la campagne V2 et des
// mondes synthétiques aux sols hostiles (champs absents, NaN, infinis, énormes, tailles
// négatives, sols hors des bornes, bords posés à ±1e-7 près d'une frontière de case).
// usage : node ground-equiv2.mjs <racine A> <racine B> [NR=4e6] [--json sortie.json]
// Les sources sont chargées dans le domaine principal de Node, jamais en node:vm.
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {loadFast} from '../../../bancs/load-verif2/lib.mjs';
import {SCENARIOS,build,drive,makeInput} from '../../../bancs/sim/lib.mjs';

const args=process.argv.slice(2),jsonAt=args.indexOf('--json'),jsonOut=jsonAt>=0?args.splice(jsonAt,2)[1]:null;
const [rootA,rootB,nrArg]=args;
if(!rootA||!rootB){console.error('usage: node ground-equiv2.mjs <racine A> <racine B> [NR] [--json out]');process.exit(2);}
const NR=+nrArg||4e6;
const A={window:loadFast({srcDir:resolve(rootA,'src')})},B={window:loadFast({srcDir:resolve(rootB,'src')})};
const report={schema:'lot02-t2-ground-equiv2-v1',roots:{a:'A',b:'B'},nr:NR,scenarios:[],extras:[],totals:{points:0,mismatches:0,trapSamples:0,trapMismatches:0}};
const same=(f,g,x,z,list)=>{let r1,r2,e1=null,e2=null;try{r1=list===undefined?f(x,z):f(x,z,list);}catch(e){e1=String(e&&e.message);}try{r2=list===undefined?g(x,z):g(x,z,list);}catch(e){e2=String(e&&e.message);}return e1!==null||e2!==null?e1===e2:Object.is(r1,r2);};
const note=(row,first)=>{report.totals.points+=row.points;report.totals.mismatches+=row.mismatches;report.totals.trapSamples+=row.trapSamples;report.totals.trapMismatches+=row.trapMismatches;if(first)row.first=first;};

// ---- 1. La suite de ground-equiv.mjs, inchangée (générateur, points, pièges, chronométrage).
let seed=987654321;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296;};
const ulp=v=>{const buf=new Float64Array([v]),u=new BigInt64Array(buf.buffer);u[0]+=1n;return buf[0]-v;};
for(const [label,idx,opts] of SCENARIOS){
  const a=build(A,idx,opts),bb=build(B,idx,opts),w=a.world,b=w.bounds,floors=w.walkable;
  const pts=[];
  for(let i=0;i<NR;i++)pts.push([b.minX-6+rnd()*(b.maxX-b.minX+12),b.minZ-6+rnd()*(b.maxZ-b.minZ+12)]);
  for(const f of floors)for(const [ex,ez] of [[1,0],[-1,0],[0,1],[0,-1]])for(let k=0;k<400;k++){
    const along=rnd()-.5,bx=f.x+ex*f.w/2+(ez?along*f.w:0),bz=f.z+ez*f.d/2+(ex?along*f.d:0);
    for(const d of [0,1e-7,-1e-7,1e-7+ulp(f.x+f.w/2),1e-7-ulp(f.x+f.w/2),2e-7,-2e-7,1e-9,-1e-9,1e-12,-1e-12,ulp(bx),-ulp(bx),3*ulp(bx),-3*ulp(bx),1e-6,-1e-6])pts.push([bx+ex*d,bz+ez*d]);
  }
  for(let k=0;k<200000;k++){const cs=[1,2,4,8][k%4],x=Math.round((b.minX+rnd()*(b.maxX-b.minX))/cs)*cs,z=Math.round((b.minZ+rnd()*(b.maxZ-b.minZ))/cs)*cs;for(const [dx,dz] of [[0,0],[ulp(x)||1e-15,0],[-(ulp(x)||1e-15),0],[0,ulp(z)||1e-15],[0,-(ulp(z)||1e-15)],[1e-9,1e-9],[-1e-9,-1e-9]])pts.push([x+dx,z+dz]);}
  {const s=a.sim.state,input=makeInput();for(let i=0;i<900;i++){drive(i,input,s);a.sim.step(1/60,input);s.events.length=0;pts.push([s.player.x,s.player.z]);for(const e of s.enemies)pts.push([e.x,e.z]);for(const q of s.debris)pts.push([q.x,q.z],[q.x-.3,q.z+.3]);if(s.dead)break;}}
  pts.push([0,0],[-0,-0],[NaN,0],[0,NaN],[Infinity,0],[-Infinity,0],[1e300,1e300]);
  let diff=0,first=null;for(const [x,z] of pts){if(!same(a.sim.ground,bb.sim.ground,x,z)){diff++;if(!first)first=[x,z,a.sim.ground(x,z),bb.sim.ground(x,z)];}}
  let tdiff=0;const traps=floors.filter(f=>!f.substrate).slice(0,6).map((f,i)=>({kind:i%3===2?'blade':'floor',x:f.x,z:f.z,w:Math.min(3,f.w),d:Math.min(3,f.d),y:f.y||0,travel:i%2?undefined:1.2,progress:(i+1)/7}));
  for(let i=0;i<300000;i++){const f=floors[i%floors.length],x=f.x+(rnd()-.5)*4,z=f.z+(rnd()-.5)*4,list=i%5?traps:traps.slice(1);if(!same(a.sim.ground,bb.sim.ground,x,z,list))tdiff++;}
  const N=2e6,xs=new Float64Array(N),zs=new Float64Array(N);for(let i=0;i<N;i++){xs[i]=b.minX+rnd()*(b.maxX-b.minX);zs[i]=b.minZ+rnd()*(b.maxZ-b.minZ);}
  const time=g=>{let acc=0;for(let i=0;i<2e5;i++)acc+=g(xs[i],zs[i]);const r=[];for(let k=0;k<5;k++){const t=performance.now();for(let i=0;i<N;i++)acc+=g(xs[i],zs[i]);r.push((performance.now()-t)/N*1e6);}r.sort((p,q)=>p-q);return r[2];};
  const t1=time(a.sim.ground),t2=time(bb.sim.ground);
  const tr=pts.slice(pts.length-200000);const time2=g=>{let acc=0;const r=[];for(let k=0;k<5;k++){const t=performance.now();for(let j=0;j<10;j++)for(const [x,z] of tr)acc+=g(x,z);r.push((performance.now()-t)/(tr.length*10)*1e6);}r.sort((p,q)=>p-q);return r[2];};
  const u1=time2(a.sim.ground),u2=time2(bb.sim.ground);
  const row={id:label,points:pts.length,mismatches:diff,trapSamples:300000,trapMismatches:tdiff,nsUniform:[+t1.toFixed(1),+t2.toFixed(1)],nsTrace:[+u1.toFixed(1),+u2.toFixed(1)]};note(row,first);report.scenarios.push(row);
  console.log(label.padEnd(13),'points',pts.length,'mismatches',diff,first?JSON.stringify(first):'','| trap-list samples 300000 mismatches',tdiff,'| ns/call uniform A',t1.toFixed(1),'B',t2.toFixed(1),'x'+(t1/t2).toFixed(2),'| trace A',u1.toFixed(1),'B',u2.toFixed(1),'x'+(u1/u2).toFixed(2));
}

// ---- 2. Compléments (générateur séparé).
let seed2=123456789;const rnd2=()=>{seed2=(Math.imul(seed2,1103515245)+12345)>>>0;return seed2/4294967296;};
const tiny=[0,-0,5e-324,-5e-324,1e-323,-1e-323,1.5e-323,-1.5e-323,2e-323,-2e-323,2.5e-323,-2.5e-323,4e-323,-4e-323,1e-310,-1e-310,2.2250738585072014e-308,-2.2250738585072014e-308,1e-300,-1e-300,1e-200,-1e-200];
function probe(label,a,bb,w,{uniform=300000,edgeReps=100,cuts=50000,steps=300,trapSamples=30000}={}){
  const b=w.bounds,floors=w.walkable||[],pts=[];
  for(let i=0;i<uniform;i++)pts.push([b.minX-10+rnd2()*(b.maxX-b.minX+20),b.minZ-10+rnd2()*(b.maxZ-b.minZ+20)]);
  for(const f of floors){const fx=+f.x,fz=+f.z,fw=+f.w,fd=+f.d;if(![fx,fz,fw,fd].every(Number.isFinite)||Math.abs(fx)+Math.abs(fw)>1e7||Math.abs(fz)+Math.abs(fd)>1e7)continue;
    for(const [ex,ez] of [[1,0],[-1,0],[0,1],[0,-1]])for(let k=0;k<edgeReps;k++){const along=rnd2()-.5,bx=fx+ex*fw/2+(ez?along*fw:0),bz=fz+ez*fd/2+(ex?along*fd:0);
      for(const d of [0,1e-7,-1e-7,1e-7+ulp(fx+fw/2),1e-7-ulp(fx+fw/2),2e-7,-2e-7,1e-9,-1e-9,1e-12,-1e-12,ulp(bx),-ulp(bx),3*ulp(bx),-3*ulp(bx),1e-6,-1e-6,1.000001e-6,-1.000001e-6,9.99999e-7,-9.99999e-7])pts.push([bx+ex*d,bz+ez*d]);}}
  for(let k=0;k<cuts;k++){const cs=[1,2,4,8][k%4],x=Math.round((b.minX+rnd2()*(b.maxX-b.minX))/cs)*cs,z=Math.round((b.minZ+rnd2()*(b.maxZ-b.minZ))/cs)*cs;for(const [dx,dz] of [[0,0],[ulp(x)||5e-324,0],[-(ulp(x)||5e-324),0],[0,ulp(z)||5e-324],[0,-(ulp(z)||5e-324)],[2*ulp(x),2*ulp(z)],[-2*ulp(x),-2*ulp(z)],[1e-9,1e-9],[-1e-9,-1e-9]])pts.push([x+dx,z+dz]);}
  for(const x of tiny)for(const z of tiny)pts.push([x,z]);
  for(const x of tiny)for(let k=0;k<40;k++){const z=b.minZ+rnd2()*(b.maxZ-b.minZ),x2=b.minX+rnd2()*(b.maxX-b.minX);pts.push([x,z],[z,x],[x2,x],[x,x2]);}
  pts.push([NaN,NaN],[NaN,0],[0,NaN],[Infinity,0],[-Infinity,0],[0,Infinity],[0,-Infinity],[1e300,-1e300],[-1e300,1e300],[Number.MAX_VALUE,0],[-Number.MAX_VALUE,0],[b.minX,b.minZ],[b.maxX,b.maxZ],[b.minX-1e-9,b.minZ],[b.maxX+1e-9,b.maxZ],[b.minX-8,b.minZ-8],[b.maxX+8,b.maxZ+8]);
  if(steps&&a.sim.step){const s=a.sim.state,input=makeInput();try{for(let i=0;i<steps;i++){drive(i,input,s);a.sim.step(1/60,input);s.events.length=0;pts.push([s.player.x,s.player.z]);for(const e of s.enemies)pts.push([e.x,e.z]);for(const q of s.debris)pts.push([q.x,q.z],[q.x-.3,q.z+.3]);if(s.dead||s.won)break;}}catch(e){pts.push([0,0]);}}
  let diff=0,first=null;for(const [x,z] of pts){if(!same(a.sim.ground,bb.sim.ground,x,z)){diff++;if(!first)first=[x,z,String(a.sim.ground(x,z)),String(bb.sim.ground(x,z))];}}
  const base=floors.filter(f=>!f.substrate&&Number.isFinite(+f.x)&&Number.isFinite(+f.z)).slice(0,6),traps=base.map((f,i)=>({kind:i%3===2?'blade':'floor',x:f.x,z:f.z,w:Math.min(3,+f.w||3),d:Math.min(3,+f.d||3),y:f.y||0,travel:i%2?undefined:1.2,progress:(i+1)/7}));
  let tdiff=0;if(base.length)for(let i=0;i<trapSamples;i++){const f=base[i%base.length],x=f.x+(rnd2()-.5)*4,z=f.z+(rnd2()-.5)*4,list=i%5?traps:i%10?traps.slice(1):[];if(!same(a.sim.ground,bb.sim.ground,x,z,list))tdiff++;}
  const row={id:label,points:pts.length,mismatches:diff,trapSamples:base.length?trapSamples:0,trapMismatches:tdiff};note(row,first);report.extras.push(row);
  console.log(label.padEnd(13),'points',pts.length,'mismatches',diff,first?JSON.stringify(first):'','| trap-list samples',row.trapSamples,'mismatches',tdiff);
}
for(const [label,idx,opts] of SCENARIOS){const a=build(A,idx,opts),bb=build(B,idx,opts);probe(label+'+',a,bb,a.world,{uniform:0,edgeReps:0,cuts:0,steps:0,trapSamples:0});}
for(let n=1;n<=18;n++){const a=build(A,n-1,{campaign:true,campaignVersion:2}),bb=build(B,n-1,{campaign:true,campaignVersion:2});probe('campaign2-w'+n,a,bb,a.world);}

// Mondes synthétiques : FSimulation.create sur un décor minimal, mêmes sols des deux côtés.
const fixture=walkable=>({seed:'t2',stage:0,spawn:{x:0,y:0,z:0,yaw:0},bounds:{minX:-30,maxX:30,minZ:-30,maxZ:30},colliders:[],enemies:[],pickups:[],cores:[{id:0,x:15,z:15},{id:1,x:18,z:15},{id:2,x:21,z:15}],exit:{x:24,z:15},walkable});
const edge=(w)=>w/2+1e-7;
const synthetic={
  'vide':[],
  'plat-seul':[{x:0,z:0,w:60,d:60}],
  'champs-absents':[{x:0,z:0,w:20,d:20},{x:3,z:-4,w:6,d:2,y:1.5},{x:-8,z:8,w:5,d:5,slopeX:.2},{x:12,z:0,w:4,d:9,y:-1,slopeZ:-.15}],
  'egalites':[{x:0,z:0,w:16,d:16,y:2},{x:2,z:2,w:6,d:6,y:2},{x:-3,z:1,w:4,d:12,y:2},{x:0,z:0,w:8,d:8,y:1.99999999},{x:0,z:0,w:60,d:60,y:-.25,substrate:true,fallback:true}],
  'rampes-et-plats':[{x:0,z:0,w:10,d:10,y:1,slopeX:.1,slopeZ:.05},{x:0,z:0,w:4,d:4,y:0},{x:5,z:5,w:10,d:10,y:3,slopeX:-.2},{x:-6,z:-6,w:6,d:6,y:-2,slopeZ:.3},{x:0,z:0,w:60,d:60,y:-.25,substrate:true,fallback:true}],
  'repli-sans-substrat':[{x:0,z:0,w:30,d:30,y:-.5,fallback:true},{x:4,z:4,w:8,d:8,y:1},{x:-4,z:-4,w:8,d:8,y:.5,slopeX:.1}],
  'zeros-signes':[{x:-0,z:-0,w:8,d:8,y:-0,slopeX:-0,slopeZ:-0},{x:0,z:0,w:4,d:4,y:0,slopeX:0,slopeZ:-0},{x:2,z:-2,w:4,d:4,y:-0,slopeX:1e-300}],
  'nan-et-infinis':[{x:NaN,z:0,w:10,d:10},{x:0,z:NaN,w:10,d:10,y:5},{x:0,z:0,w:NaN,d:4,y:3},{x:Infinity,z:0,w:Infinity,d:10,y:4},{x:0,z:0,w:Infinity,d:Infinity,y:-1},{x:2,z:2,w:4,d:4,y:Infinity},{x:-2,z:-2,w:4,d:4,y:-Infinity},{x:6,z:6,w:4,d:4,y:NaN},{x:0,z:-6,w:4,d:4,slopeX:NaN,y:2},{x:-6,z:0,w:4,d:4,slopeZ:Infinity,y:2}],
  'enormes':[{x:1e20,z:0,w:2e20,d:20,y:1},{x:0,z:1e12,w:20,d:2e12-32768,y:2},{x:-1e9,z:-1e9,w:2e9+3,d:2e9+3,y:.5},{x:0,z:0,w:1e300,d:1e300,y:-3,substrate:true}],
  'tailles-negatives':[{x:0,z:0,w:-4,d:4,y:5},{x:0,z:0,w:4,d:-4,y:6},{x:0,z:0,w:-0,d:-0,y:7},{x:0,z:0,w:20,d:20,y:0}],
  'hors-bornes':[{x:80,z:0,w:30,d:30,y:2},{x:-29,z:-29,w:6,d:6,y:1},{x:0,z:40,w:60,d:30,y:.5},{x:0,z:0,w:200,d:200,y:-.25,substrate:true,fallback:true}],
  'bords-a-1e-7':[{x:edge(4),z:0,w:4,d:8,y:1},{x:-edge(4),z:0,w:4,d:8,y:2},{x:8+edge(2),z:8-edge(2),w:2,d:2,y:3},{x:16-edge(6),z:-16+edge(6),w:6,d:6,y:4},{x:2+edge(4),z:2,w:4,d:4,y:1.5,slopeX:.1},{x:0,z:0,w:60,d:60,y:-.25,substrate:true,fallback:true}],
  'bords-pile':[{x:1,z:1,w:2,d:2,y:1},{x:4,z:4,w:4,d:4,y:2},{x:4,z:4,w:4-2e-7,d:4-2e-7,y:3},{x:4,z:4,w:4+4e-6,d:4+4e-6,y:2.5},{x:-1,z:-1,w:2-1.8e-6,d:2+1.8e-6,y:4},{x:0,z:0,w:60,d:60,y:-.25,substrate:true,fallback:true}],
};
for(const [name,walkable] of Object.entries(synthetic)){
  let a,bb,ea=null,eb=null;try{a={world:fixture(walkable)};a.sim=A.window.FSimulation.create(a.world);}catch(e){ea=String(e&&e.message);}try{bb={world:fixture(walkable)};bb.sim=B.window.FSimulation.create(bb.world);}catch(e){eb=String(e&&e.message);}
  if(ea!==null||eb!==null){const ok=ea===eb;report.extras.push({id:'synthetique-'+name,points:0,mismatches:ok?0:1,trapSamples:0,trapMismatches:0,createError:[ea,eb]});report.totals.mismatches+=ok?0:1;console.log(('synth '+name).padEnd(28),'create:',ea,'|',eb,ok?'(identiques)':'(DIFFÉRENTS)');continue;}
  probe('synthetique-'+name,a,bb,a.world,{uniform:200000,edgeReps:60,cuts:30000,steps:60,trapSamples:20000});
}
console.log('TOTAL points',report.totals.points,'mismatches',report.totals.mismatches,'| trap samples',report.totals.trapSamples,'mismatches',report.totals.trapMismatches);
if(jsonOut)writeFileSync(jsonOut,JSON.stringify(report,null,1)+'\n');
process.exitCode=report.totals.mismatches||report.totals.trapMismatches?1:0;
