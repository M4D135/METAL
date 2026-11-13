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
const API=['rng','hasher','seedFor','smootherstep','wrapAngle','lookAt'];
const draws=(r,n,kind='u32')=>Array.from({length:n},()=>r[kind]());

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
