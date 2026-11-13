// Lot 01 suite / T1 — do the FMath tests catch real mistakes? Each mutation is
// applied to a copy of src/fmath.js in a temporary directory, next to copies of
// checks/fmath.test.mjs and checks/fmath-vectors.txt; the repository is untouched.
//   node docs/chantier-moteur/preuves/lot-01s/t1/mutation-check.mjs [work-dir]
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,copyFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..'),work=process.argv[2]?resolve(process.argv[2]):mkdtempSync(join(tmpdir(),'fmath-mutation-'));
mkdirSync(join(work,'src'),{recursive:true});mkdirSync(join(work,'checks'),{recursive:true});
for(const f of ['fmath.test.mjs','fmath-vectors.txt'])copyFileSync(join(root,'checks',f),join(work,'checks',f));
const original=readFileSync(join(root,'src/fmath.js'),'utf8');
const mutations=[
  ['none (control)',null,null],
  ['atan2 without "m &= 1"','z=pi_o_2+0.5*pi_lo;m&=1;','z=pi_o_2+0.5*pi_lo;'],
  ['last chunk of two_over_pi','0x60E27B,0xC08C6B]','0x60E27B,0xC08C6A]'],
  ['word order hard-coded little-endian','const HI=u32[1]===0x3ff00000?1:0,LO=1-HI;','const HI=1,LO=0;'],
  ['__kernel_cos without qx','const qx=ix>0x3fe90000?0.28125:words(ix-0x00200000,0);','const qx=0;'],
  ['S3 changed in its last digits','S3=-1.98412698298579493134e-04','S3=-1.98412698298579520000e-04'],
  ['__kernel_sin regrouped like a fused multiply-add','if(iy===0)return x+v*(S1+z*r);','if(iy===0)return x+(v*S1+v*(z*r));'],
  ['npio2_hw entry off by one','0x3FF921FB,0x400921FB,0x4012D97C','0x3FF921FB,0x400921FB,0x4012D97D'],
  ['atan threshold 2^-29 (fdlibm 5.3) instead of 2^-27','if(ix<0x3e400000)return x; /* |x| < 2^-27 */\n      id=-1;','if(ix<0x3e200000)return x;\n      id=-1;'],
  ['__kernel_rem_pio2 adds one term per recomputation','for(k=1;jk>=k&&iq[jk-k]===0;k++);','k=1;'],
];
// A mutant the tests miss is compared with the original on probe inputs aimed
// at the code it changes: is it really equivalent, or is the table too thin?
const load=(text,C)=>{const window={};new Function('window','C',text)(window,C||{});return window.FMath;};
const f64=new Float64Array(1),u64=new BigUint64Array(f64.buffer),bitsOf=x=>{f64[0]=x;return u64[0];};
let seed=0x5eed02;const rnd=()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
const probes={
  'atan threshold 2^-29 (fdlibm 5.3) instead of 2^-27':()=>{
    const xs=[];for(let e=-29;e<-27;e++){const p=2**e;xs.push(p,-p,p*(1-2**-53),-p*(1-2**-53));}
    for(let i=0;i<200000;i++){const x=2**(-29+2*rnd());xs.push(i&1?-x:x);}
    return {inputs:xs,run:(F,x)=>[F.atan(x),F.atan2(x,1.5)]};
  },
  '__kernel_rem_pio2 adds one term per recomputation':()=>{
    const xs=[6381956970095103*2**797,-6381956970095103*2**797]; // closest double to a multiple of pi/2 (J.-M. Muller)
    for(let i=0;i<200000;i++){const x=(1+rnd())*2**(20+Math.floor(rnd()*1003));xs.push(i&1?-x:x);}
    return {inputs:xs,run:(F,x)=>[F.sin(x),F.cos(x)],instrument:['jz+=k;\n          continue;','if(k>1)C.severalTerms++;jz+=k;\n          continue;']};
  },
};
const rows=[];
for(const [name,from,to] of mutations){
  let text=original;
  if(from!==null){if(text.split(from).length!==2)throw new Error('anchor not unique: '+name);text=text.replace(from,to);}
  writeFileSync(join(work,'src/fmath.js'),text);
  const run=spawnSync(process.execPath,['--test','--test-reporter=tap','checks/fmath.test.mjs'],{cwd:work,encoding:'utf8'});
  const failed=[...run.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map(m=>m[1]);
  const row={mutation:name,detected:failed.length>0,failingTests:failed};
  if(from!==null&&!row.detected&&probes[name]){
    const p=probes[name](),C={severalTerms:0};
    const base=load(p.instrument?original.replace(p.instrument[0],p.instrument[1]):original,C),mutant=load(text);
    let differences=0;const firstDifferences=[];
    for(const x of p.inputs){
      const a=p.run(base,x),b=p.run(mutant,x);
      if(a.some((v,i)=>bitsOf(v)!==bitsOf(b[i]))){differences++;if(firstDifferences.length<5)firstDifferences.push(x);}
    }
    row.equivalenceProbe={inputs:p.inputs.length,differences,firstDifferences};
    if(p.instrument)row.equivalenceProbe.inputsTakingSeveralTermsPath=C.severalTerms;
  }
  rows.push(row);
}
console.log(JSON.stringify({schema:'metal-fmath-mutation-check-v1',rows},null,1));
if(rows[0].detected||rows.slice(1).some(r=>!r.detected&&!(r.equivalenceProbe&&r.equivalenceProbe.differences===0)))process.exitCode=1;
