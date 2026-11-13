// Lot 01 suite / T1 (MURS-V1): platform sensitivity of world generation.
// Outside the game and outside npm test. Compares the host Math.sin, cos, atan and
// atan2 with FMath (src/fmath.js, the portable fdlibm of V8 without FMA) in the
// main Node realm (tools/realm-loader.mjs, never node:vm). Nothing is written in
// src/, checks/ or dist/; FMath is injected through loadRealm globals or, for the
// replays only, into this process' Math.
//
//   node tools/platform-math.mjs census      [root] [--seeds 1,96,2026] [--path fmath|host] [--samples 150] [--out F]
//   node tools/platform-math.mjs golden      [root] [--seeds 1,96,2026] [--out F]
//   node tools/platform-math.mjs checkpoints [root] [--seed 96] [--out F]
//   node tools/platform-math.mjs replay      [root] [--fmath] [--scenario all] [--steps 1800] [--profile-out F] [--out F]
//   node tools/platform-math.mjs pages       [root] --dir D [--census F]
//   node tools/platform-math.mjs engines     [root] --dir D [--census F] [--chrome PATH] [--jsc PATH]
//
// "engines" runs Google Chrome headless on file:// pages (--dump-dom, private
// --user-data-dir under D, no port, no server) and JavaScriptCore's jsc shell.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {loadRealm,DEFAULT_ROOT} from './realm-loader.mjs';

export const PORTED=Object.freeze(['sin','cos','atan','atan2']);
const f64=new Float64Array(1),u64=new BigUint64Array(f64.buffer);
export const bits=x=>{f64[0]=x;return u64[0].toString(16).padStart(16,'0');};
export const fromBits=hex=>{u64[0]=BigInt('0x'+hex);return f64[0];};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fnv=text=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');};
const highWord=x=>{f64[0]=x;return Number(u64[0]>>32n)&0x7fffffff;};
// fdlibm argument classes of sin/cos, by high word: no reduction, n=+-1, medium, __kernel_rem_pio2.
const reductionClass=x=>{const ix=highWord(x);return ix<=0x3fe921fb?'none':ix<0x4002d97c?'pio2':ix<=0x413921fb?'medium':ix>=0x7ff00000?'nonFinite':'large';};

export function loadFMath(root=DEFAULT_ROOT){return loadRealm({root,modules:['fmath']}).window.FMath;}
export function fmathMath(F){const M=Object.create(Math);for(const name of PORTED)M[name]=F[name];return M;}
export function worldFactory(root,M){return loadRealm({root,modules:['world'],...(M?{globals:{Math:M}}:{})}).window.FWorld;}

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
  const F=loadFMath(root),byKind={},perWorld=[],seen=new Set(),divergentSamples={sin:[],cos:[],atan:[],atan2:[]};
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
  const W=worldFactory(root,M);
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
  const worldsWithDivergence=Object.fromEntries(['legacy','v1','v2'].map(kind=>{const rows=perWorld.filter(w=>w.kind===kind);return [kind,{worlds:rows.length,withDivergentCall:rows.filter(w=>Object.keys(w.divergent).length).length,withDivergentSin:rows.filter(w=>w.divergent.sin).length,withDivergentCos:rows.filter(w=>w.divergent.cos).length,withDivergentAtan2:rows.filter(w=>w.divergent.atan2).length,withDivergentAtan:rows.filter(w=>w.divergent.atan).length}];}));
  return {schema:'metal-platform-math-census-v1',environment:env(),root,path,seeds,legacySeeds:[1,96],worlds:perWorld.length,
    note:'Every Math function called by src/world.js is counted. Only sin, cos, atan and atan2 are compared with FMath; the others are exact by specification (abs, ceil, floor, imul, max, min, round, sign, sqrt) or, for hypot, the same Torque algorithm on every V8 build.',
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

export function golden(root,{seeds=[1,96,2026]}={}){
  const hashes=legacyHashes(root),F=loadFMath(root),host=worldFactory(root),port=worldFactory(root,fmathMath(F));
  const result={schema:'metal-platform-math-golden-v1',environment:env(),root,host:goldenChecks(host.create,hashes),fmath:goldenChecks(port.create,hashes),campaign:{}};
  // Subsets: which ported functions are needed to recover the golden worlds?
  result.subsets=[];
  for(const subset of [['sin','cos'],['atan','atan2'],['sin','cos','atan2'],['sin','cos','atan','atan2']]){
    const M=Object.create(Math);for(const name of subset)M[name]=F[name];
    const checks=goldenChecks(worldFactory(root,M).create,hashes);
    result.subsets.push({ported:subset,passed:checks.passed,of:checks.of,pattern:checks.rows.map(r=>r.pass?1:0).join('')});
  }
  // SHA-256 of JSON.stringify(world) for every campaign world, under both Math,
  // so that two machines can be compared from their outputs.
  for(const kind of ['v1','v2']){
    const rows=worldList(seeds,[]).filter(w=>w.kind===kind),changed=[],digests=[];
    for(const w of rows){const h=digest(make(host,w)),f=digest(make(port,w));digests.push({seed:w.seed,index:w.index,host:h,fmath:f});if(h!==f)changed.push(w.seed+':'+(w.index+1));}
    result.campaign[kind]={worlds:rows.length,changedByFMath:changed.length,changed,digests};
  }
  return result;
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

export function checkpoints(root,{seed=96}={}){
  const F=loadFMath(root),host=loadRealm({root}),port=worldFactory(root,fmathMath(F)),rows=[],fields={},byField={};
  const list=[...worldList([],[1,96]),...worldList([seed],[]).filter(w=>w.kind==='v1'),...worldList([seed],[]).filter(w=>w.kind==='v2')];
  for(const w of list){
    const a=make(host.window.FWorld,w),b=make(port,w),changed=digest(a)!==digest(b);
    const differing=Object.keys(a).filter(k=>digest(a[k])!==digest(b[k]));for(const k of differing)fields[k]=(fields[k]||0)+1;
    const acc={numeric:0,maxAbs:0,maxRel:0,maxPath:'',structural:[],byField};walk(a,b,'$',acc);
    const sa=host.window.FSimulation.create(a),sb=host.window.FSimulation.create(b);
    const fa=sa.snapshot().fingerprint,fb=sb.snapshot().fingerprint;sa.dispose?.();sb.dispose?.();
    rows.push({kind:w.kind,seed:w.seed,index:w.index,worldJsonChanged:changed,checkpointFingerprintHost:fa,checkpointFingerprintFMath:fb,checkpointFingerprintChanged:fa!==fb,differingTopLevelFields:differing,numericDifferences:acc.numeric,maxAbsDifference:acc.maxAbs,maxRelDifference:acc.maxRel,maxAbsPath:acc.maxPath,structuralDifferences:acc.structural.length});
  }
  const summary=Object.fromEntries(['legacy','v1','v2'].map(kind=>{const r=rows.filter(x=>x.kind===kind);return [kind,{worlds:r.length,worldJsonChanged:r.filter(x=>x.worldJsonChanged).length,checkpointFingerprintChanged:r.filter(x=>x.checkpointFingerprintChanged).length,changedWorlds:r.filter(x=>x.checkpointFingerprintChanged).map(x=>x.seed+':'+(x.kind==='legacy'?'s'+x.index:'w'+(x.index+1)))}];}));
  const numeric=rows.map(r=>r.numericDifferences).filter(n=>n>0);
  return {schema:'metal-platform-math-checkpoints-v1',environment:env(),root,note:'Fingerprint = FSimulation snapshot().fingerprint (src/simulation.js, identity of the world: colliders, destructibles, enemies...; meshes excluded). Simulation modules use the host Math; only world generation differs.',
    summary,differingTopLevelFields:fields,differencesByField:byField,maxAbsDifference:Math.max(...rows.map(r=>r.maxAbsDifference)),maxRelDifference:Math.max(...rows.map(r=>r.maxRelDifference)),numericDifferencesPerChangedWorld:numeric.length?{min:Math.min(...numeric),max:Math.max(...numeric)}:null,structuralDifferences:rows.reduce((s,r)=>s+r.structuralDifferences,0),rows};
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

// Port of V8's Torque MathHypot (src/builtins/math.tq), only for the jsc comparison (T3).
const V8_HYPOT=`function v8hypot(){var length=arguments.length;if(length===0)return 0;var abs=new Array(length),oneArgIsNaN=false,max=0,i;
for(i=0;i<length;i++){var value=+arguments[i];if(value!==value){oneArgIsNaN=true;abs[i]=0;}else{var a=Math.abs(value);abs[i]=a;if(a>max)max=a;}}
if(max===Infinity)return Infinity;if(oneArgIsNaN)return NaN;if(max===0)return 0;var sum=0,compensation=0;
for(i=0;i<length;i++){var n=abs[i]/max,summand=n*n-compensation,preliminary=sum+summand;compensation=(preliminary-sum)-summand;sum=preliminary;}
return Math.sqrt(sum)*max;}`;
const ENGINE_WORLDS=[[1,0,null],[1,1,null],[1,2,null],[96,0,null],[96,1,null],[96,2,null],[96,0,'v2'],[96,9,'v2'],[96,17,'v2'],[2026,4,'v2']];

export function trigCases(censusFile){
  const cases=[];
  for(let i=0;i<1800;i++)cases.push({set:'driver',fn:'sin',args:[bits(i/90)]});
  if(censusFile){const c=JSON.parse(readFileSync(censusFile,'utf8'));for(const fn of PORTED)for(const d of c.divergentSamples[fn]||[])cases.push({set:'world-divergent',fn,args:d.args});}
  return cases;
}

export function pages(root,{dir,census:censusFile}={}){
  if(!dir)throw new Error('--dir is required');
  mkdirSync(dir,{recursive:true});
  const src=name=>pathToFileURL(join(root,'src',name+'.js')).href,cases=trigCases(censusFile);
  // FMath itself on the reference vectors of checks/fmath-vectors.txt, in each engine.
  const vectors=[];
  for(const v of readFileSync(join(root,'checks/fmath-vectors.txt'),'utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(' '))){
    if(v[0]==='sincos')vectors.push(['sin',[v[1]],v[2]],['cos',[v[1]],v[3]]);
    else if(v[0]==='atan')vectors.push(['atan',[v[1]],v[2]]);
    else if(v[0]==='atan2')vectors.push(['atan2',[v[1],v[2]],v[3]]);
  }
  const vectorCheck='function fmathVectors(F,V){var f=new Float64Array(1),u=new Uint32Array(f.buffer);f[0]=1;var hi=u[1]===0x3ff00000?1:0;'+
    'function val(h){u[hi]=parseInt(h.slice(0,8),16);u[1-hi]=parseInt(h.slice(8),16);return f[0];}function bits(x){f[0]=x;return (u[hi]>>>0).toString(16).padStart(8,"0")+(u[1-hi]>>>0).toString(16).padStart(8,"0");}'+
    'var ok=0,bad=[];for(var i=0;i<V.length;i++){var c=V[i],r=F[c[0]].apply(null,c[1].map(val));if(c[2]==="nan"?r!==r:bits(r)===c[2])ok++;else if(bad.length<5)bad.push(c[0]+"("+c[1].join(",")+")");}return {cases:V.length,equal:ok,firstDifferences:bad};}\n';
  writeFileSync(join(dir,'trig.html'),'<!doctype html><meta charset=utf-8><title>trig</title><body><pre id=o>pending</pre>'+`<script src="${src('fmath')}"></script><script>`+vectorCheck+
    'const cases='+JSON.stringify(cases.map(c=>[c.fn,c.args]))+',vectors='+JSON.stringify(vectors)+';const f=new Float64Array(1),u=new BigUint64Array(f.buffer);'+
    'const bits=x=>{f[0]=x;return u[0].toString(16).padStart(16,"0");},val=h=>{u[0]=BigInt("0x"+h);return f[0];};'+
    'document.getElementById("o").textContent=JSON.stringify({ua:navigator.userAgent,results:cases.map(([fn,a])=>bits(Math[fn](...a.map(val)))),fmathVectors:fmathVectors(FMath,vectors)});</script>');
  const modules=['renderer','world','destruction','economy','brain','simulation'];
  writeFileSync(join(dir,'fp.html'),'<!doctype html><meta charset=utf-8><title>fp</title><body><pre id=o>pending</pre>'+
    modules.map(m=>`<script src="${src(m)}"></script>`).join('')+`<script src="${src('fmath')}"></script><script>`+
    'const N={sin:Math.sin,cos:Math.cos,atan:Math.atan,atan2:Math.atan2},use=t=>{for(const k in N)Math[k]=t==="fmath"?FMath[k]:N[k];};'+
    'const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,"0");};'+
    'const cases=[];for(const s of [1,96])for(let i=0;i<3;i++)cases.push([s,i,null,"legacy"]);for(let i=0;i<18;i++){cases.push([96,i,{campaign:true},"v1"]);cases.push([96,i,{campaign:true,campaignVersion:2},"v2"]);}'+
    'const res=[];let err=null;try{for(const [s,i,o,k] of cases){const r={s,i,k};for(const t of ["native","fmath"]){use(t);const w=FWorld.create(s,i,o&&{...o});use("native");const json=JSON.stringify(w);const sim=FSimulation.create(w);r[t]=sim.snapshot().fingerprint;r[t+"Fnv"]=fnv(json);sim.dispose&&sim.dispose();}res.push(r);}}catch(e){err=String(e&&e.stack||e);}'+
    'document.getElementById("o").textContent=JSON.stringify({ua:navigator.userAgent,err,res});</script>');
  const world=readFileSync(join(root,'src/world.js'),'utf8'),fmath=readFileSync(join(root,'src/fmath.js'),'utf8');
  writeFileSync(join(dir,'jsc-worlds.js'),V8_HYPOT+'\nvar window={};\n'+fmath+'\nvar F=window.FMath;\n'+
    'function fnv(s){var h=2166136261;for(var i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16);}\n'+
    'function load(M){var w={};(new Function("window","Math",'+JSON.stringify(world)+'))(w,M);return w.FWorld;}\n'+
    'function variant(trig,hypot){var M=Object.create(Math);if(trig){M.sin=F.sin;M.cos=F.cos;M.atan=F.atan;M.atan2=F.atan2;}if(hypot)M.hypot=v8hypot;return load(M);}\n'+
    'var V={native:variant(false,false),fmath:variant(true,false),nativeV8Hypot:variant(false,true),fmathV8Hypot:variant(true,true)},cases='+JSON.stringify(ENGINE_WORLDS)+',out=[];\n'+
    'for(var c of cases){var r={seed:c[0],index:c[1],v2:c[2]==="v2"};for(var k in V)r[k]=fnv(JSON.stringify(V[k].create(c[0],c[1],c[2]?{campaign:true,campaignVersion:2}:undefined)));out.push(r);}\n'+
    vectorCheck+'var vectors='+JSON.stringify(vectors)+';\n'+
    'print(JSON.stringify({engine:"jsc",out:out,fmathVectors:fmathVectors(F,vectors)}));\n');
  return {dir,files:['trig.html','fp.html','jsc-worlds.js'],trigCases:cases.length};
}

function readDump(file){
  const html=readFileSync(file,'utf8'),m=/<pre id="o">([\s\S]*?)<\/pre>/.exec(html);
  if(!m)throw new Error('no <pre id="o"> payload in '+file);
  const text=m[1].replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  if(text==='pending')throw new Error('page did not finish: '+file);
  return JSON.parse(text);
}

export function engines(root,{dir,census:censusFile,chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',jsc='/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'}={}){
  const written=pages(root,{dir,census:censusFile}),F=loadFMath(root),out={schema:'metal-platform-math-engines-v1',environment:env(),root,pages:written};
  if(existsSync(chrome)){
    const run=page=>{const profile=join(dir,'chrome-profile-'+page.replace(/\W/g,''));mkdirSync(profile,{recursive:true});
      const html=execFileSync(chrome,['--headless=new','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--no-pings','--dump-dom',pathToFileURL(join(dir,page)).href],{maxBuffer:1<<28,timeout:300000,stdio:['ignore','pipe','ignore']}).toString();
      const file=join(dir,page+'.dump.html');writeFileSync(file,html);return readDump(file);};
    const trig=run('trig.html'),cases=trigCases(censusFile),by={};
    cases.forEach((c,i)=>{
      const args=c.args.map(fromBits),chromeBits=trig.results[i],node=bits(Math[c.fn](...args)),port=bits(F[c.fn](...args)),key=c.set+':'+c.fn,k=by[key]??={cases:0,chromeEqNodeHost:0,chromeEqFMath:0,nodeHostEqFMath:0};
      k.cases++;if(chromeBits===node)k.chromeEqNodeHost++;if(chromeBits===port)k.chromeEqFMath++;if(node===port)k.nodeHostEqFMath++;
      {const cr=correctlyRounded(c.fn,args[0],args[1]);if(cr===null)k.undecided=(k.undecided||0)+1;else{const crBits=bits(cr);k.withReference=(k.withReference||0)+1;if(chromeBits===crBits)k.chromeCorrectlyRounded=(k.chromeCorrectlyRounded||0)+1;if(node===crBits)k.nodeHostCorrectlyRounded=(k.nodeHostCorrectlyRounded||0)+1;if(port===crBits)k.fmathCorrectlyRounded=(k.fmathCorrectlyRounded||0)+1;}}
    });
    const fp=run('fp.html');
    let fpChromeEqNode=0,fpChromeNativeEqNodeHost=0,fnvChromeEqNode=0,changedInChrome=0;
    // World by world, so that the outputs of two machines (Chrome on macOS and on
    // Linux, Node on each) can be compared afterwards without rerunning anything.
    const worlds=[];
    if(!fp.err){
      const host=loadRealm({root}),port=worldFactory(root,fmathMath(F));
      for(const r of fp.res){
        const options=r.k==='legacy'?undefined:r.k==='v1'?{campaign:true}:{campaign:true,campaignVersion:2};
        const wn=host.window.FWorld.create(r.s,r.i,options&&{...options}),wp=port.create(r.s,r.i,options&&{...options});
        const sn=host.window.FSimulation.create(wn),sp=host.window.FSimulation.create(wp);
        const nodeHost=sn.snapshot().fingerprint,nodeFMath=sp.snapshot().fingerprint,nodeHostWorldFnv=fnv(JSON.stringify(wn)),nodeFMathWorldFnv=fnv(JSON.stringify(wp));
        if(nodeFMath===r.fmath)fpChromeEqNode++;if(nodeHost===r.native)fpChromeNativeEqNodeHost++;
        if(nodeFMathWorldFnv===r.fmathFnv)fnvChromeEqNode++;if(r.native!==r.fmath)changedInChrome++;
        worlds.push({kind:r.k,seed:r.s,index:r.i,chromeNative:r.native,chromeFMath:r.fmath,nodeHost,nodeFMath,chromeNativeWorldFnv:r.nativeFnv,chromeFMathWorldFnv:r.fmathFnv,nodeHostWorldFnv,nodeFMathWorldFnv});
        sn.dispose?.();sp.dispose?.();
      }
    }
    out.chrome={path:chrome,userAgent:trig.ua,fmathVectors:trig.fmathVectors,trig:by,checkpoints:fp.err?{error:fp.err}:{worlds:fp.res.length,fingerprintChangedByFMathInChrome:changedInChrome,fmathFingerprintChromeEqNode:fpChromeEqNode,nativeFingerprintChromeEqNodeHost:fpChromeNativeEqNodeHost,fmathWorldFnvChromeEqNode:fnvChromeEqNode,
      note:'Fingerprint = FSimulation snapshot().fingerprint of the generated world; WorldFnv = FNV-1a of JSON.stringify(world). native: the Math of the engine; fmath: FMath for sin, cos, atan and atan2 during generation.',perWorld:worlds}};
  }else out.chrome={skipped:'not found: '+chrome};
  if(existsSync(jsc)){
    const text=execFileSync(jsc,[join(dir,'jsc-worlds.js')],{maxBuffer:1<<26,timeout:600000}).toString(),j=JSON.parse(text.trim().split('\n').pop());
    const host=worldFactory(root),port=worldFactory(root,fmathMath(F)),rows=[];
    for(const r of j.out){
      const options=r.v2?{campaign:true,campaignVersion:2}:undefined,nn=fnv(JSON.stringify(host.create(r.seed,r.index,options&&{...options}))),np=fnv(JSON.stringify(port.create(r.seed,r.index,options&&{...options})));
      rows.push({seed:r.seed,index:r.index,v2:r.v2,jscNativeEqNodeHost:r.native===nn,jscFMathEqNodeFMath:r.fmath===np,jscNativeV8HypotEqNodeHost:r.nativeV8Hypot===nn,jscFMathV8HypotEqNodeFMath:r.fmathV8Hypot===np});
    }
    const count=key=>rows.filter(r=>r[key]).length;
    out.jsc={path:jsc,fmathVectors:j.fmathVectors,worlds:rows.length,jscNativeEqNodeHost:count('jscNativeEqNodeHost'),jscFMathEqNodeFMath:count('jscFMathEqNodeFMath'),jscNativeV8HypotEqNodeHost:count('jscNativeV8HypotEqNodeHost'),jscFMathV8HypotEqNodeFMath:count('jscFMathV8HypotEqNodeFMath'),rows};
  }else out.jsc={skipped:'not found: '+jsc};
  return out;
}

function env(){return {node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch};}

function parse(argv){
  const out={root:DEFAULT_ROOT,flags:{}};let rootSet=false;
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==='--fmath'){out.flags.fmath=true;continue;}
    if(a.startsWith('--')){if(i+1>=argv.length)throw new Error('missing value for '+a);out.flags[a.slice(2)]=argv[++i];continue;}
    if(rootSet)throw new Error('unexpected argument '+a);out.root=resolve(a);rootSet=true;
  }
  return out;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [command,...rest]=process.argv.slice(2),{root,flags}=parse(rest);
  const seeds=flags.seeds?flags.seeds.split(',').map(Number):undefined;
  let result;
  if(command==='census')result=census(root,{seeds,path:flags.path,samples:flags.samples?Number(flags.samples):undefined});
  else if(command==='golden')result=golden(root,{seeds});
  else if(command==='checkpoints')result=checkpoints(root,{seed:flags.seed?Number(flags.seed):undefined});
  else if(command==='replay')result=await replayCheck(root,{fmath:!!flags.fmath,scenario:flags.scenario||'all',steps:flags.steps?Number(flags.steps):1800,profileOut:flags['profile-out']});
  else if(command==='pages')result=pages(root,{dir:flags.dir&&resolve(flags.dir),census:flags.census});
  else if(command==='engines')result=engines(root,{dir:flags.dir&&resolve(flags.dir),census:flags.census,...(flags.chrome?{chrome:flags.chrome}:{}),...(flags.jsc?{jsc:flags.jsc}:{})});
  else{console.log(readFileSync(fileURLToPath(import.meta.url),'utf8').split('\n').slice(0,16).join('\n'));process.exit(command?2:0);}
  const text=JSON.stringify(result,null,1)+'\n';
  if(flags.out){mkdirSync(resolve(flags.out,'..'),{recursive:true});writeFileSync(flags.out,text);console.log(JSON.stringify({output:resolve(flags.out)}));}
  else process.stdout.write(text);
}
