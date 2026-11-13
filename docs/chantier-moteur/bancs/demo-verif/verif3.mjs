// snapshot() est-il neutre ? Un seul snapshot() au pas K, comparaison pas à pas avec la passe sans snapshot.
import {runSession,W,plausibleLoadout,HZ,DT,REC,decode,digest} from '../demo/session.mjs';
const [sec='60',idx='6']=process.argv.slice(2);const startIndex=+idx,loadout=startIndex>0?plausibleLoadout(startIndex):null;
const rec=runSession({minutes:+sec/60,startIndex,startLoadout:loadout,record:true,assist:false,checkpoints:false,memoryEveryS:1e9});
const {FWorld,FSimulation,FBrain}=W;const bytes=rec.record.bytes,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),N=rec.steps;
const strip=o=>JSON.stringify(o,(k,v)=>k==='aiStats'||k==='events'?undefined:v);
const world=FWorld.create(96,startIndex,{campaign:true,campaignVersion:2});
const mk=()=>{const brain=FBrain.create({mode:'cpu'});const sim=FSimulation.create(world,{...(loadout||{}),armorSystem:true,brain});sim.setDifficulty(1);return sim;};
const input={};
function pass(K){const sim=mk(),d=new Uint32Array(N);let h=2166136261,navPendingInfo=null;for(let i=0;i<N;i++){decode(view,i*REC,input);sim.step(DT,input);sim.state.events.length=0;if(K.includes(i)){const before=strip(sim.state);sim.snapshot();const after=strip(sim.state);if(before!==after){const a=JSON.parse(before),b=JSON.parse(after);navPendingInfo=(navPendingInfo||[]).concat([{step:i,immediateDiffKeys:Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]))}]);}}h=digest(sim.state,h);d[i]=h;}return {d,end:strip(sim.state),final:h>>>0,imm:navPendingInfo,ai:{...sim.state.aiStats}};}
const base=pass([]);
const out={world:startIndex+1,simSeconds:N/HZ,manualLoopEqualsRunSession:base.final===rec.finalDigest,rows:[]};
for(const K of [[360],[900],[1800],[2700],[3240],[100,200,300,400,500,600,700,800]]){const p=pass(K);let first=null;for(let i=0;i<N;i++)if(p.d[i]!==base.d[i]){first=i;break;}
  let keys=null;if(p.end!==base.end){const a=JSON.parse(base.end),b=JSON.parse(p.end);keys=Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));}
  out.rows.push({snapshotAt:K.length>3?'100..800':K[0],digestFirstDivergenceStep:first,finalFullStateEqual:p.end===base.end,finalDiffKeys:keys,immediate:p.imm});}
console.log(JSON.stringify(out,null,1));
