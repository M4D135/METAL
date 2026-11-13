// Lot 01 suite / T1 — FMath reference vectors and exhaustive check against the C
// witness (fdlibm-v8.c, the fdlibm of V8's src/base/ieee754.cc).
//
//   node docs/chantier-moteur/preuves/lot-01s/t1/gen-vectors.mjs harvest <census.json>
//       keeps the inputs where the host Math differed from FMath during world
//       generation (tools/platform-math.mjs census) and in the audit driver, in
//       mac-divergent-inputs.json next to this script (inputs only, never results).
//   node docs/chantier-moteur/preuves/lot-01s/t1/gen-vectors.mjs vectors [--cc clang|gcc] [--write] [--work DIR] [--report FILE]
//       compiles fdlibm-v8.c without contraction (-ffp-contract=off) and with the
//       compiler's contraction (clang: =on, its default; gcc: =fast, its default;
//       gcc also =on, which gcc 13 implements as =off), builds a deterministic
//       input set, and writes (--write) or checks checks/fmath-vectors.txt.
//       Expected values always come from the -ffp-contract=off witness, never from
//       a host Math. The report compares, per function and input set, the
//       contracted witness with this host's Math.* and the =off witness with FMath.
//   node docs/chantier-moteur/preuves/lot-01s/t1/gen-vectors.mjs exhaustive [--cc clang|gcc] [--path fmath|host] [--work DIR] --report FILE
//       generates the 114 worlds of tools/platform-math.mjs (legacy seeds 1 and 96,
//       V1 and V2 campaigns of seeds 1, 96 and 2026) with FMath (default) or the
//       host Math in src/world.js, collects every distinct input of sin, cos, atan
//       and atan2 (keys are IEEE-754 bit patterns: -0 and 0 are distinct), and
//       compares FMath and the host Math with both witnesses on all of them. The
//       inputs are piped to the witness, never written to disk; the report holds
//       counts only.
//   node docs/chantier-moteur/preuves/lot-01s/t1/gen-vectors.mjs sweep [--cc clang|gcc] [--count 500000] [--seed S] [--work DIR] --report FILE
//       the same comparison on seeded random inputs over the whole double range,
//       by argument class (count per function); counts only.
// The witness binaries go to --work, or to a fresh directory under $TMPDIR.
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..'),table=join(root,'checks/fmath-vectors.txt'),harvestFile=join(here,'mac-divergent-inputs.json');
const f64=new Float64Array(1),u64=new BigUint64Array(f64.buffer);
const bits=x=>{f64[0]=x;return u64[0].toString(16).padStart(16,'0');};
const val=h=>{u64[0]=BigInt('0x'+h);return f64[0];};
const step=(h,k)=>(BigInt('0x'+h)+BigInt(k)).toString(16).padStart(16,'0'); // neighbour by k ulps (same sign)
const neg=h=>(BigInt('0x'+h)^(1n<<63n)).toString(16).padStart(16,'0');
const words=(hi,lo)=>(hi>>>0).toString(16).padStart(8,'0')+(lo>>>0).toString(16).padStart(8,'0');
const nanify=h=>{const v=val(h);return v!==v?'nan':h;}; // any NaN payload is the same NaN for ECMAScript
const normal=out=>out.includes(' ')?out:nanify(out); // a rem line ("n y0 y1") is compared as text
function loadFMath(){const w={};new Function('window',readFileSync(join(root,'src/fmath.js'),'utf8'))(w);return w.FMath;}
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return (t^t>>>14)>>>0;};}
// Random double with a biased exponent in [e0, e1] (2^(e-1023)), random mantissa and sign.
function randomDouble(next,e0,e1,sign=true){
  const e=e0+next()%(e1-e0+1),hi=((e&0x7ff)<<20)|(next()&0xfffff),s=sign&&(next()&1)?0x80000000:0;
  return words((hi|s)>>>0,next());
}

// ------------------------------------------------------------------ inputs
function inputs(){
  const harvest=existsSync(harvestFile)?JSON.parse(readFileSync(harvestFile,'utf8')):{sin:[],cos:[],atan:[],atan2:[],driver:[]};
  const sets={sincos:new Map(),atan:new Map(),atan2:new Map(),rem:new Map()};
  const add=(fn,set,args)=>{const key=args.join(' ');if(!sets[fn].has(key))sets[fn].set(key,set);};
  // sin, cos
  const special=['0000000000000000','0000000000000001','000fffffffffffff','0010000000000000','3e3fffffffffffff','3e40000000000000',
    '3fd3333300000000','3fd33332ffffffff','3fe8ffffffffffff','3fe9000000000000','3fe9000000000001','3fe921fb54442d18','3fe921fbffffffff',
    '3fe921fc00000000','3ff0000000000000','3ff921fb00000000','3ff921fb54442d17','3ff921fb54442d18','3ff921fb54442d19','3ff921fbffffffff',
    '4002d97bffffffff','4002d97c00000000','4002d97c7f3321d2','400921fb54442d18','401921fb54442d18','413921fb54442d18','413921fbffffffff',
    '413921fc00000000','4130000000000000','41d0000000000000','4330000000000000','4340000000000000',bits(1e22),bits(1e300),
    '7506ac5b262ca1ff','7fefffffffffffff','7ff0000000000000','7ff8000000000000'];
  for(const h of special){add('sincos','special',[h]);add('sincos','special',[neg(h)]);}
  const next=mulberry32(0x5eed01);
  for(let k=1;k<=40;k++){const h=bits(k*1.5707963267948966);for(const d of [-1,0,1]){add('sincos','pio2-multiple',[step(h,d)]);add('rem','pio2-multiple',[step(h,d)]);}add('sincos','pio2-multiple',[neg(h)]);}
  const npio2hw=[0x3FF921FB,0x400921FB,0x4012D97C,0x401921FB,0x401F6A7A,0x4022D97C,0x4025FDBB,0x402921FB,0x402C463A,0x402F6A7A,0x4031475C,0x4032D97C,0x40346B9C,0x4035FDBB,0x40378FDB,0x403921FB,0x403AB41B,0x403C463A,0x403DD85A,0x403F6A7A,0x40407E4C,0x4041475C,0x4042106C,0x4042D97C,0x4043A28C,0x40446B9C,0x404534AC,0x4045FDBB,0x4046C6CB,0x40478FDB,0x404858EB,0x404921FB];
  for(const hw of npio2hw){const h=words(hw,next());add('sincos','npio2-high-word',[h]);add('rem','npio2-high-word',[h]);}
  for(let i=0;i<40;i++){const k=1+next()%524288,h=bits(k*1.5707963267948966);add('sincos','pio2-multiple-medium',[h]);add('rem','pio2-multiple-medium',[step(h,1)]);}
  for(let i=0;i<400;i++){let h;do h=randomDouble(next,1023-30,1023+19);while(parseInt(h.slice(0,8),16)%0x80000000>0x413921fb);add('sincos','random-medium',[h]);if(i<60)add('rem','random-medium',[h]);}
  for(let i=0;i<60;i++)add('sincos','random-tiny',[randomDouble(next,0,1023-31)]);
  for(let i=0;i<200;i++){const h=randomDouble(next,1023+20,2046);add('sincos','random-large',[h]);add('rem','random-large',[h]);}
  add('rem','special',['7506ac5b262ca1ff']);add('rem','special',[neg('7506ac5b262ca1ff')]);add('rem','special',['7fefffffffffffff']);
  for(let i=0;i<1800;i+=12)add('sincos','driver',[bits(i/90)]);
  for(const i of harvest.driver)add('sincos','driver-divergent',[bits(i/90)]);
  for(const fn of ['sin','cos'])for(const a of harvest[fn].slice(0,100))add('sincos','world-divergent',a);
  // atan
  const atanSpecial=['0000000000000000','0000000000000001','000fffffffffffff','0010000000000000','3e3fffffffffffff','3e40000000000000',
    '3fdbffffffffffff','3fdc000000000000','3fe5ffffffffffff','3fe6000000000000','3ff2ffffffffffff','3ff3000000000000','40037fffffffffff',
    '4003800000000000','440fffffffffffff','4410000000000000','3fe0000000000000','3ff0000000000000','3ff8000000000000',bits(1e300),
    '7fefffffffffffff','7ff0000000000000','7ff8000000000000'];
  for(const h of atanSpecial){add('atan','special',[h]);add('atan','special',[neg(h)]);}
  for(let i=0;i<400;i++)add('atan','random',[randomDouble(next,1023-35,1023+70)]);
  for(const a of harvest.atan.slice(0,100))add('atan','world-divergent',a);
  // atan2
  const grid=['0000000000000000','0000000000000001',bits(1e-300),'3fe0000000000000','3ff0000000000000','4004000000000000',bits(1e300),'7ff0000000000000'];
  const gridAll=[...grid,...grid.map(neg),'7ff8000000000000'];
  for(const y of gridAll)for(const x of gridAll)add('atan2','special',[y,x]);
  for(const [y,x] of [[bits(1e20),bits(-1)],[bits(-1e20),bits(-1)],[bits(1e-20),bits(-1)],[bits(-1e-20),bits(-1)],[bits(1e20),bits(1)],[bits(1e-20),bits(1)],[bits(2**61),bits(-1)],[bits(2**-61),bits(-1)]])add('atan2','k-limits',[y,x]);
  for(let i=0;i<300;i++)add('atan2','random',[randomDouble(next,1023-40,1023+40),randomDouble(next,1023-40,1023+40)]);
  for(let i=0;i<60;i++){const x=randomDouble(next,1023-10,1023+10),y=bits(val(x)*(1+((next()%2001)-1000)*1e-6)*((next()&1)?-1:1));add('atan2','near-diagonal',[y,x]);}
  for(const a of harvest.atan2.slice(0,100))add('atan2','world-divergent',a);
  return {sets,harvest};
}

// ------------------------------------------------------------------ witness
// Contraction of each compiler's default: clang -ffp-contract=on, gcc =fast.
// gcc also gets =on, reported against =off (gcc 13 implements =on as =off).
const COMPILERS={clang:{contracted:'on',extra:[]},gcc:{contracted:'fast',extra:['on']}};
function compile(work,cc='clang'){
  const spec=COMPILERS[cc];
  if(!spec)throw new Error('--cc must be clang or gcc');
  const out={cc,version:execFileSync(cc,['--version']).toString().split('\n')[0],off:'off',contracted:spec.contracted,extra:spec.extra,bin:{}};
  for(const mode of ['off',spec.contracted,...spec.extra]){
    out.bin[mode]=join(work,`fdlibm-v8-${cc}-${mode}`);
    execFileSync(cc,['-O2','-ffp-contract='+mode,'-o',out.bin[mode],join(here,'fdlibm-v8.c'),'-lm']);
  }
  out.flags=Object.fromEntries(Object.keys(out.bin).map(mode=>[mode,`${cc} -O2 -ffp-contract=${mode}`]));
  return out;
}
function runWitness(binary,lines){
  const out=execFileSync(binary,{input:lines.join('\n')+'\n',maxBuffer:1<<30}).toString().trim().split('\n');
  if(out.length!==lines.length)throw new Error('witness output length mismatch: '+binary);
  return out;
}
function workDir(work,prefix){if(work){mkdirSync(work,{recursive:true});return work;}return mkdtempSync(join(tmpdir(),prefix));}
function compilerReport(bin){return {cc:bin.cc,version:bin.version,flags:bin.flags,off:'-ffp-contract=off',contracted:'-ffp-contract='+bin.contracted};}
// SHA-256, per function, of the inputs and of each column of results, in the
// sorted order of the input lines: two machines that saw the same inputs can
// then be compared result by result from their reports alone.
function resultDigests(lines,columns){
  const order=lines.map((_,i)=>i).sort((a,b)=>lines[a]<lines[b]?-1:lines[a]>lines[b]?1:0),out={};
  for(const i of order){
    const fn=lines[i].slice(0,lines[i].indexOf(' ')),h=out[fn]??=Object.fromEntries(['inputs',...Object.keys(columns)].map(k=>[k,createHash('sha256')]));
    h.inputs.update(lines[i]+'\n');for(const [k,col] of Object.entries(columns))h[k].update(col[i]+'\n');
  }
  return Object.fromEntries(Object.entries(out).map(([fn,h])=>[fn,Object.fromEntries(Object.entries(h).map(([k,v])=>[k,v.digest('hex')]))]));
}

// ------------------------------------------------------------------ vectors
// The table header names the compiler of the reference run (clang -O2
// -ffp-contract=off). It is fixed text: gcc -ffp-contract=off must give the same
// rows, so the file is identical whatever --cc is (identicalToExisting).
const HEADER=['# FMath reference vectors (lot 01 suite / T1). Generated by docs/chantier-moteur/preuves/lot-01s/t1/gen-vectors.mjs.',
  '# Expected bits come from docs/chantier-moteur/preuves/lot-01s/t1/fdlibm-v8.c (V8 fdlibm) compiled with clang -O2',
  '# -ffp-contract=off, i.e. without fused multiply-add; never from a host Math. IEEE-754 bit patterns in hexadecimal.',
  '#   sincos X SIN COS | atan X R | atan2 Y X R | rem X N Y0 Y1 (__ieee754_rem_pio2) ; "nan" = any NaN'];
const rowsOf=text=>text.split('\n').filter(line=>line&&!line.startsWith('#')).join('\n');

function vectors({write=false,work,report,cc='clang'}={}){
  const bin=compile(workDir(work,'fmath-witness-'),cc),{sets,harvest}=inputs(),F=loadFMath();
  // Requests: every table line, plus the full audit driver and every harvested input (report only).
  const requests=[];
  for(const [key,set] of sets.sincos){requests.push({fn:'sin',args:[key],set,table:true});requests.push({fn:'cos',args:[key],set,table:true});}
  for(const [key,set] of sets.atan)requests.push({fn:'atan',args:[key],set,table:true});
  for(const [key,set] of sets.atan2)requests.push({fn:'atan2',args:key.split(' '),set,table:true});
  for(const [key,set] of sets.rem)requests.push({fn:'rem',args:[key],set,table:true});
  for(let i=0;i<1800;i++)requests.push({fn:'sin',args:[bits(i/90)],set:'driver-all'});
  for(const fn of ['sin','cos','atan','atan2'])for(const a of harvest[fn])requests.push({fn,args:a,set:'world-divergent-all'});
  const lines=requests.map(r=>r.fn+' '+r.args.join(' ')),off=runWitness(bin.bin.off,lines),contracted=runWitness(bin.bin[bin.contracted],lines);
  const extra=Object.fromEntries(bin.extra.map(mode=>[mode,runWitness(bin.bin[mode],lines)]));
  // Table
  const rows=[],stats={},bySincos=new Map();
  const zero=()=>({cases:0,witnessContractedEqHost:0,witnessOffEqFMath:0,witnessOffEqHost:0,witnessContractedEqWitnessOff:0});
  requests.forEach((r,i)=>{
    if(r.fn==='rem')return;
    const args=r.args.map(val),host=nanify(bits(Math[r.fn](...args))),port=nanify(bits(F[r.fn](...args))),o=nanify(off[i]),c=nanify(contracted[i]);
    const s=(stats[r.fn]??={})[r.set]??=zero();
    s.cases++;if(c===host)s.witnessContractedEqHost++;if(o===port)s.witnessOffEqFMath++;if(o===host)s.witnessOffEqHost++;if(c===o)s.witnessContractedEqWitnessOff++;
    if(r.table&&(r.fn==='sin'||r.fn==='cos')){const k=r.args[0],e=bySincos.get(k)||{};e[r.fn]=o;bySincos.set(k,e);}
  });
  for(const [k,e] of bySincos)rows.push(`sincos ${k} ${e.sin} ${e.cos}`);
  requests.forEach((r,i)=>{
    if(!r.table||r.fn==='sin'||r.fn==='cos')return;
    if(r.fn==='rem'){const [n,y0,y1]=off[i].split(' ');rows.push(`rem ${r.args[0]} ${n} ${y0} ${y1}`);}
    else rows.push(`${r.fn} ${r.args.join(' ')} ${nanify(off[i])}`);
  });
  const text=HEADER.join('\n')+'\n'+rows.join('\n')+'\n';
  const existing=existsSync(table)?readFileSync(table,'utf8'):null;
  if(write)writeFileSync(table,text);
  // rem: witness agreement only (FMath does not export its reduction; checks/fmath.test.mjs reaches it).
  const remStats={cases:0,witnessContractedEqWitnessOff:0};
  requests.forEach((r,i)=>{if(r.fn==='rem'){remStats.cases++;if(contracted[i]===off[i])remStats.witnessContractedEqWitnessOff++;}});
  const totals={};
  for(const [fn,bySet] of Object.entries(stats)){const t=totals[fn]=zero();for(const s of Object.values(bySet))for(const k in t)t[k]+=s[k];}
  const all={cases:0,witnessContractedEqHost:0,witnessOffEqFMath:0,witnessOffEqHost:0};for(const t of Object.values(totals))for(const k in all)all[k]+=t[k];
  const extraModes=Object.fromEntries(Object.entries(extra).map(([mode,out])=>[mode,{flags:bin.flags[mode],cases:lines.length,equalToOff:out.filter((v,i)=>normal(v)===normal(off[i])).length,equalToContracted:out.filter((v,i)=>normal(v)===normal(contracted[i])).length}]));
  const result={schema:'metal-fmath-witness-v2',node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,compiler:compilerReport(bin),
    table:{path:'checks/fmath-vectors.txt',lines:rows.length,bytes:Buffer.byteLength(text),written:write,identicalToExisting:existing===text,rowsIdenticalToExisting:existing!==null&&rowsOf(existing)===rowsOf(text),counts:{sincos:bySincos.size,atan:sets.atan.size,atan2:sets.atan2.size,rem:sets.rem.size}},
    all,totals,bySet:stats,rem:remStats,extraModes};
  if(report)writeFileSync(report,JSON.stringify(result,null,1)+'\n');
  return result;
}

// ------------------------------------------------------------------ exhaustive
async function exhaustive({cc='clang',path='fmath',work,report}={}){
  if(!['fmath','host'].includes(path))throw new Error('--path must be fmath or host');
  const {loadRealm}=await import(join(root,'tools/realm-loader.mjs')),{worldList}=await import(join(root,'tools/platform-math.mjs'));
  const F=loadRealm({root,modules:['fmath']}).window.FMath,seen={sin:new Set(),cos:new Set(),atan:new Set(),atan2:new Set()};
  const M=Object.create(Math);
  for(const name of ['sin','cos','atan']){const host=Math[name],port=F[name],keys=seen[name];M[name]=x=>{keys.add(bits(x));return path==='host'?host(x):port(x);};}
  {const host=Math.atan2,port=F.atan2,keys=seen.atan2;M.atan2=(y,x)=>{keys.add(bits(y)+' '+bits(x));return path==='host'?host(y,x):port(y,x);};}
  const t0=performance.now(),W=loadRealm({root,modules:['world'],globals:{Math:M}}).window.FWorld,list=worldList();
  for(const w of list)W.create(w.seed,w.index,w.options&&{...w.options});
  const generationMs=performance.now()-t0,lines=[];
  for(const [fn,keys] of Object.entries(seen))for(const key of keys)lines.push(fn+' '+key);
  const bin=compile(workDir(work,'fmath-exhaustive-'),cc),t1=performance.now();
  const off=runWitness(bin.bin.off,lines),contracted=runWitness(bin.bin[bin.contracted],lines),extra=Object.fromEntries(bin.extra.map(mode=>[mode,runWitness(bin.bin[mode],lines)]));
  const witnessMs=performance.now()-t1,res={},firstFMathMismatches=[],firstHostMismatches=[],hostColumn=[],fmathColumn=[];
  lines.forEach((line,i)=>{
    const [fn,...a]=line.split(' '),args=a.map(val),host=nanify(bits(Math[fn](...args))),port=nanify(bits(F[fn](...args))),o=nanify(off[i]),c=nanify(contracted[i]);
    hostColumn.push(host);fmathColumn.push(port);
    const r=res[fn]??={distinct:0,fmathEqOff:0,hostEqContracted:0,hostEqOff:0,offEqContracted:0,hostEqFMath:0,...Object.fromEntries(bin.extra.map(mode=>[mode+'EqOff',0]))};
    r.distinct++;
    if(port===o)r.fmathEqOff++;else if(firstFMathMismatches.length<20)firstFMathMismatches.push({input:line,fmath:port,off:o});
    if(host===c)r.hostEqContracted++;else if(firstHostMismatches.length<20)firstHostMismatches.push({input:line,host,contracted:c});
    if(host===o)r.hostEqOff++;if(o===c)r.offEqContracted++;if(host===port)r.hostEqFMath++;
    for(const mode of bin.extra)if(nanify(extra[mode][i])===o)r[mode+'EqOff']++;
  });
  const total={};for(const r of Object.values(res))for(const [k,v] of Object.entries(r))total[k]=(total[k]||0)+v;
  const result={schema:'metal-fmath-exhaustive-v1',node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,compiler:compilerReport(bin),
    path,note:'Every distinct input (IEEE-754 bit pattern, so -0 and 0 differ) of sin, cos, atan and atan2 during the generation of the worlds below, with src/world.js using FMath (path fmath) or the host Math (path host). NaN results are compared as one NaN. Counts only; the inputs are never written.',
    worlds:{count:list.length,legacySeeds:[1,96],campaignSeeds:[1,96,2026],kinds:{legacy:list.filter(w=>w.kind==='legacy').length,v1:list.filter(w=>w.kind==='v1').length,v2:list.filter(w=>w.kind==='v2').length}},
    distinctInputs:lines.length,ms:{generation:Math.round(generationMs),witness:Math.round(witnessMs)},res,total,
    digests:resultDigests(lines,{fmath:fmathColumn,host:hostColumn,off:off.map(nanify),contracted:contracted.map(nanify)}),firstFMathMismatches,firstHostMismatches};
  if(report)writeFileSync(report,JSON.stringify(result,null,1)+'\n');
  return result;
}

// ------------------------------------------------------------------ sweep
// Seeded random inputs over the whole double range, by argument class, so that
// FMath and the host are compared with the witnesses far beyond the inputs of
// the worlds (huge arguments of __kernel_rem_pio2, cancellations near n*pi/2,
// subnormals, special values). Counts only.
function sweepInputs(count,seed){
  const next=mulberry32(seed),lines=[],classes=[],any=()=>words(next(),next());
  const near=(k,d)=>step(bits(k*1.5707963267948966),d);
  const plan={
    sin:[['medium',.4,()=>randomDouble(next,1023-30,1023+19)],['large',.3,()=>randomDouble(next,1023+20,2046)],['near-pio2',.1,()=>near(1+next()%1048576,(next()%9)-4)],['tiny',.1,()=>randomDouble(next,0,1023-31)],['any-bits',.1,any]],
    atan:[['moderate',.7,()=>randomDouble(next,1023-40,1023+80)],['tiny-or-huge',.1,()=>next()&1?randomDouble(next,0,1023-41):randomDouble(next,1023+81,2046)],['any-bits',.2,any]],
    atan2:[['moderate',.6,()=>randomDouble(next,1023-60,1023+60)+' '+randomDouble(next,1023-60,1023+60)],['near-diagonal',.1,()=>{const x=randomDouble(next,1023-20,1023+20);return bits(val(x)*(1+((next()%2001)-1000)*1e-9)*(next()&1?-1:1))+' '+x;}],['wide',.1,()=>randomDouble(next,0,2046)+' '+randomDouble(next,0,2046)],['any-bits',.2,()=>any()+' '+any()]],
  };
  plan.cos=plan.sin;
  for(const fn of ['sin','cos','atan','atan2'])for(const [name,share,make] of plan[fn]){
    const n=Math.round(count*share);
    for(let i=0;i<n;i++){lines.push(fn+' '+make());classes.push(fn+':'+name);}
  }
  return {lines,classes};
}
function sweep({cc='clang',count=500000,seed=0x5eed03,work,report}={}){
  const F=loadFMath(),{lines,classes}=sweepInputs(count,seed),bin=compile(workDir(work,'fmath-sweep-'),cc),t0=performance.now();
  const off=runWitness(bin.bin.off,lines),contracted=runWitness(bin.bin[bin.contracted],lines),witnessMs=performance.now()-t0;
  const res={},byClass={},firstFMathMismatches=[],firstHostMismatches=[],hostColumn=[],fmathColumn=[];
  const zero=()=>({cases:0,fmathEqOff:0,hostEqContracted:0,hostEqOff:0,offEqContracted:0});
  lines.forEach((line,i)=>{
    const [fn,...a]=line.split(' '),args=a.map(val),host=nanify(bits(Math[fn](...args))),port=nanify(bits(F[fn](...args))),o=nanify(off[i]),c=nanify(contracted[i]);
    hostColumn.push(host);fmathColumn.push(port);
    for(const r of [res[fn]??=zero(),byClass[classes[i]]??=zero()]){r.cases++;if(port===o)r.fmathEqOff++;if(host===c)r.hostEqContracted++;if(host===o)r.hostEqOff++;if(o===c)r.offEqContracted++;}
    if(port!==o&&firstFMathMismatches.length<20)firstFMathMismatches.push({input:line,fmath:port,off:o});
    if(host!==c&&firstHostMismatches.length<20)firstHostMismatches.push({input:line,host,contracted:c});
  });
  const total=zero();for(const r of Object.values(res))for(const k in total)total[k]+=r[k];
  const result={schema:'metal-fmath-sweep-v1',node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,compiler:compilerReport(bin),
    seed,countPerFunction:count,note:'Seeded random inputs (mulberry32) by argument class; cos uses the classes of sin. NaN results are compared as one NaN. Counts only; the inputs are regenerated from the seed, never written.',
    ms:{witness:Math.round(witnessMs)},res,byClass,total,digests:resultDigests(lines,{fmath:fmathColumn,host:hostColumn,off:off.map(nanify),contracted:contracted.map(nanify)}),firstFMathMismatches,firstHostMismatches};
  if(report)writeFileSync(report,JSON.stringify(result,null,1)+'\n');
  return result;
}

function harvestCensus(file){
  const census=JSON.parse(readFileSync(file,'utf8')),F=loadFMath(),out={source:'tools/platform-math.mjs census on '+census.environment.platform+'-'+census.environment.arch+' Node '+census.environment.node+' (inputs only)',driver:[]};
  for(const fn of ['sin','cos','atan','atan2'])out[fn]=(census.divergentSamples[fn]||[]).map(d=>d.args);
  for(let i=0;i<1800;i++)if(!Object.is(Math.sin(i/90),F.sin(i/90)))out.driver.push(i);
  writeFileSync(harvestFile,JSON.stringify(out)+'\n');
  return {file:harvestFile,counts:Object.fromEntries(['sin','cos','atan','atan2','driver'].map(k=>[k,out[k].length]))};
}

const [command,...rest]=process.argv.slice(2);
const flag=name=>{const i=rest.indexOf(name);if(i<0)return undefined;if(i+1>=rest.length||rest[i+1].startsWith('--'))throw new Error('missing value for '+name);return rest[i+1];};
if(command==='harvest')console.log(JSON.stringify(harvestCensus(rest[0])));
else if(command==='vectors'){
  const r=vectors({write:rest.includes('--write'),work:flag('--work'),report:flag('--report'),cc:flag('--cc')});
  console.log(JSON.stringify({compiler:r.compiler,table:r.table,all:r.all,rem:r.rem,extraModes:r.extraModes,totals:r.totals},null,1));
  if(!rest.includes('--write')&&!r.table.identicalToExisting)process.exitCode=1;
}else if(command==='exhaustive'){
  const report=flag('--report');if(!report)throw new Error('--report is required');
  const r=await exhaustive({cc:flag('--cc'),path:flag('--path'),work:flag('--work'),report});
  console.log(JSON.stringify({compiler:r.compiler,path:r.path,distinctInputs:r.distinctInputs,ms:r.ms,res:r.res,firstFMathMismatches:r.firstFMathMismatches.length,firstHostMismatches:r.firstHostMismatches.length}));
  if(r.total.fmathEqOff!==r.distinctInputs)process.exitCode=1;
}else if(command==='sweep'){
  const report=flag('--report');if(!report)throw new Error('--report is required');
  const r=sweep({cc:flag('--cc'),count:flag('--count')?Number(flag('--count')):undefined,seed:flag('--seed')?Number(flag('--seed')):undefined,work:flag('--work'),report});
  console.log(JSON.stringify({compiler:r.compiler,seed:r.seed,countPerFunction:r.countPerFunction,ms:r.ms,res:r.res,total:r.total,firstFMathMismatches:r.firstFMathMismatches.length,firstHostMismatches:r.firstHostMismatches.length}));
  if(r.total.fmathEqOff!==r.total.cases)process.exitCode=1;
}else{console.log('Usage: gen-vectors.mjs harvest <census.json> | vectors [--cc clang|gcc] [--write] [--work DIR] [--report FILE] | exhaustive [--cc clang|gcc] [--path fmath|host] [--work DIR] --report FILE | sweep [--cc clang|gcc] [--count N] [--seed S] [--work DIR] --report FILE');process.exitCode=2;}
