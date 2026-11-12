// Load-robust cost of ONE step in a frozen representative state: restore the same snapshot N times, time a single
// step each time, report min / p10 / p50. Same workload every sample, so the minimum approaches the uncontended cost.
import {SCENES} from './scenes.mjs';
const N=+(process.argv[2]||400),HZ=+(process.argv[3]||120),SUB=+(process.argv[4]||1);
const STATES=[['stack10 resting',  'stack10',  20],['pyramid55 resting','pyramid55',20],['rubble300 free fall (no contact)','rubble300',2],['rubble300 first impacts','rubble300',100],['rubble300 pile, all awake','rubble300',600],['blast200 just after blast','blast200',250],['blast200 0.5 s after blast','blast200',300],['blast200 settling','blast200',560]];
const q=(a,p)=>a[Math.min(a.length-1,Math.floor(a.length*p))];
const rows=[];
for(const [label,scene,at] of STATES){
  const {w}=SCENES[scene]({});const k=Math.round(at*HZ/120);
  for(let i=0;i<k;i++){if(scene==='blast200'&&i===Math.round(240*HZ/120))w.explode(0,.5,0,14,900);w.step(1/HZ,SUB);}
  const snap=w.snapshot(true),t=new Float64Array(N);let st=null,h=null;
  for(let n=0;n<N;n++){w.restore(snap);const t0=performance.now();w.step(1/HZ,SUB);t[n]=(performance.now()-t0)*1000;if(n===0){st={...w.stats};h=w.hash();}else if(w.hash()!==h)throw new Error('restore is not exact: '+label);}
  t.sort();rows.push({label,awake:st.awake,contacts:st.contacts,manifolds:st.manifolds,tests:st.tests,min:t[0],p10:q(t,.1),p50:q(t,.5)});
  console.log(`${label.padEnd(34)} awake ${String(st.awake).padStart(3)} contactPts ${String(st.contacts).padStart(4)} manifolds ${String(st.manifolds).padStart(4)} SAT ${String(st.tests).padStart(4)} | us/step min ${t[0].toFixed(1)} p10 ${q(t,.1).toFixed(1)} p50 ${q(t,.5).toFixed(1)} | per awake body min ${(t[0]/st.awake).toFixed(3)} us | per contact pt min ${(t[0]/Math.max(1,st.contacts)).toFixed(3)} us`);
}
// least squares on the minima: us = a*awake + b*contactPts + c*SAT
{const n=3,A=Array.from({length:n},()=>new Float64Array(n+1));for(const r of rows){const x=[r.awake,r.contacts,r.tests];for(let i=0;i<n;i++){for(let j=0;j<n;j++)A[i][j]+=x[i]*x[j];A[i][n]+=x[i]*r.min;}}
 for(let i=0;i<n;i++){let p=i;for(let k=i+1;k<n;k++)if(Math.abs(A[k][i])>Math.abs(A[p][i]))p=k;[A[i],A[p]]=[A[p],A[i]];for(let k=0;k<n;k++)if(k!==i){const f=A[k][i]/A[i][i];for(let j=i;j<=n;j++)A[k][j]-=f*A[i][j];}}
 const c=A.map((r,i)=>r[n]/r[i]);console.log(`fit on minima: us/step = ${c[0].toFixed(3)}*awake + ${c[1].toFixed(3)}*contactPts + ${c[2].toFixed(3)}*SAT`);
 for(const r of rows)console.log('   '+r.label.padEnd(34)+' measured '+r.min.toFixed(1)+' fitted '+(c[0]*r.awake+c[1]*r.contacts+c[2]*r.tests).toFixed(1));}
