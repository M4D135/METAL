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
// Étape 2 : état de resolve, uniformes, cas de la source principale (T8), angles.
const RAD=Math.PI/180,A=x=>Array.from(x),tag=x=>Object.prototype.toString.call(x);
const MONDE=Object.keys(F.UNIFORMS).filter(n=>F.UNIFORMS[n][2]==='monde'),IMAGE=Object.keys(F.UNIFORMS).filter(n=>F.UNIFORMS[n][2]==='image');
const ETAT=['id','preset','principal','exposure','seed','sun','moon','light','fog','uniforms'];
const taille=n=>(F.UNIFORMS[n][0]==='float'?1:+F.UNIFORMS[n][0].slice(3))*F.UNIFORMS[n][1];
const unitaire=v=>Math.abs(Math.hypot(...A(v))-1)<1e-12;
const T8=[[{sun:{el:10}},'sun'],[{sun:{el:-7}},'sun'],[{sun:{el:-9},moon:{el:10}},'moon'],[{sun:{el:-9},moon:{el:-3},floor:[.01,.02,.03]},'none']];
const ecartAngle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
const camera=(o={})=>({right:[1,0,0],up:[0,1,0],forward:[0,0,-1],fov:[1,1],height:100,...o});

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

test('T7 resolve',()=>{
 const avant=JSON.stringify(F.presets);
 for(const p of F.presets){
  const s=F.resolve(p),u=s.uniforms;
  assert.deepEqual(Object.keys(s),ETAT,'clés de l’état ('+p.id+')');
  assert.deepEqual(Object.keys(u).sort(),[...MONDE].sort(),'les 19 uniformes de monde ('+p.id+')');
  for(const n of MONDE){
   assert.equal(tag(u[n]),'[object Float32Array]',n+' doit être un Float32Array');
   assert.equal(u[n].length,taille(n),n+' : longueur');
   assert.ok(A(u[n]).every(Number.isFinite),n+' doit être fini ('+p.id+')');
  }
  assert.equal(u.uFskyRay.length,90,'uFskyRay : 30 vec3');
  assert.deepEqual(plain(F.resolve(p)),plain(s),'deux appels, même état ('+p.id+')');
  // Cas ajoutés : champs de l'état (§3.3).
  assert.deepEqual(plain(F.validate(p)),[],p.id+' doit être valide');
  assert.equal(s.id,p.id);
  assert.deepEqual(plain(s.preset),plain(F.normalize(p)),'preset = normalize(p)');
  assert.ok(Number.isFinite(s.exposure)&&s.exposure>0,'exposition finie et strictement positive ('+p.id+')');
  assert.ok(unitaire(s.sun)&&unitaire(s.moon),'sun et moon unitaires');
  assert.ok(near(A(s.sun),A(F.direction(p.sun.el,p.sun.az))),'sun = direction(sun.el, sun.az)');
  assert.ok(Array.isArray(s.fog)&&s.fog.length===3&&A(s.fog).every(Number.isFinite),'fog : 3 nombres finis');
 }
 assert.equal(JSON.stringify(F.presets),avant,'resolve ne modifie pas FSky.presets');
 assert.throws(()=>F.resolve({turbidity:50}),/FSky\.resolve: turbidity: hors bornes/,'resolve lève sur un préréglage invalide');
 // Cas ajoutés : entrée intacte et non partagée, options absentes ou nulles, entrée non objet traitée comme {}.
 const p={sun:{el:12,az:40},tint:[1,1,1],clouds:{cover:.2,tint:[1,1,1]}},jp=JSON.stringify(p),s=F.resolve(p);
 assert.equal(JSON.stringify(p),jp,'resolve ne modifie pas l’entrée');
 s.preset.tint[0]=2;s.preset.clouds.tint[0]=2;s.preset.sun.el=60;
 assert.equal(JSON.stringify(p),jp,'l’état ne partage rien avec l’entrée');
 assert.deepEqual(plain(F.resolve(p)),plain(F.resolve(p,{})),'options absentes = {}');
 assert.deepEqual(plain(F.resolve(p,null)),plain(F.resolve(p,{})),'options nulles = {}');
 assert.deepEqual(plain(F.resolve(F.resolve(p).preset)),plain(F.resolve(p)),'resolve(state.preset) redonne le même état');
 assert.deepEqual(plain(F.resolve(null)),plain(F.resolve({})),'entrée non objet traitée comme {}');
 assert.equal(F.resolve({}).id,'','id vide sans id');
 // Cas ajoutés : le bloc de données (annexe C.2) compte 18 mondes d'id distincts, graine = index·101+7.
 assert.equal(F.presets.length,18);
 assert.equal(new Set(F.presets.map(q=>q.id)).size,18,'ids distincts');
 F.presets.forEach((q,i)=>assert.equal(q.seed,i*101+7,'graine du monde '+i));
});

test('T8 source principale',()=>{
 for(const[p,attendu]of T8)assert.equal(F.resolve(p).principal,attendu,montre(p));
 const s=F.resolve(T8[3][0]),u=s.uniforms;
 assert.equal(s.exposure,1,'sans source principale, l’exposition vaut 1');
 assert.ok(A(u.uFskyMie).every(v=>v===0),'uFskyMie entièrement nul');
 for(let i=0;i<30;i++)for(let k=0;k<3;k++)
  assert.ok(Math.abs(u.uFskyRay[i*3+k]-[.01,.02,.03][k])<1e-7,'uFskyRay['+i+'] vaut le plancher');
 // Cas ajoutés : bornes incluses de la bascule (soleil ≥ −8°, lune ≥ −2°) ; sources des 18 mondes (annexe E).
 assert.equal(F.resolve({sun:{el:-8}}).principal,'sun');
 assert.equal(F.resolve({sun:{el:-8.001},moon:{el:-2}}).principal,'moon');
 assert.equal(F.resolve({sun:{el:-8.001},moon:{el:-2.001}}).principal,'none');
 assert.deepEqual(A(F.presets.map(p=>F.resolve(p).principal)),[...Array(15).fill('sun'),'moon','none','none']);
 assert.deepEqual(A(u.uFskyCloudSun),[0,0,0],'sans source, pas de lumière directe sur les nuages');
});

test('T9 lumière clé',()=>{
 for(const p of[...F.presets,...T8.map(c=>c[0])]){
  const s=F.resolve(p),q=s.preset,src=s.principal==='moon'?q.moon:q.sun,L=A(s.light);
  assert.ok(unitaire(L),'light unitaire');
  assert.ok(Math.asin(L[1])/RAD>=18-1e-9,'élévation de light ≥ 18° ('+montre(p.id||p)+')');
  assert.ok(ecartAngle(Math.atan2(L[0],-L[2]),src.az*RAD)<1e-9,'azimut de light = azimut de la source principale');
  if(src.el>=18)assert.ok(near(L,A(F.direction(src.el,src.az))),'source au-dessus du plancher : light = sa direction');
  const t=A(F.resolve(p,{lightFloor:30}).light);
  assert.ok(Math.asin(t[1])/RAD>=30-1e-9,'lightFloor 30 respecté');
  assert.ok(ecartAngle(Math.atan2(t[0],-t[2]),src.az*RAD)<1e-9,'lightFloor garde l’azimut');
  // Cas ajouté : lightFloor null vaut absent (??), donc 18°.
  assert.deepEqual(A(F.resolve(p,{lightFloor:null}).light),L,'lightFloor null = 18°');
 }
 // Cas ajoutés (hors fiche) : soleil à 5°, plancher absent, nul ou 0 (0 est une valeur, pas une absence).
 const bas={sun:{el:5,az:40}};
 assert.ok(near(A(F.resolve(bas).light),A(F.direction(18,40))),'plancher par défaut : 18°');
 assert.ok(near(A(F.resolve(bas,{lightFloor:null}).light),A(F.direction(18,40))),'lightFloor null : 18°');
 assert.ok(near(A(F.resolve(bas,{lightFloor:undefined}).light),A(F.direction(18,40))),'lightFloor undefined : 18°');
 assert.ok(near(A(F.resolve(bas,{lightFloor:0}).light),A(F.direction(5,40))),'lightFloor 0 : la source à 5°');
 assert.ok(near(A(F.resolve({sun:{el:-9,az:10},moon:{el:5,az:-70}}).light),A(F.direction(18,-70))),'lune relevée à 18°');
 assert.ok(near(A(F.resolve({sun:{el:-30,az:208},moon:{el:-10}}).light),A(F.direction(18,208))),'sans source : soleil relevé à 18°');
});

test('T10 brouillard cohérent',()=>{
 for(const p of F.presets){
  const s=F.resolve(p);
  for(const y of[-.2,-.01])for(const az of[0,90,180,270]){
   const d=[Math.sin(az*RAD),y,-Math.cos(az*RAD)];
   assert.ok(near(A(F.radianceAt(s,d)),A(F.fogAt(s,d))),'sous l’horizon, radianceAt = fogAt ('+p.id+', y '+y+', az '+az+')');
  }
  for(let j=0;j<8;j++){
   const a=j*45*RAD,x=Math.sin(a),z=-Math.cos(a),f=A(F.fogAt(s,[x,0,z])),r=A(F.radianceAt(s,[x,1e-8,z]));
   for(let k=0;k<3;k++)assert.ok(Math.abs(r[k]-f[k])<=1e-3*(1+Math.abs(f[k])),'continuité à l’horizon ('+p.id+', az '+j*45+')');
  }
  const m=[0,0,0];
  for(let j=0;j<16;j++){const g=F.fogAt(s,F.direction(0,j*22.5));for(let k=0;k<3;k++)m[k]+=g[k];}
  // Plus strict que la fiche (1e-6) : fog est calculé sur les uniformes Float32 définitifs.
  assert.ok(near(A(s.fog),m.map(v=>v/16)),'fog = moyenne de 16 azimuts ('+p.id+')');
  // Cas ajoutés : d normalisé (nul → zénith, échelle sans effet), d intact, d en Float32Array.
  assert.deepEqual(A(F.radianceAt(s,[0,0,0])),A(F.radianceAt(s,[0,1,0])),'d nul → zénith');
  assert.deepEqual(A(F.radianceAt(s,[2,4,6])),A(F.radianceAt(s,[1,2,3])),'radianceAt ne dépend pas de |d|');
  assert.deepEqual(A(F.radianceAt(s,[2,-4,6])),A(F.radianceAt(s,[1,-2,3])),'même chose sous l’horizon');
  const d=[.3,.5,-.8],jd=JSON.stringify(d);F.radianceAt(s,d);F.fogAt(s,d);
  assert.equal(JSON.stringify(d),jd,'d intact');
  assert.ok(near(A(F.radianceAt(s,new Float32Array([0,1,0]))),A(F.radianceAt(s,[0,1,0]))),'d en Float32Array');
  // Direction verticale : azimut de la source (uFskyRefH, en Float32 donc pas tout à fait unitaire).
  const v=A(F.fogAt(s,[0,-1,0])),hz=A(F.fogAt(s,[s.uniforms.uFskyRefH[0],0,s.uniforms.uFskyRefH[1]]));
  assert.deepEqual(A(F.fogAt(s,[0,1,0])),v);assert.deepEqual(A(F.fogAt(s,[1e-6,-1,-1e-6])),v);
  for(let k=0;k<3;k++)assert.ok(Math.abs(v[k]-hz[k])<=1e-5*(1+Math.abs(hz[k])),'vertical : azimut de la source ('+p.id+')');
 }
});

test('T11 encode',()=>{
 const cas=[[[0,0,0],undefined,[0,0,0]],[[1e9,1e9,1e9],undefined,[255,255,255]],[[.76,.76,.76],undefined,[186,186,186]],
  [[.76,.76,.76],.5,[93,93,93]],[[-1,0,0],undefined,[0,0,0]],
  // Cas ajoutés : borne haute après vignette, canaux indépendants, Float32Array.
  [[1e9,1e9,1e9],2,[255,255,255]],[[.76,0,1e9],undefined,[186,0,255]],[new Float32Array([.76,.76,.76]),1,[186,186,186]]];
 for(const[rgb,v,attendu]of cas)assert.deepEqual(Array.from(F.encode(rgb,v)),attendu,'encode('+JSON.stringify(Array.from(rgb))+','+v+')');
});

test('T14 frameUniforms',()=>{
 const cam=camera({fov:[1.6,1],height:540,time:3,vignette:.76,dither:0,mask:1,layers:[1,0,1,0]}),out={};
 assert.equal(F.frameUniforms(cam,out),out,'frameUniforms renvoie out');
 assert.deepEqual(Object.keys(out).sort(),[...IMAGE].sort(),'exactement les 8 uniformes d’image');
 for(const n of IMAGE){assert.equal(tag(out[n]),'[object Float32Array]',n+' doit être un Float32Array');assert.equal(out[n].length,taille(n),n+' : longueur');}
 assert.deepEqual(A(out.uFskyPost),[Math.fround(.76),0,1,0],'uFskyPost = (vignette, tramage, masque, 0)');
 assert.deepEqual(A(out.uFskyLayers),[1,0,1,0]);
 assert.equal(out.uFskyTime[0],3);
 assert.equal(out.uFskyPixel[0],Math.fround(2*1/540),'uFskyPixel = 2·fov[1]/height');
 const id=IMAGE.map(n=>out[n]);
 F.frameUniforms({right:[0,0,1],up:[0,1,0],forward:[-1,0,0],fov:[2,1.25],height:1080,time:9},out);
 IMAGE.forEach((n,i)=>assert.equal(out[n],id[i],n+' : même Float32Array au deuxième appel'));
 assert.deepEqual(A(out.uFskyRight),[0,0,1]);assert.deepEqual(A(out.uFskyForward),[-1,0,0]);
 assert.deepEqual(A(out.uFskyFov),[2,1.25]);assert.equal(out.uFskyTime[0],9,'valeurs mises à jour');
 assert.equal(out.uFskyPixel[0],Math.fround(2*1.25/1080),'uFskyPixel = 2·fov[1]/height');
 // Valeurs par défaut, rétablies quand la caméra ne les donne plus.
 assert.deepEqual(A(out.uFskyPost),[1,1,0,0],'uFskyPost par défaut');
 assert.deepEqual(A(out.uFskyLayers),[1,1,1,1],'uFskyLayers par défaut');
 const d=F.frameUniforms(camera());
 assert.deepEqual(Object.keys(d).sort(),[...IMAGE].sort(),'out absent : nouvel objet');
 assert.deepEqual(A(d.uFskyPost),[1,1,0,0]);assert.deepEqual(A(d.uFskyLayers),[1,1,1,1]);assert.equal(d.uFskyTime[0],0);
 // Cas ajoutés : rien n'est partagé avec la caméra ni d'un appel à l'autre (couches par défaut en constante de module).
 const c=camera();d.uFskyLayers[0]=0;d.uFskyRight[0]=5;
 const e=F.frameUniforms(c,{});
 assert.deepEqual(A(e.uFskyLayers),[1,1,1,1],'les couches par défaut ne sont pas partagées');
 assert.deepEqual(A(e.uFskyRight),[1,0,0]);assert.deepEqual(c.right,[1,0,0],'la caméra reste intacte');
 const f=new Float32Array([0,1,0]);F.frameUniforms(camera({up:f}),e);
 assert.notEqual(e.uFskyUp,f,'les axes sont copiés, pas pris');
 // Un tableau de out de mauvais type ou de mauvaise taille est remplacé.
 const g={uFskyPost:[9,9,9,9],uFskyFov:new Float32Array(3)};F.frameUniforms(camera(),g);
 assert.equal(tag(g.uFskyPost),'[object Float32Array]');assert.equal(g.uFskyFov.length,2);
});

test('T15 bind avec un faux gl',()=>{
 const appels=[],demandes=[],prog={},FCT={float:'uniform1fv',vec2:'uniform2fv',vec3:'uniform3fv',vec4:'uniform4fv'};
 const gl={getUniformLocation(p,n){assert.equal(p,prog,'getUniformLocation reçoit le programme');demandes.push(n);return n==='uFskyMoonUp'?null:{n};},
  useProgram(){assert.fail('bind ne doit pas appeler useProgram');}};
 for(const f of Object.values(FCT))gl[f]=(l,v)=>appels.push([f,l.n,v.length,v]);
 const s=F.resolve(F.presets[0]),cache={};
 assert.equal(F.bind(gl,prog,s.uniforms,cache),18,'18 uniformes posés sur 19');
 const noms=appels.map(a=>a[1]);
 assert.equal(new Set(noms).size,noms.length,'un seul appel par nom');
 assert.deepEqual(appels.filter(a=>a[1]==='uFskyRay').map(a=>a.slice(0,3)),[['uniform3fv','uFskyRay',90]],'uFskyRay : uniform3fv de 90');
 assert.ok(!noms.includes('uFskyMoonUp'),'uFskyMoonUp sauté sans erreur');
 assert.deepEqual([...noms].sort(),MONDE.filter(n=>n!=='uFskyMoonUp').sort());
 for(const a of appels){
  assert.equal(a[0],FCT[F.UNIFORMS[a[1]][0]],'fonction de '+a[1]);
  assert.equal(a[3],s.uniforms[a[1]],a[1]+' : le Float32Array lui-même, sans copie');
 }
 const avant=demandes.length;
 assert.equal(F.bind(gl,prog,s.uniforms,cache),18);
 assert.equal(demandes.length,avant,'un second bind avec le même cache n’appelle plus getUniformLocation');
 assert.ok('uFskyMoonUp' in cache&&cache.uFskyMoonUp===null,'emplacement nul mis en cache');
 // Cas ajoutés : uniformes d'image, valeurs sans uniforme connu, cache absent.
 appels.length=0;
 assert.equal(F.bind(gl,prog,F.frameUniforms(camera()),cache),8,'8 uniformes d’image');
 assert.deepEqual(appels.map(a=>a.slice(0,3)),IMAGE.map(n=>[FCT[F.UNIFORMS[n][0]],n,taille(n)]));
 assert.equal(F.bind(gl,prog,{autre:new Float32Array(3)},cache),0,'nom inconnu ignoré');
 demandes.length=0;
 assert.equal(F.bind(gl,prog,s.uniforms),18,'cache absent : pose quand même');
 assert.equal(demandes.length,19);
});

test('T16 graine',()=>{
 for(const p of[F.presets[3],F.presets[15],F.presets[17]]){
  const a=F.resolve(p,{seed:1}),b=F.resolve(p,{seed:2}),ua=plain(a.uniforms),ub=plain(b.uniforms);
  for(const n of MONDE)if(n!=='uFskySeed')assert.deepEqual(ua[n],ub[n],n+' ne dépend pas de la graine');
  assert.notDeepEqual(ua.uFskySeed,ub.uFskySeed,'uFskySeed dépend de la graine');
  const reste=s=>{const o=plain(s);delete o.seed;delete o.uniforms;return o;};
  assert.deepEqual(reste(a),reste(b),'le reste de l’état ne dépend pas de la graine');
  assert.notEqual(a.seed,b.seed,'la graine effective change');
  assert.equal(F.resolve(p).seed,p.seed,'sans option, la graine du préréglage');
  assert.deepEqual(plain(F.resolve(p,{seed:5})),plain(F.resolve(p,{seed:5})),'mêmes options, même résultat');
  // Cas ajoutés : formule de la graine effective (§3.3), graines négatives, non entières ou hors int32.
  for(const g of[0,1,-1,7.9,1e10,-123456789,2**31,'3',undefined,null]){
   const s=F.resolve(p,{seed:g});
   assert.equal(s.seed,((Math.imul(g|0,7919)+p.seed)>>>0)%65536,'graine effective pour '+g);
   assert.equal(s.uniforms.uFskySeed[3],s.seed,'uFskySeed.w = graine effective');
  }
 }
});

test('T17 temps (souple)',()=>{
 // Mesuré dans le contexte vm du test, 4,5 à 9 fois plus lent que le domaine principal.
 for(const p of F.presets){
  const t0=performance.now();F.resolve(p);const d=performance.now()-t0;
  assert.ok(d<50,'resolve sous 50 ms ('+p.id+' : '+d.toFixed(2)+' ms)');
 }
});
