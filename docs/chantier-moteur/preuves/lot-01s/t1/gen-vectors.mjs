// Lot 01 suite / T1 — FMath reference vectors from the C witness (fdlibm-v8.c).
//
//   node docs/chantier-moteur/preuves/lot-01s/t1/gen-vectors.mjs harvest <census.json>
//       keeps the inputs where the host Math differed from FMath during world
//       generation (tools/platform-math.mjs census) and in the audit driver, in
//       mac-divergent-inputs.json next to this script (inputs only, never results).
//   node docs/chantier-moteur/preuves/lot-01s/t1/gen-vectors.mjs vectors [--write] [--work DIR] [--report FILE]
//       compiles fdlibm-v8.c twice (clang -O2, -ffp-contract=off and =on), builds a
//       deterministic input set, and writes (--write) or checks checks/fmath-vectors.txt.
//       Expected values always come from the -ffp-contract=off witness, never from a
//       host Math. The report compares, per function and input set, the =on witness
//       with this host's Math.* and the =off witness with FMath.
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..'),table=join(root,'checks/fmath-vectors.txt'),harvestFile=join(here,'mac-divergent-inputs.json');
const f64=new Float64Array(1),u64=new BigUint64Array(f64.buffer);
const bits=x=>{f64[0]=x;return u64[0].toString(16).padStart(16,'0');};
const val=h=>{u64[0]=BigInt('0x'+h);return f64[0];};
const step=(h,k)=>(BigInt('0x'+h)+BigInt(k)).toString(16).padStart(16,'0'); // neighbour by k ulps (same sign)
const neg=h=>(BigInt('0x'+h)^(1n<<63n)).toString(16).padStart(16,'0');
const words=(hi,lo)=>(hi>>>0).toString(16).padStart(8,'0')+(lo>>>0).toString(16).padStart(8,'0');
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
function compile(work){
  const out={};
  for(const mode of ['off','on']){out[mode]=join(work,'fdlibm-v8-'+mode);execFileSync('clang',['-O2','-ffp-contract='+mode,'-o',out[mode],join(here,'fdlibm-v8.c'),'-lm']);}
  out.clang=execFileSync('clang',['--version']).toString().split('\n')[0];
  return out;
}
function runWitness(binary,lines){return execFileSync(binary,{input:lines.join('\n')+'\n',maxBuffer:1<<28}).toString().trim().split('\n');}
const nanify=h=>{const v=val(h);return v!==v?'nan':h;};

function vectors({write=false,work,report}={}){
  if(work)mkdirSync(work,{recursive:true});else work=mkdtempSync(join(tmpdir(),'fmath-witness-'));
  const bin=compile(work),{sets,harvest}=inputs(),F=loadFMath();
  // Requests: every table line, plus the full audit driver and every harvested input (report only).
  const requests=[];
  for(const [key,set] of sets.sincos){requests.push({fn:'sin',args:[key],set,table:true});requests.push({fn:'cos',args:[key],set,table:true});}
  for(const [key,set] of sets.atan)requests.push({fn:'atan',args:[key],set,table:true});
  for(const [key,set] of sets.atan2)requests.push({fn:'atan2',args:key.split(' '),set,table:true});
  for(const [key,set] of sets.rem)requests.push({fn:'rem',args:[key],set,table:true});
  for(let i=0;i<1800;i++)requests.push({fn:'sin',args:[bits(i/90)],set:'driver-all'});
  for(const fn of ['sin','cos','atan','atan2'])for(const a of harvest[fn])requests.push({fn,args:a,set:'world-divergent-all'});
  const lines=requests.map(r=>r.fn+' '+r.args.join(' ')),off=runWitness(bin.off,lines),on=runWitness(bin.on,lines);
  if(off.length!==requests.length||on.length!==requests.length)throw new Error('witness output length mismatch');
  // Table
  const rows=[],stats={};
  const bySincos=new Map();
  requests.forEach((r,i)=>{
    if(r.fn==='rem')return;
    const args=r.args.map(val),host=bits(Math[r.fn](...args)),port=bits(F[r.fn](...args)),o=nanify(off[i]),n=nanify(on[i]);
    const s=(stats[r.fn]??={})[r.set]??={cases:0,witnessOnEqHost:0,witnessOffEqFMath:0,witnessOffEqHost:0,witnessOnEqWitnessOff:0};
    s.cases++;if(n===nanify(host))s.witnessOnEqHost++;if(o===nanify(port))s.witnessOffEqFMath++;if(o===nanify(host))s.witnessOffEqHost++;if(n===o)s.witnessOnEqWitnessOff++;
    if(r.table&&(r.fn==='sin'||r.fn==='cos')){const k=r.args[0],e=bySincos.get(k)||{};e[r.fn]=o;bySincos.set(k,e);}
  });
  const header=['# FMath reference vectors (lot 01 suite / T1). Generated by docs/chantier-moteur/preuves/lot-01s/t1/gen-vectors.mjs.',
    '# Expected bits come from docs/chantier-moteur/preuves/lot-01s/t1/fdlibm-v8.c (V8 fdlibm) compiled with clang -O2',
    '# -ffp-contract=off, i.e. without fused multiply-add; never from a host Math. IEEE-754 bit patterns in hexadecimal.',
    '#   sincos X SIN COS | atan X R | atan2 Y X R | rem X N Y0 Y1 (__ieee754_rem_pio2) ; "nan" = any NaN'];
  for(const [k,e] of bySincos)rows.push(`sincos ${k} ${e.sin} ${e.cos}`);
  requests.forEach((r,i)=>{
    if(!r.table||r.fn==='sin'||r.fn==='cos')return;
    if(r.fn==='rem'){const [n,y0,y1]=off[i].split(' ');rows.push(`rem ${r.args[0]} ${n} ${y0} ${y1}`);}
    else rows.push(`${r.fn} ${r.args.join(' ')} ${nanify(off[i])}`);
  });
  const text=header.join('\n')+'\n'+rows.join('\n')+'\n';
  const existing=existsSync(table)?readFileSync(table,'utf8'):null;
  if(write)writeFileSync(table,text);
  // rem: witness on/off agreement only (FMath does not export its reduction).
  const remStats={cases:0,witnessOnEqWitnessOff:0};
  requests.forEach((r,i)=>{if(r.fn==='rem'){remStats.cases++;if(on[i]===off[i])remStats.witnessOnEqWitnessOff++;}});
  const totals={};
  for(const [fn,bySet] of Object.entries(stats)){const t=totals[fn]={cases:0,witnessOnEqHost:0,witnessOffEqFMath:0,witnessOffEqHost:0,witnessOnEqWitnessOff:0};for(const s of Object.values(bySet))for(const k in t)t[k]+=s[k];}
  const all={cases:0,witnessOnEqHost:0,witnessOffEqFMath:0,witnessOffEqHost:0};for(const t of Object.values(totals))for(const k in all)all[k]+=t[k];
  const result={schema:'metal-fmath-witness-v1',node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,clang:bin.clang,
    table:{path:'checks/fmath-vectors.txt',lines:rows.length,bytes:Buffer.byteLength(text),written:write,identicalToExisting:existing===text,counts:{sincos:bySincos.size,atan:sets.atan.size,atan2:sets.atan2.size,rem:sets.rem.size}},
    all,totals,bySet:stats,rem:remStats};
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
const flag=name=>{const i=rest.indexOf(name);return i<0?undefined:rest[i+1];};
if(command==='harvest')console.log(JSON.stringify(harvestCensus(rest[0])));
else if(command==='vectors'){const r=vectors({write:rest.includes('--write'),work:flag('--work'),report:flag('--report')});console.log(JSON.stringify({table:r.table,all:r.all,rem:r.rem,totals:r.totals},null,1));if(!rest.includes('--write')&&!r.table.identicalToExisting)process.exitCode=1;}
else{console.log('Usage: gen-vectors.mjs harvest <census.json> | vectors [--write] [--work DIR] [--report FILE]');process.exitCode=2;}
