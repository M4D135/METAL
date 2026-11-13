import {SCENES} from './scenes.mjs';
const name=process.argv[2]||'stack10',steps=+(process.argv[3]||1200),sub=+(process.argv[4]||1),hz=+(process.argv[5]||120);
const {w,ids,ideal}=SCENES[name]();
let t0=performance.now(),maxC=0,sleepAt=-1;
for(let i=0;i<steps;i++){
  if(name==='blast200'&&i===240)console.log('explode touched',w.explode(0,0.5,0,14,900));
  w.step(1/hz,sub);maxC=Math.max(maxC,w.stats.contacts);
  if(sleepAt<0&&w.stats.awake===0&&i>10)sleepAt=i;
  if(i%Math.max(1,(steps/8|0))===0)console.log(i,'awake',w.stats.awake,'contacts',w.stats.contacts,'manifolds',w.stats.manifolds,'tests',w.stats.tests);
}
console.log('ms/step',((performance.now()-t0)/steps).toFixed(4),'maxContacts',maxC,'sleepAt',sleepAt,'hash',w.hash());
let bad=0,minY=1e9,maxY=-1e9,drift=0;
for(let k=0;k<ids.length;k++){const i=ids[k];const x=w.P[i*3],y=w.P[i*3+1],z=w.P[i*3+2];if(!Number.isFinite(x+y+z))bad++;minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(ideal){const t=ideal(k);drift=Math.max(drift,Math.hypot(x-t[0],y-t[1],z-t[2]));}}
console.log('nan',bad,'minY',minY.toFixed(4),'maxY',maxY.toFixed(4),'maxDrift',drift.toFixed(5));
