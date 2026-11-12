import {SCENES} from './scenes.mjs';
const name=process.argv[2]||'rubble300',steps=+(process.argv[3]||900);
for(let rep=0;rep<3;rep++){
  const {w}=SCENES[name]({profile:true});let c=0,t=0,a=0,n=0;
  const t0=performance.now();
  for(let i=0;i<steps;i++){if(name==='blast200'&&i===240)w.explode(0,0.5,0,14,900);w.step(1/120,1);if(w.stats.awake){c+=w.stats.contacts;t+=w.stats.tests;a+=w.stats.awake;n++;}}
  const el=performance.now()-t0;
  console.log(name,'rep',rep,'awake steps',n,'ms/awake-step',(el/n).toFixed(3),'collide',(w.TP[0]/n).toFixed(3),'prepare',(w.TP[1]/n).toFixed(3),'solve',(w.TP[2]/n).toFixed(3),'finish',(w.TP[3]/n).toFixed(3),'| avg awake',(a/n).toFixed(0),'contacts',(c/n).toFixed(0),'tests',(t/n).toFixed(0));
}
