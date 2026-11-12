// Quels champs divergent après un seul snapshot() au pas 2700 ? Et à quel pas l'état complet diverge-t-il en premier ?
import {runSession,W,plausibleLoadout,HZ,DT,REC,decode} from '../demo/session.mjs';
const startIndex=6,loadout=plausibleLoadout(startIndex);
const rec=runSession({minutes:1,startIndex,startLoadout:loadout,record:true,assist:false,checkpoints:false,memoryEveryS:1e9});
const {FWorld,FSimulation,FBrain}=W;const bytes=rec.record.bytes,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),N=rec.steps;
const world=FWorld.create(96,startIndex,{campaign:true,campaignVersion:2});
const mk=()=>{const brain=FBrain.create({mode:'cpu'});const sim=FSimulation.create(world,{...(loadout||{}),armorSystem:true,brain});sim.setDifficulty(1);return sim;};
const a=mk(),b=mk(),ia={},ib={};let first=null;const fields={};let aiDiff=null;
for(let i=0;i<N;i++){decode(view,i*REC,ia);decode(view,i*REC,ib);a.step(DT,ia);b.step(DT,ib);a.state.events.length=0;b.state.events.length=0;if(i===2700)b.snapshot();
  if(i>=2700){const ea=a.state.enemies,eb=b.state.enemies;for(let k=0;k<ea.length;k++){const x=ea[k],y=eb[k];for(const f in x){const va=JSON.stringify(x[f]),vb=JSON.stringify(y[f]);if(va!==vb){if(first===null)first={step:i,enemy:x.id,field:f,a:va.slice(0,80),b:vb.slice(0,80)};fields[f]=(fields[f]||0)+1;}}}}}
console.log(JSON.stringify({firstFullStateDivergence:first,divergentFieldCounts:fields,aiStatsA:a.state.aiStats,aiStatsB:b.state.aiStats}));
