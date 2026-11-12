// Height of outdoor boundary walls per world vs. a jump apex.
import {load} from './load.mjs';
const root=process.argv[2];const W=load(root);
for(const [label,idx,opts] of [['historique 0',0],['historique 1',1],['historique 2',2],['campagne 0',0,{campaign:true,campaignVersion:2}],['campagne 7',7,{campaign:true,campaignVersion:2}],['campagne 14',14,{campaign:true,campaignVersion:2}]]){
  const w=W.FWorld.create(96,idx,opts);const b=w.outdoorBoundaries||[];const hs=[...new Set(b.map(q=>q.height))];
  console.log(label,'murs de limite exterieurs:',b.length,'hauteurs',JSON.stringify(hs),'longueur totale',Math.round(b.reduce((n,q)=>n+q.length,0)),'m');
}
