// Lot 01 suite / T3 — FMath.hypot, hypot2 and hypot3 against Math.hypot of V8.
//
// The reference is Math.hypot of V8 (the MathHypot builtin of src/builtins/math.tq):
// V8 generates it with its own code generator, which never fuses a multiply and
// an add, so every V8 build (x86-64, arm64, Node, Chrome) gives the same bits.
// JavaScriptCore (Safari) computes hypot otherwise; it is never a reference here.
// Run with Node, in the main realm (no node:vm).
//
//   node docs/chantier-moteur/preuves/lot-01s/t3/hypot-proof.mjs vectors [--write]
//       builds the deterministic input set of checks/fmath-hypot-vectors.txt and
//       writes it (--write) or checks that the file is exactly what this V8 gives.
//   node docs/chantier-moteur/preuves/lot-01s/t3/hypot-proof.mjs sweep [--count 10000000] [--seed S] [--report F]
//       compares hypot2, hypot3 and hypot with Math.hypot on seeded random inputs
//       (mixed magnitudes, +-0, subnormals, huge values, Infinity, NaN, Infinity
//       beside NaN), on special-value grids and on arities 0 to 8; counts only.
//   node docs/chantier-moteur/preuves/lot-01s/t3/hypot-proof.mjs worlds [--root R] [--report F]
//       generates the 114 worlds of tools/platform-math.mjs with an FMath whose
//       hypot2 and hypot3 also call Math.hypot on every input, and counts calls,
//       distinct inputs (per world) and differences; the worlds are those of R.
//   node docs/chantier-moteur/preuves/lot-01s/t3/hypot-proof.mjs micro [--root R] [--reps 11] [--report F]
//       ns per call of Math.hypot and of hypot2/hypot3 on the inputs recorded
//       while generating six worlds: cache-resident (4 096 inputs, inlined call)
//       and streamed (every recorded input), alternated, medians.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cpus,loadavg} from 'node:os';

const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../../..'),table=join(repo,'checks/fmath-hypot-vectors.txt');
const f64=new Float64Array(1),u64=new BigUint64Array(f64.buffer);
const bits=x=>{f64[0]=x;return u64[0].toString(16).padStart(16,'0');};
const val=h=>{u64[0]=BigInt('0x'+h);return f64[0];};
const out=x=>x!==x?'nan':bits(x); // any NaN payload is the same NaN for ECMAScript
const words=(hi,lo)=>(hi>>>0).toString(16).padStart(8,'0')+(lo>>>0).toString(16).padStart(8,'0');
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return (t^t>>>14)>>>0;};}
const env=()=>({node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,cpu:cpus()[0]?.model||'unknown',loadAverage:loadavg()});
if(!process.versions.v8)throw new Error('hypot-proof: the reference is Math.hypot of V8: run it with Node');

async function loadFMath(root=repo){const {loadRealm}=await import(join(repo,'tools/realm-loader.mjs'));return loadRealm({root,modules:['fmath']}).window.FMath;}

// One argument: a double of the given class. ref: biased exponent of the first
// argument, for the "near" class (same scale, where the compensation matters).
const NAN_BITS=['7ff8000000000000','fff8000000000000','7ff0000000000001','7fffffffffffffff'];
function randomArg(next,kind,ref){
  const sign=next()&1?0x80000000:0,biased=(e0,e1)=>{const e=Math.max(0,Math.min(2046,e0+next()%(e1-e0+1)));return val(words(sign|(e<<20)|(next()&0xfffff),next()));};
  switch(kind){
    case 'zero':return sign?-0:0;
    case 'subnormal':return biased(0,0);
    case 'tiny':return biased(1,80);
    case 'small':return biased(1023-40,1023-10);
    case 'unit':return biased(1023-8,1023+8);
    case 'large':return biased(1023+10,1023+60);
    case 'huge':return biased(1950,2046);
    case 'max':return val(words(sign|0x7fefffff,0xffffffff-(next()%4)));
    case 'infinity':return sign?-Infinity:Infinity;
    case 'nan':return val(NAN_BITS[next()%NAN_BITS.length]);
    case 'near':return biased(ref-30,ref+30);
    case 'any':return biased(0,2046);
    case 'world':{const scale=[1,8,64,1024][next()%4];return (next()%(400*scale)-200*scale)/scale;} // coordinates and offsets
  }
  throw new Error('unknown class '+kind);
}
const FIRST=[['zero',4],['subnormal',4],['tiny',4],['small',8],['unit',20],['large',8],['huge',4],['max',1],['infinity',1],['nan',1],['any',20],['world',10]];
const OTHER=[...FIRST,['near',85]];
const pick=(next,list)=>{const total=list.reduce((s,[,w])=>s+w,0);let r=next()%total;for(const [k,w] of list){if(r<w)return k;r-=w;}};
const expOf=x=>{f64[0]=x;return Number((u64[0]>>52n)&0x7ffn);};
function randomTuple(next,n){
  const kinds=[pick(next,FIRST)],a=[randomArg(next,kinds[0],1023)],ref=Math.min(2046,Math.max(1,expOf(a[0])||1));
  for(let i=1;i<n;i++){const k=pick(next,OTHER);kinds.push(k);a.push(randomArg(next,k,ref));}
  return {args:a,kinds};
}

// Special values: zeros, subnormal and normal limits, overflow of the squares,
// overflow of the result, infinities and NaN.
const SPECIAL2=[0,-0,5e-324,-2.225073858507201e-308,2.2250738585072014e-308,-1,1.5,3,2**-537,2**512,1.2711610061536462e308,1.7976931348623157e308,-1.7976931348623157e308,Infinity,-Infinity,NaN];
const SPECIAL3=[0,-0,5e-324,1,-3,1.7976931348623157e308,-Infinity,NaN];

// ------------------------------------------------------------------ vectors
const HEADER=v8=>['# FMath hypot reference vectors (lot 01 suite / T3). Generated by docs/chantier-moteur/preuves/lot-01s/t3/hypot-proof.mjs.',
  `# Expected bits come from Math.hypot of V8 ${v8} (Node): the MathHypot builtin of src/builtins/math.tq, the same in`,
  '# every V8 build; never from FMath, never from JavaScriptCore. IEEE-754 bit patterns in hexadecimal.',
  '#   hypot GROUP A1 ... An R (n = 0 to 6 arguments) ; "nan" = any NaN'];
async function vectorRows(){
  const rows=[],seen=new Set(),add=(group,args)=>{const key=args.map(bits).join(' ');if(seen.has(group+key))return;seen.add(group+key);rows.push(['hypot',group,...args.map(bits),out(Math.hypot(...args))].join(' '));};
  for(const a of SPECIAL2)for(const b of SPECIAL2)add('special',[a,b]);
  for(const a of SPECIAL3)for(const b of SPECIAL3)for(const c of SPECIAL3)add('special',[a,b,c]);
  // Overflow and underflow edges: squares that overflow, results that do or do not.
  const big=1.2711610061536462e308,step=(x,k)=>{f64[0]=x;u64[0]+=BigInt(k);return f64[0];};
  for(const k of [-2,-1,0,1,2]){const x=step(big,k);add('edge',[x,x]);add('edge',[x,x,0]);add('edge',[0,x,x]);}
  for(const [a,b] of [[1.7976931348623157e308,1e292],[1.7976931348623157e308,1.7976931348623157e300],[1e308,1e308],[1e200,1e200],[1e-200,1e-200],[5e-324,5e-324],[1e-323,5e-324],[2.2250738585072014e-308,2.2250738585072014e-308],[2**-1074,2**-1022],[2**-1022,2**-1074],[3,4],[5,12],[1e300,1e-300]])add('edge',[a,b]);
  for(const [a,b,c] of [[1e308,1e308,1e308],[1.7976931348623157e308,1,1],[5e-324,5e-324,5e-324],[2,3,6],[1,4,8],[2**-1074,2**-1074,2**-1073],[1e154,1e154,1e154]])add('edge',[a,b,c]);
  // Random tuples over the whole range.
  const next=mulberry32(0x417e0301);
  for(let i=0;i<150;i++)add('random',randomTuple(next,2).args);
  for(let i=0;i<150;i++)add('random',randomTuple(next,3).args);
  // The compensation changes the result: V8 differs from the plain sum of the
  // scaled squares (same scale arguments).
  const plain=(a,b,c)=>{const m=Math.max(Math.abs(a),Math.abs(b),Math.abs(c)),x=a/m,y=b/m,z=c/m;return Math.sqrt(x*x+y*y+z*z)*m;};
  for(let found=0,tries=0;found<60&&tries<1e6;tries++){const {args}=randomTuple(next,3),[a,b,c]=args;if(args.some(x=>!Number.isFinite(x)||x===0))continue;if(!Object.is(plain(a,b,c),Math.hypot(a,b,c))){add('kahan',args);found++;}}
  // The argument order matters: a permutation of the same three values.
  for(let found=0,tries=0;found<24&&tries<1e6;tries++){const [a,b,c]=randomTuple(next,3).args,r=Math.hypot(a,b,c);for(const p of [[b,a,c],[c,b,a],[a,c,b]])if(!Object.is(Math.hypot(...p),r)){add('order',[a,b,c]);add('order',p);found++;break;}}
  // The arity matters: hypot(a, b) and hypot(a, b, 0) (the compensation reaches the zero term).
  for(let found=0,tries=0;found<24&&tries<1e7;tries++){const [a,b]=randomTuple(next,2).args;if(!Object.is(Math.hypot(a,b),Math.hypot(a,b,0))){add('arity',[a,b]);add('arity',[a,b,0]);found++;}}
  // Inputs met while generating one world (seed 96, campaign V2, world 10).
  const sample=await worldSample(repo,{seed:96,index:9,options:{campaign:true,campaignVersion:2}},100);
  for(const args of sample)add('world',args);
  // Other arities: hypot only.
  add('many',[]);for(const a of SPECIAL2)add('many',[a]);
  for(const n of [4,5,6]){for(let i=0;i<30;i++)add('many',randomTuple(next,n).args);add('many',Array(n).fill(0));add('many',[...Array(n-1).fill(1),NaN]);add('many',[NaN,...Array(n-2).fill(1),-Infinity]);add('many',Array(n).fill(1.7976931348623157e308));}
  return rows;
}
// Every k-th input of hypot2 and hypot3 while one world is generated, count per arity.
async function worldSample(root,w,count){
  const {loadRealm}=await import(join(repo,'tools/realm-loader.mjs'));
  const F=await loadFMath(root),seen={2:[],3:[]};
  const FM=Object.freeze({...F,hypot2:(a,b)=>{seen[2].push([a,b]);return F.hypot2(a,b);},hypot3:(a,b,c)=>{seen[3].push([a,b,c]);return F.hypot3(a,b,c);}});
  loadRealm({root,modules:['world'],globals:{FMath:FM}}).window.FWorld.create(w.seed,w.index,w.options&&{...w.options});
  const pickEvery=list=>{const k=Math.max(1,Math.floor(list.length/count));return list.filter((_,i)=>i%k===0).slice(0,count);};
  return [...pickEvery(seen[2]),...pickEvery(seen[3])];
}

// ------------------------------------------------------------------ sweep
async function sweep({count=1e7,seed=0x5eed0303}={}){
  const F=await loadFMath(),next=mulberry32(seed),res={},classCount={};
  const tally=(name,ok)=>{const r=res[name]??={calls:0,differences:0};r.calls++;if(!ok){r.differences++;if((r.first??=[]).length<5)r.first.push(name);}};
  const t0=performance.now();
  for(let i=0;i<count;i++){
    const {args:[a,b],kinds}=randomTuple(next,2),r=Math.hypot(a,b);
    tally('hypot2',Object.is(F.hypot2(a,b),r));tally('hypot(2)',Object.is(F.hypot(a,b),r));
    if(i<1e5)for(const k of kinds)classCount[k]=(classCount[k]||0)+1;
  }
  for(let i=0;i<count;i++){
    const {args:[a,b,c]}=randomTuple(next,3),r=Math.hypot(a,b,c);
    tally('hypot3',Object.is(F.hypot3(a,b,c),r));tally('hypot(3)',Object.is(F.hypot(a,b,c),r));
  }
  const many=Math.max(1,Math.floor(count/10));
  for(let i=0;i<many;i++){const n=[0,1,4,5,6,7,8][i%7],{args}=randomTuple(next,Math.max(n,1)),list=args.slice(0,n);tally('hypot('+n+')',Object.is(F.hypot(...list),Math.hypot(...list)));}
  // Grids of special values (every combination, both functions).
  const S=[...new Set([...SPECIAL2,...SPECIAL3,2**-1074*3,1e-300,0.1,7,1e22,1e300])];
  for(const a of S)for(const b of S){tally('grid hypot2',Object.is(F.hypot2(a,b),Math.hypot(a,b)));for(const c of S)tally('grid hypot3',Object.is(F.hypot3(a,b,c),Math.hypot(a,b,c)));}
  // Infinity beside NaN, in every position.
  for(const inf of [Infinity,-Infinity])for(const nan of NAN_BITS.map(val)){
    for(const p of [[inf,nan],[nan,inf]])tally('infinity and NaN',Object.is(F.hypot2(...p),Math.hypot(...p))&&Object.is(F.hypot2(...p),Infinity));
    for(const p of [[inf,nan,1],[nan,inf,1],[nan,1,inf],[1,nan,inf],[nan,nan,inf],[0,nan,inf]])tally('infinity and NaN',Object.is(F.hypot3(...p),Math.hypot(...p))&&Object.is(F.hypot3(...p),Infinity));
  }
  const total=Object.values(res).reduce((s,r)=>s+r.calls,0),differences=Object.values(res).reduce((s,r)=>s+r.differences,0);
  return {schema:'metal-lot01s-t3-hypot-sweep-v1',environment:env(),seed,countPerArity:count,calls:total,differences,seconds:+((performance.now()-t0)/1000).toFixed(1),
    note:'Object.is(FMath, Math.hypot of V8) on every input; a NaN equals any NaN. Classes of the first 100 000 pairs: '+JSON.stringify(classCount),byFunction:res,
    classes:{first:FIRST,other:OTHER,specialValues:S.length}};
}

// ------------------------------------------------------------------ worlds
async function worlds({root=repo}={}){
  const {loadRealm}=await import(join(repo,'tools/realm-loader.mjs')),{worldList}=await import(join(repo,'tools/platform-math.mjs'));
  const F=await loadFMath(root),host=Math.hypot,count={2:{calls:0,differences:0},3:{calls:0,differences:0}};
  let keys2=new Set(),keys3=new Set();const perWorld=[];
  const key=(...a)=>a.map(bits).join(',');
  const FM=Object.freeze({...F,
    hypot2:(a,b)=>{const r=F.hypot2(a,b),c=count[2];c.calls++;if(!Object.is(r,host(a,b)))c.differences++;keys2.add(key(a,b));return r;},
    hypot3:(a,b,c)=>{const r=F.hypot3(a,b,c),s=count[3];s.calls++;if(!Object.is(r,host(a,b,c)))s.differences++;keys3.add(key(a,b,c));return r;}});
  const W=loadRealm({root,modules:['world'],globals:{FMath:FM}}).window.FWorld,t0=performance.now();
  for(const w of worldList()){
    const c2=count[2].calls,c3=count[3].calls;
    W.create(w.seed,w.index,w.options&&{...w.options});
    perWorld.push({kind:w.kind,seed:w.seed,index:w.index,calls2:count[2].calls-c2,calls3:count[3].calls-c3,distinct2:keys2.size,distinct3:keys3.size});
    keys2=new Set();keys3=new Set();
  }
  const sum=k=>perWorld.reduce((s,r)=>s+r[k],0);
  return {schema:'metal-lot01s-t3-hypot-worlds-v1',environment:env(),root,worlds:perWorld.length,seconds:+((performance.now()-t0)/1000).toFixed(1),
    note:'Every hypot2 and hypot3 call of src/world.js during the generation of the 114 worlds (legacy seeds 1 and 96, V1 and V2 campaigns of seeds 1, 96 and 2026) is also computed by Math.hypot of V8; differences counted with Object.is. Distinct inputs are counted per world (IEEE-754 bit patterns, -0 and 0 distinct) and summed.',
    hypot2:{...count[2],distinctInputsSummedOverWorlds:sum('distinct2')},hypot3:{...count[3],distinctInputsSummedOverWorlds:sum('distinct3')},perWorld};
}

// ------------------------------------------------------------------ micro
async function micro({root=repo,reps=11}={}){
  const {loadRealm}=await import(join(repo,'tools/realm-loader.mjs'));
  const F=await loadFMath(root),rec={2:[],3:[]};
  const FM=Object.freeze({...F,hypot2:(a,b)=>{rec[2].push(a,b);return F.hypot2(a,b);},hypot3:(a,b,c)=>{rec[3].push(a,b,c);return F.hypot3(a,b,c);}});
  const W=loadRealm({root,modules:['world'],globals:{FMath:FM}}).window.FWorld;
  for(const [s,i,o] of [[96,0],[96,2],[96,0,{campaign:true,campaignVersion:2}],[96,9,{campaign:true,campaignVersion:2}],[96,17,{campaign:true,campaignVersion:2}],[1,5,{campaign:true}]])W.create(s,i,o);
  const H2=new Float64Array(rec[2]),H3=new Float64Array(rec[3]),N2=H2.length/2,N3=H3.length/3,M=4096,K=400;
  // Each loop is its own function, so each call site has its own feedback and FMath's functions can be inlined.
  const make=(call,H,arity,n,k)=>new Function('Math','F','H',`return function(){let acc=0;for(let k=0;k<${k};k++)for(let i=0;i<${n};i++)acc+=${call}(${Array.from({length:arity},(_,j)=>`H[${arity}*i+${j}]`).join(',')});return acc;}`)(Math,F,H);
  const loops={
    'resident builtin 2':make('Math.hypot',H2,2,M,K),'resident hypot2':make('F.hypot2',H2,2,M,K),
    'resident builtin 3':make('Math.hypot',H3,3,M,K),'resident hypot3':make('F.hypot3',H3,3,M,K),
    'streamed builtin 2':make('Math.hypot',H2,2,N2,1),'streamed hypot2':make('F.hypot2',H2,2,N2,1),
    'streamed builtin 3':make('Math.hypot',H3,3,N3,1),'streamed hypot3':make('F.hypot3',H3,3,N3,1)};
  const calls=name=>name.startsWith('resident')?M*K:name.endsWith('2')?N2:N3,keys=Object.keys(loops),ns=Object.fromEntries(keys.map(k=>[k,[]])),sums={};
  for(const k of keys)sums[k]=loops[k]();
  for(let rep=0;rep<reps;rep++)for(const k of (rep%2?keys.slice().reverse():keys)){const t=process.hrtime.bigint();loops[k]();ns[k].push(Number(process.hrtime.bigint()-t)/calls(k));}
  const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length%2?s[s.length>>1]:(s[s.length/2-1]+s[s.length/2])/2;};
  const nsPerCall=Object.fromEntries(keys.map(k=>[k,+median(ns[k]).toFixed(2)]));
  const ratio=(a,b)=>+(nsPerCall[b]/nsPerCall[a]).toFixed(3);
  return {schema:'metal-lot01s-t3-hypot-micro-v1',environment:env(),root,recorded:{calls2:N2,calls3:N3,worlds:'96:s0, 96:s2, V2 96:w1, 96:w10, 96:w18, V1 1:w6'},reps,
    sameSums:{resident2:Object.is(sums['resident builtin 2'],sums['resident hypot2']),resident3:Object.is(sums['resident builtin 3'],sums['resident hypot3']),streamed2:Object.is(sums['streamed builtin 2'],sums['streamed hypot2']),streamed3:Object.is(sums['streamed builtin 3'],sums['streamed hypot3'])},
    nsPerCall,portOverBuiltin:{resident2:ratio('resident builtin 2','resident hypot2'),resident3:ratio('resident builtin 3','resident hypot3'),streamed2:ratio('streamed builtin 2','streamed hypot2'),streamed3:ratio('streamed builtin 3','streamed hypot3')},
    method:'process.hrtime per pass, passes alternated (forward, then reverse order), medians; resident: the first 4 096 recorded inputs, 400 passes per timing; streamed: every recorded input once per timing.'};
}

function parse(argv){
  const o={};
  for(let i=0;i<argv.length;i++){const a=argv[i];if(a==='--write'){o.write=true;continue;}if(!a.startsWith('--')||i+1>=argv.length)throw new Error('bad argument '+a);o[a.slice(2)]=argv[++i];}
  return o;
}
const [command,...rest]=process.argv.slice(2),flags=parse(rest),report=r=>{const text=JSON.stringify(r,null,1)+'\n';if(flags.report){mkdirSync(dirname(resolve(flags.report)),{recursive:true});writeFileSync(flags.report,text);console.log(JSON.stringify({report:resolve(flags.report)}));}else process.stdout.write(text);};
if(command==='vectors'){
  const rows=await vectorRows(),text=[...HEADER(process.versions.v8),...rows].join('\n')+'\n';
  const groups={};for(const r of rows){const g=r.split(' ')[1];groups[g]=(groups[g]||0)+1;}
  if(flags.write){writeFileSync(table,text);console.log(JSON.stringify({written:table,rows:rows.length,bytes:Buffer.byteLength(text),groups}));}
  else{let existing='';try{existing=readFileSync(table,'utf8');}catch{}const rowsOf=t=>t.split('\n').filter(l=>l&&!l.startsWith('#')).join('\n');console.log(JSON.stringify({table,rows:rows.length,groups,identicalToExisting:existing===text,rowsIdenticalToExisting:rowsOf(existing)===rowsOf(text)}));}
}
else if(command==='sweep')report(await sweep({count:flags.count?Number(flags.count):undefined,seed:flags.seed?Number(flags.seed):undefined}));
else if(command==='worlds')report(await worlds({root:flags.root?resolve(flags.root):undefined}));
else if(command==='micro')report(await micro({root:flags.root?resolve(flags.root):undefined,reps:flags.reps?Number(flags.reps):undefined}));
else{const lines=readFileSync(fileURLToPath(import.meta.url),'utf8').split('\n');console.log(lines.slice(0,lines.findIndex(l=>!l.startsWith('//'))).join('\n'));process.exit(command?2:0);}
