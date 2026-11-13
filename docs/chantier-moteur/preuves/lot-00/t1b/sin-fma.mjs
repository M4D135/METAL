// Lot 00 / T1b — pourquoi reference-check échoue sur arm64 : le Math.sin de V8 est-il le fdlibm
// évalué avec ou sans FMA ? Compare Math.sin(i/90), l'entrée du pilote de tools/proof/scenarios.mjs,
// au noyau __kernel_sin de fdlibm (V8 src/base/ieee754.cc) évalué de deux façons, pour i = 1..70
// (x < pi/4, aucune réduction d'argument) :
// - sans FMA : arithmétique double ordinaire de JavaScript, comme un x86-64 de base ;
// - avec FMA : les contractions que clang -ffp-contract=on fait sur arm64, la multiplication-addition
//   fusionnée étant calculée exactement en BigInt puis arrondie une seule fois.
// Usage : node docs/chantier-moteur/preuves/lot-00/t1b/sin-fma.mjs > sin-fma.json
const S1=-1.66666666666666324348e-01,S2=8.33333333332248946124e-03,S3=-1.98412698298579493134e-04,
  S4=2.75573137070700676789e-06,S5=-2.50507602534068634195e-08,S6=1.58969099521155010221e-10;
const view=new DataView(new ArrayBuffer(8));
function parts(d){ // d = m * 2^e exactement, m entier signé
  view.setFloat64(0,d);const hi=view.getUint32(0),lo=view.getUint32(4),exp=(hi>>>20)&0x7ff;
  let m=(BigInt(hi&0xfffff)<<32n)|BigInt(lo),e;if(exp===0)e=-1074;else{m|=1n<<52n;e=exp-1075;}
  return {m:hi>>>31?-m:m,e};
}
function fma(a,b,c){ // a*b+c exact, un seul arrondi au plus proche (Number(BigInt) arrondit au plus proche pair)
  const A=parts(a),B=parts(b),C=parts(c),pe=A.e+B.e,E=Math.min(pe,C.e);
  return Number((A.m*B.m<<BigInt(pe-E))+(C.m<<BigInt(C.e-E)))*2**E;
}
const plain=x=>{const z=x*x,v=z*x,r=S2+z*(S3+z*(S4+z*(S5+z*S6)));return x+v*(S1+z*r);};
const fused=x=>{const z=x*x,v=z*x,r=fma(z,fma(z,fma(z,fma(z,S6,S5),S4),S3),S2);return fma(v,fma(z,r,S1),x);};
const differences=[];let firstNoFma=null,firstFma=null;
for(let i=1;i<=70;i++){
  const x=i/90,native=Math.sin(x),p=plain(x),f=fused(x);
  if(p!==native&&firstNoFma===null)firstNoFma=i;
  if(f!==native&&firstFma===null)firstFma=i;
  if(p!==native||f!==native)differences.push({i,mathSin:native,withoutFma:p,withFma:f});
}
console.log(JSON.stringify({schema:'metal-t1b-sin-fma-v1',node:process.version,v8:process.versions.v8,arch:process.arch,platform:process.platform,
  inputs:'Math.sin(i/90), i = 1..70',
  mathSinEqualsFmaEvaluation:differences.every(d=>d.withFma===d.mathSin),
  firstIndexWhereEvaluationWithoutFmaDiffers:firstNoFma,firstIndexWhereEvaluationWithFmaDiffers:firstFma,differences},null,2));
