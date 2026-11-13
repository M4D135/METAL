// Paired, interleaved variants of one scene; per-step minimum over repeats; cost reported per simulated second.
import {SCENES} from './scenes.mjs';
const name=process.argv[2]||'rubble300',REPS=+(process.argv[3]||5),SECONDS=+(process.argv[4]||9);
const VAR=JSON.parse(process.argv[5]||'[{"label":"120x1","hz":120,"sub":1},{"label":"120x1 cell1","hz":120,"sub":1,"cell":1},{"label":"60x2","hz":60,"sub":2},{"label":"60x2 cell1","hz":60,"sub":2,"cell":1}]');
const res=VAR.map(()=>({best:null,hash:new Set(),aw:0,co:0,te:0,n:0,sleepAt:-1}));
for(let rep=0;rep<REPS;rep++)for(let v=0;v<VAR.length;v++){
  const o=VAR[v],steps=Math.round(SECONDS*o.hz),{w,ids}=SCENES[name](o),t=new Float64Array(steps),r=res[v];r.aw=r.co=r.te=r.n=0;r.sleepAt=-1;
  for(let i=0;i<steps;i++){if(name==='blast200'&&i===Math.round(2*o.hz))w.explode(0,.5,0,14,900);const t0=performance.now();w.step(1/o.hz,o.sub);t[i]=performance.now()-t0;if(w.stats.awake){r.aw+=w.stats.awake;r.co+=w.stats.contacts;r.te+=w.stats.tests;r.n++;}else if(r.sleepAt<0&&i>5&&!(name==='blast200'&&i<2*o.hz))r.sleepAt=i/o.hz;}
  r.hash.add(w.hash());if(!r.best)r.best=t;else for(let i=0;i<steps;i++)if(t[i]<r.best[i])r.best[i]=t[i];
  let maxY=-1e9,minY=1e9;for(const i of ids){maxY=Math.max(maxY,w.P[i*3+1]);minY=Math.min(minY,w.P[i*3+1]);}r.maxY=maxY;r.minY=minY;
}
for(let v=0;v<VAR.length;v++){const o=VAR[v],r=res[v],tot=r.best.reduce((a,b)=>a+b,0),mx=Math.max(...r.best);
  console.log(`${name} ${o.label.padEnd(22)} total ${(tot).toFixed(1)} ms for ${SECONDS}s sim | per 60Hz frame while awake ${(tot/(r.n/(o.hz/60))).toFixed(3)} ms | worst frame ${(mx*(o.hz/60)).toFixed(3)} ms | awake mean ${(r.aw/r.n).toFixed(0)} contacts ${(r.co/r.n).toFixed(0)} tests ${(r.te/r.n).toFixed(0)} | asleep at ${r.sleepAt.toFixed(2)} s | y ${r.minY.toFixed(3)}..${r.maxY.toFixed(3)} | ${r.hash.size===1?'deterministic':'DIVERGED'}`);}
