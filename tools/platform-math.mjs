// Lot 01 suite (MURS-V1): platform sensitivity of world generation.
// Outside the game and outside npm test. Compares the host Math.sin, cos, atan and
// atan2 with FMath (src/fmath.js, the portable fdlibm of V8 without FMA), and the
// host Math.hypot with FMath.hypot2 and hypot3 (the MathHypot builtin of V8), in
// the main Node realm (tools/realm-loader.mjs, never node:vm). Nothing is written
// in src/, checks/ or dist/; FMath is injected through loadRealm globals or, for
// the replays only, into this process' Math.
//
// Since T2, src/world.js takes sin, cos, atan and atan2 from FMath itself, and
// since T3 hypot too (hypot2, hypot3), so an injected Math no longer changes it.
// The host variant (native trigonometry) comes from a world.js before the fix:
// --base <root>. A root whose world.js still calls Math (before T2) is its own base.
//
//   node tools/platform-math.mjs census      [root] [--base B] [--seeds 1,96,2026] [--path fmath|host] [--samples 150] [--out F]
//   node tools/platform-math.mjs golden      [root] [--base B] [--seeds 1,96,2026] [--out F]
//   node tools/platform-math.mjs worlds      [root] [--base B] [--seeds 1,96,2026] [--fixture check|write] [--out F]
//   node tools/platform-math.mjs checkpoints [root] [--base B | --from W] [--seed 96] [--out F]
//   node tools/platform-math.mjs replay      [root] [--fmath] [--scenario all] [--steps 1800] [--profile-out F] [--out F]
//   node tools/platform-math.mjs sim-risk    [root] [--sim-fmath] [--steps 1800] [--out F]
//   node tools/platform-math.mjs pages       [root] [--base B] --dir D [--census F]
//   node tools/platform-math.mjs engines     [root] [--base B] --dir D [--census F] [--chrome PATH] [--jsc PATH]
//
// "worlds": SHA-256 of the 114 worlds; with --base, also those of the world.js of
// B with FMath injected. "worlds --fixture" (T4): "check" compares the 108
// campaign worlds with checks/campaign-world-digests.json of root, the golden
// digests that checks/campaign-world.test.mjs asserts (exit code 1 on any
// difference); "write" rewrites that file, only for the seeds of the test, from a
// world.js that takes its trigonometry from FMath and whose six classic worlds
// equal the golden legacyHashes of the test (the x86-64 oracle).
// "checkpoints --from W": points written by root W (world and simulation, as a
// player before the fix) and read back by root. "engines"
// runs Google Chrome headless on file:// pages (--dump-dom, private
// --user-data-dir under D, no port, no server) and JavaScriptCore's jsc shell; in
// jsc, the 114 worlds of root are hashed with SHA-256 and compared with Node.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {loadRealm,defaultModules,DEFAULT_ROOT} from './realm-loader.mjs';

export const PORTED=Object.freeze(['sin','cos','atan','atan2']);
export const HYPOT=Object.freeze(['hypot2','hypot3']); // FMath since T3, compared with the host Math.hypot
const f64=new Float64Array(1),u64=new BigUint64Array(f64.buffer);
export const bits=x=>{f64[0]=x;return u64[0].toString(16).padStart(16,'0');};
export const fromBits=hex=>{u64[0]=BigInt('0x'+hex);return f64[0];};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fnv=text=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');};
const highWord=x=>{f64[0]=x;return Number(u64[0]>>32n)&0x7fffffff;};
// fdlibm argument classes of sin/cos, by high word: no reduction, n=+-1, medium, __kernel_rem_pio2.
const reductionClass=x=>{const ix=highWord(x);return ix<=0x3fe921fb?'none':ix<0x4002d97c?'pio2':ix<=0x413921fb?'medium':ix>=0x7ff00000?'nonFinite':'large';};

// FMath of a root, or of this repository for a root from before src/fmath.js.
export function loadFMath(root=DEFAULT_ROOT){return loadRealm({root:existsSync(join(root,'src/fmath.js'))?root:DEFAULT_ROOT,modules:['fmath']}).window.FMath;}
export function fmathMath(F){const M=Object.create(Math);for(const name of PORTED)M[name]=F[name];return M;}
// True when the world.js of a root takes its trigonometry from FMath (T2 and later).
export function worldUsesFMath(root){return /\bFMath\b/.test(readFileSync(join(root,'src/world.js'),'utf8'));}
// FWorld of a root: fmath loads first when world.js needs it. M replaces Math;
// FM replaces FMath (window.FMath), for instrumentation.
export function worldFactory(root,M,FM){
  // FPassages (lot « jeu-pieges-massifs ») est optionnel : une racine antérieure
  // n'a pas ce fichier et doit rester mesurable et comparée telle quelle.
  const optional=existsSync(join(root,'src/passages.js'))?['passages']:[];
  const modules=worldUsesFMath(root)&&!FM?['fmath',...optional,'world']:['world'],globals={...(M?{Math:M}:{}),...(FM?{FMath:FM}:{})};
  return loadRealm({root,modules,globals}).window.FWorld;
}
// Host variant: the native trigonometry of this machine, from a world.js before the fix.
export function hostWorld(root,base){
  if(base)return worldFactory(base);
  if(!worldUsesFMath(root))return worldFactory(root);
  throw new Error(`src/world.js of ${root} takes its trigonometry from FMath: give --base <root before the fix> for the host variant`);
}
// FMath variant: a wired world.js as it is, an older one with FMath injected.
export function fmathWorld(root,F=loadFMath(root)){return worldUsesFMath(root)?worldFactory(root):worldFactory(root,fmathMath(F));}
const hostRoot=(root,base)=>base??(worldUsesFMath(root)?null:root);

// The six golden digests, read from the test itself so the tool can never drift from it.
export function legacyHashes(root){
  const text=readFileSync(join(root,'checks/campaign-world.test.mjs'),'utf8'),block=/const legacyHashes = \[([\s\S]*?)\n\];/.exec(text);
  if(!block)throw new Error('legacyHashes not found in checks/campaign-world.test.mjs');
  const rows=[...block[1].matchAll(/\[(\d+), (\d+), '([0-9a-f]{64})'\]/g)].map(m=>[Number(m[1]),Number(m[2]),m[3]]);
  if(rows.length!==6)throw new Error('expected six legacy hashes, found '+rows.length);
  return rows;
}

export function worldList(seeds=[1,96,2026],legacySeeds=[1,96]){
  const list=[];
  for(const seed of legacySeeds)for(let stage=0;stage<3;stage++)list.push({kind:'legacy',seed,index:stage,options:undefined});
  for(const seed of seeds)for(let index=0;index<18;index++){
    list.push({kind:'v1',seed,index,options:{campaign:true}});
    list.push({kind:'v2',seed,index,options:{campaign:true,campaignVersion:2}});
  }
  return list;
}
const make=(W,w)=>W.create(w.seed,w.index,w.options&&{...w.options});

// ---------------------------------------------------------------- census
export function census(root,{seeds=[1,96,2026],path='fmath',samples=150}={}){
  if(!['fmath','host'].includes(path))throw new Error('--path must be fmath or host');
  const F=loadFMath(root),byKind={},perWorld=[],seen=new Set(),divergentSamples={sin:[],cos:[],atan:[],atan2:[],hypot2:[],hypot3:[]};
  let bucket=null,world=null;
  const slot=name=>bucket[name]??={calls:0};
  const trig=(name,args,host,port)=>{
    const s=slot(name);s.calls++;s.divergent??=0;
    const magnitude=name==='atan2'?Math.max(Math.abs(args[0]),Math.abs(args[1])):Math.abs(args[0]);
    if(!(magnitude<=(s.maxAbsArg??0))){s.maxAbsArg=magnitude;s.maxAbsArgBits=bits(magnitude);}
    if(name==='sin'||name==='cos'){const c=reductionClass(args[0]);(s.reduction??={})[c]=(s.reduction[c]||0)+1;}
    if(!Object.is(host,port)){
      s.divergent++;world.divergent[name]=(world.divergent[name]||0)+1;
      const key=name+args.map(bits).join(',');
      if(!seen.has(key)&&divergentSamples[name].length<samples){seen.add(key);divergentSamples[name].push({args:args.map(bits),host:bits(host),fmath:bits(port),kind:world.kind});}
    }
  };
  const M=Object.create(Math);
  for(const name of Object.getOwnPropertyNames(Math)){
    const host=Math[name];if(typeof host!=='function')continue;
    if(name==='atan2'){const port=F.atan2;M.atan2=(y,x)=>{const h=host(y,x),p=port(y,x);trig(name,[y,x],h,p);return path==='host'?h:p;};}
    else if(PORTED.includes(name)){const port=F[name];M[name]=x=>{const h=host(x),p=port(x);trig(name,[x],h,p);return path==='host'?h:p;};}
    else if(name==='hypot')M.hypot=function(){const s=slot(name);s.calls++;(s.arity??={})[arguments.length]=(s.arity[arguments.length]||0)+1;return host.apply(Math,arguments);};
    else M[name]=function(){slot(name).calls++;return host.apply(Math,arguments);};
  }
  bucket=byKind.load={};world={kind:'load',divergent:{}};
  // A wired world.js (T2) calls FMath: the same comparison runs on an instrumented
  // FMath. Since T3 it also calls FMath.hypot2 and hypot3, compared with the host
  // Math.hypot at the same arity (path host: the host result is returned).
  const FM=Object.fromEntries(PORTED.map(name=>[name,M[name]])),hostHypot=Math.hypot;
  const hyp=(name,args,host,port)=>{
    const s=slot(name);s.calls++;s.divergent??=0;
    const magnitude=Math.max(...args.map(Math.abs));if(!(magnitude<=(s.maxAbsArg??0))){s.maxAbsArg=magnitude;s.maxAbsArgBits=bits(magnitude);}
    if(!Object.is(host,port)&&!(host!==host&&port!==port)){s.divergent++;world.divergent[name]=(world.divergent[name]||0)+1;if(divergentSamples[name].length<samples)divergentSamples[name].push({args:args.map(bits),host:bits(host),fmath:bits(port),kind:world.kind});}
  };
  if(typeof F.hypot2==='function'){FM.hypot2=(x,y)=>{const h=hostHypot(x,y),p=F.hypot2(x,y);hyp('hypot2',[x,y],h,p);return path==='host'?h:p;};FM.hypot3=(x,y,z)=>{const h=hostHypot(x,y,z),p=F.hypot3(x,y,z);hyp('hypot3',[x,y,z],h,p);return path==='host'?h:p;};}
  const wired=worldUsesFMath(root),W=wired?worldFactory(root,M,Object.freeze(FM)):worldFactory(root,M);
  if(!Object.keys(byKind.load).length)delete byKind.load;
  for(const w of worldList(seeds)){
    bucket=byKind[w.kind]??={};world={kind:w.kind,seed:w.seed,index:w.index,divergent:{}};
    make(W,w);perWorld.push(world);
  }
  const total={};
  for(const kind of Object.values(byKind))for(const [name,s] of Object.entries(kind)){
    const t=total[name]??={calls:0};t.calls+=s.calls;
    if(s.divergent!==undefined){t.divergent=(t.divergent||0)+s.divergent;if(!(s.maxAbsArg<=(t.maxAbsArg??0))){t.maxAbsArg=s.maxAbsArg;t.maxAbsArgBits=s.maxAbsArgBits;}}
    for(const field of ['reduction','arity'])if(s[field]){t[field]??={};for(const [k,v] of Object.entries(s[field]))t[field][k]=(t[field][k]||0)+v;}
  }
  for(const group of [total,...Object.values(byKind)])for(const s of Object.values(group))if(s.divergent!==undefined)s.divergentRate=s.calls?s.divergent/s.calls:0;
  const worldsWithDivergence=Object.fromEntries(['legacy','v1','v2'].map(kind=>{const rows=perWorld.filter(w=>w.kind===kind);return [kind,{worlds:rows.length,withDivergentCall:rows.filter(w=>Object.keys(w.divergent).length).length,withDivergentSin:rows.filter(w=>w.divergent.sin).length,withDivergentCos:rows.filter(w=>w.divergent.cos).length,withDivergentAtan2:rows.filter(w=>w.divergent.atan2).length,withDivergentAtan:rows.filter(w=>w.divergent.atan).length,withDivergentHypot:rows.filter(w=>w.divergent.hypot2||w.divergent.hypot3).length}];}));
  return {schema:'metal-platform-math-census-v1',environment:env(),root,worldUsesFMath:wired,path,seeds,legacySeeds:[1,96],worlds:perWorld.length,
    note:'Every Math function called by src/world.js is counted, and FMath too when world.js calls it (path fmath: FMath results; path host: the host results instead). sin, cos, atan and atan2 are compared with FMath, and FMath.hypot2 and hypot3 (T3) with the host Math.hypot; the others are exact by specification (abs, ceil, floor, imul, max, min, round, sign, sqrt). A Math.hypot of an older world.js is only counted: it is the same Torque algorithm on every V8 build.',
    largeArgumentCalls:(total.sin?.reduction?.large||0)+(total.cos?.reduction?.large||0),total,byKind,worldsWithDivergence,perWorld,divergentSamples};
}

// ---------------------------------------------------------------- golden
// The eight historical tests of checks/campaign-world.test.mjs, replayed with the
// same transformations under host Math and under FMath injected into world.js.
export function goldenChecks(create,hashes){
  const expected=(seed,stage)=>hashes.find(h=>h[0]===seed&&h[1]===stage)[2],rows=[];
  for(const [seed,stage,want] of hashes){const got=digest(create(seed,stage));rows.push({test:`legacy seed ${seed}, sector ${stage}: exact pre-campaign world fingerprint`,pass:got===want,digest:got});}
  {
    let pass=true;const want=expected(96,2);
    for(const options of [undefined,{},{campaign:false},{campaign:1},{campaign:'true'},null]){
      const w=create(96,17,options);if(digest(w)!==want)pass=false;
      for(const field of ['campaign','index','chapter','chapterTitle'])if(Object.hasOwn(w,field))pass=false;
    }
    pass&&=create(96,-5,{campaign:true}).index===0&&create(96,99,{campaign:true}).index===17&&create(96,7.9,{campaign:true}).index===7;
    rows.push({test:'campaign mode is strictly opt-in and keeps historical clamping otherwise',pass});
  }
  {
    let pass=true;const stages=[];
    for(let stage=0;stage<3;stage++){
      const w=create(96,stage,{campaign:true});
      for(const key of ['campaign','index','chapter','chapterTitle','trophies','campaignProfile'])delete w[key];
      const legacy=create(96,stage);
      for(const key of ['weaponSlots','startWeapons','startAmmo','ammoCaps','maxActive'])w.progression[key]=legacy.progression[key];
      w.pickups=legacy.pickups;w.enemies=legacy.enemies;w.encounters=legacy.encounters;
      const ok=digest(w)===expected(96,stage);stages.push(ok);pass&&=ok;
    }
    rows.push({test:'the first three campaign worlds preserve historical geometry outside campaign supplies and loadout',pass,stages});
  }
  return {passed:rows.filter(r=>r.pass).length,of:rows.length,rows};
}

export function golden(root,{seeds=[1,96,2026],base}={}){
  const hashes=legacyHashes(root),F=loadFMath(root),hr=hostRoot(root,base),host=hr?worldFactory(hr):null,port=fmathWorld(root,F);
  const result={schema:'metal-platform-math-golden-v1',environment:env(),root,base:base??null,worldUsesFMath:worldUsesFMath(root),
    host:host?goldenChecks(host.create,hashes):{skipped:'world.js takes FMath; give --base for the host variant'},fmath:goldenChecks(port.create,hashes),campaign:{}};
  // Subsets: which ported functions are needed to recover the golden worlds? (a world.js before the fix)
  result.subsets=[];
  if(hr)for(const subset of [['sin','cos'],['atan','atan2'],['sin','cos','atan2'],['sin','cos','atan','atan2']]){
    const M=Object.create(Math);for(const name of subset)M[name]=F[name];
    const checks=goldenChecks(worldFactory(hr,M).create,hashes);
    result.subsets.push({ported:subset,passed:checks.passed,of:checks.of,pattern:checks.rows.map(r=>r.pass?1:0).join('')});
  }
  // SHA-256 of JSON.stringify(world) for every campaign world, under both Math,
  // so that two machines can be compared from their outputs.
  for(const kind of ['v1','v2']){
    const rows=worldList(seeds,[]).filter(w=>w.kind===kind),changed=[],digests=[];
    for(const w of rows){const f=digest(make(port,w)),h=host?digest(make(host,w)):null;digests.push({seed:w.seed,index:w.index,host:h,fmath:f});if(host&&h!==f)changed.push(w.seed+':'+(w.index+1));}
    result.campaign[kind]={worlds:rows.length,changedByFMath:host?changed.length:null,changed,digests};
  }
  return result;
}

// ---------------------------------------------------------------- worlds
// SHA-256 of JSON.stringify(world) for the 114 worlds (classic seeds 1 and 96,
// V1 and V2 of the seeds), as the game generates them after the fix. With --base,
// the same worlds from the world.js of B with FMath injected (the path checked in
// T1): equal digests show that the wiring changes nothing but the trigonometry.
export function worlds(root,{seeds=[1,96,2026],base,fixture}={}){
  if(fixture!==undefined&&!['check','write'].includes(fixture))throw new Error('--fixture must be check or write');
  if(fixture)fixtureSeeds(root,seeds,fixture); // refuse before generating anything
  const F=loadFMath(root),W=fmathWorld(root,F),B=base?fmathWorld(base,F):null,rows=[];
  for(const w of worldList(seeds)){
    const row={kind:w.kind,seed:w.seed,index:w.index,sha256:digest(make(W,w))};
    if(B){row.baseFMathSha256=digest(make(B,w));row.equal=row.baseFMathSha256===row.sha256;}
    rows.push(row);
  }
  return {schema:'metal-platform-math-worlds-v1',environment:env(),root,base:base??null,worldUsesFMath:worldUsesFMath(root),baseWorldUsesFMath:base?worldUsesFMath(base):null,
    worlds:rows.length,...(B?{equalToBaseWithFMath:rows.filter(r=>r.equal).length}:{}),
    digestOfDigests:createHash('sha256').update(rows.map(r=>r.sha256).join('\n')).digest('hex'),
    ...(fixture?{fixture:fixture==='write'?writeFixture(root,rows,seeds):checkFixture(root,rows,seeds)}:{}),rows};
}

// ---------------------------------------------------------------- fixture (T4)
// checks/campaign-world-digests.json holds the golden digests of the 108 campaign
// worlds (V1 and V2, 18 worlds for each seed of the test): SHA-256 of
// JSON.stringify(world), as digest() of checks/campaign-world.test.mjs, which
// asserts them in its two loops. A world from the native Math of an arm64 host
// (or of any engine) must never enter it: "write" needs a world.js that takes its
// trigonometry from FMath, and the six classic worlds of the same run must equal
// the golden legacyHashes of the test, checked on Linux x86-64.
export const FIXTURE='checks/campaign-world-digests.json';
export const FIXTURE_COMMAND='node tools/platform-math.mjs worlds . --fixture write';
const FIXTURE_KINDS=Object.freeze({v1:{campaign:true},v2:{campaign:true,campaignVersion:2}});
// The seeds of the campaign loops, read from the test so the fixture can never drift from it.
export function testSeeds(root){
  const m=/\nconst seeds = \[([\d, ]+)\]/.exec(readFileSync(join(root,'checks/campaign-world.test.mjs'),'utf8'));
  if(!m)throw new Error('const seeds not found in checks/campaign-world.test.mjs');
  return m[1].split(',').map(Number);
}
function fixtureSeeds(root,seeds,mode){
  const wanted=testSeeds(root);
  if(seeds.join()!==wanted.join())throw new Error(`--fixture covers the seeds of the test (${wanted.join(',')}), not ${seeds.join(',')}`);
  if(mode==='write'&&!worldUsesFMath(root))throw new Error('--fixture write: src/world.js of root must take its trigonometry from FMath (lot 01 suite T2)');
  return wanted;
}
const rowOf=(rows,kind,seed,index)=>rows.find(r=>r.kind===kind&&r.seed===seed&&r.index===index);
function legacyAgreement(root,rows){
  const hashes=legacyHashes(root),differing=hashes.filter(([seed,stage,want])=>rowOf(rows,'legacy',seed,stage)?.sha256!==want).map(([seed,stage])=>seed+':s'+stage);
  return {equal:hashes.length-differing.length,of:hashes.length,differing};
}
export function fixtureOf(rows,seeds){
  const out={schema:'metal-campaign-world-digests-v1',command:FIXTURE_COMMAND,
    digest:'SHA-256 (hex) of JSON.stringify(FWorld.create(seed, index, options)) for index 0 to 17, as digest() in checks/campaign-world.test.mjs',
    note:'Golden campaign worlds (MURS-V1, MURS-06). src/world.js takes sin, cos, atan, atan2 and hypot from FMath (src/fmath.js), so these worlds are the same on x86-64, arm64, Chrome and JavaScriptCore; the command checks that the six classic worlds of the same run equal the golden legacyHashes of the test. Any number changed or field added in a campaign world changes its digest. Regenerate only with an intended change of the generation, in the commit that makes it and says why; never to make a test pass.',
    seeds,options:FIXTURE_KINDS};
  for(const kind of Object.keys(FIXTURE_KINDS)){
    const block=out[kind]={};
    for(const seed of seeds)block[seed]=Array.from({length:18},(_,index)=>{const r=rowOf(rows,kind,seed,index);if(!r)throw new Error(`no ${kind} world ${index+1} for seed ${seed}`);return r.sha256;});
  }
  return out;
}
function compareFixture(golden,rows,seeds){
  const differing=[];let equal=0;
  for(const kind of Object.keys(FIXTURE_KINDS))for(const seed of seeds)for(let index=0;index<18;index++){
    const want=golden?.[kind]?.[seed]?.[index]??null,got=rowOf(rows,kind,seed,index)?.sha256??null;
    if(got!==null&&got===want)equal++;else differing.push({kind,seed,world:index+1,expected:want,actual:got});
  }
  return {equal,of:Object.keys(FIXTURE_KINDS).length*seeds.length*18,differing};
}
export function checkFixture(root,rows,seeds=[1,96,2026]){
  const wanted=fixtureSeeds(root,seeds),text=readFileSync(join(root,FIXTURE),'utf8');
  return {mode:'check',file:FIXTURE,fileSha256:createHash('sha256').update(text).digest('hex'),...compareFixture(JSON.parse(text),rows,wanted),legacyHashes:legacyAgreement(root,rows)};
}
export function writeFixture(root,rows,seeds=[1,96,2026]){
  const wanted=fixtureSeeds(root,seeds,'write'),legacy=legacyAgreement(root,rows);
  if(legacy.differing.length)throw new Error(`--fixture write refused: classic worlds ${legacy.differing.join(', ')} differ from the golden legacyHashes of checks/campaign-world.test.mjs, so this generation is not the portable one`);
  const file=join(root,FIXTURE),previous=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null,text=JSON.stringify(fixtureOf(rows,wanted),null,1)+'\n';
  writeFileSync(file,text);
  return {mode:'write',file:FIXTURE,fileSha256:createHash('sha256').update(text).digest('hex'),bytes:Buffer.byteLength(text),worlds:Object.keys(FIXTURE_KINDS).length*wanted.length*18,
    changedFromPrevious:previous?compareFixture(previous,rows,wanted).differing:null,legacyHashes:legacy};
}

// ---------------------------------------------------------------- checkpoints
function walk(a,b,path,acc){
  if(typeof a==='number'&&typeof b==='number'){
    if(!Object.is(a,b)){
      acc.numeric++;const d=Math.abs(a-b);if(d>acc.maxAbs){acc.maxAbs=d;acc.maxPath=path;}const r=d/Math.max(Math.abs(a),Math.abs(b));if(r>acc.maxRel)acc.maxRel=r;
      const field=path.split('.').filter(p=>p!=='$'&&!/^\d+$/.test(p)).join('.'),f=acc.byField[field]??={count:0,maxAbs:0};f.count++;if(d>f.maxAbs)f.maxAbs=d;
    }
    return;
  }
  if(typeof a!==typeof b||(a===null)!==(b===null)){acc.structural.push(path+' type');return;}
  if(a&&typeof a==='object'){
    const ka=Object.keys(a),kb=Object.keys(b);
    if(ka.length!==kb.length||ka.some((k,i)=>k!==kb[i])){acc.structural.push(path+' keys');return;}
    for(const k of ka)walk(a[k],b[k],path+'.'+k,acc);
    return;
  }
  if(a!==b)acc.structural.push(path+' value');
}

const checkpointList=seed=>[...worldList([],[1,96]),...worldList([seed],[]).filter(w=>w.kind==='v1'),...worldList([seed],[]).filter(w=>w.kind==='v2')];
const worldLabel=w=>w.seed+':'+(w.kind==='legacy'?'s'+w.index:'w'+(w.index+1));

export function checkpoints(root,{seed=96,base,from}={}){
  if(from)return crossCheckpoints(root,{seed,from});
  const F=loadFMath(root),host=hostWorld(root,base),FSimulation=loadRealm({root}).window.FSimulation,port=fmathWorld(root,F),rows=[],fields={},byField={};
  for(const w of checkpointList(seed)){
    const a=make(host,w),b=make(port,w),changed=digest(a)!==digest(b);
    const differing=Object.keys(a).filter(k=>digest(a[k])!==digest(b[k]));for(const k of differing)fields[k]=(fields[k]||0)+1;
    const acc={numeric:0,maxAbs:0,maxRel:0,maxPath:'',structural:[],byField};walk(a,b,'$',acc);
    const sa=FSimulation.create(a),sb=FSimulation.create(b);
    const fa=sa.snapshot().fingerprint,fb=sb.snapshot().fingerprint;sa.dispose?.();sb.dispose?.();
    rows.push({kind:w.kind,seed:w.seed,index:w.index,worldJsonChanged:changed,checkpointFingerprintHost:fa,checkpointFingerprintFMath:fb,checkpointFingerprintChanged:fa!==fb,differingTopLevelFields:differing,numericDifferences:acc.numeric,maxAbsDifference:acc.maxAbs,maxRelDifference:acc.maxRel,maxAbsPath:acc.maxPath,structuralDifferences:acc.structural.length});
  }
  const summary=Object.fromEntries(['legacy','v1','v2'].map(kind=>{const r=rows.filter(x=>x.kind===kind);return [kind,{worlds:r.length,worldJsonChanged:r.filter(x=>x.worldJsonChanged).length,checkpointFingerprintChanged:r.filter(x=>x.checkpointFingerprintChanged).length,changedWorlds:r.filter(x=>x.checkpointFingerprintChanged).map(worldLabel)}];}));
  const numeric=rows.map(r=>r.numericDifferences).filter(n=>n>0);
  return {schema:'metal-platform-math-checkpoints-v1',environment:env(),root,base:hostRoot(root,base),note:'Fingerprint = FSimulation snapshot().fingerprint (src/simulation.js, identity of the world: colliders, destructibles, enemies...; meshes excluded). Simulation modules use the host Math; only world generation differs.',
    summary,differingTopLevelFields:fields,differencesByField:byField,maxAbsDifference:Math.max(...rows.map(r=>r.maxAbsDifference)),maxRelDifference:Math.max(...rows.map(r=>r.maxRelDifference)),numericDifferencesPerChangedWorld:numeric.length?{min:Math.min(...numeric),max:Math.max(...numeric)}:null,structuralDifferences:rows.reduce((s,r)=>s+r.structuralDifferences,0),rows};
}

// A point written by the modules of root "from" (world.js and simulation.js, as
// before the fix), after a few steps, then read back by the modules of root, as
// the shell does: restore(point, {recover:true}), then the same point without its
// rubble. Refused means the shell falls back to the entry of the same sector.
export function crossCheckpoints(root,{from,seed=96,steps=30}={}){
  const writer=loadRealm({root:from}).window,reader=loadRealm({root}).window,rows=[];
  for(const w of checkpointList(seed)){
    const written=writer.FSimulation.create(make(writer.FWorld,w));
    for(let i=0;i<steps;i++){written.step(1/60,{});written.state.events.length=0;}
    const text=JSON.stringify(written.snapshot());written.dispose?.();
    const reading=reader.FSimulation.create(make(reader.FWorld,w)),readerFingerprint=reading.snapshot().fingerprint,point=JSON.parse(text);
    const restored=reading.restore(JSON.parse(text),{recover:true});
    let restoredWithoutRubble=null;
    if(!restored){const bare=JSON.parse(text);delete bare.rubbleVersion;if(bare.state)delete bare.state.rubble;if(bare.timers)delete bare.timers.rubbleSerial;restoredWithoutRubble=reading.restore(bare,{recover:true});}
    reading.dispose?.();
    rows.push({kind:w.kind,seed:w.seed,index:w.index,world:worldLabel(w),writerFingerprint:point.fingerprint,readerFingerprint,sameFingerprint:point.fingerprint===readerFingerprint,restored,restoredWithoutRubble});
  }
  const summary=Object.fromEntries(['legacy','v1','v2'].map(kind=>{const r=rows.filter(x=>x.kind===kind);return [kind,{worlds:r.length,restored:r.filter(x=>x.restored).length,refused:r.filter(x=>!x.restored).length,refusedWorlds:r.filter(x=>!x.restored).map(x=>x.world)}];}));
  return {schema:'metal-platform-math-cross-checkpoints-v1',environment:env(),root,from,seed,stepsBeforeSnapshot:steps,
    note:'Writer: FWorld and FSimulation of root "from"; reader: those of root. Restore as the shell does (recover:true), then without rubble when refused.',
    worlds:rows.length,restored:rows.filter(r=>r.restored).length,refused:rows.filter(r=>!r.restored).length,refusedAlsoWithoutRubble:rows.filter(r=>!r.restored&&!r.restoredWithoutRubble).length,
    refusedExactlyWhereFingerprintDiffers:rows.every(r=>r.restored===r.sameFingerprint),summary,rows};
}

// ---------------------------------------------------------------- replay
// Proof replays (tools/proof) with FMath in the whole process (world, simulation
// and the audit driver, whose Math.sin(index/90) also differs on this host), or
// natively. Compared with the Linux x86-64 oracles already in the repository.
export async function replayCheck(root,{fmath=false,scenario='all',steps=1800,profileOut}={}){
  Object.getOwnPropertyDescriptors(globalThis); // materialise lazy Node globals before profileSteps snapshots them
  const F=loadFMath(root),saved={};
  if(fmath)for(const name of PORTED){saved[name]=Math[name];Math[name]=F[name];}
  try{
    const {profileSteps}=await import('./profile-steps.mjs'),{parseArgs}=await import('./proof/common.mjs');
    const options=parseArgs([root,'--scenario',scenario,'--steps',String(steps),'--reps','1','--warmups','1','--no-counters']);
    const report=await profileSteps(options);
    if(profileOut){mkdirSync(resolve(profileOut,'..'),{recursive:true});writeFileSync(profileOut,JSON.stringify(report,null,2)+'\n');}
    const reference=JSON.parse(readFileSync(join(root,'tools/proof/reference-63668ac.json'),'utf8'));
    const v2File=join(root,'docs/chantier-moteur/preuves/lot-00/aa-v2-short.json.gz'),v2=existsSync(v2File)?JSON.parse(gunzipSync(readFileSync(v2File))):null;
    const envFile=join(root,'docs/chantier-moteur/preuves/lot-00/reference-environment.json.gz'),refEnv=existsSync(envFile)?JSON.parse(gunzipSync(readFileSync(envFile))):null;
    const historicalEnvironment=refEnv&&{platform:refEnv.platform,node:refEnv.node,cpu:refEnv.cpu_model,from:'docs/chantier-moteur/preuves/lot-00/reference-environment.json.gz'};
    const rows=report.scenarios.map(s=>{
      let oracle=null,source=null;
      const historical=reference.scenarios.find(r=>r.id===s.id);
      if(historical&&steps===reference.method.requestedSteps){oracle=historical.proof;source='tools/proof/reference-63668ac.json';}
      const short=v2?.scenarios.find(r=>r.id===s.id);
      if(!oracle&&short&&steps===v2.method.requestedSteps){oracle=short.proofA;source='docs/chantier-moteur/preuves/lot-00/aa-v2-short.json.gz (proofA)';}
      if(!oracle)return {id:s.id,steps:s.proof.steps,chainHash:s.proof.chainHash,snapshotSha256:s.proof.snapshot.sha256,oracle:null};
      const first=s.proof.stateHashes.findIndex((h,i)=>h!==oracle.stateHashes[i]);
      return {id:s.id,steps:s.proof.steps,chainHash:s.proof.chainHash,oracleChainHash:oracle.chainHash,snapshotSha256:s.proof.snapshot.sha256,oracleSnapshotSha256:oracle.snapshot.sha256,
        identical:JSON.stringify(s.proof)===JSON.stringify(oracle),firstDivergentStepIndex:first,firstDivergentStepNumber:first<0?null:first+1,oracle:source,oracleEnvironment:source.startsWith('tools')?historicalEnvironment:v2.environment};
    });
    let driverFirstDivergence=null;
    for(let i=0;i<steps;i++)if(!Object.is(Math.sin(i/90),F.sin(i/90))){driverFirstDivergence=i;break;}
    return {schema:'metal-platform-math-replay-v1',environment:env(),root,fmathInProcess:fmath,scenario,steps,checksum:report.checksum,stable:report.identical,rows,
      driver:{note:'tools/proof/scenarios.mjs drive() uses Math.sin(index/90): first index where the Math of this run differs from FMath',firstIndex:driverFirstDivergence}};
  }finally{for(const name of Object.keys(saved))Math[name]=saved[name];}
}

// ---------------------------------------------------------------- sim-risk
// Lot 13 risk, measured without changing the simulation: the four proof
// scenarios with FMath in world generation (the game after T2) and in the proof
// driver (tools/proof/scenarios.mjs, Math.sin(index/90)), and the host Math in
// every other module. The first step departing from the Linux x86-64 reference
// is the platform sensitivity of the simulation itself. Each module gets its own
// counting Math: sin, cos, atan and atan2 are compared with FMath; exp, log, pow
// and the other inexact functions are only counted (no portable reference here),
// and "**" is counted in the source. --sim-fmath gives FMath to every module.
const UNVERIFIED=Object.freeze(['exp','expm1','log','log1p','log2','log10','pow','cbrt','tan','asin','acos','sinh','cosh','tanh','asinh','acosh','atanh']);
export async function simRisk(root,{steps=1800,simFMath=false}={}){
  const F=loadFMath(root),wired=worldUsesFMath(root),native=Object.fromEntries(PORTED.map(name=>[name,Math[name]])),perModule={},mathFor={};
  let counting=false;
  const counted=(name,host,port,s)=>(...args)=>{const h=host(...args);if(counting){const c=s[name];c.calls++;if(!Object.is(h,port(...args)))c.divergent++;}return simFMath?port(...args):h;};
  const modules=defaultModules(root);
  for(const name of modules){
    if(name==='fmath'||name==='world')continue;
    const s=perModule[name]={},M=Object.create(Math);
    for(const fn of PORTED){s[fn]={calls:0,divergent:0};M[fn]=counted(fn,native[fn],F[fn],s);}
    for(const fn of UNVERIFIED){const host=Math[fn];s[fn]={calls:0};M[fn]=(...args)=>{if(counting)s[fn].calls++;return host(...args);};}
    const text=readFileSync(join(root,'src',name+'.js'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
    s.exponentOperatorInSource=(text.match(/\*\*/g)||[]).length;
    mathFor[name]=M;
  }
  const worldMath=wired?null:fmathMath(F);
  const transform=(name,text)=>mathFor[name]?`(function(Math){${text}\n})(__math_${name});`:name==='world'&&worldMath?`(function(Math){${text}\n})(__worldMath);`:text;
  const globals={...Object.fromEntries(Object.entries(mathFor).map(([name,M])=>['__math_'+name,M])),...(worldMath?{__worldMath:worldMath}:{})};
  const saved={};for(const name of PORTED){saved[name]=Math[name];Math[name]=F[name];} // the proof driver uses the process Math
  try{
    const {SCENARIOS}=await import('./proof/scenarios.mjs'),{createRun,advance,finishRun}=await import('./proof/run.mjs');
    const loaded=loadRealm({root,modules,transform,globals}),reference=JSON.parse(readFileSync(join(root,'tools/proof/reference-63668ac.json'),'utf8')),rows=[];
    let totalSteps=0;
    for(const scenario of SCENARIOS){
      const run=createRun(loaded,scenario,{seed:96});counting=true;
      try{for(let i=0;i<steps;i++){advance(run,i,{timed:false});totalSteps++;if(run.sim.state.dead||run.sim.state.won)break;}}
      finally{counting=false;}
      const result=finishRun(run),ref=reference.scenarios.find(s=>s.id===scenario.id).proof,first=result.rows.findIndex((row,i)=>row.stateHash!==ref.stateHashes[i]);
      rows.push({id:scenario.id,steps:result.steps,firstDivergentStepIndex:first,identical:first<0&&result.chainHash===ref.chainHash&&result.snapshot.sha256===ref.snapshot.sha256,chainHash:result.chainHash,referenceChainHash:ref.chainHash});
    }
    let driverFirstDivergence=null;
    for(let i=0;i<steps;i++)if(!Object.is(native.sin(i/90),F.sin(i/90))){driverFirstDivergence=i;break;}
    const total={};
    for(const s of Object.values(perModule))for(const [fn,c] of Object.entries(s)){if(typeof c!=='object')continue;const t=total[fn]??={calls:0};t.calls+=c.calls;if(c.divergent!==undefined)t.divergent=(t.divergent||0)+c.divergent;}
    for(const [fn,c] of Object.entries(total)){c.perStep=totalSteps?c.calls/totalSteps:0;if(c.divergent!==undefined)c.divergentRate=c.calls?c.divergent/c.calls:0;}
    return {schema:'metal-platform-math-sim-risk-v1',environment:env(),root,worldUsesFMath:wired,simulationTrigonometry:simFMath?'FMath':'host',steps,totalSteps,
      note:'World generation and the proof driver use FMath; the other modules use the host Math unless --sim-fmath. Reference: tools/proof/reference-63668ac.json (Linux x86-64). Unverified functions are counted only; WebNN (IA-12) is not covered: the brain runs in cpu mode.',
      rows,driver:{firstDivergentIndex:driverFirstDivergence,note:'first index where the host Math.sin(index/90) of the proof driver differs from FMath'},total,perModule};
  }finally{for(const name of Object.keys(saved))Math[name]=saved[name];}
}

// ---------------------------------------------------------------- engines
// Correctly rounded sin/cos for moderate arguments (2^-30 <= |x| < 2^20), BigInt
// fixed point with 384 fractional bits; null when the rounding cannot be decided.
const W=384n,ONE=1n<<W;
let PI_FIXED=null;
function atanInv(k){let sum=0n,term=ONE/BigInt(k),n=1n,sign=1n;const k2=BigInt(k*k);while(term){sum+=sign*(term/n);term/=k2;n+=2n;sign=-sign;}return sum;}
function piFixed(){return PI_FIXED??=16n*atanInv(5)-4n*atanInv(239);}
function exactFixed(x){f64[0]=x;const b=u64[0],e=Number((b>>52n)&0x7ffn),m=(b&((1n<<52n)-1n))|(1n<<52n),shift=BigInt(e-1075)+W;return (b>>63n?-1n:1n)*(shift>=0n?m<<shift:m>>-shift);}
function toDouble(v){
  const neg=v<0n,a=neg?-v:v,len=a.toString(2).length,shift=BigInt(len-53),err=1n<<40n;
  if(len<120)return null;
  let m=a>>shift;const rem=a&((1n<<shift)-1n),half=1n<<(shift-1n);
  if(rem>half-err&&rem<half+err)return null;
  if(rem>half)m+=1n;
  let e=BigInt(len-1)-W;if(m===1n<<53n){m>>=1n;e+=1n;}
  if(e<-1022n||e>1023n)return null;
  u64[0]=((e+1023n)<<52n)|(m&((1n<<52n)-1n))|(neg?1n<<63n:0n);return f64[0];
}
const isqrt=n=>{if(n<2n)return n;let x=1n<<BigInt((n.toString(2).length>>1)+1);for(;;){const y=(x+n/x)>>1n;if(y>=x)return x;x=y;}};
function atanFixed(T){ // atan(T/2^W) for T >= 0, in fixed point: halve the angle 4 times, then the Taylor series
  if(T>ONE)return (piFixed()>>1n)-atanFixed(ONE*ONE/T);
  let h=0n;for(;h<4n;h++)T=T*ONE/(ONE+isqrt(ONE*ONE+T*T));
  const T2=T*T>>W;let sum=T,term=T;for(let n=3n;term;n+=2n){term=-(term*T2>>W);sum+=term/n;}
  return sum<<h;
}
export function correctlyRounded(name,x,y){
  if(name==='atan')return correctlyRounded('atan2',x,1);
  if(name==='atan2'){ // atan2(x, y) here: first argument x is the ordinate
    const ay=Math.abs(x),ax=Math.abs(y);if(!(ay>0&&ax>0&&ay<2**60&&ax<2**60&&ay>2**-60&&ax>2**-60&&ay/ax>2**-60&&ay/ax<2**60))return null;
    const a=atanFixed(exactFixed(ay)*ONE/exactFixed(ax)),r=y>0?a:piFixed()-a;
    return toDouble(x<0?-r:r);
  }
  if(x===0)return name==='sin'?x:1;
  const ax=Math.abs(x);if(!(ax>=2**-30&&ax<2**20))return null;
  const X=exactFixed(x),halfPi=piFixed()>>1n,k=(X+(X<0n?-halfPi/2n:halfPi/2n))/halfPi,R=X-k*halfPi,R2=(R*R)>>W;
  let s=R,term=R;for(let n=1n;term;n++){term=-(term*R2>>W)/((2n*n)*(2n*n+1n));s+=term;}
  let c=ONE;term=ONE;for(let n=1n;term;n++){term=-(term*R2>>W)/((2n*n-1n)*(2n*n));c+=term;}
  const q=Number(((k%4n)+4n)%4n),value=name==='sin'?[s,c,-s,-c][q]:[c,-s,-c,s][q];
  return toDouble(value);
}

// Port of V8's Torque MathHypot (src/builtins/math.tq), for the jsc comparison of a
// root whose FMath has no hypot (before T3); FMath.hypot is used otherwise.
const V8_HYPOT=`function v8hypot(){var length=arguments.length;if(length===0)return 0;var abs=new Array(length),oneArgIsNaN=false,max=0,i;
for(i=0;i<length;i++){var value=+arguments[i];if(value!==value){oneArgIsNaN=true;abs[i]=0;}else{var a=Math.abs(value);abs[i]=a;if(a>max)max=a;}}
if(max===Infinity)return Infinity;if(oneArgIsNaN)return NaN;if(max===0)return 0;var sum=0,compensation=0;
for(i=0;i<length;i++){var n=abs[i]/max,summand=n*n-compensation,preliminary=sum+summand;compensation=(preliminary-sum)-summand;sum=preliminary;}
return Math.sqrt(sum)*max;}`;

// SHA-256 of a string's UTF-8 bytes in plain JavaScript, for the jsc shell (no
// crypto there): the same digest as Node's createHash('sha256').update(text).
// Round constants and initial values are computed exactly with BigInt (integer
// roots of the first primes), and the code is checked against node:crypto.
function rootFraction(p,k,bitsOut){const scale=1n<<BigInt(bitsOut*k),n=BigInt(p)*scale;let lo=0n,hi=1n<<BigInt(bitsOut+4);while(lo<hi){const mid=(lo+hi+1n)>>1n;if(mid**BigInt(k)<=n)lo=mid;else hi=mid-1n;}return Number(lo&0xffffffffn);}
const PRIMES=[];for(let n=2;PRIMES.length<64;n++)if(PRIMES.every(p=>n%p))PRIMES.push(n);
export const SHA256_JS='var SHA256_K=['+PRIMES.map(p=>rootFraction(p,3,32)).join(',')+'],SHA256_H=['+PRIMES.slice(0,8).map(p=>rootFraction(p,2,32)).join(',')+'];\n'+
`function sha256(text){var n=text.length,buf=new Uint8Array(n*3+72),len=0,i,c,d;
for(i=0;i<n;i++){c=text.charCodeAt(i);
if(c<0x80)buf[len++]=c;else if(c<0x800){buf[len++]=0xc0|c>>6;buf[len++]=0x80|c&63;}
else if(c>=0xd800&&c<0xdc00&&i+1<n&&(d=text.charCodeAt(i+1))>=0xdc00&&d<0xe000){i++;c=0x10000+((c-0xd800)<<10)+(d-0xdc00);buf[len++]=0xf0|c>>18;buf[len++]=0x80|c>>12&63;buf[len++]=0x80|c>>6&63;buf[len++]=0x80|c&63;}
else if(c>=0xd800&&c<0xe000){buf[len++]=0xef;buf[len++]=0xbf;buf[len++]=0xbd;}
else{buf[len++]=0xe0|c>>12;buf[len++]=0x80|c>>6&63;buf[len++]=0x80|c&63;}}
var total=((len+9+63)>>6)<<6;buf[len]=0x80;for(i=len+1;i<total;i++)buf[i]=0;
var hiBits=Math.floor(len/0x20000000),loBits=(len*8)>>>0;
buf[total-8]=hiBits>>>24;buf[total-7]=hiBits>>>16&255;buf[total-6]=hiBits>>>8&255;buf[total-5]=hiBits&255;buf[total-4]=loBits>>>24;buf[total-3]=loBits>>>16&255;buf[total-2]=loBits>>>8&255;buf[total-1]=loBits&255;
var H=new Int32Array(SHA256_H),K=new Int32Array(SHA256_K),W=new Int32Array(64),off,t,a,b,e,f,g,h,cc,dd,t1,t2;
for(off=0;off<total;off+=64){
for(t=0;t<16;t++){i=off+4*t;W[t]=buf[i]<<24|buf[i+1]<<16|buf[i+2]<<8|buf[i+3];}
for(t=16;t<64;t++){a=W[t-15];b=W[t-2];W[t]=(W[t-16]+((a>>>7|a<<25)^(a>>>18|a<<14)^(a>>>3))+W[t-7]+((b>>>17|b<<15)^(b>>>19|b<<13)^(b>>>10)))|0;}
a=H[0];b=H[1];cc=H[2];dd=H[3];e=H[4];f=H[5];g=H[6];h=H[7];
for(t=0;t<64;t++){t1=(h+((e>>>6|e<<26)^(e>>>11|e<<21)^(e>>>25|e<<7))+((e&f)^(~e&g))+K[t]+W[t])|0;t2=(((a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10))+((a&b)^(a&cc)^(b&cc)))|0;h=g;g=f;f=e;e=(dd+t1)|0;dd=cc;cc=b;b=a;a=(t1+t2)|0;}
H[0]=H[0]+a|0;H[1]=H[1]+b|0;H[2]=H[2]+cc|0;H[3]=H[3]+dd|0;H[4]=H[4]+e|0;H[5]=H[5]+f|0;H[6]=H[6]+g|0;H[7]=H[7]+h|0;}
var out="";for(i=0;i<8;i++)out+=(H[i]>>>0).toString(16).padStart(8,"0");return out;}`;
// Checked once per process against node:crypto: ASCII, accents, a surrogate
// pair, block boundaries and one megabyte of mixed text.
let sha256Checked=false;
export function checkSha256Source(){
  if(sha256Checked)return;
  const js=new Function(SHA256_JS+'\nreturn sha256;')(),probes=['','abc','L’Éveil des forges','\u{1F600}x',...[55,56,63,64,65,119,120,128].map(n=>'a'.repeat(n))];
  let big='';for(let i=0;i<1<<20;i++)big+=String.fromCharCode(i%7===0?0xe9:i%11===0?0x2019:32+(i*7919)%90);probes.push(big);
  for(const text of probes)if(js(text)!==createHash('sha256').update(text).digest('hex'))throw new Error('SHA256_JS differs from node:crypto for a probe of length '+text.length);
  sha256Checked=true;
}

export function trigCases(censusFile){
  const cases=[];
  for(let i=0;i<1800;i++)cases.push({set:'driver',fn:'sin',args:[bits(i/90)]});
  if(censusFile){const c=JSON.parse(readFileSync(censusFile,'utf8'));for(const fn of PORTED)for(const d of c.divergentSamples[fn]||[])cases.push({set:'world-divergent',fn,args:d.args});}
  return cases;
}

export function pages(root,{dir,census:censusFile,base}={}){
  if(!dir)throw new Error('--dir is required');
  mkdirSync(dir,{recursive:true});
  const fmRoot=existsSync(join(root,'src/fmath.js'))?root:DEFAULT_ROOT,src=(r,name)=>pathToFileURL(join(r,'src',name+'.js')).href,cases=trigCases(censusFile);
  // FMath itself on the reference vectors of checks/fmath-vectors.txt, in each
  // engine, and on those of checks/fmath-hypot-vectors.txt (since T3).
  const vectors=[],hypotVectors=[];
  for(const v of readFileSync(join(fmRoot,'checks/fmath-vectors.txt'),'utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(' '))){
    if(v[0]==='sincos')vectors.push(['sin',[v[1]],v[2]],['cos',[v[1]],v[3]]);
    else if(v[0]==='atan')vectors.push(['atan',[v[1]],v[2]]);
    else if(v[0]==='atan2')vectors.push(['atan2',[v[1],v[2]],v[3]]);
  }
  const hypotTable=join(fmRoot,'checks/fmath-hypot-vectors.txt');
  if(existsSync(hypotTable))for(const v of readFileSync(hypotTable,'utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(' '))){
    const args=v.slice(2,-1),want=v[v.length-1];hypotVectors.push(['hypot',args,want]);
    if(args.length===2)hypotVectors.push(['hypot2',args,want]);
    if(args.length===3)hypotVectors.push(['hypot3',args,want]);
  }
  const vectorCheck='function fmathVectors(F,V){var f=new Float64Array(1),u=new Uint32Array(f.buffer);f[0]=1;var hi=u[1]===0x3ff00000?1:0;'+
    'function val(h){u[hi]=parseInt(h.slice(0,8),16);u[1-hi]=parseInt(h.slice(8),16);return f[0];}function bits(x){f[0]=x;return (u[hi]>>>0).toString(16).padStart(8,"0")+(u[1-hi]>>>0).toString(16).padStart(8,"0");}'+
    'var ok=0,bad=[];for(var i=0;i<V.length;i++){var c=V[i],r=F[c[0]].apply(null,c[1].map(val));if(c[2]==="nan"?r!==r:bits(r)===c[2])ok++;else if(bad.length<5)bad.push(c[0]+"("+c[1].join(",")+")");}return {cases:V.length,equal:ok,firstDifferences:bad};}\n';
  writeFileSync(join(dir,'trig.html'),'<!doctype html><meta charset=utf-8><title>trig</title><body><pre id=o>pending</pre>'+`<script src="${src(fmRoot,'fmath')}"></script><script>`+vectorCheck+
    'const cases='+JSON.stringify(cases.map(c=>[c.fn,c.args]))+',vectors='+JSON.stringify(vectors)+';const f=new Float64Array(1),u=new BigUint64Array(f.buffer);'+
    'const bits=x=>{f[0]=x;return u[0].toString(16).padStart(16,"0");},val=h=>{u[0]=BigInt("0x"+h);return f[0];};'+
    'const hypotVectors='+JSON.stringify(hypotVectors)+';'+
    'document.getElementById("o").textContent=JSON.stringify({ua:navigator.userAgent,results:cases.map(([fn,a])=>bits(Math[fn](...a.map(val)))),fmathVectors:fmathVectors(FMath,vectors),fmathHypotVectors:hypotVectors.length?fmathVectors(FMath,hypotVectors):null});</script>');
  // fp.html: the 42 worlds of seeds 1 and 96 (checkpoint fingerprint and FNV of
  // the JSON), variant by variant. "game": a wired world.js as the page loads it
  // (fmath first). "native" and "fmath": a world.js before the fix (--base, or
  // root itself before T2) with the Math of the engine, then with FMath swapped
  // in for the generation only. Each variant's scripts replace the previous ones.
  const modules=['renderer','world','destruction','economy','brain','simulation'],scripts=(r,list)=>{const out=[];for(const m of list){if(m==='world'&&existsSync(join(r,'src','passages.js')))out.push('passages');out.push(m);}return out.map(m=>`<script src="${src(r,m)}"></script>`).join('');};
  const wired=worldUsesFMath(root),old=wired?base:root;
  let body=`<script src="${src(fmRoot,'fmath')}"></script><script>`+
    'const N={sin:Math.sin,cos:Math.cos,atan:Math.atan,atan2:Math.atan2},use=t=>{for(const k in N)Math[k]=t==="fmath"?FMath[k]:N[k];};'+
    'const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,"0");};'+
    'const cases=[];for(const s of [1,96])for(let i=0;i<3;i++)cases.push([s,i,null,"legacy"]);for(let i=0;i<18;i++){cases.push([96,i,{campaign:true},"v1"]);cases.push([96,i,{campaign:true,campaignVersion:2},"v2"]);}'+
    'const res=cases.map(([s,i,o,k])=>({s,i,k}));let err=null;'+
    'function collect(label,trig){if(err)return;try{cases.forEach(([s,i,o],n)=>{if(trig)use(trig);const w=FWorld.create(s,i,o&&{...o});use("native");const json=JSON.stringify(w);const sim=FSimulation.create(w);res[n][label]=sim.snapshot().fingerprint;res[n][label+"Fnv"]=fnv(json);sim.dispose&&sim.dispose();});}catch(e){err=label+": "+String(e&&e.stack||e);}}'+
    '</script>';
  const variants=[];
  if(wired){body+=scripts(root,modules)+'<script>collect("game",null);</script>';variants.push('game');}
  if(old){body+=scripts(old,modules)+'<script>collect("native","native");collect("fmath","fmath");</script>';variants.push('native','fmath');}
  writeFileSync(join(dir,'fp.html'),'<!doctype html><meta charset=utf-8><title>fp</title><body><pre id=o>pending</pre>'+body+
    '<script>document.getElementById("o").textContent=JSON.stringify({ua:navigator.userAgent,err,variants:'+JSON.stringify(variants)+',res});</script>');
  // jsc-worlds.js, for JavaScriptCore (the engine of Safari). "game": the world.js
  // of root as the page loads it (fmath.js first, the engine's own Math), for the
  // 114 worlds, hashed with SHA-256 like "worlds". With a world.js before the fix
  // (--base B, or root before T2), on the 42 worlds of seed 96: "native" (the
  // Math of the engine), "fmath" (FMath's trigonometry: the state after T2) and
  // "fmathV8Hypot" (FMath's trigonometry and hypot: what T3 wires).
  checkSha256Source();
  const world=readFileSync(join(root,'src/world.js'),'utf8'),fmath=readFileSync(join(fmRoot,'src/fmath.js'),'utf8'),oldWorld=old?readFileSync(join(old,'src/world.js'),'utf8'):null;
  const jscCase=w=>[w.kind,w.seed,w.index];
  writeFileSync(join(dir,'jsc-worlds.js'),V8_HYPOT+'\n'+SHA256_JS+'\nvar window={};\n'+fmath+'\nvar F=window.FMath;\n'+
    'function optionsOf(kind){return kind==="legacy"?undefined:kind==="v1"?{campaign:true}:{campaign:true,campaignVersion:2};}\n'+
    'function load(source,M){var w={FMath:F};(new Function("window","Math",source))(w,M);return w.FWorld;}\n'+
    'var game=load('+JSON.stringify(world)+',Math),gameCases='+JSON.stringify(worldList().map(jscCase))+',gameOut=[];\n'+
    'for(var c of gameCases)gameOut.push({kind:c[0],seed:c[1],index:c[2],sha256:sha256(JSON.stringify(game.create(c[1],c[2],optionsOf(c[0]))))});\n'+
    'var baseOut=[];\n'+
    (oldWorld?'var H=typeof F.hypot==="function"?F.hypot:v8hypot,oldSource='+JSON.stringify(oldWorld)+';\n'+
      'function variant(trig,hypot){var M=Object.create(Math);if(trig){M.sin=F.sin;M.cos=F.cos;M.atan=F.atan;M.atan2=F.atan2;}if(hypot)M.hypot=H;return load(oldSource,M);}\n'+
      'var V={native:variant(false,false),fmath:variant(true,false),fmathV8Hypot:variant(true,true)},baseCases='+JSON.stringify(checkpointList(96).map(jscCase))+';\n'+
      'for(var c of baseCases){var r={kind:c[0],seed:c[1],index:c[2]};for(var k in V)r[k]=sha256(JSON.stringify(V[k].create(c[1],c[2],optionsOf(c[0]))));baseOut.push(r);}\n':'')+
    vectorCheck+'var vectors='+JSON.stringify(vectors)+',hypotVectors='+JSON.stringify(hypotVectors)+';\n'+
    'print(JSON.stringify({engine:"jsc",worldUsesFMath:'+wired+',hypotFromFMath:typeof F.hypot==="function",game:gameOut,base:baseOut,fmathVectors:fmathVectors(F,vectors),fmathHypotVectors:hypotVectors.length?fmathVectors(F,hypotVectors):null}));\n');
  return {dir,files:['trig.html','fp.html','jsc-worlds.js'],trigCases:cases.length,fpVariants:variants,worldUsesFMath:wired,base:old??null};
}

function readDump(file){
  const html=readFileSync(file,'utf8'),m=/<pre id="o">([\s\S]*?)<\/pre>/.exec(html);
  if(!m)throw new Error('no <pre id="o"> payload in '+file);
  const text=m[1].replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  if(text==='pending')throw new Error('page did not finish: '+file);
  return JSON.parse(text);
}

export function engines(root,{dir,census:censusFile,base,chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',jsc='/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'}={}){
  const written=pages(root,{dir,census:censusFile,base}),F=loadFMath(root),out={schema:'metal-platform-math-engines-v1',environment:env(),root,base:base??null,worldUsesFMath:worldUsesFMath(root),pages:written};
  const hr=hostRoot(root,base),nodeHost=hr?worldFactory(hr):null,nodeFMath=fmathWorld(root,F);
  if(existsSync(chrome)){
    const run=page=>{const profile=join(dir,'chrome-profile-'+page.replace(/\W/g,''));mkdirSync(profile,{recursive:true});
      const html=execFileSync(chrome,['--headless=new','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--no-pings','--dump-dom',pathToFileURL(join(dir,page)).href],{maxBuffer:1<<28,timeout:600000,stdio:['ignore','pipe','ignore']}).toString();
      const file=join(dir,page+'.dump.html');writeFileSync(file,html);return readDump(file);};
    const trig=run('trig.html'),cases=trigCases(censusFile),by={};
    cases.forEach((c,i)=>{
      const args=c.args.map(fromBits),chromeBits=trig.results[i],node=bits(Math[c.fn](...args)),port=bits(F[c.fn](...args)),key=c.set+':'+c.fn,k=by[key]??={cases:0,chromeEqNodeHost:0,chromeEqFMath:0,nodeHostEqFMath:0};
      k.cases++;if(chromeBits===node)k.chromeEqNodeHost++;if(chromeBits===port)k.chromeEqFMath++;if(node===port)k.nodeHostEqFMath++;
      {const cr=correctlyRounded(c.fn,args[0],args[1]);if(cr===null)k.undecided=(k.undecided||0)+1;else{const crBits=bits(cr);k.withReference=(k.withReference||0)+1;if(chromeBits===crBits)k.chromeCorrectlyRounded=(k.chromeCorrectlyRounded||0)+1;if(node===crBits)k.nodeHostCorrectlyRounded=(k.nodeHostCorrectlyRounded||0)+1;if(port===crBits)k.fmathCorrectlyRounded=(k.fmathCorrectlyRounded||0)+1;}}
    });
    const fp=run('fp.html');
    // World by world, so that the outputs of two machines (Chrome on macOS and on
    // Linux, Node on each) can be compared afterwards without rerunning anything.
    const worlds=[],count={};const inc=key=>count[key]++;
    if((fp.variants||[]).includes('game'))Object.assign(count,{gameFingerprintChromeEqNodeFMath:0,gameWorldFnvChromeEqNodeFMath:0});
    if((fp.variants||[]).includes('native'))Object.assign(count,{fmathFingerprintChromeEqNode:0,fmathWorldFnvChromeEqNode:0,fingerprintChangedByFMathInChrome:0,nativeChromePointRefusedAfterFix:0},nodeHost?{nativeFingerprintChromeEqNodeHost:0}:{});
    if(!fp.err){
      const FSimulation=loadRealm({root}).window.FSimulation;
      const print=(W,r)=>{const options=r.k==='legacy'?undefined:r.k==='v1'?{campaign:true}:{campaign:true,campaignVersion:2},w=W.create(r.s,r.i,options&&{...options}),sim=FSimulation.create(w),fingerprint=sim.snapshot().fingerprint;sim.dispose?.();return {fingerprint,fnv:fnv(JSON.stringify(w))};};
      for(const r of fp.res){
        const nf=print(nodeFMath,r),nh=nodeHost?print(nodeHost,r):null,row={kind:r.k,seed:r.s,index:r.i,nodeFMath:nf.fingerprint,nodeFMathWorldFnv:nf.fnv,...(nh?{nodeHost:nh.fingerprint,nodeHostWorldFnv:nh.fnv}:{})};
        if(r.game!==undefined){row.chromeGame=r.game;row.chromeGameWorldFnv=r.gameFnv;if(r.game===nf.fingerprint)inc('gameFingerprintChromeEqNodeFMath');if(r.gameFnv===nf.fnv)inc('gameWorldFnvChromeEqNodeFMath');}
        if(r.native!==undefined){
          row.chromeNative=r.native;row.chromeNativeWorldFnv=r.nativeFnv;row.chromeFMath=r.fmath;row.chromeFMathWorldFnv=r.fmathFnv;
          if(r.fmath===nf.fingerprint)inc('fmathFingerprintChromeEqNode');if(r.fmathFnv===nf.fnv)inc('fmathWorldFnvChromeEqNode');
          if(nh&&r.native===nh.fingerprint)inc('nativeFingerprintChromeEqNodeHost');if(r.native!==r.fmath)inc('fingerprintChangedByFMathInChrome');
          if(r.native!==nf.fingerprint)inc('nativeChromePointRefusedAfterFix');
        }
        worlds.push(row);
      }
    }
    out.chrome={path:chrome,userAgent:trig.ua,fmathVectors:trig.fmathVectors,fmathHypotVectors:trig.fmathHypotVectors??null,trig:by,checkpoints:fp.err?{error:fp.err}:{worlds:fp.res.length,variants:fp.variants,...count,
      note:'Fingerprint = FSimulation snapshot().fingerprint of the generated world; WorldFnv = FNV-1a of JSON.stringify(world). game: the wired world.js of root; native: a world.js before the fix with the Math of the engine; fmath: the same with FMath for sin, cos, atan and atan2 during generation. nodeFMath: the worlds of root after the fix in Node. nativeChromePointRefusedAfterFix: a point saved in Chrome before the fix whose fingerprint differs from the world after the fix (restore refuses it).',perWorld:worlds}};
  }else out.chrome={skipped:'not found: '+chrome};
  if(existsSync(jsc)){
    const text=execFileSync(jsc,[join(dir,'jsc-worlds.js')],{maxBuffer:1<<26,timeout:1800000}).toString(),j=JSON.parse(text.trim().split('\n').pop());
    // Node side: the same worlds, SHA-256 of their JSON (as "worlds").
    const sha=(W,r)=>digest(make(W,{seed:r.seed,index:r.index,options:r.kind==='legacy'?undefined:r.kind==='v1'?{campaign:true}:{campaign:true,campaignVersion:2}}));
    const gameRows=j.game.map(r=>{const node=sha(nodeFMath,r);return {kind:r.kind,seed:r.seed,index:r.index,node,jsc:r.sha256,equal:r.sha256===node};});
    const baseRows=j.base.map(r=>{const nf=sha(nodeFMath,r),nh=nodeHost?sha(nodeHost,r):null;return {kind:r.kind,seed:r.seed,index:r.index,jscNativeEqNodeHost:nh!==null&&r.native===nh,jscFMathEqNodeFMath:r.fmath===nf,jscFMathV8HypotEqNodeFMath:r.fmathV8Hypot===nf};});
    const tally=key=>baseRows.filter(r=>r[key]).length,byKind=Object.fromEntries(['legacy','v1','v2'].map(kind=>{const rows=gameRows.filter(r=>r.kind===kind);return [kind,rows.filter(r=>r.equal).length+'/'+rows.length];}));
    out.jsc={path:jsc,worldUsesFMath:j.worldUsesFMath,hypotFromFMath:j.hypotFromFMath,fmathVectors:j.fmathVectors,fmathHypotVectors:j.fmathHypotVectors,
      worlds:gameRows.length,jscGameEqNode:gameRows.filter(r=>r.equal).length,jscGameEqNodeByKind:byKind,
      jscGameEqNodeSeed96:gameRows.filter(r=>r.equal&&(r.kind==='legacy'||r.seed===96)).length+'/'+gameRows.filter(r=>r.kind==='legacy'||r.seed===96).length,
      baseWorlds:baseRows.length,...(baseRows.length?{jscNativeEqNodeHost:nodeHost?tally('jscNativeEqNodeHost'):null,jscFMathEqNodeFMath:tally('jscFMathEqNodeFMath'),jscFMathV8HypotEqNodeFMath:tally('jscFMathV8HypotEqNodeFMath')}:{}),
      note:'game: the world.js of root in JavaScriptCore (fmath.js first, the Math of jsc otherwise), SHA-256 of JSON.stringify(world), compared with the same worlds in Node. base: a world.js before the fix (--base) on the 42 worlds of seed 96, with the Math of jsc (native), FMath trigonometry (fmath: the state after T2) and FMath trigonometry and hypot (fmathV8Hypot); compared with the Node worlds of root (nodeFMath) or of the base with the Math of Node (nodeHost).',
      game:gameRows,base:baseRows};
  }else out.jsc={skipped:'not found: '+jsc};
  return out;
}

function env(){return {node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch};}

function parse(argv){
  const out={root:DEFAULT_ROOT,flags:{}};let rootSet=false;
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==='--fmath'||a==='--sim-fmath'){out.flags[a.slice(2)]=true;continue;}
    if(a.startsWith('--')){if(i+1>=argv.length)throw new Error('missing value for '+a);out.flags[a.slice(2)]=argv[++i];continue;}
    if(rootSet)throw new Error('unexpected argument '+a);out.root=resolve(a);rootSet=true;
  }
  return out;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [command,...rest]=process.argv.slice(2),{root,flags}=parse(rest);
  const seeds=flags.seeds?flags.seeds.split(',').map(Number):undefined;
  let result;
  const base=flags.base?resolve(flags.base):undefined,from=flags.from?resolve(flags.from):undefined;
  if(command==='census')result=census(root,{seeds,path:flags.path,samples:flags.samples?Number(flags.samples):undefined});
  else if(command==='golden')result=golden(root,{seeds,base});
  else if(command==='worlds')result=worlds(root,{seeds,base,fixture:flags.fixture});
  else if(command==='checkpoints')result=checkpoints(root,{seed:flags.seed?Number(flags.seed):undefined,base,from});
  else if(command==='replay')result=await replayCheck(root,{fmath:!!flags.fmath,scenario:flags.scenario||'all',steps:flags.steps?Number(flags.steps):1800,profileOut:flags['profile-out']});
  else if(command==='sim-risk')result=await simRisk(root,{steps:flags.steps?Number(flags.steps):1800,simFMath:!!flags['sim-fmath']});
  else if(command==='pages')result=pages(root,{dir:flags.dir&&resolve(flags.dir),census:flags.census,base});
  else if(command==='engines')result=engines(root,{dir:flags.dir&&resolve(flags.dir),census:flags.census,base,...(flags.chrome?{chrome:flags.chrome}:{}),...(flags.jsc?{jsc:flags.jsc}:{})});
  else{const lines=readFileSync(fileURLToPath(import.meta.url),'utf8').split('\n');console.log(lines.slice(0,lines.findIndex(line=>!line.startsWith('//'))).join('\n'));process.exit(command?2:0);}
  const text=JSON.stringify(result,null,1)+'\n',fixture=result.fixture&&{mode:result.fixture.mode,file:result.fixture.file,...(result.fixture.mode==='check'?{equal:result.fixture.equal,of:result.fixture.of}:{worlds:result.fixture.worlds,changedFromPrevious:result.fixture.changedFromPrevious?.length??null}),legacyHashes:result.fixture.legacyHashes.equal+'/'+result.fixture.legacyHashes.of};
  if(flags.out){mkdirSync(resolve(flags.out,'..'),{recursive:true});writeFileSync(flags.out,text);console.log(JSON.stringify({output:resolve(flags.out),...(fixture?{fixture}:{})}));}
  else process.stdout.write(text);
  if(result.fixture?.mode==='check'&&result.fixture.differing.length){console.error(`${result.fixture.file}: ${result.fixture.differing.length} of ${result.fixture.of} campaign worlds differ`);process.exitCode=1;}
}
