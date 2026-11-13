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
const API=['rng','hasher','seedFor','smootherstep','wrapAngle','lookAt','schema'];
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
