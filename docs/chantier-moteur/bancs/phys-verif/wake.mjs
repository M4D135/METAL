import {SCENES} from '../phys/scenes.mjs';
// Réveil d'un grand tas endormi par une seule balle : combien de corps, combien de temps, quel coût ?
for(const [hz,sub] of [[120,1],[60,2]]) for(const j of [6,45]){
  let best=null,info='';
  for(let rep=0;rep<3;rep++){
    const {w,ids}=SCENES.rubble300({}); let n=0; while(n<40*hz){w.step(1/hz,sub);n++;if(n>50&&w.stats.awake===0)break;}
    const before=ids.map(i=>[w.P[i*3],w.P[i*3+1],w.P[i*3+2]]);
    let top=ids[0];for(const i of ids)if(w.P[i*3+1]>w.P[top*3+1])top=i;
    w.impulseAt(top,w.P[top*3],w.P[top*3+1],w.P[top*3+2],j,0,0);
    let tot=0,steps=0,maxAwake=0,worst=0; for(let i=0;i<30*hz;i++){const t0=performance.now();w.step(1/hz,sub);const t=performance.now()-t0;if(w.stats.awake===0)break;tot+=t;steps++;maxAwake=Math.max(maxAwake,w.stats.awake);worst=Math.max(worst,t);}
    let moved=0,dmax=0;ids.forEach((i,k)=>{const d=Math.hypot(w.P[i*3]-before[k][0],w.P[i*3+1]-before[k][1],w.P[i*3+2]-before[k][2]);if(i!==top){if(d>0.002)moved++;dmax=Math.max(dmax,d);}});
    if(best===null||tot<best){best=tot;info=`${maxAwake} corps reveilles, ${(steps/hz).toFixed(2)} s avant rendormissement, cout total ${tot.toFixed(0)} ms (${(tot/steps*hz/60).toFixed(2)} ms par image a 60 i/s pendant ${(steps/hz).toFixed(1)} s) ; ${moved} autres pieces deplacees de plus de 2 mm, max ${(dmax*1000).toFixed(0)} mm`;}
  }
  console.log(`tas de 300 endormi, ${hz} Hz x${sub}, une impulsion de ${j} sur la piece du haut: ${info}`);
}
