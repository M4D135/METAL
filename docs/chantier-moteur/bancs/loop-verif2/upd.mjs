// LOOP-04 (contre-vérif, domaine principal) : coût de renderer.updateWorld par révision, répété sur les mêmes listes.
import {scene} from '../rcpu/harness.mjs';
const root=(process.env.METAL_ROOT||process.cwd());
for(const w of [['camp',9],['classic',0],['camp',17]]){
  const S=scene(root,{world:w,wrap:false});const events=[];const orig=S.renderer.updateWorld;
  S.renderer.updateWorld=(m,r,l)=>{events.push([m,r,l]);return orig(m,r,l);};
  const upd=[],drawAfter=[],drawOther=[],simRev=[],simOther=[];
  for(let i=0;i<1500;i++){const r=S.frame(1/60,{tour:true});if(r.changed){upd.push(r.updateMs);drawAfter.push(r.drawMs);simRev.push(r.simMs);}else{drawOther.push(r.drawMs);simOther.push(r.simMs);}}
  // rejoue chaque updateWorld 7 fois (mêmes entrées) et garde la médiane et le minimum : filtre la charge machine
  const med=[],min=[];let rev=1e6;for(const [m,r,l] of events){const ts=[];for(let k=0;k<7;k++){const t=performance.now();orig(m,++rev,l);ts.push(performance.now()-t);}ts.sort((a,b)=>a-b);med.push(ts[3]);min.push(ts[0]);}
  const f=a=>a.map(x=>+x.toFixed(1)).join(' ');const srt=a=>[...a].sort((x,y)=>x-y);
  console.log(w.join(':'),'révisions',events.length,'maillages',events.at(-1)?.[0].length);
  console.log('  updateWorld en situation ms:',f(upd));console.log('  rejoué médiane ms:',f(med),'| min:',f(min));
  console.log('  draw image suivante ms:',f(drawAfter),'| draw autres p50',srt(drawOther)[drawOther.length>>1].toFixed(2));
  console.log('  sim.step image de révision ms:',f(simRev),'| autres p50',srt(simOther)[simOther.length>>1].toFixed(2),'p99',srt(simOther)[Math.floor(simOther.length*.99)].toFixed(2));
}
