// Lot 01 suite / T1 — branch coverage of the argument reductions of src/fmath.js
// by the reference vectors (checks/fmath-vectors.txt). An in-memory copy of FMath
// receives one counter per branch; src/ is never modified.
//   node docs/chantier-moteur/preuves/lot-01s/t1/branch-coverage.mjs
import {readFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..');
const source=readFileSync(join(root,'src/fmath.js'),'utf8');
const marks=[ // [counter, unique anchor, instrumented replacement]
  ['mediumSecondIteration','t=r;w=fn*pio2_2;','C.mediumSecondIteration++;t=r;w=fn*pio2_2;'],
  ['mediumThirdIteration','t=r;w=fn*pio2_3;','C.mediumThirdIteration++;t=r;w=fn*pio2_3;'],
  ['nearPlusPio2','else{z-=pio2_2;y0=z-pio2_2t;','else{C.nearPlusPio2++;z-=pio2_2;y0=z-pio2_2t;'],
  ['nearMinusPio2','else{z+=pio2_2;y0=z+pio2_2t;','else{C.nearMinusPio2++;z+=pio2_2;y0=z+pio2_2t;'],
  ['largeZeroTermSkipped','while(tx[nx-1]===0)nx--;','while(tx[nx-1]===0){C.largeZeroTermSkipped++;nx--;}'],
  ['remQ0Positive','i=iq[jz-1]>>(24-q0);n+=i;','C.remQ0Positive++;i=iq[jz-1]>>(24-q0);n+=i;'],
  ['remQ0Zero','else if(q0===0)ih=iq[jz-1]>>23;','else if(q0===0){C.remQ0Zero++;ih=iq[jz-1]>>23;}'],
  ['remIh2','if(ih===2){z=1-z;','if(ih===2){C.remIh2++;z=1-z;'],
  ['remCarryScalbn','if(carry!==0)z-=scalbn(1,q0);','if(carry!==0){C.remCarryScalbn++;z-=scalbn(1,q0);}'],
  ['remMaskQ0Is1','if(q0===1)iq[jz-1]&=0x7fffff;','if(q0===1){C.remMaskQ0Is1++;iq[jz-1]&=0x7fffff;}'],
  ['remMaskQ0Is2','else if(q0===2)iq[jz-1]&=0x3fffff;','else if(q0===2){C.remMaskQ0Is2++;iq[jz-1]&=0x3fffff;}'],
  ['remRecompute','jz+=k;\n          continue;','C.remRecompute++;if(k>1)C.remRecomputeSeveralTerms++;jz+=k;\n          continue;'],
  ['remChopZeroTerms','jz-=1;q0-=24;\n      while','C.remChopZeroTerms++;jz-=1;q0-=24;\n      while'],
  ['remChopLoop','while(iq[jz]===0){jz--;q0-=24;}','while(iq[jz]===0){C.remChopLoop++;jz--;q0-=24;}'],
  ['remBreakInto24Bits','if(z>=two24){','if(z>=two24){C.remBreakInto24Bits++;'],
  ['atan2KOver60','if(k>60){','if(k>60){C.atan2KOver60++;'],
  ['atan2KUnderMinus60','else if(hx<0&&k< -60)z=0;','else if(hx<0&&k< -60){C.atan2KUnderMinus60++;z=0;}'],
];
let text=source;
for(const [,anchor,replacement] of marks){if(text.split(anchor).length!==2)throw new Error('anchor not unique: '+anchor);text=text.replace(anchor,replacement);}
const C=Object.fromEntries(marks.map(m=>[m[0],0]));C.remRecomputeSeveralTerms=0;
const window={};new Function('window','C',text)(window,C);
const F=window.FMath,f64=new Float64Array(1),u64=new BigUint64Array(f64.buffer),val=h=>{u64[0]=BigInt('0x'+h);return f64[0];};
for(const v of readFileSync(join(root,'checks/fmath-vectors.txt'),'utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(' '))){
  if(v[0]==='sincos'||v[0]==='rem'){F.sin(val(v[1]));F.cos(val(v[1]));}
  else if(v[0]==='atan')F.atan(val(v[1]));
  else if(v[0]==='atan2')F.atan2(val(v[1]),val(v[2]));
}
const missing=Object.entries(C).filter(([,n])=>n===0).map(([k])=>k);
console.log(JSON.stringify({schema:'metal-fmath-branch-coverage-v1',counters:C,missing},null,1));
if(missing.length)process.exitCode=1;
