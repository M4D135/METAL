// Module FSky — vérifications de la voie ciel. Hors `npm test` : node --test checks/fsky.test.mjs
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const SRC=readFileSync(new URL('../src/skies.js',import.meta.url),'utf8');
const charge=()=>{const ctx={};vm.createContext(ctx);vm.runInContext(SRC,ctx);return ctx;};
const CTX=charge(),F=CTX.FSky;
const plain=x=>JSON.parse(JSON.stringify(x,(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v));
const near=(a,b,eps=1e-12)=>a.length===b.length&&a.every((v,k)=>Math.abs(v-b[k])<=eps);
const montre=p=>JSON.stringify(p,(k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v);
// validate ne doit jamais lever : l'appel est enveloppé pour nommer l'entrée fautive.
const erreurs=p=>{try{return plain(F.validate(p));}catch(x){assert.fail('validate('+montre(p)+') lève : '+x.message);}};
const refuse=(p,chemin)=>{const e=erreurs(p);
 assert.ok(e.some(m=>m.startsWith(chemin+':')),montre(p)+' → attendu '+chemin+' dans « '+e.join(' | ')+' »');return e;};
const accepte=p=>assert.deepEqual(erreurs(p),[],montre(p)+' doit être accepté');

test('T1 chargement',()=>{
 assert.deepEqual(Object.keys(CTX),['FSky']);
 assert.equal(F.VERSION,1);
 for(const n of['normalize','validate','direction','view','resolve','frameUniforms','bind','radianceAt','fogAt','encode','signature'])
  assert.equal(typeof F[n],'function',n+' doit être une fonction');
 for(const n of['VERT','FOG_GLSL','FRAG'])assert.equal(typeof F[n],'string',n+' doit être une chaîne');
 for(const n of['UNIFORMS','defaults'])assert.equal(typeof F[n],'object',n+' doit être un objet');
 assert.ok(Array.isArray(F.presets),'presets doit être un tableau');
 assert.deepEqual(Object.keys(F).sort(),['VERSION','VERT','FOG_GLSL','FRAG','UNIFORMS','defaults','presets','normalize','validate','direction',
  'view','resolve','frameUniforms','bind','radianceAt','fogAt','encode','signature'].sort(),'membres du §3.2, exactement');
});

test('T2 hygiène du source',()=>{
 for(const s of['Math.random','Date.now','new Date','performance.now','fetch(','XMLHttpRequest','WebSocket(','import(','@import','</script','require(','/Users/','/home/'])
  assert.ok(!SRC.includes(s),'source interdit : '+s);
 assert.ok(Buffer.byteLength(SRC)<=24000,'src/skies.js doit rester sous 24 000 octets');
});

test('T3 GLSL statique',()=>{
 assert.ok(F.VERT.startsWith('#version 300 es\n'),'VERT doit commencer par #version');
 assert.ok(F.FRAG.startsWith('#version 300 es\n'),'FRAG doit commencer par #version');
 assert.ok(!F.FOG_GLSL.includes('#version'),'FOG_GLSL ne doit pas déclarer #version');
 assert.ok(!F.FOG_GLSL.includes('precision'),'FOG_GLSL ne doit pas déclarer de précision');
 assert.ok(F.FRAG.includes(F.FOG_GLSL),'FRAG doit inclure FOG_GLSL');
 assert.ok(F.FOG_GLSL.endsWith('\n'),'FOG_GLSL doit finir par un saut de ligne');
 assert.ok(F.FRAG.startsWith('#version 300 es\nprecision highp float;\nprecision highp int;\n'+F.FOG_GLSL),'FRAG = en-tête + FOG_GLSL + suite');
 // GLSL à l'octet près de la référence validée (mission ciel, annexe A) ; un levier de coût (§6.1)
 // qui change FRAG met à jour son empreinte dans le même commit.
 const h=s=>createHash('sha256').update(s).digest('hex');
 assert.equal(h(F.VERT),'13b10eba7a07125ab931fd45c77222b7f780792224bad4f6cdf69c7dee529dd8','VERT doit rester celui de l’annexe A.1');
 assert.equal(h(F.FOG_GLSL),'2a1f64748dc7c6668424fcf08d6d62a725d2b9d43a19137cbc7a1c0e16513dfa','FOG_GLSL doit rester celui de l’annexe A.2');
 assert.equal(h(F.FRAG),'4e78c16bf66b9753675536d9fa7ff9641a4baab2cc5782593b0e917ba5e65a7f','FRAG doit rester celui de l’annexe A.3');
 const vus=new Map();
 for(const m of F.FRAG.matchAll(/uniform\s+(float|vec2|vec3|vec4)\s+(\w+)(?:\[(\d+)\])?\s*;/g))vus.set(m[2],[m[1],m[3]?+m[3]:1]);
 assert.deepEqual([...vus.keys()].sort(),Object.keys(F.UNIFORMS).sort(),'les uniformes déclarés doivent être ceux de UNIFORMS');
 for(const[n,v]of vus)assert.deepEqual(Array.from(v),[F.UNIFORMS[n][0],F.UNIFORMS[n][1]],'type ou taille de '+n);
 const genres=Object.keys(F.UNIFORMS).map(n=>F.UNIFORMS[n][2]);
 assert.ok(genres.every(g=>g==='monde'||g==='image'),'genre inconnu');
 assert.equal(genres.filter(g=>g==='monde').length,19,'19 uniformes de monde');
 assert.equal(genres.filter(g=>g==='image').length,8,'8 uniformes d’image');
 for(const s of['texture(','sampler','dFdx','dFdy','fwidth','fract(sin('])assert.ok(!F.FRAG.includes(s),'FRAG interdit : '+s);
 for(const m of F.FRAG.matchAll(/\b(?:void|float|int|uint|vec[234]|uvec[234]|ivec[234])\s+([A-Za-z_]\w*)\s*\(/g))
  assert.ok(m[1]==='main'||m[1].startsWith('fsky'),'fonction mal nommée : '+m[1]);
});

test('T4 conventions',()=>{
 assert.ok(near(F.direction(0,0),[0,0,-1]),'direction(0,0)');
 assert.ok(near(F.direction(0,90),[1,0,0]),'direction(0,90)');
 assert.ok(near(F.direction(90,123),[0,1,0]),'direction(90,123)');
 assert.ok(Math.abs(Math.hypot(...F.direction(30,-45))-1)<1e-12,'direction doit être unitaire');
 const v=F.view(0,0,Math.PI/2,2);
 assert.ok(near(v.forward,[0,0,-1]),'forward');
 assert.ok(near(v.right,[1,0,0]),'right');
 assert.ok(near(v.up,[0,1,0]),'up');
 assert.ok(near(v.fov,[2,1]),'fov');
 for(const yaw of[-2,0.3,1.7])for(const pitch of[-1,0,0.6]){
  const a=F.view(yaw,pitch,1.2,1.6);
  for(const k of['right','up','forward'])assert.ok(Math.abs(Math.hypot(...a[k])-1)<1e-12,k+' doit être unitaire');
  assert.ok(Math.abs(a.right[0]*a.up[0]+a.right[1]*a.up[1]+a.right[2]*a.up[2])<1e-12,'right ⟂ up');
  assert.ok(Math.abs(a.right[0]*a.forward[0]+a.right[1]*a.forward[1]+a.right[2]*a.forward[2])<1e-12,'right ⟂ forward');
  assert.ok(Math.abs(a.up[0]*a.forward[0]+a.up[1]*a.forward[1]+a.up[2]*a.forward[2])<1e-12,'up ⟂ forward');
  const x=[a.right[1]*a.up[2]-a.right[2]*a.up[1],a.right[2]*a.up[0]-a.right[0]*a.up[2],a.right[0]*a.up[1]-a.right[1]*a.up[0]];
  assert.ok(near(x,[-a.forward[0],-a.forward[1],-a.forward[2]]),'right × up doit valoir −forward');
 }
});

test('T5 normalize',()=>{
 assert.deepEqual(plain(F.validate(F.defaults)),[],'defaults doit être valide');
 assert.deepEqual(plain(F.normalize({})),plain(F.normalize(F.defaults)),'{} doit donner defaults');
 for(const p of F.presets)assert.deepEqual(plain(F.normalize(F.normalize(p))),plain(F.normalize(p)),'normalize doit être idempotente');
 const p={sun:{el:12,az:40},tint:[1,1,1],clouds:{cover:.2}};
 const avant=JSON.stringify(p);
 F.normalize(p);
 assert.equal(JSON.stringify(p),avant,'normalize ne doit pas modifier l’entrée');
 const n=F.normalize({});
 n.tint[0]=.5;n.clouds.tint[0]=.5;n.sun.el=1;
 assert.equal(F.defaults.tint[0],1,'defaults.tint ne doit pas être partagé');
 assert.equal(F.defaults.clouds.tint[0],1,'defaults.clouds.tint ne doit pas être partagé');
 assert.equal(F.defaults.sun.el,30,'defaults.sun ne doit pas être partagé');
 // Cas ajoutés (contrôle de la WIP) : fusion clé à clé d'un sous-objet partiel.
 assert.deepEqual(plain(F.normalize({})),plain(F.defaults),'normalize({}) doit valoir defaults');
 assert.deepEqual(plain(F.normalize({clouds:{cover:.5}}).clouds),{...plain(F.defaults.clouds),cover:.5},'les autres champs de clouds restent ceux de defaults');
 assert.deepEqual(plain(F.validate({clouds:{cover:.5}})),[],'un sous-objet partiel est valide');
 assert.deepEqual(plain(F.normalize({sun:{el:12}}).sun),{...plain(F.defaults.sun),el:12},'les autres champs de sun restent ceux de defaults');
 // Une valeur fournie reste telle quelle, même invalide, pour que validate la juge ; undefined vaut absent.
 assert.equal(F.normalize({tint:5}).tint,5,'tint fourni non tableau gardé');
 assert.equal(F.normalize({clouds:{tint:'x'}}).clouds.tint,'x','clouds.tint fourni non tableau gardé');
 assert.equal(F.normalize({glow:{color:null}}).glow.color,null,'glow.color null gardé');
 assert.equal(F.normalize({clouds:null}).clouds,null,'clouds null gardé');
 assert.ok(Number.isNaN(F.normalize({sun:{el:NaN}}).sun.el),'nombre invalide gardé');
 assert.deepEqual(plain(F.normalize({tint:undefined,clouds:{cover:undefined},zz:undefined})),plain(F.defaults),'undefined vaut absent');
 for(const v of[null,3,'x',[1,2],new Map(),new Float32Array(3)])assert.deepEqual(plain(F.normalize(v)),plain(F.defaults),'non objet traité comme {}');
 const r=F.normalize({id:'a-b',name:'Nom',inconnu:[1,2],clouds:{epais:1}});
 assert.equal(r.id,'a-b');assert.equal(r.name,'Nom');assert.deepEqual(Array.from(r.inconnu),[1,2]);assert.equal(r.clouds.epais,1);
 // Aucun tableau ni sous-objet partagé avec l'entrée ou defaults ; entrée intacte ; idempotence hors préréglages.
 const q={tint:[1,1,1],grade:[1,1,1],floor:[0,0,0],clouds:{tint:[1,1,1]},glow:{color:[1,1,1]},sun:{el:5},inconnu:[3],moon:[1,2]};
 const jq=JSON.stringify(q),nq=F.normalize(q);
 for(const k of['tint','grade','floor','inconnu','moon','sun','clouds','glow'])assert.notEqual(nq[k],q[k],k+' ne doit pas être partagé avec l’entrée');
 assert.notEqual(nq.clouds.tint,q.clouds.tint,'clouds.tint partagé');assert.notEqual(nq.glow.color,q.glow.color,'glow.color partagé');
 const nd=F.normalize(F.defaults);
 for(const k of Object.keys(F.defaults))if(typeof F.defaults[k]==='object')assert.notEqual(nd[k],F.defaults[k],k+' ne doit pas être partagé avec defaults');
 assert.notEqual(nd.clouds.tint,F.defaults.clouds.tint);assert.notEqual(nd.glow.color,F.defaults.glow.color);
 F.validate(q);assert.equal(JSON.stringify(q),jq,'normalize et validate ne doivent pas modifier l’entrée');
 for(const x of[F.defaults,{},q,{clouds:{cover:.5}},{tint:5},{clouds:null},{glow:{color:null}},{sun:[1,2]},{horizon:{far:'a'}},{id:'a',name:'b',zz:{y:1}}])
  assert.deepEqual(plain(F.normalize(F.normalize(x))),plain(F.normalize(x)),'normalize doit être idempotente : '+montre(x));
});

test('T6 validate refuse',()=>{
 const cas=[
  [{turbidity:50},'turbidity'],
  [{clouds:{cover:-0.1}},'clouds.cover'],
  [{tint:[1,1]},'tint'],
  [{sun:{el:NaN}},'sun.el'],
  [{seed:1.5},'seed'],
  [{id:'Pas Bon'},'id'],
  [{inconnu:1},'inconnu'],
  [{clouds:{epais:1}},'clouds.epais'],
  [{horizon:{far:0.02,near:0.05}},'horizon'],
  // Cas ajoutés (contrôle de la WIP) : la WIP levait sur le premier et laissait passer les trois suivants.
  [{clouds:null},'clouds'],
  [{tint:5},'tint'],
  [{clouds:{tint:'x'}},'clouds.tint'],
  [{glow:{color:null}},'glow.color'],
  [{glow:5},'glow'],
  [{sun:[1,2]},'sun'],
  [{horizon:{far:'a',near:.1}},'horizon.far'],
  [{name:''},'name']
 ];
 for(const[p,chemin]of cas){
  const e=erreurs(p);
  assert.ok(e.length>0,montre(p)+' doit être refusé');
  assert.ok(e.some(m=>m.startsWith(chemin+':')),montre(p)+' → attendu '+chemin+' dans « '+e.join(' | ')+' »');
 }
 for(const v of[null,3,'x'])assert.ok(F.validate(v).length>0,'entrée non objet refusée');
 for(const v of[undefined,true,[],[1,2,3],new Map(),new Float32Array(3),()=>1,null,3,'x'])
  assert.deepEqual(erreurs(v),['preset: objet attendu'],'entrée non objet : '+Object.prototype.toString.call(v));
 // Schéma de la mission ciel (§3.5), recopié ici : bornes incluses, juste au-delà refusé au bon chemin, types refusés.
 const N={'sun.el':[-90,90],'moon.el':[-90,90],'sun.az':[-360,360],'moon.az':[-360,360],'wind.dir':[-360,360],'sun.size':[.1,5],'sun.bright':[0,50],
  'moon.size':[.1,6],'moon.bright':[0,20],turbidity:[.5,15],absorb:[0,.95],g:[0,.95],rayleigh:[.1,4],ozone:[0,4],multi:[0,1],key:[.005,.6],
  'clouds.cover':[0,1],'clouds.opacity':[0,1],'clouds.dark':[0,1],'clouds.veil':[0,1],'clouds.soft':[.01,.6],'clouds.scale':[.1,5],
  'clouds.stretch':[1,8],'clouds.curve':[.02,.6],'wind.speed':[0,10],stars:[0,1],milky:[0,1],'glow.strength':[0,1],'horizon.mix':[0,1],
  'glow.width':[1,45],'horizon.far':[0,.2],'horizon.near':[0,.15],'horizon.dark':[0,2],seed:[0,65535]};
 const T={tint:[0,2],'clouds.tint':[0,2],'glow.color':[0,2],grade:[.2,2.5],floor:[0,.1]};
 const feuilles=(o,pre='')=>Object.keys(o).flatMap(k=>o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k])?feuilles(o[k],pre+k+'.'):[pre+k]);
 assert.deepEqual(feuilles(plain(F.defaults)).sort(),Object.keys({...N,...T}).sort(),'le schéma du §3.5 couvre exactement defaults');
 const en=(chemin,v)=>{const[a,b]=chemin.split('.');return chemin==='horizon.far'?{horizon:{far:v,near:0}}:chemin==='horizon.near'?{horizon:{near:v,far:.2}}:b?{[a]:{[b]:v}}:{[a]:v};};
 for(const[chemin,[lo,hi]]of Object.entries(N)){
  accepte(en(chemin,lo));accepte(en(chemin,hi));
  for(const v of[lo-1e-6,hi+1e-6,NaN,Infinity,-Infinity,'1',null,true,[1],{}])refuse(en(chemin,v),chemin);
 }
 for(const v of[-1,65536,0.5])refuse({seed:v},'seed');
 for(const[chemin,[lo,hi]]of Object.entries(T)){
  for(let k=0;k<3;k++){const t=v=>en(chemin,[lo,lo,lo].map((x,i)=>i===k?v:x));
   accepte(t(lo));accepte(t(hi));refuse(t(lo-1e-6),chemin+'['+k+']');refuse(t(hi+1e-6),chemin+'['+k+']');refuse(t(NaN),chemin);refuse(t('1'),chemin);}
  for(const v of[[lo,lo],[lo,lo,lo,lo],5,null,'x',{},[lo,Infinity,lo],[lo,,lo]])refuse(en(chemin,v),chemin);
 }
 // Sous-objets : clés inconnues signalées ; un non-objet est signalé une seule fois, sans descendre dedans.
 for(const s of['sun','moon','clouds','wind','glow','horizon']){
  refuse({[s]:{zz:1}},s+'.zz');
  for(const v of[null,5,'x',[1,2],true]){const e=refuse({[s]:v},s);assert.ok(!e.some(m=>m.startsWith(s+'.')),s+' non objet : « '+e.join(' | ')+' »');}
 }
 for(const k of['zz','constructor','toString'])refuse({[k]:1},k);
 for(const id of['a','a-b','lisiere-aube','x9-0'])accepte({id});
 for(const id of['Pas Bon','-a','a-','a--b','é','',5,null,Object.create(null)])refuse({id},'id');
 for(const name of['x','x'.repeat(40),'Après-midi de cirrus'])accepte({name});
 for(const name of['','x'.repeat(41),5,null])refuse({name},'name');
 accepte({horizon:{far:.05,near:.05}});
 for(const p of[{turbidity:Object.create(null)},{tint:[Symbol('s'),1,1]},{clouds:{tint:Object.create(null)}},{sun:Object.create(null)}])erreurs(p);
});

test('T11 encode',()=>{
 const cas=[[[0,0,0],undefined,[0,0,0]],[[1e9,1e9,1e9],undefined,[255,255,255]],[[.76,.76,.76],undefined,[186,186,186]],
  [[.76,.76,.76],.5,[93,93,93]],[[-1,0,0],undefined,[0,0,0]],
  // Cas ajoutés : borne haute après vignette, canaux indépendants, Float32Array.
  [[1e9,1e9,1e9],2,[255,255,255]],[[.76,0,1e9],undefined,[186,0,255]],[new Float32Array([.76,.76,.76]),1,[186,186,186]]];
 for(const[rgb,v,attendu]of cas)assert.deepEqual(Array.from(F.encode(rgb,v)),attendu,'encode('+JSON.stringify(Array.from(rgb))+','+v+')');
});
