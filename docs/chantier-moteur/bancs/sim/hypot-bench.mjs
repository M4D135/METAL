// Math.hypot vs Math.sqrt (main realm).  usage: node gc-harness.mjs hypot-bench.mjs
// 1) calls per simulation step (Math.hypot wrapped while the sim runs; results unchanged), arity histogram, callers (sampled stacks)
// 2) ns/call and bytes/call: hypot(a,b) / hypot(a,b,c) / hypot(...v) vs sqrt forms, monomorphic loops over Float64Array inputs
// 3) bit-exactness: share of inputs where hypot(a,b) !== sqrt(a*a+b*b), max ulp distance
import {loadFast} from './fast.mjs';import {SCENARIOS,drive,makeInput,build,q,mean} from './lib.mjs';
const realHypot=Math.hypot;
{ const ctx=loadFast();let calls=0;const arity=new Map(),callers=new Map();let tick=0;
  Math.hypot=function(...a){calls++;arity.set(a.length,(arity.get(a.length)||0)+1);if((++tick&1023)===0){const l=(new Error().stack.split('\n')[2]||'').match(/at (\S+).*?simulation\.js:(\d+)/);if(l){const k=l[1]+':'+l[2];callers.set(k,(callers.get(k)||0)+1);}}return realHypot(...a);};
  for(const [label,idx,opts] of SCENARIOS){const {sim}=build(ctx,idx,opts),s=sim.state,input=makeInput();const per=[];
    for(let i=0;i<1800;i++){drive(i,input,s);calls=0;sim.step(1/60,input);s.events.length=0;per.push(calls);if(s.dead)break;}
    console.log('##'+label.padEnd(13)+' Math.hypot calls/step mean '+mean(per).toFixed(0)+' p50 '+q(per,.5)+' p99 '+q(per,.99)+' max '+Math.max(...per));}
  Math.hypot=realHypot;
  const tot=[...arity.values()].reduce((a,b)=>a+b,0);console.log('##arity share: '+[...arity].sort((a,b)=>a[0]-b[0]).map(([k,v])=>k+' args '+(100*v/tot).toFixed(1)+'%').join(', '));
  const ct=[...callers.values()].reduce((a,b)=>a+b,0);console.log('##top callers (1/1024 sampled): '+[...callers].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>k+' '+(100*v/ct).toFixed(0)+'%').join(', '));
}
const N=4e6,A=new Float64Array(N),B=new Float64Array(N),C=new Float64Array(N);let seed=12345;const rnd=()=>((seed=(seed*1103515245+12345)>>>0)/4294967296);
for(let i=0;i<N;i++){A[i]=(rnd()-.5)*400;B[i]=(rnd()-.5)*400;C[i]=(rnd()-.5)*40;}
const V=[0,0,0];
const kern={
  hypot2:new Function('A','B','C','V','n','let s=0;for(let i=0;i<n;i++)s+=Math.hypot(A[i],B[i]);return s;'),
  sqrt2:new Function('A','B','C','V','n','let s=0;for(let i=0;i<n;i++){const a=A[i],b=B[i];s+=Math.sqrt(a*a+b*b);}return s;'),
  hypot3:new Function('A','B','C','V','n','let s=0;for(let i=0;i<n;i++)s+=Math.hypot(A[i],B[i],C[i]);return s;'),
  sqrt3:new Function('A','B','C','V','n','let s=0;for(let i=0;i<n;i++){const a=A[i],b=B[i],c=C[i];s+=Math.sqrt(a*a+b*b+c*c);}return s;'),
  hypotSpread3:new Function('A','B','C','V','n','let s=0;for(let i=0;i<n;i++){V[0]=A[i];V[1]=B[i];V[2]=C[i];s+=Math.hypot(...V);}return s;'),
  hypotArr3:new Function('A','B','C','V','n','let s=0;for(let i=0;i<n;i++){const v=[A[i],B[i],C[i]];s+=Math.hypot(...v);}return s;'),
};
const res={};for(const k in kern){kern[k](A,B,C,V,2e5);}
for(let rep=0;rep<5;rep++)for(const k in kern){globalThis.gc();if(rep===4)console.log('##BEGIN '+k+' '+N);const t=performance.now();const s=kern[k](A,B,C,V,N);const dt=performance.now()-t;if(rep===4){console.log('##TAIL');globalThis.gc();console.log('##END');}(res[k]||=[]).push(dt*1e6/N);if(rep===4)console.log('##'+k.padEnd(13)+' median '+q(res[k],.5).toFixed(2)+' ns/call (5 runs: '+res[k].map(x=>x.toFixed(1)).join(' ')+') checksum '+s.toFixed(3));}
// exactness
const f64=new Float64Array(2),u64=new BigInt64Array(f64.buffer);const ulps=(x,y)=>{f64[0]=x;f64[1]=y;const d=u64[0]-u64[1];return Number(d<0n?-d:d);};
for(const [name,scale] of [['coords |v|<200',400],['small |v|<1',2],['mixed',0]]){let diff=0,maxU=0,diff3=0,maxU3=0;const M=2e6;
  for(let i=0;i<M;i++){const sc=scale||Math.pow(10,rnd()*8-4);const a=(rnd()-.5)*sc,b=(rnd()-.5)*sc,c=(rnd()-.5)*sc;
    const h=realHypot(a,b),r=Math.sqrt(a*a+b*b);if(h!==r){diff++;maxU=Math.max(maxU,ulps(h,r));}
    const h3=realHypot(a,b,c),r3=Math.sqrt(a*a+b*b+c*c);if(h3!==r3){diff3++;maxU3=Math.max(maxU3,ulps(h3,r3));}}
  console.log('##exactness '+name.padEnd(15)+' 2 args: '+(100*diff/M).toFixed(2)+'% differ (max '+maxU+' ulp) | 3 args: '+(100*diff3/M).toFixed(2)+'% differ (max '+maxU3+' ulp)');}
