import {SCENES} from './scenes.mjs';
const name=process.argv[2]||'rubble300',REPS=+(process.argv[3]||6),steps=+(process.argv[4]||1100);
let best=null,rows=null;
for(let rep=0;rep<REPS;rep++){const {w}=SCENES[name]({});const t=new Float64Array(steps);rows=[];
  for(let i=0;i<steps;i++){if(name==='blast200'&&i===240)w.explode(0,.5,0,14,900);const t0=performance.now();w.step(1/120,1);t[i]=performance.now()-t0;rows.push([w.stats.awake,w.stats.contacts,w.stats.tests]);}
  if(!best)best=t;else for(let i=0;i<steps;i++)if(t[i]<best[i])best[i]=t[i];}
const order=[...best.keys()].sort((a,b)=>best[b]-best[a]).slice(0,8);
for(const i of order)console.log('step',i,'ms',best[i].toFixed(3),'awake',rows[i][0],'contacts',rows[i][1],'tests',rows[i][2]);
const s=Float64Array.from(best).sort();console.log('p50',s[steps>>1].toFixed(3),'p90',s[Math.floor(steps*.9)].toFixed(3),'p99',s[Math.floor(steps*.99)].toFixed(3));
for(let k=0;k<steps;k+=100)console.log(k,best[k].toFixed(3),rows[k].join(' '));
