// PARA : modele de file a partir des temps CPU par pas mesures (proto.mjs DUMP=...). Independant de la charge machine.
// A = pas sur le fil principal ; B0 = worker, etat affiche a l'image suivante ; B1 = worker, « dessin a l'arrivee ».
import {readFileSync} from 'node:fs';
const d=JSON.parse(readFileSync(process.argv[2],'utf8'));const F=1000/60,HOP=+(process.argv[3]||0.1),PACK=0.17,MAIN=0.11;
for(const key of ['a1','a2']){
  const st=d[key],n=st.length;const arrival=new Float64Array(n);let end=0;
  for(let i=0;i<n;i++){const start=Math.max(i*F+HOP,end);end=start+st[i]+PACK;arrival[i]=end+HOP;}
  const res={serie:key,scenario:d.scenario,pas:n};
  for(const R of [4,8,12]){ // R = cout du rendu + reste de l'image sur le fil principal (ms)
    const dropA=st.filter(x=>R+x>F).length; // image perdue quand rendu + pas depasse 16,7 ms
    let lateB0=0,late2B0=0,newest=-1;for(let j=1;j<n;j++){while(newest+1<n&&arrival[newest+1]<=j*F)newest++;const l=(j-1)-newest;if(l>=1)lateB0++;if(l>=2)late2B0++;}
    let sameFrame=0;for(let i=0;i<n;i++)if(arrival[i]-i*F<=F-R-0.5)sameFrame++;
    res['R='+R+'ms']={A_imagesPerdues:dropA,B_imagesPerdues:0,B0_imagesAvecEtatEnRetard:lateB0,B0_retard2ticksOuPlus:late2B0,B1_etatDansLaMemeImagePct:+(100*sameFrame/n).toFixed(2),B1_imagesSurEtatPrecedent:n-sameFrame};
  }
  res.coutFilPrincipalParImage={A_moy:+(st.reduce((a,b)=>a+b,0)/n).toFixed(3),A_max:Math.max(...st),B_moy:MAIN,B_max:1.7};
  console.log(JSON.stringify(res));
}
