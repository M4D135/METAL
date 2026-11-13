// MD-5 (DEMO-02) : réalisateur FDemo.director sur le contexte et le catalogue jouets de l'annexe 1, domaine principal de Node.
// « avant » : src/demo.js de l'étape 4 (054961d), sans réalisateur. « après » : l'arbre de travail.
// - Comportement : 10 min simulées à 60 Hz, graines 1 et 2 : plans, raisons, répétitions, durées, vols, empreinte des poses ;
//   vol A → B de F5 ; taux de cible répétée de F7.
// - Coût : director.update, catalogue jouet (4 plans, 8 points pendant le combat), passes alternées avec une boucle témoin
//   (même contexte, faux réalisateur), temps processeur du fil, 1 passe de chauffe puis 5, médianes ; ramassages comptés.
// - Allocations : volume exact (tas grandi + ce que rend chaque ramassage, v8.GCProfiler), témoin retranché, médianes de 5.
//   node docs/chantier-moteur/preuves/module-demo/MD-5/director.mjs [--before <rév>] [--out F]
import {loadRealm,DEFAULT_ROOT} from '../../../../../tools/realm-loader.mjs';
import {PerformanceObserver} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import v8 from 'node:v8';
import os from 'node:os';

const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:fallback;};
const BEFORE=arg('--before','054961d7b800acc46b8c7e45e53b819d29ce344f'),OUT=arg('--out',null),DT=1/60;
v8.setFlagsFromString('--expose-gc');const gc=vm.runInNewContext('gc');
const texts={before:execFileSync('git',['-C',DEFAULT_ROOT,'show',BEFORE+':src/demo.js'],{encoding:'utf8'}),
  after:readFileSync(new URL('../../../../../src/demo.js',import.meta.url),'utf8')};
const sha=t=>createHash('sha256').update(t).digest('hex');
const before=loadRealm({modules:['demo'],transform:()=>texts.before}).window.FDemo,F=loadRealm({modules:['demo']}).window.FDemo;

// Contexte et catalogue jouets (annexe 1), comme checks/fdemo.test.mjs ; extra : points de plus, d'un genre qu'aucun plan n'exige.
function toyContext(extra=0){
  const corners=[[15,15],[-15,15],[15,-15],[-15,-15]].map(([x,z],i)=>({id:'c'+i,kind:'coin',pos:[x,6,z]}));
  const others=Array.from({length:extra},(_,i)=>({id:'r'+i,kind:'repère',pos:[5*i,0,-5*i]}));
  const boss={id:'boss',kind:'boss',pos:[20,3,0]},ctx={time:0,combat:false,eye:{pos:[10,1.62,0],yaw:0,pitch:0},points:[...corners,...others]};
  const base=ctx.points.length;
  return {ctx,at(time){
    const e=ctx.eye,points=ctx.points,wanted=ctx.combat=time%120>=60&&time%120<100;
    ctx.time=time;e.pos[0]=10*Math.cos(.1*time);e.pos[2]=10*Math.sin(.1*time);e.yaw=.1*time;
    boss.pos[0]=20*Math.cos(.3*time);boss.pos[2]=20*Math.sin(.3*time);
    if(wanted&&points.length===base)points.push(boss);else if(!wanted&&points.length>base)points.pop();
    return ctx;
  }};
}
const put=(out,p)=>{out.pos[0]=p[0];out.pos[1]=p[1];out.pos[2]=p[2];};
const toyShots=()=>[
  {id:'yeux',weight:60,duration:[12,25],pose(ctx,age,target,out){put(out,ctx.eye.pos);out.yaw=ctx.eye.yaw;out.pitch=ctx.eye.pitch;}},
  {id:'surveillance',weight:15,duration:[6,9],needs:'coin',pose(ctx,age,target,out){put(out,target.pos);F.lookAt(target.pos,ctx.eye.pos,out);}},
  {id:'colosse',weight:ctx=>ctx.combat?40:0,duration:[6,10],needs:'boss',transition:'fly',pose(ctx,age,target,out){
    const a=.4*age,p=target.pos;out.pos[0]=p[0]+22*Math.cos(a);out.pos[1]=p[1]+6;out.pos[2]=p[2]+22*Math.sin(a);F.lookAt(out.pos,p,out);}},
  {id:'survol',weight:ctx=>ctx.time<4?100:0,duration:[4,4],transition:'fly',pose(ctx,age,target,out){out.pos[0]=-30+5*age;out.pos[1]=15;out.pos[2]=-30;out.yaw=.8;out.pitch=-.3;}}];
const poseOf=f=>[...f.pose.pos,f.pose.yaw,f.pose.pitch,f.pose.roll,f.pose.fov];
const count=(list,key)=>list.reduce((m,e)=>(m[e[key]]=(m[e[key]]||0)+1,m),{});

// 10 min : journal à chaque changed, empreinte de toutes les poses, contrôles de F2 à F5 sur le film entier.
function film(seed){
  const dir=F.director({seed,shots:toyShots()}),toy=toyContext(),h=F.hasher(),log=[],bounds=Object.fromEntries(toyShots().map(s=>[s.id,s.duration]));
  let took=0,last=null,worstStep=0,colosseWithoutBoss=0,late=[Infinity,-Infinity],flights=0;
  for(let i=0;i<36000;i++){
    const ctx=toy.at(i/60),f=dir.update(DT,ctx),pose=poseOf(f);took+=DT;
    if(f.changed){
      const prev=log[log.length-1];
      if(prev&&f.reason==='time'){const over=took-(prev.flight+prev.hold);late[0]=Math.min(late[0],over);late[1]=Math.max(late[1],over);}
      log.push({i,shot:f.shot,target:f.target&&f.target.id,reason:f.reason,hold:f.hold,flight:f.flight,inBounds:f.hold>=bounds[f.shot][0]&&f.hold<=bounds[f.shot][1]});
      if(f.flight>0)flights++;took=0;
    }
    // Plus grand déplacement d'une image à la suivante pendant un vol, première image du vol comprise.
    if(f.flying&&last)worstStep=Math.max(worstStep,Math.hypot(pose[0]-last[0],pose[1]-last[1],pose[2]-last[2]));
    if(f.shot==='colosse'&&!ctx.points.some(p=>p.kind==='boss'))colosseWithoutBoss++;
    for(const v of pose)h.number(v);
    last=pose;
  }
  const repeats=log.filter((e,k)=>k>0&&e.shot===log[k-1].shot).length;
  return {changes:log.length,byShot:count(log,'shot'),byReason:count(log,'reason'),repeats,holdsInBounds:log.every(e=>e.inBounds),
    colosseWithoutBoss,flights,timeEndLateness:{min:late[0],max:late[1],dt:DT},worstFlightStepMetres:+worstStep.toFixed(4),
    poseDigest:h.result(),journalDigest:sha(JSON.stringify(log))};
}
// F5 : A en [0,2,0] (coupe), B en [30,2,40] (vol) ; d = 50.
function flightAB(){
  const at=p=>(ctx,age,t,out)=>{put(out,p);out.yaw=0;out.pitch=0;};
  const dir=F.director({shots:[{id:'A',weight:1,duration:[1,1],pose:at([0,2,0])},{id:'B',weight:1,duration:[1,1],transition:'fly',pose:at([30,2,40])}]});
  let flight=null,worst=0,last=null,arrived=null,previous=null,watching=false;
  for(let i=0;i<600&&arrived===null;i++){
    const f=dir.update(DT,{}),p=[...f.pose.pos];
    if(f.changed){watching=f.shot==='B'&&previous==='A';if(watching)flight=f.flight;previous=f.shot;}
    if(watching&&f.flying)worst=Math.max(worst,Math.hypot(p[0]-last[0],p[1]-last[1],p[2]-last[2]));
    if(watching&&!f.flying)arrived=p.join(',')==='30,2,40';
    last=p;
  }
  return {d:50,flight,expected:'clamp(1.8 + 50/160, 2.2, 5.5) = 2.2',worstStepMetres:+worst.toFixed(6),bound:+(1.875*50/flight*DT+1e-9).toFixed(6),arrivedExactly:arrived};
}
// F7 : deux coins à 50 m l'un de l'autre, avoid {count:1} : part des choix de « coin » qui reprennent la cible précédente.
function repeatRate(avoid){
  const points=[{id:'a',kind:'coin',pos:[0,0,0]},{id:'b',kind:'coin',pos:[50,0,0]}],pose=(c,a,t,out)=>{out.pos[0]=1;out.pos[1]=0;out.pos[2]=0;out.yaw=out.pitch=0;};
  const dir=F.director({seed:1,avoid,shots:[{id:'coin',weight:1,duration:[1,2],needs:'coin',pose},{id:'simple',weight:1,duration:[1,2],pose}]});
  let previous=null,same=0,choices=0;
  for(let i=0;choices<400;i++){const f=dir.update(DT,{points});if(f.changed&&f.shot==='coin'){if(previous!==null){choices++;if(f.target.id===previous)same++;}previous=f.target.id;}}
  return {avoid,choices,sameTarget:+(same/choices).toFixed(4)};
}

// Coût : boucles de même texte, l'une autour du réalisateur, l'autre autour d'un faux réalisateur (le contexte seul).
const cpu=()=>{const u=process.threadCpuUsage();return u.user+u.system;};
const median=a=>[...a].sort((x,y)=>x-y)[a.length>>1];
async function cost(){
  const N=1e6,toy=toyContext(3),dir=F.director({shots:toyShots()}),idle={frame:{changed:false},update(dt,c){return this.frame;}};
  const run=()=>{let changes=0;for(let i=0;i<N;i++){if(dir.update(DT,toy.at(i/60)).changed)changes++;}return changes;};
  const control=()=>{let changes=0;for(let i=0;i<N;i++){if(idle.update(DT,toy.at(i/60)).changed)changes++;}return changes;};
  const starts=[],observer=new PerformanceObserver(list=>{for(const e of list.getEntries())starts.push(e.startTime);});observer.observe({entryTypes:['gc']});
  const times={director:[],control:[]},windows=[],gcs={director:0,control:0},settle=async()=>{for(let j=0;j<4;j++)await new Promise(r=>setImmediate(r));};
  let changes=0;
  for(let k=0;k<6;k++)for(const [name,f] of [['director',run],['control',control]]){
    const t0=performance.now(),c0=cpu(),n=f(),c1=cpu(),t1=performance.now();
    await settle();
    if(k===0)continue;
    times[name].push((c1-c0)*1000/N);windows.push([name,t0,t1]);
    if(name==='director')changes=n;
  }
  await settle();observer.disconnect();
  for(const [name,t0,t1] of windows)gcs[name]+=starts.filter(t=>t>=t0&&t<=t1).length;
  const r=v=>+v.toFixed(1);
  return {updates:N,passes:5,warmup:1,shotChanges:changes,points:'7 hors combat, 8 en combat',
    nsPerUpdate:{director:{median:r(median(times.director)),min:r(Math.min(...times.director))},control:{median:r(median(times.control)),min:r(Math.min(...times.control))},
      net:r(median(times.director)-median(times.control))},gcDuringMeasuredPasses:gcs};
}
// Allocations : image courante (orbite en vol, cible relue, valid, cutIf) dans un module neuf où update ne voit qu'une
// fonction pose, puis dans le module des essais précédents ; catalogue de jeu (une pose par plan) ; catalogue jouet de
// l'annexe 1 (lookAt dans les poses) ; lookAt seul.
function allocation(){
  const N=3e5,heap=()=>v8.getHeapStatistics().used_heap_size,fresh=()=>loadRealm({modules:['demo']}).window.FDemo;
  const measure=f=>{gc();const prof=new v8.GCProfiler();prof.start();const h0=heap(),changes=f();let bytes=heap()-h0;
    for(const e of prof.stop().statistics)bytes+=e.beforeGC.heapStatistics.usedHeapSize-e.afterGC.heapStatistics.usedHeapSize;return {bytes,changes};};
  function compare(dir,toy){
    const idle={frame:{changed:false},update(dt,c){return this.frame;}};let a=0,b=0;
    const run=()=>{let c=0;for(let i=a;i<a+N;i++)if(dir.update(DT,toy.at(i/60)).changed)c++;a+=N;return c;};
    const control=()=>{let c=0;for(let i=b;i<b+N;i++)if(idle.update(DT,toy.at(i/60)).changed)c++;b+=N;return c;};
    for(let k=0;k<3;k++){run();control();}
    const r=[],c=[],ch=[];
    for(let k=0;k<5;k++){const m=measure(run);r.push(m.bytes);ch.push(m.changes);c.push(measure(control).bytes);}
    return {updates:N,bytesPerUpdate:+((median(r)-median(c))/N).toFixed(3),shotChangesPerPass:median(ch)};
  }
  const fixed=(c,age,t,out)=>{out.pos[0]=1;out.pos[1]=2;out.pos[2]=3;out.yaw=.5;out.pitch=.1;};
  const orbit=(c,age,t,out)=>{const p=t.pos,a=.4*age;out.pos[0]=p[0]+22*Math.cos(a);out.pos[1]=p[1]+6;out.pos[2]=p[2]+22*Math.sin(a);out.yaw=a;out.pitch=-.3;out.roll=.01*a;out.fov=70+Math.sin(a);};
  const both=(c,age,t,out)=>t===null?fixed(c,age,t,out):orbit(c,age,t,out);
  const one=()=>({at(time){this.ctx.time=time;return this.ctx;},ctx:{time:0,points:[{id:'boss',kind:'boss',pos:[20,3,0]}]}});
  const steady=M=>M.director({fly:{min:1e5,max:1e5},shots:[{id:'ouverture',weight:c=>c.time<1?1:0,duration:[1,1],pose:both},
    {id:'orbite',weight:c=>c.time>=1?40:0,duration:[1e6,1e6],needs:'boss',transition:'fly',valid:c=>c.points.length>0,cutIf:(c,age)=>age<0,pose:both}]});
  const alone=steady(fresh()),shared=steady(F);
  const game=fresh().director({shots:[{id:'fixe',weight:60,duration:[2,4],pose:fixed},
    {id:'coin',weight:15,duration:[1,3],needs:'coin',pose(c,age,t,out){put(out,t.pos);out.yaw=age;out.pitch=-.2;}},
    {id:'orbite',weight:c=>c.combat?40:0,duration:[2,4],needs:'boss',transition:'fly',valid:c=>c.points.length>0,cutIf:(c,age)=>age<0,pose:orbit},
    {id:'survol',weight:c=>c.time%30<4?100:0,duration:[2,3],transition:'fly',cutIf:(c,age)=>age>3,pose(c,age,t,out){out.pos[0]=-30+5*age;out.pos[1]=15;out.pos[2]=-30;out.yaw=.8;out.pitch=-.3;}}]});
  // lookAt seul : la boucle témoin fait les mêmes écritures sans l'appel.
  const L=fresh(),from=[0,1.5,0],to=[3,2,-4],look={yaw:0,pitch:0};let u=0,w=0;
  const aim=()=>{for(let i=u;i<u+N;i++){to[0]=3+Math.sin(i*.01);to[2]=-4+Math.cos(i*.01);L.lookAt(from,to,look);}u+=N;return 0;};
  const still=()=>{for(let i=w;i<w+N;i++){to[0]=3+Math.sin(i*.01);to[2]=-4+Math.cos(i*.01);look.yaw=to[0];}w+=N;return 0;};
  for(let k=0;k<3;k++){aim();still();}
  const la=[],ls=[];for(let k=0;k<5;k++){la.push(measure(aim).bytes);ls.push(measure(still).bytes);}
  return {method:'volume exact : tas grandi pendant la passe + octets rendus par chaque ramassage (v8.GCProfiler) ; boucle témoin de même texte retranchée ; médianes de 5 passes après 3 de chauffe ; module neuf pour chaque cas, sauf steadyAfterOtherPoses',
    steadyOnePose:{...compare(alone,one()),flying:alone.frame.flying,shot:alone.frame.shot,note:'une seule fonction pose vue par update, que V8 intègre'},
    steadyAfterOtherPoses:{...compare(shared,one()),flying:shared.frame.flying,shot:shared.frame.shot,note:'même cas, dans le module qui a déjà appelé les poses des autres essais : age mis en boîte à chaque appel'},
    gameCatalogue:{...compare(game,toyContext()),note:'une fonction pose par plan, comme un jeu'},
    toyCatalogue:{...compare(fresh().director({shots:toyShots()}),toyContext()),note:'annexe 1 : lookAt dans les poses'},
    lookAtBytesPerCall:{value:+((median(la)-median(ls))/N).toFixed(3),note:'Math.hypot(dx, dz) de la section 3.4 ; Math.sqrt(dx*dx+dz*dz) : 0 octet (essai hors dépôt)'}};
}

const seeds={1:film(1),2:film(2)},again=film(1);
const result={schema:'fdemo-md5-director-v1',
  command:'node docs/chantier-moteur/preuves/module-demo/MD-5/director.mjs --out docs/chantier-moteur/preuves/module-demo/MD-5/director.json',
  before:BEFORE,sourceSha256:{before:sha(texts.before),after:sha(texts.after)},sourceBytes:{before:Buffer.byteLength(texts.before),after:Buffer.byteLength(texts.after)},
  environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,cores:os.cpus().length,loadavg:os.loadavg().map(v=>+v.toFixed(2))},
  directorExported:{before:typeof before.director,after:typeof F.director},
  toyTenMinutes:{seeds,sameSeedSameJournal:again.journalDigest===seeds[1].journalDigest&&again.poseDigest===seeds[1].poseDigest,
    seed2Differs:seeds[2].journalDigest!==seeds[1].journalDigest},
  flightAB:flightAB(),avoid:[repeatRate({count:1}),repeatRate({count:1,factor:1})],
  cost:await cost(),allocation:allocation()};
const text=JSON.stringify(result,null,1)+'\n';
if(OUT)writeFileSync(OUT,text);
process.stdout.write(text);
