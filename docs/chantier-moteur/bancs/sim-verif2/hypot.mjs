// SIM-10: Math.hypot vs sqrt — CPU cost and ulp differences (main realm).
const N=2e6,a=new Float64Array(N),b=new Float64Array(N),c=new Float64Array(N);let seed=12345;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<N;i++){a[i]=(rnd()-.5)*400;b[i]=(rnd()-.5)*400;c[i]=(rnd()-.5)*40;}
const cpu=()=>{const u=process.cpuUsage();return (u.user+u.system)/1000;};
function h2(){let s=0;for(let i=0;i<N;i++)s+=Math.hypot(a[i],b[i]);return s;}function s2(){let s=0;for(let i=0;i<N;i++)s+=Math.sqrt(a[i]*a[i]+b[i]*b[i]);return s;}
function h3(){let s=0;for(let i=0;i<N;i++)s+=Math.hypot(a[i],b[i],c[i]);return s;}function s3(){let s=0;for(let i=0;i<N;i++)s+=Math.sqrt(a[i]*a[i]+b[i]*b[i]+c[i]*c[i]);return s;}
const T={h2:[],s2:[],h3:[],s3:[]};for(let r=0;r<5;r++)for(const [k,f] of [['h2',h2],['s2',s2],['h3',h3],['s3',s3]]){const t=cpu();f();T[k].push((cpu()-t)/N*1e6);}
const med=v=>v.slice().sort((x,y)=>x-y)[2];console.log('ns/call (CPU, median of 5): hypot2 '+med(T.h2).toFixed(1)+' sqrt2 '+med(T.s2).toFixed(2)+' (x'+(med(T.h2)/med(T.s2)).toFixed(1)+') | hypot3 '+med(T.h3).toFixed(1)+' sqrt3 '+med(T.s3).toFixed(2)+' (x'+(med(T.h3)/med(T.s3)).toFixed(1)+')');
const f=new Float64Array(2),g=new BigInt64Array(f.buffer);let d2=0,d3=0,mx=0n,below=0,zero=Object.is(Math.hypot(0,0),0)&&Object.is(Math.hypot(-0,-0),0)&&Object.is(Math.hypot(0,-0),0);
for(let i=0;i<N;i++){f[0]=Math.hypot(a[i],b[i]);f[1]=Math.sqrt(a[i]*a[i]+b[i]*b[i]);let u=g[0]-g[1];if(u<0n)u=-u;if(u)d2++;if(u>mx)mx=u;if(f[0]<Math.max(Math.abs(a[i]),Math.abs(b[i])))below++;f[0]=Math.hypot(a[i],b[i],c[i]);f[1]=Math.sqrt(a[i]*a[i]+b[i]*b[i]+c[i]*c[i]);u=g[0]-g[1];if(u<0n)u=-u;if(u)d3++;if(u>mx)mx=u;}
console.log('differing results: 2 args '+(100*d2/N).toFixed(1)+'% ; 3 args '+(100*d3/N).toFixed(1)+'% ; max ulp '+mx+' ; hypot<max(|a|,|b|) cases '+below+' ; hypot(±0,±0) is +0: '+zero);
