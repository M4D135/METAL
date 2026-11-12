// LOOP-03 (contre-vérif, domaine principal) : coût de snapshot() selon navPending, par rejeu.
// node snap.mjs <monde> [motif]
import {loadFast,mkWorld,INPUTS,stat} from './fast.mjs';
const [label='campaign-9',pat='a']=process.argv.slice(2);
const W=loadFast();const {FSimulation,FBrain}=W,input=INPUTS[pat],dt=1/60;
const opts=label.startsWith('classic')?{armorSystem:true,inventory:{weapons:[true,true,true],ammo:[180,36,12]}}:{armorSystem:true};
const mk=()=>FSimulation.create(mkWorld(W,label),{...opts,brain:FBrain.create({mode:'cpu'})});
// passe 1 : repère les pas avec révision et la courbe navPending
const ref=mk();let t=0;const revSteps=[],pend=[];for(let i=0;i<1800&&!ref.state.dead;i++){const r=ref.state.destructionRevision;ref.step(dt,input(t));ref.state.player.hp=Math.max(ref.state.player.hp,60);t+=dt;pend.push(ref.state.aiStats.navPending||0);if(ref.state.destructionRevision!==r)revSteps.push(i);}
const frac=pend.filter(x=>x>0).length/pend.length;
console.log(label,pat,'révisions:',revSteps.length,'pas avec navPending>0:',(100*frac).toFixed(1)+'%','navPending max',Math.max(...pend),'pas pour vider (depuis max)',Math.ceil(Math.max(...pend)/768));
// chauffe snapshot
{const w=mk();for(let i=0;i<300;i++)w.step(dt,input(i*dt));for(let i=0;i<30;i++){JSON.stringify(w.snapshot());}}
const out=[];
for(const k of revSteps.slice(0,6)){for(const off of [1,15,40,200]){
  const sim=mk();let tt=0;for(let i=0;i<=k+off-1&&i<1800;i++){sim.step(dt,input(tt));sim.state.player.hp=Math.max(sim.state.player.hp,60);tt+=dt;}
  const p=sim.state.aiStats.navPending||0;const t0=performance.now();const snap=sim.snapshot();const t1=performance.now();const str=JSON.stringify(snap);const t2=performance.now();
  out.push({pas:k,decal:off,navPending:p,snapMs:+(t1-t0).toFixed(2),jsonMs:+(t2-t1).toFixed(2),car:str.length});}}
console.table(out);
const full=out.filter(x=>x.navPending>20000).map(x=>x.snapMs),none=out.filter(x=>x.navPending===0).map(x=>x.snapMs+x.jsonMs);
console.log('snapshot file pleine (>20000):',JSON.stringify(stat(full)),' sans file (snap+json):',JSON.stringify(stat(none)));
