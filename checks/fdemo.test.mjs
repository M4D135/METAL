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
const API=['rng','hasher','seedFor','smootherstep','wrapAngle','lookAt','schema','recorder','player','replay'];
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
  assert.doesNotMatch(SOURCE,/Math\.random|\bDate\b|performance\.|setTimeout|setInterval|requestAnimationFrame|\bBuffer\b|\brequire\s*\(|\bprocess\.|\bimport\s*\(|\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|TextEncoder|TextDecoder|structuredClone|console\./);
  assert.doesNotMatch(SOURCE,/<\/script/i);
  assert.doesNotMatch(SOURCE,/\binstanceof\b/,'jamais d’instanceof (annexe 4, piège 1)');
  assert.ok(Buffer.byteLength(SOURCE,'utf8')<=24000,'src/demo.js : '+Buffer.byteLength(SOURCE,'utf8')+' octets');
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
