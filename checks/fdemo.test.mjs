import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import v8 from 'node:v8';
import {hasher as proofHasher} from '../tools/proof/digest.mjs';
import {loadRealm} from '../tools/realm-loader.mjs';
import {PerformanceObserver,performance} from 'node:perf_hooks';
const SOURCE=readFileSync(new URL('../src/demo.js',import.meta.url),'utf8');
const context={};vm.createContext(context);vm.runInContext(SOURCE,context,{filename:'demo.js'});
const D=context.FDemo;
const plain=v=>JSON.parse(JSON.stringify(v));            // objet d'un autre domaine → objet ordinaire
const sameBytes=(a,b)=>a.length===b.length&&Array.from(a).every((v,i)=>v===b[i]);
const code=c=>e=>e&&e.code===c;                         // assert.throws(fn, code('FDEMO_FORMAT'))

// Fonctions de 3.1 déjà livrées, dans l'ordre de l'export : à compléter à chaque étape.
const API=['rng','hasher','seedFor','smootherstep','wrapAngle','lookAt','schema','recorder','player','replay','director','attract','runner'];
const draws=(r,n,kind='u32')=>Array.from({length:n},()=>r[kind]());

// Schéma METAL d'aujourd'hui (section 3.5) : un exemple pour les tests, il n'est pas dans FDemo.
const METAL_FIELDS=[
  {name:'moveX',type:'i8',scale:127},{name:'moveY',type:'i8',scale:127},
  {name:'lookX',type:'i16',scale:8192},{name:'lookY',type:'i16',scale:8192},
  {name:'buttons',type:'bits',names:['fire','fireLeft','dash','pulse','melee','interact','sprint','assist']},
  {name:'weapon',type:'u8'}];
const METAL_NAMES=['moveX','moveY','lookX','lookY','fire','fireLeft','dash','pulse','melee','interact','sprint','assist','weapon'];

// Pilote jouet (annexe 1) : des entrées brutes qui ne tombent pas sur les pas de quantification.
function toyPilot(i,s,raw){
  raw.moveX=Math.sin(i*.013)*1.3;raw.moveY=Math.cos(i*.007);raw.lookX=.02*Math.sin(i*.07)+(s.x>20?-.01:.004);raw.lookY=.01*Math.sin(i*.05);
  raw.fire=i%37<9;raw.fireLeft=i%101<3;raw.dash=i%240===0;raw.pulse=i%600===300;raw.melee=i%450===100;raw.interact=false;raw.sprint=i%300<120;raw.assist=false;
  raw.weapon=i%500===0?(i/500)%4:undefined;
}

// Simulation jouet (annexe 1) : déterministe, son aléa vient de D.rng(seed), conventions de déplacement de METAL.
function toySim(D,seed){
  const rng=D.rng(seed),s={t:0,x:0,z:0,yaw:0,pitch:0,vx:0,vz:0,hp:100,score:0,boosts:0,weapon:0,fired:0,enemies:[]};
  for(let i=0;i<24;i++)s.enemies.push({x:rng.range(-30,30),z:rng.range(-30,30),hp:3,phase:rng.next()*6.283});
  function step(dt,input){
    s.t+=dt;s.yaw+=input.lookX;s.pitch=Math.max(-1.2,Math.min(1.2,s.pitch+input.lookY));
    const c=Math.cos(s.yaw),n=Math.sin(s.yaw),sp=input.sprint?9:5,k=Math.min(1,dt*8);
    const tx=(c*input.moveX+n*input.moveY)*sp,tz=(n*input.moveX-c*input.moveY)*sp;
    s.vx+=(tx-s.vx)*k;s.vz+=(tz-s.vz)*k;s.x+=s.vx*dt;s.z+=s.vz*dt;
    if(Number.isInteger(input.weapon))s.weapon=input.weapon;
    for(const e of s.enemies){e.phase+=dt*(.5+rng.next());e.x+=Math.cos(e.phase)*dt*2;e.z+=Math.sin(e.phase*1.3)*dt*2;}
    if(input.fire){
      s.fired++;
      // Ennemi le plus proche devant : produit scalaire > 0,8 avec [sin(yaw), −cos(yaw)], à moins de 25 m.
      let target=null,best=25;
      for(const e of s.enemies){const dx=e.x-s.x,dz=e.z-s.z,d=Math.hypot(dx,dz);if(d>0&&d<best&&dx*n-dz*c>.8*d){target=e;best=d;}}
      if(target&&--target.hp<=0){s.score++;target.x=rng.range(-30,30);target.z=rng.range(-30,30);target.hp=3;}
    }
  }
  function command(type,data){if(type==='boost'){s.boosts++;s.vx+=data.v;}}
  function digest(){const h=D.hasher();for(const k of ['t','x','z','yaw','pitch','vx','vz','hp','score','boosts','weapon','fired'])h.number(s[k]);for(const e of s.enemies)h.number(e.x).number(e.z).number(e.hp).number(e.phase);return h.word(rng.state).result();}
  return {state:s,step,command,digest};
}

// Enregistrement type (annexe 1), dans le même ordre partout. plan : [{info, seed, steps, commands:{n:[[type, data]…]}, dt(i)}].
// Rend l'enregistreur et, par scène, la copie de chaque sortie de rec.step, les dt, les empreintes prises et l'état final.
// onStep(rec, k, i, raw) voit aussi l'entrée brute du pas.
function recordToy(header,plan,options,onStep=()=>{}){
  const rec=D.recorder(header,options),raw={},scenes=[];
  for(const [k,scene] of plan.entries()){
    rec.scene(scene.info);
    const sim=toySim(D,scene.seed),outputs=[],dts=[],sums={};
    const issue=n=>{for(const [type,data] of scene.commands?.[n]||[]){rec.command(type,data);sim.command(type,data);}};
    const sum=()=>{sums[rec.steps]=sim.digest();rec.checksum(sums[rec.steps]);};
    sum();
    for(let i=0;i<scene.steps;i++){
      issue(i);
      toyPilot(i,sim.state,raw);
      const q=rec.step(raw,scene.dt?.(i));
      outputs.push(plain(q));dts.push(rec.dt);
      sim.step(rec.dt,q);
      if(rec.checksumDue())sum();
      onStep(rec,k,i,raw);
    }
    issue(scene.steps);
    scenes.push({outputs,dts,sums,state:plain(sim.state)});
  }
  return {rec,scenes};
}
const TOY_HEADER={game:'jouet',gameVersion:'1.0',simHash:'sha-jouet',simVersion:{sim:3},engine:'node',checksumEvery:60,fields:METAL_FIELDS,meta:{lot:'MD-3',note:'été €'}};
const TOY_PLAN=[{info:{seed:5,index:0},seed:5,steps:500,commands:{0:[['boost',{v:1.5}],['mark',{label:'départ €',ok:true}]],250:[['boost',{v:-.75}]],500:[['mark',null]]}},
  {info:{seed:9,index:1},seed:9,steps:300}];
// Petit enregistrement de deux scènes, avec empreintes et commandes, pour les refus du lecteur.
const sample=()=>recordToy({...TOY_HEADER,checksumEvery:30},[{info:{k:0},seed:3,steps:120,commands:{0:[['boost',{v:1}]],120:[['mark','fin']]}},{info:{k:1},seed:4,steps:50}]).rec.end();
const headerLength=bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true);
const headerOf=bytes=>JSON.parse(Buffer.from(bytes.buffer,bytes.byteOffset+8,headerLength(bytes)).toString('utf8'));
// Reconstruit un enregistrement dont l'en-tête est modifié par edit (ou remplacé par ce qu'il rend) : signature, longueur, JSON, corps.
function rebuild(bytes,edit){
  const header=headerOf(bytes),value=edit(header);
  const head=Buffer.from(JSON.stringify(value===undefined?header:value),'utf8'),body=bytes.subarray(8+headerLength(bytes)),out=new Uint8Array(8+head.length+body.length);
  out.set(bytes.subarray(0,4));new DataView(out.buffer).setUint32(4,head.length,true);out.set(head,8);out.set(body,8+head.length);
  return out;
}
const refusal=(fn,label)=>{try{fn();}catch(e){return e;}return assert.fail('accepté : '+label);};

// ---------------------------------------------------------------- Groupe A : module

test('A1 module exposé, forme 3.1, chargeable en domaine principal',()=>{
  assert.ok(D&&typeof D==='object','FDemo exposé');
  assert.equal(D.FORMAT,1);assert.equal(D.MAGIC,'FDM1');
  for(const k of API)assert.equal(typeof D[k],'function',k+' est une fonction');
  assert.deepEqual(Object.keys(D),['FORMAT','MAGIC',...API]);
  assert.match(SOURCE,/^\/\* FERRO — mode démo : [^\n]*\*\/\n\(function\(G\)\{\n  'use strict';\n/,'en-tête de 3.1');
  assert.ok(SOURCE.endsWith("\n})(typeof window!=='undefined'?window:globalThis);\n"),'pied de 3.1');
  // Le banc et la preuve METAL chargent FDemo par tools/realm-loader.mjs, qui repère « G.FDemo= ».
  assert.deepEqual([...SOURCE.matchAll(/(?:window|globalThis|self|G)\.F[A-Za-z0-9_$]+\s*=/g)].map(m=>m[0]),['G.FDemo='],'un seul export, de la forme 3.1');
  const main=loadRealm({modules:['demo']}).window.FDemo;
  assert.ok(main&&main!==D,'FDemo rendu par tools/realm-loader.mjs');
  assert.equal(Object.getPrototypeOf(main.rng(1)),Object.prototype,'objets du domaine principal');
  assert.deepEqual(Object.keys(main),Object.keys(D));
  assert.deepEqual(draws(main.rng(96),5),draws(D.rng(96),5));
  assert.equal(main.hasher().number(1.5).word(0xdeadbeef).byte(7).result(),4073073363);
});

test('A2 motifs interdits et taille',()=>{
  // Only the opt-in title controller reads its injected browser clock.
  assert.doesNotMatch(SOURCE.slice(0,SOURCE.indexOf('  function attract(')),/Math\.random|\bDate\b|performance\.|setTimeout|setInterval|requestAnimationFrame|\bBuffer\b|\brequire\s*\(|\bprocess\.|\bimport\s*\(|\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|TextEncoder|TextDecoder|structuredClone|console\./);
  assert.doesNotMatch(SOURCE,/<\/script/i);
  assert.doesNotMatch(SOURCE,/\binstanceof\b/,'jamais d’instanceof (annexe 4, piège 1)');
  assert.ok(Buffer.byteLength(SOURCE,'utf8')<=30000,'src/demo.js : '+Buffer.byteLength(SOURCE,'utf8')+' octets');
});

// ---------------------------------------------------------------- Groupe B : outils

test('B1 rng : valeurs de référence, graine et état',()=>{
  const r=D.rng(1);
  assert.equal(r.state,1);
  assert.deepEqual(draws(r,5),[2693262067,11749833,2265367787,4213581821,4159151403]);
  assert.equal(r.state,567894474);
  assert.deepEqual(draws(D.rng(96),5),[266758267,411331306,1195603051,3545778728,3433470034]);
  assert.deepEqual(draws(D.rng(0),5),[1144304738,1416247,958946056,627933444,2007157716]);
  assert.deepEqual(draws(D.rng(1),3,'next'),[0.6270739405881613,0.002735721180215478,0.5274470399599522]);
  assert.equal(D.rng(-1).state,4294967295);
  assert.deepEqual(draws(D.rng(-1),4),draws(D.rng(4294967295),4));
  assert.deepEqual(draws(D.rng(2**32+1),4),draws(D.rng(1),4));
  for(const seed of [-.5,NaN,undefined])assert.deepEqual(draws(D.rng(seed),4),draws(D.rng(0),4),'graine '+seed+' : >>>0');
  const a=D.rng(7);draws(a,13);
  const saved=a.state,first=draws(a,40);
  a.state=saved;assert.deepEqual(draws(a,40),first,'remettre l’état rejoue la suite');
  const b=D.rng(99);b.state=saved;assert.deepEqual(draws(b,40),first,'un autre générateur aussi');
  b.state=-1;assert.equal(b.state,4294967295);
  b.state=2**32+5;assert.equal(b.state,5);
  for(const v of [-.5,NaN]){b.state=v;assert.equal(b.state,0);assert.deepEqual(draws(b,4),draws(D.rng(0),4),'état '+v+' : >>>0');}
  const c=D.rng(3),d=D.rng(3);
  for(let i=0;i<1000;i++){const v=c.next();assert.equal(v,d.u32()/4294967296);assert.ok(v>=0&&v<1);}
});

test('B2 rng.pick : pondération, un tirage par appel',()=>{
  const r=D.rng(11);let ones=0;
  for(let i=0;i<10000;i++){const k=r.pick([0,3,0,1]);assert.ok(k===1||k===3,'indice '+k);if(k===1)ones++;}
  assert.ok(ones>=7300&&ones<=7700,'part de l’indice 1 : '+ones/10000);
  assert.equal(D.rng(3).pick([0,0]),-1);
  // Lecture directe de 3.4, contre un générateur jumeau : même indice, même état après chaque appel.
  function reference(twin,weights,n=weights.length){
    const w=Array.from({length:n},(_,i)=>Number.isFinite(weights[i])&&weights[i]>0?weights[i]:0);
    const sum=w.reduce((s,v)=>s+v,0),x=twin.next()*sum;
    if(!(sum>0))return -1;
    let cum=0;for(let i=0;i<n;i++)if(w[i]>0&&x<(cum+=w[i]))return i;
    return w.findLastIndex(v=>v>0);
  }
  const values=[0,0,1,2.5,7,1e-300,Number.MIN_VALUE,-1,-0,NaN,Infinity,-Infinity,40];
  const probe=D.rng(21),twin=D.rng(21),source=D.rng(22);
  for(let i=0;i<2000;i++){
    const weights=Array.from({length:source.int(7)},()=>values[source.int(values.length)]);
    const n=i%5===0?source.int(weights.length+2):undefined;
    assert.equal(probe.pick(weights,n),reference(twin,weights,n),'appel '+i);
    assert.equal(probe.state,twin.state,'un seul tirage, appel '+i);
  }
  for(const weights of [[],[0,0],[-1,-2],[NaN,Infinity,-Infinity]]){
    const p=D.rng(5),t=D.rng(5);assert.equal(p.pick(weights),-1);t.u32();assert.equal(p.state,t.state,'tirage consommé sans choix possible');
  }
  const limited=D.rng(13);
  for(let i=0;i<1000;i++)assert.notEqual(limited.pick([1,1,5],2),2,'n borne les indices');
  // Tirage tombé pile sur un cumul : c'est l'indice suivant qui sort (r < cumul, strict).
  for(const seed of [1,2,3,96]){
    const v=D.rng(seed).next();assert.ok(v>0&&v+(1-v)===1);
    assert.equal(D.rng(seed).pick([v,1-v]),1);assert.equal(D.rng(seed).pick([v,0,1-v]),2);
  }
  // Repli d'arrondi : avec un poids sous-normal, r arrondi peut égaler le cumul final ; c'est alors
  // le dernier indice de poids positif qui sort (rng(1).next() vaut 0,627 : r arrondi au poids).
  assert.equal(D.rng(1).pick([Number.MIN_VALUE]),0);
  assert.equal(D.rng(1).pick([0,Number.MIN_VALUE,0]),1);
});

test('B3 rng.int et rng.range',()=>{
  const r=D.rng(4);for(let i=0;i<1000;i++)assert.equal(r.int(1),0);
  for(const n of [0,-3,.5]){const s=D.rng(6),before=s.state;assert.equal(s.int(n),0);assert.equal(s.state,before,'int('+n+') ne tire pas');}
  const p=D.rng(9),u=D.rng(9);
  for(let i=0;i<1000;i++){const v=p.int(7);assert.equal(v,Math.floor(u.next()*7));assert.ok(Number.isInteger(v)&&v>=0&&v<7);}
  const q=D.rng(8),t=D.rng(8);
  for(let i=0;i<1000;i++){const v=q.range(2,5);assert.ok(v>=2&&v<5,'dans [2, 5) : '+v);assert.equal(v,2+3*t.next());}
});

test('B4 hasher : identique à tools/proof/digest.mjs, valeurs de référence',()=>{
  const pool=[0,-0,1.5,-2.25,NaN,Infinity,-Infinity,1e-300,2**53,Math.PI],r=D.rng(5);
  for(let round=0;round<300;round++){
    const mine=D.hasher(),proof=proofHasher(),ops=1+r.int(12);
    for(let o=0;o<ops;o++){
      const kind=r.int(3);
      if(kind===0){const v=r.int(512)-128;mine.byte(v);proof.byte(v);}
      else if(kind===1){const v=r.next()<.8?r.u32():[-1,1.5,2**32+3,-(2**31)][r.int(4)];mine.word(v);proof.word(v);}
      else{const v=r.next()<.5?pool[r.int(pool.length)]:r.range(-1e6,1e6);mine.number(v);proof.number(v);}
    }
    assert.equal(mine.result(),proof.result(),'suite '+round);
  }
  assert.equal(D.hasher().result(),2166136261);
  assert.equal(D.hasher().number(1.5).word(0xdeadbeef).byte(7).result(),4073073363);
  assert.equal(D.hasher().number(0).result(),2615243109);
  assert.equal(D.hasher().number(-0).result(),467811045);
  const accent=proofHasher();accent.word(2);for(const v of [0xE9,0x00,0xAC,0x20])accent.byte(v);
  assert.equal(D.hasher().text('é€').result(),accent.result());
  assert.equal(D.hasher().text('\u{1F600}').result(),D.hasher().word(2).byte(0x3D).byte(0xD8).byte(0x00).byte(0xDE).result(),'unités UTF-16');
  assert.equal(D.hasher().text('').result(),D.hasher().word(0).result());
  assert.equal(D.hasher().bool(true).bool(0).result(),D.hasher().byte(1).byte(0).result());
  const h=D.hasher();
  for(const [method,arg] of [['byte',1],['word',2],['number',3],['bool',true],['text','a'],['reset',undefined]])assert.equal(h[method](arg),h,method+' chaîne');
  assert.equal(h.result(),2166136261,'reset() remet la graine FNV');
  assert.equal(h.reset(5).result(),5);
  assert.equal(D.hasher(123).result(),123);
  assert.equal(D.hasher(-1).result(),4294967295);
});

test('B5 seedFor : valeurs de référence',()=>{
  assert.equal(D.seedFor(1,0,0),246411908);
  assert.equal(D.seedFor(96,2,5),2593382274);
  const r=D.rng(31);
  for(let i=0;i<200;i++){const s=r.u32(),a=r.int(1000),b=r.int(50);assert.equal(D.seedFor(s,a,b),D.hasher().word(s).word(a).word(b).result());}
});

test('B6 smootherstep et wrapAngle',()=>{
  assert.equal(D.smootherstep(.25),0.103515625);
  assert.equal(D.smootherstep(.5),0.5);
  assert.equal(D.smootherstep(.75),0.896484375);
  assert.equal(D.smootherstep(-1),0);assert.equal(D.smootherstep(2),1);assert.equal(D.smootherstep(NaN),0);
  assert.equal(D.smootherstep(0),0);assert.equal(D.smootherstep(1),1);
  assert.equal(D.smootherstep(Infinity),0);assert.equal(D.smootherstep(-Infinity),0);
  for(let i=0;i<=100;i++){const t=i/100;assert.equal(D.smootherstep(t),t*t*t*(t*(t*6-15)+10));}
  const r=D.rng(41),angles=[];
  for(let i=0;i<1000;i++)angles.push(-50+100*i/999,r.range(-50,50));
  for(const a of angles){
    const w=D.wrapAngle(a);
    assert.ok(w>-Math.PI&&w<=Math.PI,'dans ]-π, π] : '+a+' → '+w);
    assert.ok(Math.abs(Math.sin(w)-Math.sin(a))<1e-9&&Math.abs(Math.cos(w)-Math.cos(a))<1e-9,'même direction : '+a);
  }
  assert.equal(D.wrapAngle(Math.PI),Math.PI);
  assert.equal(D.wrapAngle(-Math.PI),Math.PI);
  assert.equal(D.wrapAngle(NaN),0);assert.equal(D.wrapAngle(Infinity),0);
  for(const a of [0,1,-1,3,-3,3.14159])assert.equal(D.wrapAngle(a),a,'déjà dans ]-π, π]');
});

test('B7 lookAt : convention METAL',()=>{
  const forward=(yaw,pitch)=>[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
  const r=D.rng(17);
  for(let i=0;i<50;i++){
    // Distance horizontale d'au moins 0,5 m par construction : pas de boucle de nouveau tirage.
    const from=[r.range(-40,40),r.range(0,10),r.range(-40,40)],angle=r.range(-Math.PI,Math.PI),far=r.range(.5,40);
    const to=[from[0]+Math.sin(angle)*far,from[1]+r.range(-15,15),from[2]-Math.cos(angle)*far];
    const out=D.lookAt(from,to,{yaw:0,pitch:0}),f=forward(out.yaw,out.pitch);
    const d=[to[0]-from[0],to[1]-from[1],to[2]-from[2]],length=Math.hypot(...d);
    const dot=(f[0]*d[0]+f[1]*d[1]+f[2]*d[2])/length;
    assert.ok(dot>1-1e-12,'alignement '+i+' : '+dot);
  }
  const o=[0,0,0],look=to=>D.lookAt(o,to,{yaw:9,pitch:9});
  assert.equal(look([0,0,-1]).yaw,0);assert.equal(look([0,0,-1]).pitch,0);
  assert.equal(look([1,0,0]).yaw,Math.PI/2);
  assert.equal(look([-1,0,0]).yaw,-Math.PI/2);
  assert.equal(look([0,0,1]).yaw,Math.PI);
  assert.equal(look([0,1,-1]).pitch,Math.PI/4);
  assert.equal(look([0,-1,-1]).pitch,-Math.PI/4);
  assert.equal(look([0,3,0]).pitch,Math.PI/2,'visée verticale');
  const camera={pos:[1,2,3],yaw:1.25,pitch:-.5,roll:.1,fov:74};
  assert.equal(D.lookAt([3,4,5],[3,4,5],camera),camera,'rend out');
  assert.deepEqual(plain(camera),{pos:[1,2,3],yaw:1.25,pitch:-.5,roll:.1,fov:74},'from égal à to : out inchangé');
  assert.equal(D.lookAt([0,0,0],[2,0,0],camera),camera);
  assert.deepEqual(plain(camera),{pos:[1,2,3],yaw:Math.PI/2,pitch:0,roll:.1,fov:74},'seuls yaw et pitch changent');
});

test('B8 hasher et rng : aucune allocation après la création (3.4)',async()=>{
  // Domaine principal (le contexte vm fausserait l'optimisation) ; arguments entiers, que l'appelant
  // ne met jamais en boîte. Seuls comptent les ramassages commencés pendant la passe mesurée : Node
  // livre leurs entrées deux tours de boucle plus tard.
  v8.setFlagsFromString('--expose-gc');const gc=vm.runInNewContext('gc');
  const F=loadRealm({modules:['demo']}).window.FDemo,N=2e6,settle=()=>new Promise(r=>setImmediate(r));
  const starts=[],observer=new PerformanceObserver(list=>{for(const e of list.getEntries())starts.push(e.startTime);});
  observer.observe({entryTypes:['gc']});
  const loops={
    byte:(h)=>{for(let i=0;i<N;i++)h.byte(i);},
    word:(h)=>{for(let i=0;i<N;i++)h.word(i*7);},
    number:(h)=>{for(let i=0;i<N;i++)h.number(i);},
    text:(h)=>{for(let i=0;i<N/8;i++)h.text('caméra €');},
    bool:(h)=>{for(let i=0;i<N;i++)h.bool(i&1);},
    int:(h,r)=>{for(let i=0;i<N;i++)r.int(1000);},
    pick:(h,r)=>{const w=[60,15,40,100];for(let i=0;i<N;i++)r.pick(w);},
  };
  const counts={};
  try{
    for(const [name,loop] of Object.entries(loops)){
      const h=F.hasher(),r=F.rng(5);loop(h,r);gc();
      const t0=performance.now();loop(h,r);const t1=performance.now();
      for(let k=0;k<4;k++)await settle();
      counts[name]=starts.filter(t=>t>=t0&&t<=t1).length;
    }
  }finally{observer.disconnect();}
  for(const [name,n] of Object.entries(counts))assert.ok(n<=1,name+' : '+n+' ramassages pendant '+N+' appels');
});

// ---------------------------------------------------------------- Groupe C : schéma

// Un champ seul : la valeur relue après encodage de v.
function through(field){
  const sc=D.schema([field]),view=new DataView(new ArrayBuffer(sc.size));
  return v=>{sc.encode({[field.name]:v},view,0);return sc.decode(view,0,{})[field.name];};
}
// Idempotence exhaustive d'un champ signé : chaque niveau q écrit dans les octets, relu, réécrit, redonne q.
// Rend les niveaux fautifs.
function unstableLevels(type,scale){
  const sc=D.schema([{name:'v',type,scale}]),view=new DataView(new ArrayBuffer(2)),out={},max=type==='i8'?127:32767,wrong=[];
  const read=()=>type==='i8'?view.getInt8(0):view.getInt16(0,true);
  for(let q=-max;q<=max;q++){
    if(type==='i8')view.setInt8(0,q);else view.setInt16(0,q,true);
    sc.decode(view,0,out);
    const decoded=out.v;
    sc.encode(out,view,0);
    if(!Object.is(decoded,q/scale)||!Number.isFinite(decoded)||read()!==q)wrong.push(q);
  }
  return wrong;
}

test('C1 schéma refusé : FDEMO_ARG, pour la cause visée',()=>{
  const refusal=fields=>{try{D.schema(fields);}catch(e){return e;}return assert.fail('schéma accepté : '+JSON.stringify(fields));};
  const bits=n=>Array.from({length:n},(_,k)=>'b'+k);
  const check=(fields,cause,extra={})=>{
    const e=refusal(fields),label=JSON.stringify(fields)??String(fields);
    assert.equal(e.code,'FDEMO_ARG',label);
    assert.match(e.message,/^FDemo : schéma : /,label);
    assert.match(e.message,cause,label+' : '+e.message);
    for(const [k,v] of Object.entries(extra))assert.equal(e[k],v,label+' : e.'+k);
  };
  // Les onze cas de la mission, « un name vide » dans ses deux sens (champ et bit), chacun pour sa propre cause.
  check([],/tableau de champs non vide attendu/);
  check([{name:'a',type:'f32'}],/: a : type inconnu$/,{field:'a',index:0});
  check([{name:'a',type:'i8'}],/: a : scale attendu, nombre fini > 0$/,{field:'a',index:0});
  check([{name:'a',type:'i8',scale:0}],/: a : scale attendu/,{field:'a'});
  check([{name:'a',type:'i8',scale:NaN}],/: a : scale attendu/,{field:'a'});
  check([{name:'a',type:'u8',scale:1}],/: a : scale interdit pour u8$/,{field:'a'});
  check([{name:'b',type:'bits'}],/: b : names attendu, de 1 à 32 chaînes$/,{field:'b'});
  check([{name:'b',type:'bits',names:bits(33)}],/: b : names attendu, de 1 à 32/,{field:'b'});
  check([{name:'',type:'u8'}],/: champ 0 : name attendu, chaîne non vide$/,{index:0});
  check([{name:'b',type:'bits',names:['ok','']}],/: b : nom de bit 1 vide ou invalide$/,{field:'b'});
  check([{name:'fire',type:'u8'},{name:'b',type:'bits',names:['fire']}],/: propriété fire en double$/,{field:'fire',index:1});
  check([{name:'b',type:'bits',names:['x','x']}],/: propriété x en double$/,{field:'x',index:0});
  // Le reste de la validation.
  for(const fields of [undefined,null,{},'i8',{length:1,0:{name:'a',type:'u8'}}])check(fields,/tableau de champs non vide attendu/);
  for(const field of [null,3,'moveX',[{name:'a',type:'u8'}]])check([{name:'a',type:'u8'},field],/: champ 1 : objet attendu$/,{index:1});
  for(const name of [undefined,3,'__proto__'])check([{name,type:'u8'}],/: champ 0 : name attendu/,{index:0});
  for(const type of [undefined,'I8','int8','toString','__proto__',['i8']])check([{name:'a',type}],/: a : type inconnu$/,{field:'a'});
  for(const scale of [Infinity,-1,-0,'127',null,[127]])check([{name:'a',type:'i16',scale}],/: a : scale attendu/,{field:'a'});
  // Échelle si petite que max/scale déborde : le niveau 1 se relirait comme l'infini.
  check([{name:'a',type:'i8',scale:1e-307}],/: a : scale attendu/);
  check([{name:'a',type:'i16',scale:1e-304}],/: a : scale attendu/);
  for(const [type,scale] of [['u16',1],['bits',1],['u8',0],['u8',null]])check([{name:'a',type,scale,names:type==='bits'?['x']:undefined}],/: a : scale interdit pour /,{field:'a'});
  for(const names of ['abc',[],{length:1,0:'x'},null])check([{name:'b',type:'bits',names}],/: b : names attendu/,{field:'b'});
  check([{name:'a',type:'i8',scale:2,names:['x']}],/: a : names réservé au type bits$/,{field:'a'});
  for(const key of [3,null,'__proto__'])check([{name:'b',type:'bits',names:['ok',key]}],/: b : nom de bit 1 vide ou invalide$/,{field:'b'});
  check([{name:'a',type:'u8'},{name:'a',type:'i16',scale:1}],/: propriété a en double$/,{field:'a',index:1});
  check([{name:'b',type:'bits',names:['x']},{name:'c',type:'bits',names:['y','x']}],/: propriété x en double$/,{field:'x',index:1});
  check([{name:'b',type:'bits',names:['fire']},{name:'fire',type:'i8',scale:1}],/: propriété fire en double$/,{field:'fire',index:1});
  // Acceptés : le name d'un champ bits n'est qu'une étiquette, seuls ses names comptent pour l'unicité.
  assert.equal(D.schema([{name:'weapon',type:'bits',names:['fire']},{name:'weapon',type:'u8'}]).size,2);
  assert.equal(D.schema([{name:'b',type:'bits',names:['x']},{name:'b',type:'bits',names:['y']}]).size,2);
  assert.equal(D.schema([{name:'b',type:'bits',names:bits(32)}]).size,4);
  for(const [type,scale] of [['i8',1e-306],['i16',1e-300],['i8',Number.MAX_VALUE],['i16',Number.MIN_VALUE*2**1000]])assert.equal(D.schema([{name:'a',type,scale}]).size,type==='i8'?1:2,type+' '+scale);
  assert.equal(D.schema([{name:'a',type:'u8',scale:undefined,names:undefined}]).size,1);
});

test('C2 schéma METAL : 8 octets, copie normalisée relisible ; 10 bits → 9 octets',()=>{
  const sc=D.schema(METAL_FIELDS);
  assert.deepEqual(Object.keys(sc),['fields','size','names','encode','decode']);
  assert.equal(sc.size,8);
  assert.deepEqual(Array.from(sc.names),METAL_NAMES);
  assert.deepEqual(plain(sc.fields),METAL_FIELDS);
  assert.deepEqual(Array.from(sc.fields,f=>Object.keys(f)),[...Array(4).fill(['name','type','scale']),['name','type','names'],['name','type']]);
  assert.deepEqual(Object.keys(sc.fields[5]),['name','type'],'u8 sans scale');
  // Ce que le lecteur de l'étape 3 fera : recompiler la copie lue dans l'en-tête JSON.
  const again=D.schema(plain(sc.fields));
  assert.equal(again.size,8);
  assert.deepEqual(Array.from(again.names),Array.from(sc.names));
  assert.equal(JSON.stringify(again.fields),JSON.stringify(sc.fields));
  for(const field of [{name:'a',type:'u16'},{name:'a',type:'u8'},{name:'a',type:'i16',scale:3},{name:'a',type:'bits',names:['x','y']}]){
    const copy=D.schema([field]).fields;
    assert.equal(JSON.stringify(copy),JSON.stringify([field]));
    assert.equal(JSON.stringify(D.schema(plain(copy)).fields),JSON.stringify([field]),'aller-retour '+field.type);
  }
  // Clés dans l'ordre name, type, scale ou names, quel que soit l'ordre de la source ; clés inconnues écartées.
  assert.equal(JSON.stringify(D.schema([{scale:2,note:'x',type:'i8',name:'a'},{names:['p'],type:'bits',name:'b'},{type:'u16',name:'c',extra:1}]).fields),
    '[{"name":"a","type":"i8","scale":2},{"name":"b","type":"bits","names":["p"]},{"name":"c","type":"u16"}]');
  // Copie : modifier la source après coup ne change ni la copie ni l'encodage.
  const source=plain(METAL_FIELDS),owned=D.schema(source);
  source[0].scale=1;source[4].names[0]='autre';source[5].type='u16';source.push({name:'x',type:'u8'});
  assert.deepEqual(plain(owned.fields),METAL_FIELDS);
  assert.equal(owned.size,8);
  // Modifier ce que rend schema ne change pas non plus l'encodage.
  owned.fields[4].names.push('jump');owned.fields[4].names[0]='autre';owned.fields[0].scale=1;owned.names.length=0;
  const view=new DataView(new ArrayBuffer(8));owned.encode({moveX:.5,fire:true,jump:true,autre:true,weapon:2},view,0);
  assert.deepEqual(Array.from(new Uint8Array(view.buffer)),[64,0,0,0,0,0,1,2]);
  assert.deepEqual(plain(owned.decode(view,0,{})),{moveX:64/127,moveY:0,lookX:0,lookY:0,fire:true,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,sprint:false,assist:false,weapon:2});
  // Après le lot 09 : jump et bash, 10 bits, 9 octets par pas.
  const ten=D.schema(METAL_FIELDS.map(f=>f.type==='bits'?{...f,names:[...f.names,'jump','bash']}:f));
  assert.equal(ten.size,9);
  assert.deepEqual(Array.from(ten.names),[...METAL_NAMES.slice(0,12),'jump','bash','weapon']);
});

test('C3 i8, scale 127 : exhaustif, arrondi, bornes, non finis, −0',()=>{
  const read=through({name:'v',type:'i8',scale:127}),wrong=[];
  for(let q=-127;q<=127;q++)if(!Object.is(read(q/127),q/127))wrong.push(q);
  assert.deepEqual(wrong,[],'niveaux q/127 relus exactement');
  assert.equal(read(1.5),1);assert.equal(read(-2),-1);assert.equal(read(1e300),1);assert.equal(read(-Number.MAX_VALUE),-1);
  for(const v of [Infinity,-Infinity,NaN,'3',undefined,null,true,{},[1]])assert.ok(Object.is(read(v),0),String(v)+' → 0');
  assert.equal(read(.5/127),1/127,'(0,5/127)·127 vaut 0,5 exactement : arrondi à 1');
  assert.ok(Object.is(read(-.5/127),0),'−0,5/127 → +0');
  for(const v of [-0,-.3/127,-1e-320])assert.ok(Object.is(read(v),0),v+' → +0');
  assert.equal(read(2.5/127),3/127);assert.equal(read(-2.5/127),-2/127,'moitiés vers +∞, comme Math.round');
  const sc=D.schema([{name:'v',type:'i8',scale:127}]),bytes=new Uint8Array(1),view=new DataView(bytes.buffer);
  for(const [v,byte] of [[1,0x7F],[-1,0x81],[-5,0x81],[0,0],[-1/127,0xFF]]){sc.encode({v},view,0);assert.equal(bytes[0],byte,'octet de '+v);}
  for(const scale of [127,1,.75,3,1e5,1e-306,Number.MAX_VALUE])assert.deepEqual(unstableLevels('i8',scale),[],'i8, scale '+scale);
});

test('C4 i16, scale 8192 : exhaustif de −32767 à 32767, bornes ±4 rad',()=>{
  const read=through({name:'v',type:'i16',scale:8192}),wrong=[];
  for(let q=-32767;q<=32767;q++)if(!Object.is(read(q/8192),q/8192))wrong.push(q);
  assert.deepEqual(wrong,[],'niveaux q/8192 relus exactement');
  assert.equal(read(4),32767/8192);assert.equal(read(-4),-32767/8192);
  assert.equal(read(0.01),82/8192);
  assert.equal(read(1e9),32767/8192);assert.equal(read(-1e300),-32767/8192);
  for(const v of [Infinity,NaN,'0.5',undefined,null])assert.ok(Object.is(read(v),0),String(v)+' → 0');
  assert.ok(Object.is(read(-.4/8192),0),'−0 relu comme +0');
  const sc=D.schema([{name:'v',type:'i16',scale:8192}]),bytes=new Uint8Array(2),view=new DataView(bytes.buffer);
  for(const [v,pair] of [[258/8192,[2,1]],[-1/8192,[0xFF,0xFF]],[4,[0xFF,0x7F]],[-4,[0x01,0x80]]]){sc.encode({v},view,0);assert.deepEqual(Array.from(bytes),pair,'petit-boutiste : '+v);}
  for(const scale of [8192,1,3,.75,1e-300,Number.MAX_VALUE])assert.deepEqual(unstableLevels('i16',scale),[],'i16, scale '+scale);
});

test('C5 u8 et u16 : entiers gardés, le reste absent',()=>{
  const r8=through({name:'v',type:'u8'}),r16=through({name:'v',type:'u16'}),wrong=[];
  for(let v=0;v<=254;v++)if(r8(v)!==v)wrong.push(v);
  for(let v=0;v<=65534;v+=7)if(r16(v)!==v)wrong.push(v);
  for(const v of [0,1,65533,65534])if(r16(v)!==v)wrong.push(v);
  assert.deepEqual(wrong,[]);
  for(const v of [255,256,-1,-2,-255,1.5,undefined,null,NaN,'3',Infinity,true,{}])assert.equal(r8(v),undefined,'u8 '+String(v));
  for(const v of [65535,65536,-1,-2,1.5,undefined,null,NaN,'3'])assert.equal(r16(v),undefined,'u16 '+String(v));
  assert.ok(Object.is(r8(-0),0));assert.ok(Object.is(r16(-0),0));
  const s8=D.schema([{name:'v',type:'u8'}]),s16=D.schema([{name:'v',type:'u16'}]),bytes=new Uint8Array(2),view=new DataView(bytes.buffer);
  s16.encode({v:258},view,0);assert.deepEqual(Array.from(bytes),[2,1],'u16 petit-boutiste');
  s16.encode({},view,0);assert.deepEqual(Array.from(bytes),[0xFF,0xFF],'u16 absent');
  s8.encode({v:300},view,0);assert.equal(bytes[0],0xFF,'u8 absent');
  bytes[0]=255;assert.equal(s8.decode(view,0,{v:1}).v,undefined,'255 relu comme absent');
  const out=s8.decode(view,0,{});assert.ok(Object.hasOwn(out,'v'),'absent : propriété écrite, valeur undefined');
});

test('C6 bits : 256 et 1 024 combinaisons, bit 0 au poids faible, vérité',()=>{
  for(const n of [8,10]){
    const keys=Array.from({length:n},(_,k)=>'k'+k),sc=D.schema([{name:'boutons',type:'bits',names:keys}]);
    const bytes=new Uint8Array(4),view=new DataView(bytes.buffer),out={};
    assert.equal(sc.size,Math.ceil(n/8));
    for(let m=0;m<1<<n;m++){
      const input={};for(let k=0;k<n;k++)input[keys[k]]=(m>>k&1)===1;
      sc.encode(input,view,0);
      assert.equal(bytes[0]|bytes[1]<<8,m,n+' bits, masque '+m);
      sc.decode(view,0,out);
      for(let k=0;k<n;k++)assert.equal(out[keys[k]],(m>>k&1)===1,'masque '+m+', bit '+k);
      if(n===8)bytes[1]=0;
    }
    assert.ok(!('boutons' in out),'le name d’un champ bits n’est qu’une étiquette');
    assert.deepEqual(Object.keys(out),keys);
  }
  const sc=D.schema([{name:'v',type:'bits',names:['a','b','c','d','e','f','g','h','i','j','k']}]),view=new DataView(new ArrayBuffer(2));
  sc.encode({a:1,b:'x',c:{},d:[],e:0,f:'',g:null,h:undefined,i:NaN,j:-0},view,0);
  assert.deepEqual(plain(sc.decode(view,0,{})),{a:true,b:true,c:true,d:true,e:false,f:false,g:false,h:false,i:false,j:false,k:false});
  sc.encode({k:true},view,0);assert.equal(view.getUint16(0,true),1<<10,'bits hauts inutilisés à 0');
  const wide=D.schema([{name:'v',type:'bits',names:Array.from({length:32},(_,k)=>'w'+k)}]),w=new DataView(new ArrayBuffer(4));
  wide.encode({w31:true,w0:true,w8:true},w,0);assert.equal(w.getUint32(0,true),(2**31+2**8+1)>>>0,'32 bits, le dernier au poids fort de l’octet 3');
  assert.equal(wide.decode(w,0,{}).w31,true);
});

test('C7 idempotence : 10 000 entrées tirées, valeurs hors bornes comprises',()=>{
  const junk=[0,-0,1.5,-2.25,NaN,Infinity,-Infinity,'3',null,undefined,true,false,{},[],1e9,-1e9,1e-320,4,-4,254,255,256,65534,65535,-1];
  const schemas=[METAL_FIELDS,[{name:'a',type:'i8',scale:.75},{name:'b',type:'i16',scale:3},{name:'c',type:'u16'},
    {name:'d',type:'bits',names:['e','f','g','h','i','j','k','l','m']},{name:'n',type:'i8',scale:1000},{name:'o',type:'i16',scale:100},{name:'p',type:'u8'}]];
  const r=D.rng(1234);
  for(const fields of schemas){
    const sc=D.schema(fields),first=new Uint8Array(sc.size),second=new Uint8Array(sc.size);
    const v1=new DataView(first.buffer),v2=new DataView(second.buffer),wrong=[];
    for(let i=0;i<10000;i++){
      const input={};
      for(const name of sc.names){
        const roll=r.int(5);
        input[name]=roll===0?r.range(-6,6):roll===1?junk[r.int(junk.length)]:roll===2?r.int(300)-20:roll===3?r.range(-1,1)*r.next()**8:r.next()<.5;
      }
      sc.encode(input,v1,0);
      const out=sc.decode(v1,0,{});
      sc.encode(out,v2,0);
      const again=sc.decode(v2,0,{});
      if(!sameBytes(first,second)||!sc.names.every(k=>Object.is(again[k],out[k])))wrong.push(i);
    }
    assert.deepEqual(wrong,[],'schéma de '+fields.length+' champs');
  }
});

test('C8 encodage à un offset : exactement size octets écrits, jamais hors de la vue',()=>{
  const sc=D.schema(METAL_FIELDS),input={moveX:1,moveY:-1,lookX:.5,lookY:-.25,fire:true,dash:true,assist:true,weapon:3};
  const bytes=new Uint8Array(20).fill(0xAA),view=new DataView(bytes.buffer);
  sc.encode(input,view,5);
  for(const i of [0,1,2,3,4,13,14,15,16,17,18,19])assert.equal(bytes[i],0xAA,'octet '+i+' touché');
  const alone=new Uint8Array(8);sc.encode(input,new DataView(alone.buffer),0);
  assert.deepEqual(Array.from(alone),[0x7F,0x81,0x00,0x10,0x00,0xF8,0x85,3],'moveX, moveY, lookX, lookY, boutons, arme');
  assert.ok(sameBytes(bytes.subarray(5,13),alone),'mêmes 8 octets qu’à l’offset 0');
  const before=Array.from(bytes),out=sc.decode(view,5,{});
  assert.deepEqual(Array.from(bytes),before,'decode ne touche pas aux octets');
  assert.deepEqual(plain(out),plain(sc.decode(new DataView(alone.buffer),0,{})));
  assert.deepEqual(plain(out),{moveX:1,moveY:-1,lookX:.5,lookY:-.25,fire:true,fireLeft:false,dash:true,pulse:false,melee:false,interact:false,sprint:false,assist:true,weapon:3});
  sc.encode(input,view,12);assert.ok(sameBytes(bytes.subarray(12,20),alone),'dernier offset valide');
  // Offsets relatifs à la vue ; une vue trop courte lève l'erreur de bornes du DataView, sans écrire au-delà.
  const big=new Uint8Array(32).fill(0xAA),sub=new DataView(big.buffer,7,13);
  sc.encode(input,sub,5);
  assert.ok(sameBytes(big.subarray(12,20),alone));
  assert.ok(Array.from(big).every((b,i)=>i>=12&&i<20||b===0xAA),'rien hors de [12, 20)');
  big.fill(0xAA);
  assert.throws(()=>sc.encode(input,sub,6),e=>e.name==='RangeError');
  assert.ok(Array.from(big).every((b,i)=>i>=7&&i<20||b===0xAA),'rien hors de la vue');
  assert.throws(()=>sc.decode(sub,6,{}),e=>e.name==='RangeError');
});

test('C9 encode et decode : aucune allocation (3.5)',async()=>{
  // Domaine principal, comme B8. Un objet réécrit en place, comme l'input du jeu, garde ses flottants sans boîte :
  // les lire sous un nom variable en crée une par nombre (4 par pas avec le schéma METAL, autant avec le relais),
  // coût de la lecture générique et non de FDemo. Les entrées d'encode ont donc leurs nombres déjà en boîte.
  v8.setFlagsFromString('--expose-gc');const gc=vm.runInNewContext('gc');
  const F=loadRealm({modules:['demo']}).window.FDemo,sc=F.schema(METAL_FIELDS),N=1e6,COUNT=1024;
  const settle=()=>new Promise(r=>setImmediate(r)),state={x:0};
  const inputs=Array.from({length:COUNT},(_,i)=>{const raw={moveX:null,moveY:null,lookX:null,lookY:null};toyPilot(i*7,state,raw);return raw;});
  const view=new DataView(new ArrayBuffer(COUNT*sc.size)),out={};
  // Sortie de la forme de l'input de src/game.js (ligne 20), créée avec des zéros entiers.
  const game={moveX:0,moveY:0,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:false,assist:false};
  for(let i=0;i<COUNT;i++)sc.encode(inputs[i],view,i*sc.size);
  const starts=[],observer=new PerformanceObserver(list=>{for(const e of list.getEntries())starts.push(e.startTime);});
  observer.observe({entryTypes:['gc']});
  const loops={
    encode:()=>{for(let i=0;i<N;i++)sc.encode(inputs[i&1023],view,(i&1023)*8);},
    decode:()=>{for(let i=0;i<N;i++)sc.decode(view,(i&1023)*8,out);},
    decodeGame:()=>{for(let i=0;i<N;i++)sc.decode(view,(i*5&1023)*8,game);},
    both:()=>{for(let i=0;i<N;i++){const at=(i*7&1023)*8;sc.encode(inputs[i&1023],view,at);sc.decode(view,at,out);}},
  };
  const counts={};
  try{
    for(const [name,loop] of Object.entries(loops)){
      loop();gc();
      const t0=performance.now();loop();const t1=performance.now();
      for(let k=0;k<4;k++)await settle();
      counts[name]=starts.filter(t=>t>=t0&&t<=t1).length;
    }
  }finally{observer.disconnect();}
  for(const [name,n] of Object.entries(counts))assert.ok(n<=1,name+' : '+n+' ramassages pendant '+N+' appels');
  // Valeurs relues : celles d'un décodage dans un objet neuf.
  for(let i=0;i<COUNT;i+=97)assert.deepEqual({...sc.decode(view,i*8,out)},{...sc.decode(view,i*8,{})});
});

// ---------------------------------------------------------------- Groupe D : enregistreur et format

test('D1 rec.step : un seul objet relu, égal au décodage stocké, entrée intacte',()=>{
  const rec=D.recorder({game:'g',simHash:'h',fields:METAL_FIELDS});
  assert.deepEqual(Object.keys(rec.input),METAL_NAMES,'objet de sortie créé d’avance, propriétés du schéma dans l’ordre');
  rec.scene({id:1});
  const a={moveX:.3,moveY:-2,lookX:.0123,lookY:-5,fire:true,dash:1,weapon:3,extra:'x'},b={moveX:-.7,lookX:1e-9,sprint:true,weapon:300,fire:0};
  const snapshot=v=>JSON.stringify(Object.entries(v)),before=[snapshot(a),snapshot(b)];
  const qa=rec.step(a),copyA=plain(qa),qb=rec.step(b);
  assert.equal(qa,qb,'même objet à chaque pas');assert.equal(rec.input,qa);
  assert.deepEqual([snapshot(a),snapshot(b)],before,'entrées reçues intactes');
  assert.deepEqual(Object.keys(qb),METAL_NAMES);
  assert.deepEqual(copyA,{moveX:38/127,moveY:-1,lookX:101/8192,lookY:-32767/8192,fire:true,fireLeft:false,dash:true,pulse:false,melee:false,interact:false,sprint:false,assist:false,weapon:3});
  const bytes=rec.bytes(),sc=D.schema(METAL_FIELDS),body=new DataView(bytes.buffer,8+headerLength(bytes),16);
  assert.deepEqual(copyA,plain(sc.decode(body,0,{})),'pas 1 : décodage de l’enregistrement stocké');
  assert.deepEqual(plain(qb),plain(sc.decode(body,8,{})),'pas 2');
  assert.equal(qb.weapon,undefined);assert.equal(qb.moveX,-89/127);
  assert.ok(Object.is(qb.moveY,0)&&Object.is(qb.lookX,0),'absent et quasi nul relus +0');
});

test('D2 aller-retour : deux scènes jouets de 500 et 300 pas, commandes et empreintes',()=>{
  const {rec,scenes}=recordToy(TOY_HEADER,TOY_PLAN),play=D.player(rec.end());
  const triplets=Object.entries(TOY_PLAN[0].commands).flatMap(([n,list])=>list.map(([type,data])=>[+n,type,data]));
  const expected={format:1,game:'jouet',gameVersion:'1.0',simHash:'sha-jouet',simVersion:{sim:3},engine:'node',hz:60,dtTicks:0,checksumEvery:60,fields:METAL_FIELDS,meta:TOY_HEADER.meta,
    scenes:[{info:TOY_PLAN[0].info,steps:500,checksums:9,commandBytes:Buffer.byteLength(JSON.stringify(triplets)),truncated:false},
      {info:TOY_PLAN[1].info,steps:300,checksums:6,commandBytes:0,truncated:false}]};
  assert.equal(JSON.stringify(play.header),JSON.stringify(expected),'en-tête, clés dans l’ordre de 3.6');
  assert.equal(play.sceneCount,2);assert.equal(play.scene,0,'scène 0 choisie à la création');
  const out={};
  for(const [k,scene] of TOY_PLAN.entries()){
    if(k)assert.equal(play.select(k),play,'select rend le lecteur');
    assert.equal(play.scene,k);assert.equal(play.steps,scene.steps);assert.equal(play.step,0);
    const read=[];
    while(play.next(out)){read.push(plain(out));assert.equal(play.dt,1/60);}
    assert.deepEqual(read,scenes[k].outputs,'scène '+k+' : même suite par next()');
    assert.equal(play.step,scene.steps);assert.equal(play.next(out),false,'next() faux après la fin');assert.equal(play.step,scene.steps);
    for(let n=0;n<=scene.steps;n++){
      const want=(scene.commands?.[n]||[]).map(([type,data])=>({type,data})),got=play.commandsAt(n);
      assert.deepEqual(plain(got),want,'scène '+k+', commandes du pas '+n);
      if(!want.length)assert.ok(got===play.commandsAt(-1)&&Object.isFrozen(got)&&got.length===0,'tableau vide partagé et gelé');
      assert.equal(play.expected(n),scenes[k].sums[n],'scène '+k+', empreinte du pas '+n);
    }
    assert.deepEqual(Object.keys(scenes[k].sums).map(Number),Array.from({length:Math.floor(scene.steps/60)+1},(_,i)=>i*60));
  }
  assert.equal(play.select(1).select(0),play);assert.equal(play.scene,0);assert.equal(play.step,0);
  assert.ok(play.next(out));assert.deepEqual(plain(out),scenes[0].outputs[0],'select remet le curseur à 0');
  for(const k of [2,-1,1.5,'1',NaN,undefined,null])assert.throws(()=>play.select(k),code('FDEMO_ARG'),'select('+String(k)+')');
  assert.equal(play.scene,0);assert.equal(play.step,1,'un select refusé ne change rien');
});

test('D3 déterminisme : mêmes appels, mêmes octets',()=>{
  const plan=TOY_PLAN.map(s=>({...s,dt:i=>(16.7+4*Math.sin(1.7*i))/1000}));
  const run=(options,onStep)=>recordToy({...TOY_HEADER,dtTicks:48000},plan,options,onStep).rec.end();
  const a=run();
  assert.ok(sameBytes(run(),a),'deux enregistreurs indépendants');
  for(const options of [{initialSteps:0},{initialSteps:1},{initialSteps:100000},{maxBytes:2**30}])assert.ok(sameBytes(run(options),a),'capacité '+JSON.stringify(options));
  // bytes() en cours de route ne ferme rien et rend un enregistrement lisible de ce qui est déjà stocké.
  const middle=[];
  assert.ok(sameBytes(run({},(rec,k,i)=>{if(i%97===0)middle.push({k,i,size:rec.size,bytes:rec.bytes()});}),a),'bytes() ne change pas le résultat');
  assert.ok(middle.length>5);
  for(const {k,i,size,bytes} of middle){
    assert.equal(bytes.length,8+headerLength(bytes)+size);
    const play=D.player(bytes);
    assert.equal(play.sceneCount,k+1);assert.equal(play.header.scenes[k].steps,i+1);
  }
});

test('D4 en-tête refusé : signature, format, expect',()=>{
  const bytes=sample(),header=headerOf(bytes);
  assert.ok(sameBytes(rebuild(bytes,()=>{}),bytes),'en-tête JSON canonique : l’aide de test le reconstruit à l’octet près');
  for(let i=0;i<4;i++){const b=bytes.slice();b[i]^=0x20;assert.throws(()=>D.player(b),code('FDEMO_FORMAT'),'signature, octet '+i);}
  for(const format of [2,0,'1',1.5,null])assert.throws(()=>D.player(rebuild(bytes,h=>{h.format=format;})),code('FDEMO_FORMAT'),'format '+format);
  assert.throws(()=>D.player(rebuild(bytes,h=>{delete h.format;})),code('FDEMO_FORMAT'),'format absent');
  const e=refusal(()=>D.player(bytes,{simHash:'autre'}),'simHash autre');
  assert.equal(e.code,'FDEMO_MISMATCH');assert.equal(e.field,'simHash');assert.match(e.message,/^FDemo : /);
  assert.equal(D.player(bytes,{simHash:header.simHash,game:header.game}).sceneCount,2,'bonnes valeurs : accepté');
  for(const expect of [undefined,null,{},{absent:undefined},{fields:plain(METAL_FIELDS),meta:header.meta,hz:60,scenes:header.scenes}])assert.equal(D.player(bytes,expect).sceneCount,2);
  for(const [expect,field] of [[{game:'jouet',simHash:'x'},'simHash'],[{game:'autre',simHash:'x'},'game'],[{meta:{...header.meta,note:'autre'}},'meta'],
    [{hz:'60'},'hz'],[{gameVersion:undefined},'gameVersion'],[{absent:0},'absent'],[{fields:METAL_FIELDS.slice(1)},'fields']]){
    const m=refusal(()=>D.player(bytes,expect),JSON.stringify(expect));
    assert.equal(m.code,'FDEMO_MISMATCH');assert.equal(m.field,field);
  }
  // expect est contrôlé après le format : un enregistrement illisible reste FDEMO_FORMAT.
  assert.throws(()=>D.player(bytes.subarray(0,bytes.length-1),{simHash:'autre'}),code('FDEMO_FORMAT'));
  for(const expect of [3,'simHash',true])assert.throws(()=>D.player(bytes,expect),code('FDEMO_ARG'),'expect '+expect);
  assert.throws(()=>D.player(bytes,{simHash:1n}),code('FDEMO_ARG'),'valeur attendue hors JSON');
});

test('D5 octets incohérents : FDEMO_FORMAT, jamais de lecture hors des octets',()=>{
  const bytes=sample(),L=headerLength(bytes),header=headerOf(bytes);
  const refused=(b,label)=>{const e=refusal(()=>D.player(b),label);assert.equal(e.code,'FDEMO_FORMAT',label+' : '+e.message);return e;};
  refused(bytes.subarray(0,bytes.length-1),'tronqué d’un octet');
  const longer=new Uint8Array(bytes.length+1);longer.set(bytes);refused(longer,'un octet en trop');
  const json=bytes.slice();json[8]=0x78;refused(json,'JSON d’en-tête invalide');
  refused(rebuild(bytes,h=>{h.scenes[0].steps++;}),'steps augmenté de 1');
  const far=bytes.slice();new DataView(far.buffer).setUint32(4,bytes.length,true);refused(far,'longueur d’en-tête plus grande que les octets');
  const huge=bytes.slice();new DataView(huge.buffer).setUint32(4,0xFFFFFFFF,true);refused(huge,'longueur 2^32 − 1');
  for(const n of [0,1,4,7,8])refused(bytes.subarray(0,n),n+' octets');
  const utf=bytes.slice();utf[8+L-2]=0xC3;refused(utf,'UTF-8 invalide');
  // En-tête : forme, réglages (validés comme à l'enregistrement), schéma, scènes.
  const edits={'tableau':()=>[],'null':()=>null,'chaîne':()=>'FDM1','game vide':h=>{h.game='';},'simHash absent':h=>{delete h.simHash;},'gameVersion':h=>{h.gameVersion=1;},'engine':h=>{h.engine=null;},
    'hz 0':h=>{h.hz=0;},'hz négatif':h=>{h.hz=-60;},'hz texte':h=>{h.hz='60';},'hz absent':h=>{delete h.hz;},'dtTicks −1':h=>{h.dtTicks=-1;},'dtTicks 1,5':h=>{h.dtTicks=1.5;},
    'dtTicks 1e6+1':h=>{h.dtTicks=1e6+1;},'dtTicks absent':h=>{delete h.dtTicks;},'dtTicks 48000':h=>{h.dtTicks=48000;},'checksumEvery 0':h=>{h.checksumEvery=0;},
    'checksumEvery 2^53':h=>{h.checksumEvery=2**53;},'checksumEvery absent':h=>{delete h.checksumEvery;},'fields vide':h=>{h.fields=[];},'fields absent':h=>{delete h.fields;},
    'simVersion absent':h=>{delete h.simVersion;},'meta absent':h=>{delete h.meta;},'scenes absent':h=>{delete h.scenes;},'scenes objet':h=>{h.scenes={};},
    'steps −1':h=>{h.scenes[0].steps=-1;},'steps 1,5':h=>{h.scenes[0].steps=1.5;},'steps texte':h=>{h.scenes[0].steps='120';},'steps 2^60':h=>{h.scenes[0].steps=2**60;},
    'checksums +1':h=>{h.scenes[1].checksums++;},'checksums 2^53':h=>{h.scenes[1].checksums=2**53;},'commandBytes 1':h=>{h.scenes[1].commandBytes=1;},
    'truncated absent':h=>{delete h.scenes[0].truncated;},'truncated 0':h=>{h.scenes[0].truncated=0;},'info absent':h=>{delete h.scenes[1].info;},'scène null':h=>{h.scenes[0]=null;},
    'scène en trop':h=>{h.scenes.push(h.scenes[1]);},'scène en moins':h=>{h.scenes.pop();},'scenes semblable à un tableau':h=>{h.scenes={...h.scenes,length:h.scenes.length};}};
  for(const [label,edit] of Object.entries(edits))refused(rebuild(bytes,edit),label);
  // Entiers ≥ 0 : un compte négatif que la scène suivante compense tomberait juste sur la longueur totale.
  const split=D.recorder({game:'g',simHash:'h',fields:METAL_FIELDS});split.scene({});for(let i=0;i<3;i++)split.step({});split.scene({});for(let i=0;i<2;i++)split.step({});
  const two=split.end();
  refused(rebuild(two,h=>{h.scenes[0].steps=-1;h.scenes[1].steps=6;}),'steps −1 compensé');
  refused(rebuild(two,h=>{h.scenes[0].checksums=-1;h.scenes[1].steps=3;}),'checksums −1 compensé');
  assert.equal(D.player(rebuild(two,h=>{h.scenes[0].steps=4;h.scenes[1].steps=1;})).steps,4,'même total, autre découpage : accepté');
  refused(rebuild(D.recorder({game:'g',simHash:'h',fields:METAL_FIELDS}).end(),h=>{h.scenes={};}),'zéro scène, scenes objet');
  // Une FDEMO_ARG du schéma ressort en FDEMO_FORMAT, avec son message et son champ.
  const schemaError=refused(rebuild(bytes,h=>{h.fields[5].scale=1;}),'u8 avec scale');
  assert.match(schemaError.message,/schéma : weapon : scale interdit pour u8/);assert.equal(schemaError.field,'weapon');
  // Corps : empreintes (n strictement croissant, ≤ steps) et commandes (triplets, n croissant au sens large, ≤ steps).
  const sums=8+L+120*8,commands=sums+header.scenes[0].checksums*8,length=header.scenes[0].commandBytes;
  const body=(edit,label)=>{const b=bytes.slice(),v=new DataView(b.buffer);edit(b,v);return refused(b,label);};
  body((b,v)=>{v.setUint32(sums,30,true);v.setUint32(sums+8,0,true);},'empreintes décroissantes');
  body((b,v)=>v.setUint32(sums+8,0,true),'deux empreintes au même pas');
  body((b,v)=>v.setUint32(sums+8*4,121,true),'empreinte après le dernier pas');
  assert.equal(Buffer.from(bytes.subarray(commands,commands+length)).toString(),JSON.stringify([[0,'boost',{v:1}],[120,'mark','fin']]));
  for(const text of ['[[120,"mark","fin"],[0,"boost",{"v":1}]]','[[0,"boost",{"v":1}],[121,"mark","fin"]]','[[0,"boost",{"v":1}],[120,""    ,"fin"]]','[[0,"boost",{"v":1}],[120,"mark"]]',
    '[[0,"boost",1,2],[120,"mark","fin"]]','[["0","boost",1]]','[[-1,"boost",1]]','[[0.5,"boost",1]]','[[0,3,1]]','[]','{}','"x"','[[0,"boost",{"v":1}],[120,"mark","fin"]',''])
    body(b=>{assert.ok(text.length<=length);b.set(Buffer.from(text.padEnd(length)),commands);},'commandes '+text);
  // Mutations au hasard : le lecteur accepte (et se lit jusqu'au bout) ou lève FDEMO_FORMAT, jamais autre chose.
  const r=D.rng(2026),out={};let accepted=0;
  for(let i=0;i<3000;i++){
    let b=bytes.slice();
    const kind=r.int(4);
    if(kind===0)b[r.int(b.length)]^=1<<r.int(8);
    else if(kind===1)b[8+r.int(L)]=r.int(256);
    else if(kind===2)b=b.subarray(0,r.int(b.length));
    else{const at=r.int(b.length+1),c=new Uint8Array(b.length+1);c.set(b.subarray(0,at));c[at]=r.int(256);c.set(b.subarray(at),at+1);b=c;}
    try{
      const play=D.player(b);accepted++;
      for(let k=0;k<play.sceneCount;k++){play.select(k);while(play.next(out));for(let n=0;n<=play.steps;n++){play.commandsAt(n);play.verify(n,0);}}
    }catch(e){if(!e||e.code!=='FDEMO_FORMAT')throw e;}
  }
  assert.ok(accepted>100&&accepted<2900,'mutations acceptées : '+accepted+' sur 3 000');
});

test('D6 mauvais moment et arguments : FDEMO_STATE, FDEMO_ARG',()=>{
  const ok={game:'g',simHash:'h',fields:METAL_FIELDS},rec=D.recorder(ok),loop={};loop.self=loop;
  for(const call of [()=>rec.step({}),()=>rec.checksum(1),()=>rec.command('x')])assert.throws(call,code('FDEMO_STATE'),'avant scene()');
  assert.equal(rec.checksumDue(),false,'sans scène, aucune empreinte due');
  rec.scene();rec.checksum(1);
  assert.throws(()=>rec.checksum(2),code('FDEMO_STATE'),'deux empreintes en n = 0');
  rec.step({});rec.checksum(3);assert.throws(()=>rec.checksum(3),code('FDEMO_STATE'),'deux empreintes en n = 1');
  for(const type of ['',undefined,null,3,{},['x']])assert.throws(()=>rec.command(type),code('FDEMO_ARG'),'type '+String(type));
  for(const data of [1n,loop,{deep:[1n]}])assert.throws(()=>rec.command('x',data),code('FDEMO_ARG'),'données hors JSON');
  assert.throws(()=>rec.scene(loop),code('FDEMO_ARG'),'info hors JSON');
  for(const input of [null,undefined,3,'moveX',true])assert.throws(()=>rec.step(input),code('FDEMO_ARG'),'entrée '+String(input));
  assert.equal(rec.steps,1,'les appels refusés ne comptent rien');
  const size=rec.size,last=rec.end();
  for(const [name,call] of Object.entries({step:()=>rec.step({}),scene:()=>rec.scene({}),checksum:()=>rec.checksum(1),command:()=>rec.command('x'),bytes:()=>rec.bytes(),end:()=>rec.end(),checksumDue:()=>rec.checksumDue()}))
    assert.throws(call,code('FDEMO_STATE'),name+' après end()');
  assert.equal(rec.size,size);assert.equal(rec.steps,1);assert.equal(D.player(last).header.scenes[0].steps,1);
  // En-tête refusé : FDEMO_ARG, avec le champ en cause.
  const without=k=>{const h={...ok};delete h[k];return h;};
  for(const [header,field] of [[without('simHash'),'simHash'],[{...ok,hz:0},'hz'],[{...ok,checksumEvery:0},'checksumEvery'],[{...ok,dtTicks:-1},'dtTicks'],
    [without('game'),'game'],[{...ok,game:''},'game'],[{...ok,simHash:''},'simHash'],[{...ok,simHash:3},'simHash'],[{...ok,gameVersion:1},'gameVersion'],[{...ok,engine:null},'engine'],
    [{...ok,hz:Infinity},'hz'],[{...ok,hz:'60'},'hz'],[{...ok,hz:-60},'hz'],[{...ok,hz:NaN},'hz'],[{...ok,hz:5e-324},'hz'],[{...ok,dtTicks:1.5},'dtTicks'],
    [{...ok,dtTicks:1e6+1},'dtTicks'],[{...ok,dtTicks:'0'},'dtTicks'],[{...ok,checksumEvery:1.5},'checksumEvery'],[{...ok,checksumEvery:2**53},'checksumEvery'],[{...ok,checksumEvery:-600},'checksumEvery']]){
    const e=refusal(()=>D.recorder(header),JSON.stringify(header));
    assert.equal(e.code,'FDEMO_ARG');assert.equal(e.field,field,JSON.stringify(header));
  }
  for(const header of [undefined,null,'g',[ok]])assert.throws(()=>D.recorder(header),code('FDEMO_ARG'),'en-tête '+String(header));
  const schemaError=refusal(()=>D.recorder({...ok,fields:[{name:'weapon',type:'u8',scale:1}]}));
  assert.equal(schemaError.code,'FDEMO_ARG');assert.match(schemaError.message,/schéma : weapon : scale interdit pour u8/);
  assert.throws(()=>D.recorder(without('fields')),code('FDEMO_ARG'));
  for(const key of ['simVersion','meta'])for(const v of [1n,loop])assert.throws(()=>D.recorder({...ok,[key]:v}),code('FDEMO_ARG'),key);
  for(const options of [null,{maxBytes:-1},{maxBytes:1.5},{maxBytes:2**30+1},{maxBytes:NaN},{maxBytes:'10'},{maxBytes:Infinity},{initialSteps:-1},{initialSteps:.5},{initialSteps:2**53}])
    assert.throws(()=>D.recorder(ok,options),code('FDEMO_ARG'),JSON.stringify(options));
  for(const options of [undefined,{},{maxBytes:0},{maxBytes:2**30},{initialSteps:0},{initialSteps:2**52}]){const r=D.recorder(ok,options);r.scene();r.step({});}
  // Valeurs par défaut de 3.7, clés dans l'ordre de 3.6 ; info absente notée null.
  const d=D.recorder(ok);d.scene();
  assert.equal(JSON.stringify(D.player(d.end()).header),JSON.stringify({format:1,game:'g',gameVersion:'',simHash:'h',simVersion:null,engine:'',hz:60,dtTicks:0,checksumEvery:600,
    fields:METAL_FIELDS,meta:null,scenes:[{info:null,steps:0,checksums:0,commandBytes:0,truncated:false}]}));
});

test('D7 dt en ticks de 1/48 000 s : u16 en tête, rec.dt et play.dt identiques',()=>{
  const rec=D.recorder({game:'g',simHash:'h',fields:METAL_FIELDS,dtTicks:48000}),seen=[],ticks=[];
  assert.equal(rec.dt,0,'0 avant toute scène');rec.scene({});assert.equal(rec.dt,0,'0 avant le premier pas');
  for(let i=0;i<600;i++){
    const dt=(16.7+4*Math.sin(1.7*i))/1000,size=rec.size;
    rec.step({moveX:i/600},dt);
    assert.equal(rec.dt,Math.round(dt*48000)/48000,'pas '+i);
    assert.equal(rec.size-size,10,'un enregistrement fait size + 2 octets');
    seen.push(rec.dt);ticks.push(Math.round(dt*48000));
  }
  for(const [dt,tick] of [[2,65535],[NaN,0],[-1,0],[Infinity,0],[-Infinity,0],[undefined,0],['0.016',0],[1e-6,0],[65535/48000,65535],[1/96000,1]]){
    rec.step({},dt);assert.equal(rec.dt,tick/48000,'dt '+String(dt));seen.push(rec.dt);ticks.push(tick);
  }
  assert.equal(seen[600],65535/48000,'2 s → 65535/48000');assert.equal(seen[601],0,'NaN → 0');
  rec.scene({});assert.equal(rec.dt,0,'scene() remet dt à 0, comme select() pour le lecteur');
  const bytes=rec.end(),play=D.player(bytes),body=new DataView(bytes.buffer,8+headerLength(bytes)),out={},read=[];
  assert.equal(body.byteLength,ticks.length*10);
  for(let i=0;i<ticks.length;i++)assert.equal(body.getUint16(10*i,true),ticks[i],'u16 de dt en tête de l’enregistrement '+i);
  assert.equal(play.dt,0,'avant le premier enregistrement');
  while(play.next(out))read.push(play.dt);
  assert.deepEqual(read,seen,'le lecteur rend la même suite de dt');
  assert.equal(play.select(0).dt,0,'select remet dt à sa valeur de départ');
  // Pas fixe : rec.dt et play.dt valent 1/hz, toujours le même nombre ; l'argument est ignoré.
  const fixed=D.recorder({game:'g',simHash:'h',fields:METAL_FIELDS,hz:50});fixed.scene();
  assert.equal(fixed.dt,1/50);
  for(const dt of [.1,NaN,3,undefined]){fixed.step({},dt);assert.equal(fixed.dt,1/50);}
  assert.equal(fixed.size,4*8,'sans dtTicks, size octets par enregistrement');
  const again=D.player(fixed.end());assert.equal(again.dt,1/50);
  while(again.next(out))assert.equal(again.dt,1/50);
});

test('D8 checksumDue : n = 0 puis tous les checksumEvery pas',()=>{
  const rec=D.recorder({game:'g',simHash:'h',fields:METAL_FIELDS,checksumEvery:60});
  assert.equal(rec.checksumDue(),false,'avant toute scène');
  rec.scene();assert.equal(rec.checksumDue(),true,'juste après scene()');
  rec.checksum(1);assert.equal(rec.checksumDue(),false,'après l’empreinte');
  for(let i=0;i<59;i++){rec.step({});assert.equal(rec.checksumDue(),false,'après '+(i+1)+' pas');}
  rec.step({});assert.equal(rec.checksumDue(),true,'après 60 pas');
  rec.checksum(2);assert.equal(rec.checksumDue(),false);
  rec.step({});assert.equal(rec.checksumDue(),false,'61 pas');
  for(let i=0;i<59;i++)rec.step({});
  assert.equal(rec.checksumDue(),true,'120 pas, même si l’empreinte de 60 avait été sautée');
  rec.scene();assert.equal(rec.checksumDue(),true,'nouvelle scène : n = 0 de nouveau');
  rec.checksum(3);rec.scene();assert.equal(rec.checksumDue(),true,'scène vide puis nouvelle scène');rec.checksum(4);
  assert.deepEqual(plain(D.player(rec.bytes()).header.scenes.map(s=>s.checksums)),[2,1,1]);
  const every=D.recorder({game:'g',simHash:'h',fields:METAL_FIELDS,checksumEvery:1});every.scene();every.checksum(0);
  for(let i=1;i<=100;i++){every.step({});assert.equal(every.checksumDue(),true,'checksumEvery 1, pas '+i);every.checksum(i);assert.equal(every.checksumDue(),false);}
  const play=D.player(every.end());
  assert.equal(play.header.scenes[0].checksums,101);
  for(let n=0;n<=100;n++)assert.equal(play.expected(n),n);
});

test('D9 maxBytes 65 536 : saturation, scène tronquée, pas stockés relus',()=>{
  const rec=D.recorder({game:'g',simHash:'h',fields:METAL_FIELDS},{maxBytes:65536}),sc=D.schema(METAL_FIELDS),probe=new DataView(new ArrayBuffer(8));
  const raw={},state={x:0},kept=[];
  rec.scene({id:'longue'});
  if(rec.checksumDue())rec.checksum(0);
  for(let i=0;i<100000;i++){
    state.x=30*Math.sin(i*.001);toyPilot(i,state,raw);
    const q=rec.step(raw);
    if(!rec.full)kept.push(plain(q));
    else if(i%1009===0){sc.encode(raw,probe,0);assert.deepEqual(plain(q),plain(sc.decode(probe,0,{})),'après saturation, entrée encore quantifiée');}
    if(rec.checksumDue())rec.checksum(Math.imul(i,2654435761));
  }
  assert.equal(rec.full,true);assert.ok(rec.size<=65536);
  // 8 178 pas (65 424 octets) et 14 empreintes (n = 0 à 7 800, 112 octets) font exactement 65 536 octets ; le pas suivant déborde.
  assert.equal(rec.size,65536);assert.equal(kept.length,8178);
  assert.equal(rec.steps,100000,'rec.steps compte les pas vus');
  assert.equal(rec.checksumDue(),false,'plus d’empreinte due');
  rec.checksum(1);rec.command('après',{x:1});
  assert.throws(()=>rec.checksum(2),code('FDEMO_STATE'),'deux empreintes au même n, même quand rien n’est stocké');
  rec.scene({id:'suivante'});assert.equal(rec.steps,0);assert.equal(rec.checksumDue(),false);
  for(let i=0;i<10;i++)rec.step(raw);
  assert.equal(rec.steps,10);assert.equal(rec.size,65536,'plus rien n’est stocké');
  const bytes=rec.end(),play=D.player(bytes),out={},read=[];
  assert.equal(bytes.length,8+headerLength(bytes)+65536);
  assert.equal(play.sceneCount,1,'scene() n’ajoute plus d’entrée');
  assert.deepEqual(plain(play.header.scenes[0]),{info:{id:'longue'},steps:8178,checksums:14,commandBytes:0,truncated:true});
  while(play.next(out))read.push(plain(out));
  assert.deepEqual(read,kept,'le lecteur rend exactement les pas stockés, égaux aux premières sorties');
  assert.equal(play.expected(0),0);assert.equal(play.expected(7800),Math.imul(7799,2654435761)>>>0);assert.equal(play.expected(8400),undefined);
  // Plafond par défaut, 4 194 304 octets : 524 288 pas METAL sans empreinte, puis saturation.
  const big=D.recorder({game:'g',simHash:'h',fields:METAL_FIELDS});big.scene({});
  let stored=0;
  while(!big.full&&stored<=524288){big.step({});if(!big.full)stored++;}
  assert.equal(stored,524288);assert.equal(big.size,4194304);assert.equal(big.full,true);
});

test('D10 taille : 3 600 pas METAL et 7 empreintes font 28 856 octets de corps',()=>{
  const rec=D.recorder({game:'metal',simHash:'h',fields:METAL_FIELDS,checksumEvery:600}),raw={},state={x:0},at=[];
  rec.scene({});
  if(rec.checksumDue()){at.push(rec.steps);rec.checksum(1);}
  for(let i=0;i<3600;i++){toyPilot(i,state,raw);rec.step(raw);if(rec.checksumDue()){at.push(rec.steps);rec.checksum(i);}}
  assert.deepEqual(at,[0,600,1200,1800,2400,3000,3600]);
  assert.equal(rec.size,3600*8+7*8);assert.equal(rec.size,28856);
  const bytes=rec.end();assert.equal(bytes.length,8+headerLength(bytes)+28856);
});

test('D11 maxBytes au plus juste : commandes en octets UTF-8 exacts, crochets et virgules compris',()=>{
  const ok={game:'g',simHash:'h',fields:METAL_FIELDS},type='é€😀',data={s:'\uD800',t:'é'};
  const first=Buffer.byteLength(JSON.stringify([2,type,data]))+2,second=Buffer.byteLength(JSON.stringify([2,'b',null]))+1,base=8+16;
  const fill=maxBytes=>{const rec=D.recorder(ok,{maxBytes});rec.scene({});rec.checksum(1);rec.step({});rec.step({});rec.command(type,data);rec.command('b');return rec;};
  const exact=fill(base+first+second);
  assert.equal(exact.full,false);assert.equal(exact.size,base+first+second);
  const play=D.player(exact.bytes());
  assert.equal(play.header.scenes[0].commandBytes,first+second);
  assert.deepEqual(plain(play.commandsAt(2)),[{type,data},{type:'b',data:null}],'demi-surrogate échappé par JSON.stringify, relu tel quel');
  exact.step({});assert.equal(exact.full,true,'le pas suivant déborde');
  const short=fill(base+first+second-1);
  assert.equal(short.full,true);assert.equal(short.size,base+first,'la seconde commande ne tient plus');
  const cut=D.player(short.end());
  assert.deepEqual(plain(cut.header.scenes[0]),{info:{},steps:2,checksums:1,commandBytes:first,truncated:true});
  // Plafond nul : la scène reste lisible, vide et tronquée ; une empreinte seule peut aussi faire déborder.
  const none=D.recorder(ok,{maxBytes:0}),sc=D.schema(METAL_FIELDS),probe=new DataView(new ArrayBuffer(8));
  none.scene({});assert.equal(none.full,false);
  sc.encode({moveX:1,fire:true},probe,0);
  assert.deepEqual(plain(none.step({moveX:1,fire:true})),plain(sc.decode(probe,0,{})));
  assert.equal(none.full,true);
  assert.deepEqual(plain(D.player(none.end()).header.scenes[0]),{info:{},steps:0,checksums:0,commandBytes:0,truncated:true});
  const tight=D.recorder(ok,{maxBytes:7});tight.scene({});tight.checksum(5);
  assert.equal(tight.full,true);assert.equal(tight.size,0);
});

test('D12 lecteur : vues, ArrayBuffer, autre domaine, rien de copié ; zéro scène',()=>{
  const bytes=sample(),host=new Uint8Array(bytes.length+13);host.set(bytes,5);
  const reference=D.player(bytes),records=play=>{const out={},all=[];for(let k=0;k<play.sceneCount;k++){play.select(k);while(play.next(out))all.push(plain(out));}return all;};
  const all=records(reference);
  for(const [label,input] of [['vue décalée',host.subarray(5,5+bytes.length)],['DataView',new DataView(host.buffer,5,bytes.length)],['ArrayBuffer d’un autre domaine',bytes.buffer],
    ['ArrayBuffer local',Uint8Array.from(bytes).buffer],['Int16Array',new Int16Array(Uint8Array.from([...bytes,0]).buffer,0,(bytes.length+1)>>1)]]){
    if(label==='Int16Array'&&bytes.length%2)continue;
    const play=D.player(input);
    assert.equal(JSON.stringify(play.header),JSON.stringify(reference.header),label);
    assert.deepEqual(records(play),all,label);
  }
  // Rien n'est copié : changer l'octet moveX du premier enregistrement se voit au prochain next().
  const play=D.player(host.subarray(5,5+bytes.length)),out={},first=5+8+headerLength(bytes);
  host[first]=127;play.select(0);play.next(out);assert.equal(out.moveX,1);
  host[first]=0x81;play.select(0);play.next(out);assert.equal(out.moveX,-1);
  for(const input of [undefined,null,[],{},'FDM1',Array.from(bytes),new SharedArrayBuffer(16),{buffer:bytes.buffer,byteOffset:0,byteLength:bytes.length}])
    assert.throws(()=>D.player(input),code('FDEMO_ARG'),Object.prototype.toString.call(input));
  // Un enregistrement sans scène est valide : rien à lire.
  const empty=D.player(D.recorder({game:'g',simHash:'h',fields:METAL_FIELDS}).end());
  assert.equal(empty.sceneCount,0);assert.equal(empty.steps,0);assert.equal(empty.step,0);assert.equal(empty.next({}),false);
  assert.equal(empty.commandsAt(0).length,0);assert.equal(empty.expected(0),undefined);assert.equal(empty.verify(0,1),true);
  assert.throws(()=>empty.select(0),code('FDEMO_ARG'));
});

test('D13 copies JSON immédiates : info, données des commandes, simVersion, meta',()=>{
  const meta={a:[1,2]},simVersion={v:1},header={game:'g',simHash:'h',fields:plain(METAL_FIELDS),meta,simVersion},rec=D.recorder(header);
  meta.a.push(3);simVersion.v=2;header.game='autre';header.fields[0]={name:'x',type:'u8'};
  const info={seed:1,list:[1]},data={v:1,nested:{w:[1]}};
  rec.scene(info);info.seed=2;info.list.push(2);
  rec.command('boost',data);data.v=99;data.nested.w.push(2);
  rec.scene(undefined);rec.command('t');rec.command('u',undefined);rec.command('v',{toJSON:()=>'converti'});
  rec.scene(()=>1);
  const play=D.player(rec.end());
  assert.deepEqual(plain(play.header.meta),{a:[1,2]});assert.deepEqual(plain(play.header.simVersion),{v:1});assert.equal(play.header.game,'g');
  assert.deepEqual(plain(play.header.fields),METAL_FIELDS,'schéma compilé à la création');
  assert.deepEqual(plain(play.header.scenes.map(s=>s.info)),[{seed:1,list:[1]},null,null],'info : copie JSON, undefined et fonction notés null');
  assert.deepEqual(plain(play.commandsAt(0)),[{type:'boost',data:{v:1,nested:{w:[1]}}}]);
  assert.deepEqual(plain(play.select(1).commandsAt(0)),[{type:'t',data:null},{type:'u',data:null},{type:'v',data:'converti'}]);
  // Le lecteur rend des commandes neuves à chaque select : les modifier ne change pas l'enregistrement.
  play.select(0).commandsAt(0)[0].data.v=5;
  assert.equal(play.select(0).commandsAt(0)[0].data.v,1);
});

test('D14 rec.step et play.next : aucune allocation par pas (3.7, 3.8)',async()=>{
  // Domaine principal, comme B8 et C9, entrées aux nombres déjà en boîte (voir C9). Capacité réservée d'avance :
  // l'agrandissement du tampon, seule allocation permise, n'a pas lieu pendant les passes mesurées.
  v8.setFlagsFromString('--expose-gc');const gc=vm.runInNewContext('gc');
  const F=loadRealm({modules:['demo']}).window.FDemo,N=5e5,TRIES=3,settle=()=>new Promise(r=>setImmediate(r)),state={x:0};
  const inputs=Array.from({length:1024},(_,i)=>{const raw={moveX:null,moveY:null,lookX:null,lookY:null};toyPilot(i*7,state,raw);return raw;});
  const dts=new Array(1024).fill(null);for(let i=0;i<1024;i++)dts[i]=(16.7+4*Math.sin(1.7*i))/1000;
  const fixed={game:'g',simHash:'h',fields:METAL_FIELDS},ticks={...fixed,dtTicks:48000},room={initialSteps:(TRIES+1)*N,maxBytes:2**30};
  const record=(header,options,n)=>{const rec=F.recorder(header,options);rec.scene({});for(let i=0;i<n;i++){rec.step(inputs[i&1023],dts[i&1023]);if(rec.checksumDue())rec.checksum(i);}return rec;};
  const recorders={fixed:record(fixed,room,0),ticks:record(ticks,room,0),full:record(fixed,{maxBytes:0},0),fullTicks:record(ticks,{maxBytes:0},0)};
  const players={fixed:F.player(record(fixed,room,N).end()),ticks:F.player(record(ticks,room,N).end())},out={};
  const stepLoop=rec=>({prepare(){},run(){for(let i=0;i<N;i++){rec.step(inputs[i&1023],dts[i&1023]);if(rec.checksumDue())rec.checksum(i);}}});
  const nextLoop=play=>({prepare(){play.select(0);},run(){for(let i=0;i<N&&play.next(out);i++){const n=play.step,want=play.expected(n);play.verify(n,want===undefined?0:want);}}});
  const loops={stepFixed:stepLoop(recorders.fixed),stepTicks:stepLoop(recorders.ticks),stepFull:stepLoop(recorders.full),stepFullTicks:stepLoop(recorders.fullTicks),
    nextFixed:nextLoop(players.fixed),nextTicks:nextLoop(players.ticks)};
  // Passe propre : aucun ramassage et un tas grandi de moins d'un octet par pas depuis gc(). Le tas compte ce que la
  // jeune génération, agrandie par les tests précédents (64 Mio vus), absorberait sans ramassage : 16 octets par pas.
  const starts=[],observer=new PerformanceObserver(list=>{for(const e of list.getEntries())starts.push(e.startTime);}),heap=()=>v8.getHeapStatistics().used_heap_size;
  observer.observe({entryTypes:['gc']});
  const passes={},clean=p=>p.gcs===0&&p.grown<N;
  try{
    for(const [name,loop] of Object.entries(loops)){
      loop.prepare();loop.run();passes[name]=[];
      for(let k=0;k<TRIES&&!passes[name].some(clean);k++){
        loop.prepare();gc();
        const h0=heap(),t0=performance.now();loop.run();const t1=performance.now(),grown=heap()-h0;
        for(let j=0;j<4;j++)await settle();
        passes[name].push({gcs:starts.filter(t=>t>=t0&&t<=t1).length,grown});
      }
    }
  }finally{observer.disconnect();}
  for(const [name,list] of Object.entries(passes))assert.ok(list.some(clean),name+' : '+JSON.stringify(list)+', '+N+' pas par passe');
  assert.ok(recorders.fixed.steps>=2*N);assert.equal(recorders.fixed.full,false);assert.equal(recorders.full.full,true);assert.equal(recorders.fullTicks.full,true);
  assert.equal(players.ticks.step,N);assert.equal(players.fixed.divergence,null);
});

test('D15 verify : première divergence gardée',()=>{
  const {rec,scenes}=recordToy(TOY_HEADER,TOY_PLAN),play=D.player(rec.end()),sums=scenes[0].sums;
  assert.equal(play.divergence,null);
  assert.equal(play.verify(60,sums[60]),true);assert.equal(play.verify(61,123),true,'aucune empreinte attendue en 61');
  assert.equal(play.verify(60,sums[60]+2**32),true,'valeur>>>0');
  assert.equal(play.verify(120,sums[120]^1),false);
  assert.deepEqual(plain(play.divergence),{scene:0,step:120,expected:sums[120],actual:(sums[120]^1)>>>0});
  play.select(1);assert.equal(play.verify(60,scenes[1].sums[60]^2),false);
  assert.equal(play.divergence.step,120,'la première divergence reste');assert.equal(play.divergence.scene,0);
});

// ---------------------------------------------------------------- Groupe E : rejoueur

// Enregistrement de E1 : 6 000 pas jouets, empreintes tous les 60 pas, boost en n = 1000 et deux en n = 3000.
// Fait une fois ; garde les octets, les entrées brutes (copies), les sorties relues, les empreintes et l'état final.
const E_PLAN=[{info:{seed:11,index:0},seed:11,steps:6000,commands:{1000:[['boost',{v:2}]],3000:[['boost',{v:-1}],['boost',{v:.5}]]}}];
let recordedE=null;
function recordingE(){
  if(!recordedE){const raws=[],{rec,scenes}=recordToy(TOY_HEADER,E_PLAN,undefined,(rec,k,i,raw)=>raws.push(plain(raw)));recordedE={bytes:rec.end(),raws,...scenes[0]};}
  return recordedE;
}
// Jeu jouet du rejeu : poignée de l'annexe 1 sur une simulation jouet neuve, graine prise dans info.
// trace reçoit chaque appel en texte ; perturb : x + 1e−9 juste après le pas d'indice perturb ; watch(input, dt) voit chaque pas.
function toyGame({trace=null,perturb=-1,commands=true,watch=null}={}){
  const game={opened:[],sims:[],disposed:0,open(info,k,header){
    const sim=toySim(D,info.seed);let count=0;
    game.opened.push({info:plain(info),k,header});game.sims.push(sim);trace?.push('open '+k);
    const handle={step(input,dt){watch?.(input,dt);sim.step(dt,input);if(count++===perturb)sim.state.x+=1e-9;trace?.push('step '+count+' '+dt);},
      checksum(){trace?.push('checksum '+count);return sim.digest();},dispose(){trace?.push('dispose '+count);game.disposed++;}};
    if(commands)handle.command=(type,data)=>{trace?.push('command '+count+' '+type);sim.command(type,data);};
    return handle;
  }};
  return game;
}

test('E1 rejeu identique : 6 000 pas jouets, 101 empreintes, même état final',()=>{
  const {bytes,state,sums}=recordingE(),game=toyGame(),rep=D.replay(bytes,game);
  assert.equal(rep.done,false);assert.equal(game.opened.length,0,'rien n’est ouvert à la création');
  const result=rep.run();
  assert.equal(result,rep.result,'run() rend rep.result');assert.equal(rep.done,true);
  assert.equal(result.ok,true);assert.equal(result.divergence,null);assert.equal(result.checked,101);assert.equal(result.steps,6000);
  assert.deepEqual(plain(result),{ok:true,steps:6000,checked:101,divergence:null,scenes:[{index:0,steps:6000,checked:101,divergence:null}]});
  assert.equal(JSON.stringify(game.sims[0].state),JSON.stringify(state),'état final identique (JSON)');
  assert.equal(game.sims[0].digest(),sums[6000]);assert.equal(game.sims[0].state.boosts,3,'les trois boosts rejoués');
  assert.equal(game.opened.length,1);assert.equal(game.disposed,1);
  assert.equal(rep.advance(),true,'après la fin, advance ne fait plus rien');assert.equal(rep.run(),result);assert.equal(game.opened.length,1);assert.equal(game.disposed,1);
});

test('E2 désynchronisation : x + 1e−9 après le pas d’indice 1234, vue au pas 1260',()=>{
  const {bytes,sums}=recordingE(),game=toyGame({perturb:1234}),rep=D.replay(bytes,game),r=plain(rep.run());
  assert.equal(r.ok,false);assert.equal(r.divergence.scene,0);assert.equal(r.divergence.step,1260);assert.notEqual(r.divergence.expected,r.divergence.actual);
  assert.equal(r.divergence.expected,sums[1260]);assert.equal(r.divergence.actual,game.sims[0].digest(),'actual : empreinte de l’état rejoué');
  assert.equal(r.steps,1260,'arrêt au pas de la divergence');assert.equal(r.checked,22,'empreintes 0, 60… 1260');
  assert.deepEqual(r.scenes,[{index:0,steps:1260,checked:22,divergence:r.divergence}]);
  assert.equal(rep.done,true);assert.equal(game.disposed,1,'poignée disposée à l’arrêt');
  const all=toyGame({perturb:1234}),going=plain(D.replay(bytes,all,{stopOnDesync:false}).run());
  assert.equal(going.steps,6000);assert.equal(going.checked,101);assert.equal(going.ok,false);
  assert.deepEqual(going.divergence,r.divergence,'la première divergence reste celle du pas 1260');
  assert.deepEqual(going.scenes,[{index:0,steps:6000,checked:101,divergence:r.divergence}]);assert.equal(all.disposed,1);
  // Témoin : sans perturbation, la même poignée rejoue juste.
  assert.equal(D.replay(bytes,toyGame({perturb:-1})).run().ok,true);
});

test('E3 commande sans h.command : FDEMO_COMMAND, poignée disposée',()=>{
  const game=toyGame({commands:false}),rep=D.replay(recordingE().bytes,game),e=refusal(()=>rep.run(),'commande sans h.command');
  assert.equal(e.code,'FDEMO_COMMAND');assert.match(e.message,/^FDemo : .*boost/);
  assert.equal(game.disposed,1);assert.equal(rep.done,true);assert.equal(rep.result.steps,1000,'refus à la première commande, avant le pas d’indice 1000');
  assert.equal(rep.advance(),true);assert.equal(game.disposed,1,'disposée une seule fois');assert.equal(game.opened.length,1);
  // Commande au pas 0 : refus avant tout pas ; un enregistrement sans commande n'exige pas h.command.
  const early=toyGame({commands:false}),first=D.replay(recordToy(TOY_HEADER,TOY_PLAN).rec.end(),early);
  assert.throws(()=>first.run(),code('FDEMO_COMMAND'));assert.equal(first.result.steps,0);assert.equal(early.disposed,1);
  const quiet=recordToy(TOY_HEADER,[{info:{seed:4},seed:4,steps:120}]).rec.end();
  assert.equal(D.replay(quiet,toyGame({commands:false})).run().ok,true);
});

test('E4 advance(97) répété : même résultat, mêmes appels et même état que run()',()=>{
  for(const [label,bytes] of [['6 000 pas',recordingE().bytes],['deux scènes de 500 et 300 pas',recordToy(TOY_HEADER,TOY_PLAN).rec.end()]]){
    const whole=[],sliced=[],a=toyGame({trace:whole}),b=toyGame({trace:sliced}),expected=plain(D.replay(bytes,a).run()),rep=D.replay(bytes,b);
    assert.equal(rep.advance(0),false,label+' : advance(0) ne fait rien');assert.equal(b.opened.length,0);
    let calls=0,before=0;
    while(!rep.advance(97)){calls++;assert.equal(rep.result.steps-before,97,label+' : 97 pas par tranche');before=rep.result.steps;}
    assert.ok(rep.result.steps-before<=97);assert.equal(calls,Math.ceil(expected.steps/97)-1,label+' : nombre de tranches');
    assert.deepEqual(plain(rep.result),expected,label+' : même résultat');
    assert.deepEqual(sliced,whole,label+' : mêmes appels, dans le même ordre');
    assert.deepEqual(b.sims.map(s=>JSON.stringify(s.state)),a.sims.map(s=>JSON.stringify(s.state)),label+' : même état final');
    assert.equal(rep.advance(97),true);assert.deepEqual(sliced,whole);
  }
});

test('E5 trois scènes de graines différentes : open avec le bon info et le bon k, trois dispose',()=>{
  const plan=[3,7,8].map((seed,index)=>({info:{seed,index,label:'scène '+index},seed,steps:200+50*index}));
  const {rec,scenes}=recordToy(TOY_HEADER,plan),bytes=rec.end(),game=toyGame(),r=plain(D.replay(bytes,game).run());
  assert.equal(game.opened.length,3);
  for(const [k,o] of game.opened.entries()){
    assert.equal(o.k,k);assert.deepEqual(o.info,plan[k].info);assert.equal(o.header,game.opened[0].header,'le même en-tête lu');
    assert.equal(JSON.stringify(o.header),JSON.stringify(D.player(bytes).header));
  }
  assert.equal(game.disposed,3);assert.equal(r.scenes.length,3);
  assert.deepEqual(r,{ok:true,steps:750,checked:15,divergence:null,scenes:[{index:0,steps:200,checked:4,divergence:null},{index:1,steps:250,checked:5,divergence:null},{index:2,steps:300,checked:6,divergence:null}]});
  for(let k=0;k<3;k++)assert.equal(JSON.stringify(game.sims[k].state),JSON.stringify(scenes[k].state),'scène '+k);
  // Une scène fausse n'arrête pas les suivantes avec stopOnDesync:false ; chaque scène garde sa première divergence.
  const wrong=toyGame(),open=wrong.open;wrong.open=(info,k,header)=>open({...plain(info),seed:k===1?99:info.seed},k,header);
  const mixed=plain(D.replay(bytes,wrong,{stopOnDesync:false}).run());
  assert.equal(mixed.ok,false);assert.deepEqual(mixed.divergence,{scene:1,step:0,expected:scenes[1].sums[0],actual:toySim(D,99).digest()});
  assert.deepEqual(mixed.scenes.map(s=>s.divergence&&s.divergence.step),[null,0,null]);assert.equal(mixed.steps,750);assert.equal(wrong.disposed,3);
});

test('E6 expect refusé : FDEMO_MISMATCH avant tout appel à open',()=>{
  const {bytes}=recordingE(),game=toyGame();
  const e=refusal(()=>D.replay(bytes,game,{expect:{simHash:'autre'}}),'simHash autre');
  assert.equal(e.code,'FDEMO_MISMATCH');assert.equal(e.field,'simHash');assert.equal(game.opened.length,0,'aucun appel à open');
  assert.throws(()=>D.replay(bytes,game,{expect:{game:'jouet',simHash:'sha-jouet',gameVersion:'2.0'}}),code('FDEMO_MISMATCH'));
  assert.throws(()=>D.replay(bytes.subarray(0,bytes.length-1),game,{expect:{simHash:'sha-jouet'}}),code('FDEMO_FORMAT'));
  assert.equal(game.opened.length,0);
  const rep=D.replay(bytes,game,{expect:{simHash:'sha-jouet',game:'jouet'}});
  assert.equal(game.opened.length,0,'accepté, toujours rien d’ouvert');assert.equal(rep.run().ok,true);assert.equal(game.opened.length,1);
});

test('E7 entrées brutes : l’empreinte finale diffère, la simulation doit recevoir l’entrée relue',()=>{
  const {raws,outputs,sums}=recordingE(),commands=E_PLAN[0].commands;
  const rerun=inputs=>{
    const sim=toySim(D,11);let first=null;
    for(let i=0;i<=inputs.length;i++){
      for(const [type,data] of commands[i]||[])sim.command(type,data);
      if(i===inputs.length)break;
      sim.step(1/60,inputs[i]);
      if(first===null&&sums[i+1]!==undefined&&sim.digest()!==sums[i+1])first=i+1;
    }
    return {digest:sim.digest(),first};
  };
  assert.equal(raws.length,6000);
  const quantized=rerun(outputs);
  assert.equal(quantized.digest,sums[6000],'témoin : les entrées relues redonnent l’empreinte finale');assert.equal(quantized.first,null);
  const raw=rerun(raws);
  assert.notEqual(raw.digest,sums[6000],'entrées brutes : empreinte finale différente');
  assert.equal(raw.first,60,'écart dès la première empreinte comparée');
});

test('E8 ordre exact des appels ; un seul objet d’entrée ; dt relus ; checksum() seulement si une empreinte est attendue',()=>{
  const dt=i=>(16.7+4*Math.sin(1.7*i))/1000;
  const plan=[{info:{seed:2},seed:2,steps:10,dt,commands:{0:[['boost',{v:1}],['mark','a']],5:[['mark','b']],10:[['boost',{v:-1}]]}},
    {info:{seed:3},seed:3,steps:3,dt},{info:{seed:4},seed:4,steps:0,commands:{0:[['mark','vide']]}}];
  const {rec,scenes}=recordToy({...TOY_HEADER,dtTicks:48000,checksumEvery:4},plan),bytes=rec.end(),trace=[],inputs=new Set(),seen=[];
  const game=toyGame({trace,watch:(input,dt)=>{inputs.add(input);seen.push(plain(input));}}),r=plain(D.replay(bytes,game).run());
  const expected=[];
  for(const [k,scene] of plan.entries()){
    expected.push('open '+k,'checksum 0');
    for(let n=0;;n++){
      for(const [type] of scene.commands?.[n]||[])expected.push('command '+n+' '+type);
      if(n===scene.steps)break;
      expected.push('step '+(n+1)+' '+scenes[k].dts[n]);
      if((n+1)%4===0)expected.push('checksum '+(n+1));
    }
    expected.push('dispose '+scene.steps);
  }
  assert.deepEqual(trace,expected,'open, empreinte 0, puis par pas : commandes, step, empreinte ; commandes de fin ; dispose');
  assert.equal(inputs.size,1,'un seul objet d’entrée pour tout le rejeu');
  assert.deepEqual(Object.keys([...inputs][0]),METAL_NAMES);
  assert.deepEqual(seen,scenes.flatMap(s=>s.outputs),'la simulation reçoit exactement les entrées relues à l’enregistrement');
  assert.equal(trace.filter(t=>t.startsWith('checksum')).length,r.checked);
  assert.deepEqual(r.scenes,[{index:0,steps:10,checked:3,divergence:null},{index:1,steps:3,checked:1,divergence:null},{index:2,steps:0,checked:1,divergence:null}]);
  assert.equal(r.ok,true);
  for(let k=0;k<3;k++)assert.equal(JSON.stringify(game.sims[k].state),JSON.stringify(scenes[k].state));
});

test('E9 exceptions du jeu : poignée disposée une fois, même exception relancée, rejeu terminé',()=>{
  const bytes=recordToy(TOY_HEADER,TOY_PLAN).rec.end(),boom=new Error('panne jouet'),other=new Error('dispose en panne');
  // Le jeu lève boom au (at+1)-ième appel de where ; dispose peut lever other en plus.
  const faulty=(where,at,disposeFails=false)=>{
    const calls={open:0,step:0,checksum:0,command:0,dispose:0},fault=name=>{if(name===where&&calls[name]>at)throw boom;};
    return {calls,open(info){calls.open++;fault('open');const sim=toySim(D,info.seed);
      return {step(input,dt){calls.step++;fault('step');sim.step(dt,input);},checksum(){calls.checksum++;fault('checksum');return sim.digest();},
        command(type,data){calls.command++;fault('command');sim.command(type,data);},dispose(){calls.dispose++;fault('dispose');if(disposeFails)throw other;}};}};
  };
  for(const [where,at,disposeFails,steps,disposed] of [['open',0,false,0,0],['open',1,false,500,1],['step',49,false,49,1],['checksum',0,false,0,1],['checksum',5,false,300,1],
    ['command',2,false,250,1],['dispose',0,false,500,1],['step',10,true,10,1]]){
    const label=where+' '+at+(disposeFails?', dispose en panne':''),game=faulty(where,at,disposeFails),rep=D.replay(bytes,game);
    assert.equal(refusal(()=>rep.run(),label),boom,label+' : la même exception');
    assert.equal(rep.done,true,label);assert.equal(rep.result.steps,steps,label+' : pas joués');assert.equal(game.calls.dispose,disposed,label+' : dispose');
    const calls=JSON.stringify(game.calls);
    assert.equal(rep.advance(),true,label);assert.equal(JSON.stringify(game.calls),calls,label+' : plus aucun appel');
  }
  // Poignée invalide : FDEMO_ARG, et son dispose s'il existe.
  for(const [label,make] of [['null',()=>null],['nombre',()=>5],['sans checksum',d=>({step(){},dispose:d})],['sans step',d=>({checksum:()=>1,dispose:d})],['checksum non fonction',d=>({step(){},checksum:1,dispose:d})]]){
    let disposed=0;const rep=D.replay(bytes,{open:()=>make(()=>disposed++)});
    assert.throws(()=>rep.run(),code('FDEMO_ARG'),label);assert.equal(rep.done,true);assert.equal(disposed,label==='null'||label==='nombre'?0:1,label);
  }
  // advance appelé par le jeu pendant le rejeu : FDEMO_STATE.
  for(const nested of ['advance','run']){
    let disposed=0,rep=null;
    rep=D.replay(bytes,{open:info=>{const sim=toySim(D,info.seed);return {step(input,dt){sim.step(dt,input);if(sim.state.t>.5)rep[nested]();},checksum:()=>sim.digest(),command:()=>{},dispose:()=>disposed++};}});
    assert.throws(()=>rep.run(),code('FDEMO_STATE'),nested);assert.equal(disposed,1);assert.equal(rep.done,true);
  }
});

test('E10 arguments, advance(0), enregistrement sans scène, scène vide',()=>{
  const bytes=recordToy(TOY_HEADER,TOY_PLAN).rec.end(),game=toyGame();
  for(const g of [undefined,null,{},{open:1},'open',[]])assert.throws(()=>D.replay(bytes,g),code('FDEMO_ARG'),'game '+JSON.stringify(g));
  for(const options of [{stopOnDesync:'non'},{stopOnDesync:0},{stopOnDesync:null},{stopOnDesync:1}])assert.throws(()=>D.replay(bytes,game,options),code('FDEMO_ARG'),JSON.stringify(options));
  for(const options of [undefined,null,{},{stopOnDesync:false},{stopOnDesync:true},{expect:null},{expect:undefined}])assert.equal(D.replay(bytes,game,options).done,false);
  for(const input of ['FDM1',null,[1,2]])assert.throws(()=>D.replay(input,game),code('FDEMO_ARG'));
  assert.throws(()=>D.replay(bytes,game,{expect:3}),code('FDEMO_ARG'));
  assert.equal(game.opened.length,0);
  const rep=D.replay(bytes,game);
  for(const max of [-1,NaN,1.5,'3',null,true,-Infinity,{}])assert.throws(()=>rep.advance(max),code('FDEMO_ARG'),'maxSteps '+String(max));
  assert.equal(rep.done,false);assert.equal(game.opened.length,0);
  assert.equal(rep.advance(0),false);assert.equal(game.opened.length,0,'advance(0) n’ouvre rien');
  assert.equal(rep.advance(1),false);assert.equal(game.opened.length,1);assert.equal(rep.result.steps,1);
  assert.equal(rep.advance(0),false);assert.equal(rep.result.steps,1,'advance(0) ne joue aucun pas');
  assert.equal(rep.advance(499),false);assert.equal(rep.result.steps,500);assert.equal(game.disposed,1,'fin de scène dans la même tranche');
  assert.equal(game.opened.length,1,'budget épuisé : la scène suivante attend la tranche suivante');
  assert.equal(rep.advance(Infinity),true);assert.equal(rep.result.steps,800);assert.equal(game.disposed,2);
  // Aucun enregistrement de scène : fini tout de suite, sans open.
  const none=toyGame(),empty=D.replay(D.recorder({game:'g',simHash:'h',fields:METAL_FIELDS}).end(),none);
  assert.equal(empty.advance(0),true);assert.deepEqual(plain(empty.result),{ok:true,steps:0,checked:0,divergence:null,scenes:[]});assert.equal(none.opened.length,0);
  // Scènes vides : open, empreinte 0, commandes du pas 0, dispose, sans pas.
  const trace=[],quiet=toyGame({trace}),blank=recordToy(TOY_HEADER,[{info:{seed:1},seed:1,steps:0,commands:{0:[['boost',{v:1}]]}},{info:{seed:2},seed:2,steps:0}]).rec.end();
  assert.deepEqual(plain(D.replay(blank,quiet).run()),{ok:true,steps:0,checked:2,divergence:null,scenes:[{index:0,steps:0,checked:1,divergence:null},{index:1,steps:0,checked:1,divergence:null}]});
  assert.deepEqual(trace,['open 0','checksum 0','command 0 boost','dispose 0','open 1','checksum 0','dispose 0']);
  // Enregistrement sans empreinte : checksum() n'est jamais appelé.
  const bare=D.recorder({game:'g',simHash:'h',fields:METAL_FIELDS});bare.scene({seed:6});for(let i=0;i<30;i++)bare.step({moveX:i/30});
  let sums=0;const r=plain(D.replay(bare.end(),{open:()=>({step(){},checksum:()=>{sums++;return 0;}})}).run());
  assert.equal(sums,0);assert.deepEqual(r,{ok:true,steps:30,checked:0,divergence:null,scenes:[{index:0,steps:30,checked:0,divergence:null}]});
});

test('E11 boucle du rejeu : aucune allocation par pas (2.2)',async()=>{
  // Domaine principal, comme D14 : poignée vide, empreinte constante tous les 600 pas, une commande tous les 1 000 pas.
  // Le rejoueur est ouvert par advance(1) avant la passe mesurée : la préparation d'une scène (select) alloue, une fois.
  v8.setFlagsFromString('--expose-gc');const gc=vm.runInNewContext('gc');
  const F=loadRealm({modules:['demo']}).window.FDemo,N=5e5,TRIES=3,settle=()=>new Promise(r=>setImmediate(r)),state={x:0};
  const inputs=Array.from({length:1024},(_,i)=>{const raw={moveX:null,moveY:null,lookX:null,lookY:null};toyPilot(i*7,state,raw);return raw;});
  const dts=new Array(1024).fill(null);for(let i=0;i<1024;i++)dts[i]=(16.7+4*Math.sin(1.7*i))/1000;
  const record=extra=>{const rec=F.recorder({game:'g',simHash:'h',fields:METAL_FIELDS,checksumEvery:600,...extra},{initialSteps:N+2,maxBytes:2**30});rec.scene({});rec.checksum(7);
    for(let i=0;i<=N;i++){if(i%1000===500)rec.command('repère',i);rec.step(inputs[i&1023],dts[i&1023]);if(rec.checksumDue())rec.checksum(7);}return rec.end();};
  let commands=0;const handle={step(input,dt){},checksum(){return 7;},command(type,data){commands++;}},game={open:()=>handle};
  const recordings={fixed:record({}),ticks:record({dtTicks:48000})};
  const starts=[],observer=new PerformanceObserver(list=>{for(const e of list.getEntries())starts.push(e.startTime);}),heap=()=>v8.getHeapStatistics().used_heap_size;
  observer.observe({entryTypes:['gc']});
  const passes={},clean=p=>p.gcs===0&&p.grown<N;
  try{
    for(const [name,bytes] of Object.entries(recordings)){
      F.replay(bytes,game).run();passes[name]=[];
      for(let k=0;k<TRIES&&!passes[name].some(clean);k++){
        const rep=F.replay(bytes,game);rep.advance(1);gc();
        const h0=heap(),t0=performance.now();rep.advance(N);const t1=performance.now(),grown=heap()-h0;
        for(let j=0;j<4;j++)await settle();
        assert.equal(rep.result.steps,N+1);assert.equal(rep.done,true);assert.equal(rep.result.ok,true);
        passes[name].push({gcs:starts.filter(t=>t>=t0&&t<=t1).length,grown});
      }
    }
  }finally{observer.disconnect();}
  for(const [name,list] of Object.entries(passes))assert.ok(list.some(clean),name+' : '+JSON.stringify(list)+', '+N+' pas par passe');
  assert.ok(commands>=1000);
});

// ---------------------------------------------------------------- Groupe F : réalisateur

const DT=1/60;
// Contexte jouet du réalisateur (annexe 1) : un seul objet, mis à jour en place à chaque image. Combat quand time % 120
// est dans [60, 100[ ; l'œil tourne ; quatre coins, plus le colosse pendant le combat. always : combat et colosse permanents ;
// bossGone retire le colosse.
function toyContext(always=false){
  const corners=[[15,15],[-15,15],[15,-15],[-15,-15]].map(([x,z],i)=>({id:'c'+i,kind:'coin',pos:[x,6,z]}));
  const boss={id:'boss',kind:'boss',pos:[20,3,0]},ctx={time:0,combat:false,eye:{pos:[10,1.62,0],yaw:0,pitch:0},points:corners.slice()};
  const toy={ctx,boss,bossGone:false,at(time){
    const e=ctx.eye,points=ctx.points,wanted=(ctx.combat=always||time%120>=60&&time%120<100)&&!toy.bossGone;
    ctx.time=time;e.pos[0]=10*Math.cos(.1*time);e.pos[2]=10*Math.sin(.1*time);e.yaw=.1*time;
    boss.pos[0]=20*Math.cos(.3*time);boss.pos[2]=20*Math.sin(.3*time);
    if(wanted&&points.length===4)points.push(boss);else if(!wanted&&points.length===5)points.pop();
    return ctx;
  }};
  return toy;
}
// Catalogue jouet (annexe 1) ; F : le module dont on prend lookAt.
function toyShots(F=D){
  const put=(out,p)=>{out.pos[0]=p[0];out.pos[1]=p[1];out.pos[2]=p[2];};
  return [
    {id:'yeux',weight:60,duration:[12,25],pose(ctx,age,target,out){put(out,ctx.eye.pos);out.yaw=ctx.eye.yaw;out.pitch=ctx.eye.pitch;}},
    {id:'surveillance',weight:15,duration:[6,9],needs:'coin',pose(ctx,age,target,out){put(out,target.pos);F.lookAt(target.pos,ctx.eye.pos,out);}},
    {id:'colosse',weight:ctx=>ctx.combat?40:0,duration:[6,10],needs:'boss',transition:'fly',pose(ctx,age,target,out){
      const a=.4*age,p=target.pos;out.pos[0]=p[0]+22*Math.cos(a);out.pos[1]=p[1]+6;out.pos[2]=p[2]+22*Math.sin(a);F.lookAt(out.pos,p,out);}},
    {id:'survol',weight:ctx=>ctx.time<4?100:0,duration:[4,4],transition:'fly',pose(ctx,age,target,out){out.pos[0]=-30+5*age;out.pos[1]=15;out.pos[2]=-30;out.yaw=.8;out.pitch=-.3;}}];
}
const poseOf=f=>[...f.pose.pos,f.pose.yaw,f.pose.pitch,f.pose.roll,f.pose.fov];
// Filme dir sur le contexte jouet, 60 updates par seconde de temps simulé, depuis l'image first. Journal à chaque changed :
// {i, time, shot, target, reason, hold, flight, took}, took étant l'âge final du plan précédent (somme des dt, dans l'ordre du
// réalisateur). digest : D.hasher de toutes les composantes de toutes les poses. each(frame, ctx, i) voit chaque image.
function film(dir,seconds,{toy=toyContext(),each=null,first=0}={}){
  const log=[],h=D.hasher();let took=0;
  for(let i=first;i<first+Math.round(seconds*60);i++){
    const ctx=toy.at(i/60),f=dir.update(DT,ctx);took+=DT;
    if(f.changed){log.push({i,time:i/60,shot:f.shot,target:f.target&&f.target.id,reason:f.reason,hold:f.hold,flight:f.flight,took});took=0;}
    for(const v of poseOf(f))h.number(v);
    each?.(f,ctx,i);
  }
  return {log,digest:h.result()};
}
const toyDirector=(options={})=>D.director({shots:toyShots(),...options});

test('F1 même graine, mêmes contextes : même journal et mêmes poses sur 10 min ; graine 2 : autre journal',()=>{
  const a=film(toyDirector(),600),b=film(toyDirector({seed:1}),600),c=film(toyDirector({seed:2}),600);
  assert.ok(a.log.length>=30,'plans en 10 min : '+a.log.length);
  assert.deepEqual(b.log,a.log,'même journal');assert.equal(b.digest,a.digest,'mêmes poses, au bit près');
  assert.notDeepEqual(c.log.map(e=>[e.shot,e.target,e.hold]),a.log.map(e=>[e.shot,e.target,e.hold]),'graine 2 : autre journal');
  assert.notEqual(c.digest,a.digest);
  assert.equal(a.log[0].reason,'start');assert.equal(a.log[0].i,0,'premier plan dès la première update');
  assert.ok(a.log.slice(1).every(e=>['time','lost'].includes(e.reason)),'catalogue jouet : fins par la durée ou par la cible perdue');
});

test('F2 durées : hold dans [min, max] ; plan fini par « time » au bout de flight + hold, à dt près',()=>{
  const bounds=Object.fromEntries(toyShots().map(s=>[s.id,s.duration]));let ended=0;
  for(const seed of [1,2,3]){
    const {log}=film(toyDirector({seed}),600);
    for(const [k,e] of log.entries()){
      const [min,max]=bounds[e.shot],next=log[k+1];
      assert.ok(e.hold>=min&&e.hold<=max,e.shot+' : hold '+e.hold+' hors de ['+min+', '+max+']');
      if(e.shot==='survol')assert.equal(e.hold,4);
      if(!next||next.reason!=='time')continue;
      const span=e.flight+e.hold;ended++;
      assert.ok(next.took>=span&&next.took<span+DT+1e-9,e.shot+' : '+next.took+' s pour flight + hold = '+span);
    }
  }
  assert.ok(ended>=60,'plans finis par la durée : '+ended);
});

test('F3 jamais deux fois le même plan de suite ; au moins 3 plans différents en 5 min',()=>{
  for(const seed of [1,2,3,4,5]){
    const {log}=film(toyDirector({seed}),600);
    for(let k=1;k<log.length;k++)assert.notEqual(log[k].shot,log[k-1].shot,'graine '+seed+', plan '+k);
    const seen=new Set(log.filter(e=>e.time<300).map(e=>e.shot));
    assert.ok(seen.size>=3,'graine '+seed+' : '+[...seen]);
  }
  // Un seul plan possible : il se répète (la règle ne vaut que s'il existe un autre plan).
  const lone=film(D.director({shots:toyShots().slice(0,1)}),300).log;
  assert.ok(lone.length>=12&&lone.every(e=>e.shot==='yeux'));
});

test('F4 cible exigée : jamais « colosse » sans point boss ; cible perdue → « lost » à l’update suivante',()=>{
  // (a) Contexte jouet : le colosse n'est filmé que pendant le combat, quand le point boss existe.
  let filmed=0;
  film(toyDirector(),600,{each:(f,ctx)=>{if(f.shot!=='colosse')return;filmed++;assert.ok(ctx.points.some(p=>p.kind==='boss'));assert.equal(f.target,ctx.points[4]);}});
  assert.ok(filmed>600,'images du colosse : '+filmed);
  // (b) Combat et colosse permanents : dès que le colosse est filmé, son point disparaît.
  for(const seed of [1,2,3]){
    const toy=toyContext(true),dir=toyDirector({seed});let lost=0,drop=false;
    for(let i=0;i<60*600;i++){
      const f=dir.update(DT,toy.at(i/60));
      if(drop){assert.equal(f.changed,true);assert.equal(f.reason,'lost');assert.notEqual(f.shot,'colosse');assert.notEqual(f.shot,null);lost++;drop=toy.bossGone=false;}
      else if(f.shot==='colosse'){drop=toy.bossGone=true;assert.equal(f.target,toy.boss);}
    }
    assert.ok(lost>=5,'graine '+seed+' : '+lost+' cibles perdues');
  }
  // La cible est relue par id à chaque update : des points neufs à chaque image, la cible suit l'objet du jour.
  const dir=D.director({shots:[{id:'suivi',weight:1,duration:[50,60],needs:'mobile',pose(ctx,age,t,out){out.pos[0]=t.pos[0];out.pos[1]=t.pos[1];out.pos[2]=t.pos[2];out.yaw=out.pitch=0;}}]});
  for(let i=0;i<600;i++){
    const points=[{id:'m',kind:'mobile',pos:[i,0,1]},{id:'autre',kind:'fixe',pos:[0,0,0]}],f=dir.update(DT,{points});
    assert.equal(f.target,points[0]);assert.deepEqual(Array.from(f.pose.pos),[i,0,1]);
  }
});

test('F5 vol amorti de A vers B, d = 50 m : flight 2,2 s, aucun saut, arrivée exacte ; coupes',()=>{
  const fixed=(id,pos,yaw,transition)=>({id,weight:1,duration:[1,2],transition,pose(ctx,age,target,out){out.pos[0]=pos[0];out.pos[1]=pos[1];out.pos[2]=pos[2];out.yaw=yaw;out.pitch=yaw/10;}});
  const B=[30,2,40,2.5,.25,0,74];
  for(const seed of [1,2,3]){
    const dir=D.director({seed,shots:[fixed('A',[0,2,0],0,'cut'),fixed('B',[30,2,40],2.5,'fly')]});
    let last=null,wasFlying=false,flights=0,arrivals=0,entries=0;
    for(let i=0;i<60*120;i++){
      const f=dir.update(DT,{}),p=poseOf(f),arriving=wasFlying&&!f.changed&&!f.flying;
      if(f.changed){
        entries++;
        if(i===0||f.shot==='A'){assert.equal(f.cut,true,'premier plan et entrée de A : coupe');assert.equal(f.flight,0);}
        else{assert.equal(f.cut,false,'entrée de B après A : vol');assert.equal(f.flight,2.2,'1,8 + 50/160 = 2,1125, ramené à 2,2');flights++;}
      }
      if(f.flying||arriving){
        // Pendant le vol, première image et image d'arrivée comprises : déplacement borné par la pente maximale de smootherstep, 15/8.
        const step=Math.hypot(p[0]-last[0],p[1]-last[1],p[2]-last[2]);
        assert.ok(step<=1.875*50/2.2*DT+1e-9,'saut de '+step+' m à l’âge '+f.age);
        if(f.changed)assert.equal(step,0,'première image du vol : la pose de départ');
      }
      if(arriving)arrivals++;
      if(f.shot==='B'&&!f.flying)assert.deepEqual(p,B,'à age >= flight, pose égale à B');
      assert.equal(f.flying,f.shot==='B'&&f.age<f.flight);
      wasFlying=f.flying;last=p;
    }
    assert.ok(flights>=15&&arrivals>=flights-1&&entries>=30,'vols '+flights+', arrivées '+arrivals+', plans '+entries);
  }
});

test('F6 pose non finie : jamais en sortie ; autre plan dans la même update, raison « pose »',()=>{
  const broken={id:'panne',weight:50,duration:[3,5],pose(ctx,age,t,out){out.pos[0]=NaN;}};
  const tired={id:'fatigue',weight:50,duration:[6,8],transition:'fly',pose(ctx,age,t,out){out.pos[0]=age>2?Infinity:1;out.pos[1]=2;out.pos[2]=3;out.yaw=age;out.pitch=0;}};
  const bad=[{id:'roulis',weight:30,duration:[3,5],pose(ctx,age,t,out){out.pos[0]=out.pos[1]=out.pos[2]=0;out.yaw=out.pitch=0;out.roll=age>1?undefined:0;}},
    {id:'champ',weight:30,duration:[3,5],pose(ctx,age,t,out){out.pos[0]=out.pos[1]=out.pos[2]=0;out.yaw=out.pitch=0;out.fov='74';}}];
  const reasons={},after={};
  const {log}=film(D.director({shots:[...toyShots(),broken,tired,...bad]}),300,{each:f=>{
    for(const v of poseOf(f))assert.ok(Number.isFinite(v),'pose finie : '+poseOf(f));
    assert.notEqual(f.shot,'panne');assert.notEqual(f.shot,'champ');assert.ok(f.shot!==null);
    if(f.shot==='fatigue')assert.ok(f.age<=2+1e-9);if(f.shot==='roulis')assert.ok(f.age<=1+1e-9);
  }});
  for(const [k,e] of log.entries()){reasons[e.reason]=(reasons[e.reason]||0)+1;if(e.reason==='pose'&&k)after[log[k-1].shot]=(after[log[k-1].shot]||0)+1;}
  assert.ok(reasons.pose>=3,JSON.stringify(reasons));
  assert.ok(after.fatigue>=1&&after.roulis>=1,'fin en cours de plan : '+JSON.stringify(after));
  // Toutes les poses échouent : au plus shots.length essais par update, shot null, dernière pose gardée ; reprise ensuite.
  let calls=0,failing=false;
  const pose=(x)=>(ctx,age,t,out)=>{calls++;out.pos[0]=failing?NaN:x;out.pos[1]=out.pos[2]=0;out.yaw=x;out.pitch=0;};
  const dir=D.director({shots:[1,2,3].map(x=>({id:'p'+x,weight:x,duration:[1,2],pose:pose(x)}))});
  for(let i=0;i<200;i++)dir.update(DT,{});
  const kept=poseOf(dir.frame);failing=true;
  for(let i=0;i<120;i++){
    calls=0;const f=dir.update(DT,{});
    assert.ok(calls<=3,calls+' essais');assert.equal(f.shot,null);assert.equal(f.changed,false);assert.equal(f.flying,false);assert.deepEqual(poseOf(f),kept,'dernière pose sortie gardée');
  }
  failing=false;const back=dir.update(DT,{});
  assert.equal(back.changed,true);assert.equal(back.reason,'pose');assert.ok(back.shot);
});

// Deux points de genre coin à 50 m l'un de l'autre, un plan qui en exige un et un plan simple : ils alternent.
const COINS={points:[{id:'a',kind:'coin',pos:[0,0,0]},{id:'b',kind:'coin',pos:[50,0,0]}]};
const COIN_SHOTS=[{id:'coin',weight:1,duration:[1,2],needs:'coin',pose(c,age,t,out){out.pos[0]=t.pos[0];out.pos[1]=t.pos[1];out.pos[2]=t.pos[2];out.yaw=out.pitch=0;}},
  {id:'simple',weight:1,duration:[1,2],pose(c,age,t,out){out.pos[0]=out.pos[1]=out.pos[2]=5;out.yaw=out.pitch=0;}}];
// Part des choix de coin dont la cible est celle du choix de coin précédent ; forget : cut() après chaque choix de coin.
function repeats(avoid,choices=400,forget=false){
  const dir=D.director({shots:COIN_SHOTS,avoid});let last=null,same=0,count=0;
  for(let i=0;count<choices;i++){
    assert.ok(i<1e6,'trop d’updates');
    const f=dir.update(DT,COINS);
    if(f.changed&&f.shot==='coin'){count++;if(f.target.id===last)same++;last=f.target.id;if(forget)dir.cut();}
  }
  return same/(choices-1);
}

test('F7 cibles évitées : poids × 0,3 près des dernières cibles (23 % de répétitions), 50 % sans pénalité',()=>{
  const penalized=repeats({count:1}),free=repeats({count:1,factor:1});
  assert.ok(penalized<.35,'pénalité 0,3 : '+penalized+' (attendu 0,3/1,3 ≈ 0,23)');
  assert.ok(free>.4,'sans pénalité : '+free+' (attendu 0,5)');
  assert.equal(repeats({count:1,factor:0}),0,'facteur 0 : jamais la même cible');
  assert.ok(repeats({count:0,factor:0})>.4,'aucune mémoire : aucune pénalité');
  // Distance strictement inférieure au rayon : à 50 m pile, l'autre point n'est pas pénalisé ; à 50,5 m, les deux le sont.
  assert.ok(repeats({count:1,radius:50})<.35);assert.ok(repeats({count:1,radius:50.5})>.4);
});

test('F8 cut() : coupe « external » à l’update suivante, sans vol ; reset(s) : journal d’un réalisateur neuf',()=>{
  const toy=toyContext(),dir=toyDirector();let cuts=0,midFlight=0,pending=false;
  for(let i=0;i<60*600;i++){
    const f=dir.update(DT,toy.at(i/60));
    if(pending){
      assert.equal(f.changed,true);assert.equal(f.cut,true);assert.equal(f.reason,'external');assert.equal(f.flight,0);assert.equal(f.flying,false);assert.ok(f.shot);
      cuts++;pending=false;
    }else if(i%613===300||f.flying&&f.age>1&&midFlight<3){if(f.flying)midFlight++;dir.cut();pending=true;}
  }
  assert.ok(cuts>=50&&midFlight>=3,'coupes '+cuts+', dont en vol '+midFlight);
  // La mémoire des cibles est oubliée : avec un facteur 0, la même cible deux fois de suite n'arrive qu'après cut().
  assert.equal(repeats({count:1,factor:0},200),0);assert.ok(repeats({count:1,factor:0},200,true)>.3,'cut() oublie les cibles retenues');
  // reset(s) remet tout, générateur compris ; reset() reprend la graine des options ; un cut() en attente est oublié.
  for(const s of [5,1]){
    const used=toyDirector({seed:3});film(used,123,{first:777});used.cut();used.reset(s);
    assert.deepEqual(plain(used.frame),{shot:null,target:null,changed:false,cut:false,flying:false,reason:null,age:0,hold:0,flight:0,pose:{pos:[0,0,0],yaw:0,pitch:0,roll:0,fov:74}});
    assert.deepEqual(film(used,600),film(toyDirector({seed:s}),600),'reset('+s+')');
  }
  const again=toyDirector({seed:3});film(again,50);again.reset();
  assert.deepEqual(film(again,300),film(toyDirector({seed:3}),300),'reset() : graine des options');
  assert.throws(()=>again.reset(NaN),code('FDEMO_ARG'));assert.throws(()=>again.reset('2'),code('FDEMO_ARG'));
});

test('F9 mêmes objets : frame, frame.pose et frame.pose.pos d’une update à l’autre',()=>{
  const dir=toyDirector(),frame=dir.frame,{pose}=frame,{pos}=pose,toy=toyContext();
  assert.deepEqual(plain(frame),{shot:null,target:null,changed:false,cut:false,flying:false,reason:null,age:0,hold:0,flight:0,pose:{pos:[0,0,0],yaw:0,pitch:0,roll:0,fov:74}},'à la création');
  for(let i=0;i<60*300;i++){
    if(i===6000)dir.cut();if(i===12000)dir.reset(9);
    const f=dir.update(DT,toy.at(i/60));
    assert.equal(f,frame);assert.equal(f.pose,pose);assert.equal(f.pose.pos,pos);
  }
  assert.deepEqual(Object.keys(frame),['shot','target','changed','cut','flying','reason','age','hold','flight','pose']);
  assert.deepEqual(Object.keys(pose),['pos','yaw','pitch','roll','fov']);
  assert.ok(Array.isArray(pos)&&pos.length===3);
});

test('F10 options et catalogue refusés à la création : FDEMO_ARG ; fly et avoid complétés champ par champ',()=>{
  const shot={id:'s',weight:1,duration:[1,2],pose(){}};
  const refused=[['sans options',undefined],['options null',null],['sans plans',{}],['plans vides',{shots:[]}],['plans non tableau',{shots:shot}],
    ['plan null',{shots:[null]}],['plan nombre',{shots:[5]}],['id vide',{shots:[{...shot,id:''}]}],['id nombre',{shots:[{...shot,id:7}]}],['ids en double',{shots:[shot,{...shot}]}],
    ...[[0,1],[2,1],[1,NaN],[1,Infinity],[NaN,1],[1],[1,'2'],['1',2],[-1,1],'1,2',null,undefined].map(d=>['duration '+String(d),{shots:[{...shot,duration:d}]}]),
    ['pose absente',{shots:[{...shot,pose:undefined}]}],['pose non fonction',{shots:[{...shot,pose:'f'}]}],
    ['transition inconnue',{shots:[{...shot,transition:'fondu'}]}],['transition null',{shots:[{...shot,transition:null}]}],
    ...[['seed',NaN],['seed','1'],['seed',null],['fov',Infinity],['fov',null]].map(([k,v])=>[k+' '+String(v),{shots:[shot],[k]:v}]),
    ...[['base',NaN],['speed','160'],['min',Infinity],['max',null]].map(([k,v])=>['fly.'+k+' '+String(v),{shots:[shot],fly:{[k]:v}}]),
    ...[['count',17],['count',-1],['count',1.5],['count','2'],['radius',NaN],['factor',Infinity]].map(([k,v])=>['avoid.'+k+' '+String(v),{shots:[shot],avoid:{[k]:v}}])];
  for(const [label,options] of refused){const e=refusal(()=>D.director(options),label);assert.equal(e.code,'FDEMO_ARG',label);assert.match(e.message,/^FDemo : réalisateur : /,label);}
  for(const options of [{shots:[shot]},{shots:[shot],fly:{},avoid:{}},{shots:[shot],fly:null,avoid:null},{shots:[{...shot,weight:0}]},{shots:[{...shot,weight:()=>NaN}]},
    {shots:[shot],avoid:{count:0}},{shots:[shot],avoid:{count:16}},{shots:[{...shot,duration:[3,3]}]},{shots:[{...shot,transition:'fly'}]},{shots:[shot],seed:-5}])
    assert.equal(typeof D.director(options).update,'function',JSON.stringify(options));
  // avoid {count:1} garde radius 12 et factor 0,3 : même suite de cibles qu'avec ces valeurs écrites, autre suite si l'une change.
  const targets=avoid=>{const dir=D.director({shots:COIN_SHOTS,avoid}),list=[];for(let i=0;i<60*300;i++){const f=dir.update(DT,COINS);if(f.changed)list.push(f.target&&f.target.id);}return list;};
  const implicit=targets({count:1});
  assert.deepEqual(targets({count:1,radius:12,factor:.3}),implicit);
  assert.notDeepEqual(targets({count:1,radius:12,factor:.5}),implicit);assert.notDeepEqual(targets({count:1,radius:60,factor:.3}),implicit);
  assert.deepEqual(targets(undefined),targets({count:2,radius:12,factor:.3}),'avoid par défaut : 2, 12, 0,3');
  // fly complété champ par champ : vol de B (d = 50 m) après A.
  const flightOf=fly=>{
    const fixed=(id,x,transition)=>({id,weight:1,duration:[1,2],transition,pose(c,age,t,out){out.pos[0]=x;out.pos[1]=0;out.pos[2]=0;out.yaw=out.pitch=0;}});
    const dir=D.director({seed:2,shots:[fixed('A',0,'cut'),fixed('B',50,'fly')],fly});
    for(let i=0;i<600;i++){const f=dir.update(DT,{});if(f.changed&&f.shot==='B'&&i>0)return f.flight;}
    return assert.fail('pas de vol');
  };
  assert.equal(flightOf(undefined),2.2);assert.equal(flightOf({}),2.2);assert.equal(flightOf({min:3}),3);
  assert.equal(flightOf({base:4}),4+50/160);assert.equal(flightOf({speed:10}),5.5);assert.equal(flightOf({speed:10,max:9}),1.8+5);
  assert.equal(flightOf({base:0,min:0}),50/160);assert.equal(flightOf({min:0,max:0}),0,'vol nul : coupe franche');
  // fov : pose de départ et préremplissage.
  const wide=D.director({fov:90,shots:[shot]});assert.equal(wide.frame.pose.fov,90);assert.equal(wide.update(DT,{}).pose.fov,90);
});

// Modèle de référence de 3.10, écrit pour être lu, sans souci de mémoire ni de vitesse. Il fait les calculs que la mission
// décrit (distance par racine de la somme des carrés, interpolation a + (b − a)·k) : ses images égalent celles de FDemo au bit près.
function referenceDirector({seed=1,shots,fov=74,fly={},avoid={}}){
  const F={base:1.8,speed:160,min:2.2,max:5.5,...fly},A={count:2,radius:12,factor:.3,...avoid},rng=D.rng(seed);
  const worth=p=>{const w=p.weight===undefined?1:p.weight;return Number.isFinite(w)&&w>0?w:0;};
  const blank=()=>({pos:[0,0,0],yaw:0,pitch:0,roll:0,fov}),clone=p=>({pos:[...p.pos],yaw:p.yaw,pitch:p.pitch,roll:p.roll,fov:p.fov});
  let shot=null,previous=null,target=null,age=0,hold=0,flight=0,reason='start',pending=false,shown=false,recent=[],out=blank(),start=blank();
  const live=blank(),own=live.pos;
  function choose(ctx,points){
    const weights=shots.map(s=>{
      const w=typeof s.weight==='function'?s.weight(ctx):s.weight;
      if(!(Number.isFinite(w)&&w>0)||s.valid&&!s.valid(ctx))return 0;
      return s.needs===undefined||points.some(p=>p&&p.kind===s.needs&&worth(p)>0)?w:0;
    });
    if(previous&&weights.filter(w=>w>0).length>=2)weights[shots.indexOf(previous)]=0;
    const i=rng.pick(weights);
    if(i<0)return false;
    previous=shots[i];target=null;
    if(previous.needs!==undefined){
      const near=p=>recent.some(q=>{const x=p.pos[0]-q[0],y=p.pos[1]-q[1],z=p.pos[2]-q[2];return x*x+y*y+z*z<A.radius*A.radius;});
      const j=rng.pick(points.map(p=>{const w=p&&p.kind===previous.needs?worth(p):0;return w>0&&near(p)?w*A.factor:w;}));
      if(j<0)return false;
      target=points[j];
      if(A.count){recent.push([...target.pos]);if(recent.length>A.count)recent.shift();}
    }
    shot=previous;age=0;flight=0;hold=shot.duration[0]+(shot.duration[1]-shot.duration[0])*rng.next();
    return true;
  }
  return {
    cut(){pending=true;shown=false;recent=[];},
    update(dt,ctx){
      if(!(Number.isFinite(dt)&&dt>0))dt=0;
      const points=ctx&&Array.isArray(ctx.points)?ctx.points:[];
      let changed=false,cut=false;
      if(pending){pending=false;shot=null;reason='external';}
      else if(shot){
        age+=dt;
        const t=shot.needs===undefined?null:points.find(p=>p&&p.id===target.id)||null;
        const end=shot.needs!==undefined&&!t?'lost':shot.valid&&!shot.valid(ctx)?'invalid':age>=flight+hold?'time':shot.cutIf&&age>=flight&&shot.cutIf(ctx,age,t)?'cutIf':null;
        if(end){shot=null;reason=end;}else target=t;
      }
      for(let tries=0;tries<shots.length;tries++){
        const fresh=!shot;
        if(fresh&&!choose(ctx,points))break;
        live.pos=own;live.roll=0;live.fov=fov;shot.pose(ctx,age,target,live);
        const q=live.pos;
        if(![q[0],q[1],q[2],live.yaw,live.pitch,live.roll,live.fov].every(Number.isFinite)){shot=null;reason='pose';continue;}
        if(fresh){
          const x=q[0]-out.pos[0],y=q[1]-out.pos[1],z=q[2]-out.pos[2];
          flight=shot.transition==='fly'&&shown?Math.min(F.max,Math.max(F.min,F.base+Math.sqrt(x*x+y*y+z*z)/F.speed)):0;
          if(!(flight>0))flight=0;
          changed=true;cut=flight===0;
          if(flight>0)start=clone(out);
        }
        if(age<flight){
          const k=D.smootherstep(age/flight),mix=(a,b)=>a+(b-a)*k;
          out={pos:[0,1,2].map(i=>mix(start.pos[i],q[i])),yaw:start.yaw+D.wrapAngle(live.yaw-start.yaw)*k,pitch:mix(start.pitch,live.pitch),roll:mix(start.roll,live.roll),fov:mix(start.fov,live.fov)};
        }else out=clone(live);
        shown=true;break;
      }
      if(!shot){target=null;age=hold=flight=0;}
      return {shot:shot&&shot.id,target,changed,cut,flying:!!shot&&age<flight,reason,age,hold,flight,pose:clone(out)};
    }};
}
// Fait tourner FDemo et le modèle sur la même suite (dt, ctx) ; cutAt(i) : cut() des deux avant l'update i. Vérifie qu'il y a
// au moins least changements de plan.
function againstReference(options,steps,next,cutAt=()=>false,least=1){
  const dir=D.director(options),ref=referenceDirector(options);let changes=0;
  for(let i=0;i<steps;i++){
    if(cutAt(i)){dir.cut();ref.cut();}
    const [dt,ctx]=next(i),f=dir.update(dt,ctx),r=ref.update(dt,ctx),label='update '+i;
    assert.equal(f.shot,r.shot,label);assert.equal(f.target,r.target,label+' : cible');
    for(const k of ['changed','cut','flying','reason','age','hold','flight'])assert.equal(f[k],r[k],label+' : '+k);
    assert.deepEqual(poseOf(f),[...r.pose.pos,r.pose.yaw,r.pose.pitch,r.pose.roll,r.pose.fov],label+' : pose');
    if(f.changed)changes++;
  }
  assert.ok(changes>=least,'changements de plan : '+changes);
}

test('F11 modèle de référence : mêmes plans, cibles, raisons, durées, vols et poses, au bit près',()=>{
  // Catalogue jouet, 10 min, deux graines, coupes externes de temps en temps.
  for(const seed of [1,7]){const toy=toyContext();againstReference({seed,shots:toyShots()},36000,i=>[DT,toy.at(i/60)],i=>i%1999===1000,40);}
  // Poses non finies, et cibles évitées avec plusieurs réglages.
  const failing=[...toyShots(),{id:'panne',weight:50,duration:[3,5],pose(c,a,t,out){out.pos[0]=NaN;}},
    {id:'fatigue',weight:50,duration:[6,8],transition:'fly',pose(c,age,t,out){out.pos[0]=age>2?Infinity:1;out.pos[1]=2;out.pos[2]=3;out.yaw=age;out.pitch=0;}}];
  const toy=toyContext();againstReference({seed:4,shots:failing},18000,i=>[DT,toy.at(i/60)]);
  for(const avoid of [{count:1},{count:2,factor:.5},{count:0},{count:16,radius:60,factor:.1}])againstReference({seed:5,shots:COIN_SHOTS,avoid},12000,()=>[DT,COINS],undefined,100);
  // Catalogue varié : poids en fonction, valid, cutIf, roulis et champ, cibles qui bougent, disparaissent et pèsent 0, NaN ou −1 ;
  // points neufs à chaque image ; dt variables, nuls, négatifs ou non finis ; contexte parfois sans points.
  const zoo=[
    {id:'garde',weight:c=>c.alert?5:1,duration:[2,4],needs:'garde',valid:c=>c.t%17<15,pose(c,age,t,out){out.pos[0]=t.pos[0]+age;out.pos[1]=2;out.pos[2]=t.pos[2];out.yaw=3*age;out.pitch=.1;out.roll=.2*Math.sin(age);}},
    {id:'ronde',weight:3,duration:[1,3],transition:'fly',cutIf:(c,age)=>age>2&&c.alert,pose(c,age,t,out){out.pos[0]=10*Math.cos(age);out.pos[1]=4;out.pos[2]=10*Math.sin(age);out.yaw=-3+age;out.pitch=-.2;out.fov=60+age;}},
    {id:'cible',weight:2,duration:[3,6],needs:'cible',transition:'fly',pose(c,age,t,out){out.pos[0]=t.pos[0]-5;out.pos[1]=t.pos[1]+3;out.pos[2]=t.pos[2];D.lookAt(out.pos,t.pos,out);}},
    {id:'fixe',weight:1,duration:[2,2],pose(c,age,t,out){out.pos[0]=out.pos[1]=out.pos[2]=0;out.yaw=3;out.pitch=0;}}];
  const dts=[DT,DT,1/144,.033,0,NaN,-.01,DT,.1,Infinity];let t=0;
  const world=i=>{
    const dt=dts[i%dts.length];if(Number.isFinite(dt)&&dt>0)t+=dt;
    const points=[0,1,2,3].map(k=>({id:'g'+k,kind:'garde',pos:[10*k,0,5*Math.sin(t+k)],weight:[undefined,0,2,-1][k]}));
    for(let k=0;k<3;k++)if(!(k===1&&t%13<4))points.push({id:'k'+k,kind:'cible',pos:[3*k,1,-4*k+Math.cos(t)],weight:k===2&&t%7<1?NaN:1});
    return [dt,i%997<40?{t,alert:t%11<3}:{t,alert:t%11<3,points}];
  };
  for(const seed of [2,3])againstReference({seed,shots:zoo,fov:80},24000,world,i=>i%1499===700,100);
});

test('F12 director.update : rien d’alloué par image (2.2)',()=>{
  // Domaine principal, comme D14 et E11. Volume alloué exact : tas grandi pendant la passe, plus ce que rend chaque ramassage
  // (v8.GCProfiler). Une boucle témoin de même texte, autour d'un faux réalisateur, compte ce qu'allouent le contexte et la
  // boucle ; on retranche sa médiane (5 passes alternées, après 3 de chauffe).
  // (a) Image courante : orbite à cible relue par id, valid, cutIf, roulis, champ, et un vol de 10⁵ s qui interpole à chaque
  //     image. Les deux plans partagent leur fonction pose, que V8 intègre à update : moins de 0,25 octet par update.
  // (b) Catalogue de jeu, une fonction pose par plan, changements de plan compris. V8 n'intègre plus ces appels et emboîte age
  //     (16 octets) à chaque appel où il n'est pas entier : c'est le prix de la signature pose(ctx, age, target, out), pas un
  //     objet du réalisateur. Moins de 48 octets par update.
  v8.setFlagsFromString('--expose-gc');const gc=vm.runInNewContext('gc');
  const F=loadRealm({modules:['demo']}).window.FDemo,N=3e5,heap=()=>v8.getHeapStatistics().used_heap_size;
  const corners=[[15,15],[-15,15],[15,-15],[-15,-15]].map(([x,z],i)=>({id:'c'+i,kind:'coin',pos:[x,6,z]}));
  const boss={id:'boss',kind:'boss',pos:[20,3,0]},ctx={time:0,combat:true,points:[...corners,boss]};
  const fixed=(c,age,t,out)=>{out.pos[0]=1;out.pos[1]=2;out.pos[2]=3;out.yaw=.5;out.pitch=.1;};
  const orbit=(c,age,t,out)=>{const p=t.pos,a=.4*age;out.pos[0]=p[0]+22*Math.cos(a);out.pos[1]=p[1]+6;out.pos[2]=p[2]+22*Math.sin(a);out.yaw=a;out.pitch=-.3;out.roll=.01*a;out.fov=70+Math.sin(a);};
  const both=(c,age,t,out)=>t===null?fixed(c,age,t,out):orbit(c,age,t,out);
  const shots=[{id:'ouverture',weight:c=>c.time<1?1:0,duration:[1,1],pose:both},
    {id:'orbite',weight:c=>c.time>=1?40:0,duration:[1e6,1e6],needs:'boss',transition:'fly',valid:c=>c.points.length>0,cutIf:(c,age)=>age<0,pose:both}];
  const busy=[{id:'fixe',weight:60,duration:[2,4],pose:fixed},
    {id:'coin',weight:15,duration:[1,3],needs:'coin',pose(c,age,t,out){const p=t.pos;out.pos[0]=p[0];out.pos[1]=p[1];out.pos[2]=p[2];out.yaw=age;out.pitch=-.2;}},
    {id:'orbite',weight:c=>c.combat?40:0,duration:[2,4],needs:'boss',transition:'fly',valid:c=>c.points.length>0,cutIf:(c,age)=>age<0,pose:orbit},
    {id:'survol',weight:c=>c.time%30<4?100:0,duration:[2,3],transition:'fly',cutIf:(c,age)=>age>3,pose(c,age,t,out){out.pos[0]=-30+5*age;out.pos[1]=15;out.pos[2]=-30;out.yaw=.8;out.pitch=-.3;}}];
  const idle={frame:{changed:false},update(dt,c){return this.frame;}};
  function world(i,toggle){
    const time=i*DT,points=ctx.points;ctx.time=time;boss.pos[0]=20*Math.cos(.3*time);boss.pos[2]=20*Math.sin(.3*time);
    if(toggle){ctx.combat=time%120>=60&&time%120<100;if(ctx.combat&&points.length===4)points.push(boss);else if(!ctx.combat&&points.length===5)points.pop();}
  }
  // Deux boucles de même texte : chacune garde ses sites d'appel monomorphes.
  const loop=(dir,toggle)=>{let base=0;return ()=>{let changes=0;for(let i=base;i<base+N;i++){world(i,toggle);if(dir.update(DT,ctx).changed)changes++;}base+=N;return changes;};};
  const twin=(dir,toggle)=>{let base=0;return ()=>{let changes=0;for(let i=base;i<base+N;i++){world(i,toggle);if(dir.update(DT,ctx).changed)changes++;}base+=N;return changes;};};
  const measure=f=>{gc();const prof=new v8.GCProfiler();prof.start();const h0=heap(),changes=f();let bytes=heap()-h0;
    for(const e of prof.stop().statistics)bytes+=e.beforeGC.heapStatistics.usedHeapSize-e.afterGC.heapStatistics.usedHeapSize;return {bytes,changes};};
  const median=a=>[...a].sort((x,y)=>x-y)[a.length>>1];
  function compare(run,control){
    for(let k=0;k<3;k++){run();control();}
    const r=[],c=[],changes=[];
    for(let k=0;k<5;k++){const m=measure(run);r.push(m.bytes);changes.push(m.changes);c.push(measure(control).bytes);}
    return {perUpdate:(median(r)-median(c))/N,changes:Math.max(...changes)};
  }
  const steady=F.director({shots,fly:{min:1e5,max:1e5}});
  const a=compare(loop(steady,false),twin(idle,false));
  assert.equal(steady.frame.shot,'orbite');assert.equal(steady.frame.flying,true);assert.equal(a.changes,0,'aucun changement de plan pendant les passes');
  assert.ok(a.perUpdate<.25,'image courante : '+a.perUpdate.toFixed(3)+' octet par update');
  ctx.points.length=4;ctx.combat=false;
  const b=compare(loop(F.director({shots:busy}),true),twin(idle,true));
  assert.ok(b.changes>=1000,'changements par passe : '+b.changes);
  assert.ok(b.perUpdate<48,'catalogue de jeu : '+b.perUpdate.toFixed(1)+' octets par update');
});

test('F13 dt, contexte, valid, cutIf, ordre des fins, poids des points, préremplissage, tableau du jeu, lacet par le plus court',()=>{
  const at=(x,yaw=0)=>(c,age,t,out)=>{out.pos[0]=x;out.pos[1]=out.pos[2]=0;out.yaw=yaw;out.pitch=0;};
  // dt non fini, négatif ou non nombre : 0, l'âge n'avance pas.
  const still=D.director({shots:[{id:'s',weight:1,duration:[5,5],pose:at(0)}]});still.update(DT);
  for(const dt of [NaN,-1,-Infinity,Infinity,'0.5',null,undefined,-0])assert.equal(still.update(dt).age,0,'dt '+String(dt));
  assert.equal(still.update(.25).age,.25);assert.equal(still.update(.5).age,.75);assert.equal(still.frame.shot,'s');
  // Contexte sans points : un plan à cible ne pèse rien ; un plan à cible en cours perd sa cible.
  const seeker={id:'cherche',weight:100,duration:[9,9],needs:'k',pose:at(1)},plain1={id:'vue',weight:1,duration:[1,1],pose:at(2)};
  for(const ctx of [undefined,{},{points:'k'},{points:null},{points:[{id:'z',kind:'k',pos:[0,0,0],weight:0}]}]){
    const d=D.director({shots:[seeker,plain1]});
    for(let i=0;i<300;i++)assert.equal(d.update(DT,ctx).shot,'vue',JSON.stringify(ctx));
  }
  const d=D.director({shots:[seeker,plain1]}),here={points:[{id:'q',kind:'k',pos:[0,0,0]}]};
  assert.equal(d.update(DT,here).shot,'cherche');assert.equal(d.frame.target,here.points[0]);
  const gone=d.update(DT,{});assert.equal(gone.reason,'lost');assert.equal(gone.shot,'vue');assert.equal(gone.target,null);
  // Poids des points : absent → 1, 0, négatif ou NaN → 0 ; une cible d'un autre genre n'est jamais prise.
  const mixed={points:[{id:'zero',kind:'k',pos:[0,0,0],weight:0},{id:'neg',kind:'k',pos:[1,0,0],weight:-1},{id:'u',kind:'k',pos:[2,0,0]},
    {id:'nan',kind:'k',pos:[3,0,0],weight:NaN},{id:'autre',kind:'j',pos:[4,0,0]}]};
  const pick=D.director({shots:[{...seeker,duration:[.1,.1]},{...plain1,duration:[.1,.1]}]});let picked=0;
  for(let i=0;i<3000;i++){const f=pick.update(DT,mixed);if(f.changed&&f.shot==='cherche'){picked++;assert.equal(f.target.id,'u');}}
  assert.ok(picked>=100);
  // valid : faux pendant un plan → « invalid » ; faux au choix → poids nul. weight reçoit ctx.
  const ctx={ok:true},guarded=D.director({shots:[{id:'g',weight:c=>{assert.equal(c,ctx);return 5;},duration:[50,50],valid:c=>c.ok,pose:at(3)},{id:'o',weight:1,duration:[1,1],pose:at(4)}]});
  const reasons=[];
  for(let i=0;i<60*20;i++){ctx.ok=i<300||i>=900;const f=guarded.update(DT,ctx);if(f.changed)reasons.push(f.shot+' '+f.reason);if(i>=300&&i<900)assert.equal(f.shot,'o');}
  assert.deepEqual(reasons.slice(0,2),['g start','o invalid']);assert.ok(reasons.includes('g time'),'g revient quand valid redevient vrai : '+reasons);
  // cutIf : jamais pendant le vol ; reçoit (ctx, age, cible) ; fin « cutIf ».
  // (armed : vrai dès que « base » a été montré, donc quand « vol » vole ; un « vol » en premier plan ne vole pas.)
  const ages=[],cutter=D.director({seed:3,shots:[{id:'base',weight:1,duration:[1,1],pose:at(0)},
    {id:'vol',weight:1,duration:[50,50],transition:'fly',cutIf:(c,age,t)=>{if(c.armed)ages.push(age);assert.equal(t,null);return age>=3;},pose:at(40)}]});
  const ends=[],state={armed:false};
  for(let i=0;i<60*30;i++){const f=cutter.update(DT,state);if(f.shot==='base')state.armed=true;if(f.changed)ends.push(f.reason);if(f.shot==='vol'&&f.changed&&state.armed)assert.equal(f.flight,2.2);}
  assert.ok(ages.length>0&&ages.every(a=>a>=2.2),'cutIf appelé à partir de flight seulement');assert.ok(ends.filter(r=>r==='cutIf').length>=5,ends);
  // Ordre des fins quand plusieurs s'appliquent à la même update : lost, puis invalid, puis time, puis cutIf.
  const ending=(lost,invalid,late,cut)=>{
    const point={id:'q',kind:'k',pos:[0,0,0]},end=D.director({shots:[{id:'p',weight:100,duration:[1,1],needs:'k',valid:c=>c.ok,cutIf:c=>c.cut,pose:at(5)},plain1]});
    assert.equal(end.update(DT,{ok:true,cut:false,points:[point]}).shot,'p');
    return end.update(late?2:DT,{ok:!invalid,cut,points:lost?[]:[point]}).reason;
  };
  assert.deepEqual([ending(1,1,1,1),ending(0,1,1,1),ending(0,0,1,1),ending(0,0,0,1),ending(0,0,0,0)],['lost','invalid','time','cutIf','start']);
  // Préremplissage : roll = 0 et fov = options.fov avant chaque appel ; le tableau pos du jeu n'est jamais écrit.
  const anchor=[7,8,9],seen={},painter=D.director({fov:90,shots:[{id:'alias',weight:1,duration:[1,1],pose(c,age,t,out){out.pos=c.anchor;out.yaw=out.pitch=0;out.roll=.5;out.fov=50;}},
    {id:'ecrit',weight:1,duration:[1,1],pose(c,age,t,out){out.pos[0]=out.pos[1]=out.pos[2]=-1;out.yaw=out.pitch=0;}}]});
  for(let i=0;i<60*20;i++){const f=painter.update(DT,{anchor});seen[f.shot]=poseOf(f);}
  assert.deepEqual(anchor,[7,8,9],'le tableau du jeu n’est jamais écrit');assert.notEqual(painter.frame.pose.pos,anchor);
  assert.deepEqual(seen,{alias:[7,8,9,0,0,.5,50],ecrit:[-1,-1,-1,0,0,0,90]},'roll et fov remis à 0 et à options.fov');
  // Lacet par le plus court : de 3 rad vers −3 rad, le vol passe par π (écart wrapAngle(−6) ≈ 0,283), jamais par 0.
  const turn=D.director({seed:5,shots:[{id:'g',weight:1,duration:[3,3],pose:at(0,3)},{id:'d',weight:1,duration:[3,3],transition:'fly',pose:at(30,-3)}]});
  let flown=0,last=null;
  for(let i=0;i<60*60;i++){
    const f=turn.update(DT,{});
    if(f.shot==='d'&&f.flying){flown++;assert.ok(f.pose.yaw>=3&&f.pose.yaw<=3+D.wrapAngle(-6)+1e-12,'lacet '+f.pose.yaw);if(!f.changed)assert.ok(f.pose.yaw>=last);}
    if(f.shot==='d'&&!f.flying)assert.equal(f.pose.yaw,-3);
    last=f.pose.yaw;
  }
  assert.ok(flown>500);
});
