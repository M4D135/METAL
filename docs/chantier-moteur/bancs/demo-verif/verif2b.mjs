// Contre-vérification DEMO-08 : un tampon circulaire d'entrées n'est rejouable que depuis une image clé.
// Test : enregistrement continu, snapshot() au pas K, puis restore() dans une simulation neuve et rejeu des entrées K+1..fin.
// usage : node verif2.mjs [secondes=60] [monde=6]
import {runSession,W,plausibleLoadout,HZ,DT,REC,decode} from '../demo/session.mjs';
const [sec='60',idx='6']=process.argv.slice(2);const startIndex=+idx,loadout=startIndex>0?plausibleLoadout(startIndex):null;
const rec=runSession({minutes:+sec/60,startIndex,startLoadout:loadout,record:true,assist:false,checkpoints:false,memoryEveryS:1e9});
const {FWorld,FSimulation,FBrain}=W;const bytes=rec.record.bytes,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),N=rec.steps;
const strip=o=>JSON.stringify(o,(k,v)=>k==='aiStats'||k==='events'?undefined:v);
const world=FWorld.create(96,startIndex,{campaign:true,campaignVersion:2});
const mk=()=>{const brain=FBrain.create({mode:'cpu'});const sim=FSimulation.create(world,{...(loadout||{}),armorSystem:true,brain});sim.setDifficulty(1);return sim;};
const input={};
const KS=[.05,.1,.25].map(f=>Math.round(N*f));
// passe continue, avec snapshots aux pas K
const sim=mk(),snaps=new Map(),revAt=new Map();
for(let i=0;i<N;i++){decode(view,i*REC,input);sim.step(DT,input);sim.state.events.length=0;if(KS.includes(i)){snaps.set(i,JSON.stringify(sim.snapshot()));revAt.set(i,[sim.state.destructionRevision,sim.state.debris.length,sim.state.player.airborne]);}}
const endA=strip(sim.state);
// contrôle : la passe continue sans snapshot donne-t-elle le même état final ? (neutralité de snapshot)
const simC=mk();for(let i=0;i<N;i++){decode(view,i*REC,input);simC.step(DT,input);simC.state.events.length=0;}
const rows=[];
for(const K of KS){const s2=mk();const ok=s2.restore(JSON.parse(snaps.get(K)),process.env.RECOVER==='0'?{}:{recover:true});let equal=null,firstDiff=null;
  if(ok){for(let i=K+1;i<N;i++){decode(view,i*REC,input);s2.step(DT,input);s2.state.events.length=0;}const e=strip(s2.state);equal=e===endA;if(!equal){const a=JSON.parse(endA),b=JSON.parse(e);firstDiff=Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])).slice(0,12);}}
  rows.push({K,tS:+(K/HZ).toFixed(1),revision:revAt.get(K)[0],debris:revAt.get(K)[1],airborne:revAt.get(K)[2],restoreAccepted:ok,snapshotBytes:snaps.get(K).length,finalStateEqual:equal,diffKeys:firstDiff});}
console.log(JSON.stringify({simSeconds:N/HZ,world:startIndex+1,sessionDeaths:rec.deaths,continuousWithSnapshotsEqualsWithout:endA===strip(simC.state),playerEnd:[sim.state.player.x,sim.state.player.z,sim.state.player.hp].map(v=>+v.toFixed(3)),rows},null,1));
