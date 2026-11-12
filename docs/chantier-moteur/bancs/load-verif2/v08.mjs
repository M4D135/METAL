import {loadFast,makeWorld,fnv,drive,mkInput} from './lib.mjs';
const W=loadFast();
const SYM={simulation:[['if(!(edgeKnown[i]&mask)){edgeKnown[i]|=mask;if(segmentFree(...coord(i),...coord(j),.4))edgeOpen[i]|=mask;}','if(!(edgeKnown[i]&mask)){edgeKnown[i]|=mask;edgeKnown[j]|=1<<(k^1);if(segmentFree(...coord(i),...coord(j),.4)){edgeOpen[i]|=mask;edgeOpen[j]|=1<<(k^1);}}'],['function segmentFree(ax,az,bx,bz,r=.4){','function segmentFree(ax,az,bx,bz,r=.4){G.__s.sf++;']]};
const W2=loadFast({patches:SYM});const W1=loadFast({patches:{simulation:[SYM.simulation[1]]}});
for(const spec of ['l:0','c:9']){
  const world=makeWorld(W,spec);
  // LOAD-08: structured clone
  const j0=JSON.stringify(world);const ts=[];let c;for(let i=0;i<5;i++){const t=performance.now();c=structuredClone(world);ts.push(performance.now()-t);}
  const tj=[];for(let i=0;i<3;i++){const t=performance.now();JSON.parse(JSON.stringify(world));tj.push(performance.now()-t);}
  const types=new Set();(function walk(v,d){if(v&&typeof v==='object'){const n=Object.prototype.toString.call(v);types.add(n);if(d<6)for(const k in v)walk(v[k],d+1);}else types.add(typeof v);})(world,0);
  console.log(JSON.stringify({spec,jsonMB:+(j0.length/1e6).toFixed(2),cloneEqualJSON:JSON.stringify(c)===j0,structuredCloneMsMin:+Math.min(...ts).toFixed(1),jsonRoundTripMsMin:+Math.min(...tj).toFixed(1),types:[...types]}));
  // LOAD-01: default arsenal when the fallback path runs
  if(spec==='c:9'){const sim=W.FSimulation.create(world,{armorSystem:true});console.log(JSON.stringify({defaultInventory:sim.exportInventory?.(),equipment:sim.state.equipment,credits:sim.state.economy?.credits}));}
  // LOAD-04: symmetry of segmentFree on every grid edge
  const sim=W.FSimulation.create(world,{armorSystem:true}),n=sim.nav,nx=n.nx;let edges=0,asym=0;
  for(let i=0;i<n.cells.length;i++){if(!n.cells[i])continue;for(const j of [(i%nx)<nx-1?i+1:-1,i+nx]){if(j<0||j>=n.cells.length||!n.cells[j])continue;edges++;const a=n.canTraverse(...n.coord(i),...n.coord(j),.4),b=n.canTraverse(...n.coord(j),...n.coord(i),.4);if(a!==b)asym++;}}
  // symmetric cache: sf count + final state equality on the walk scenario
  const res={};for(const [name,WW] of [['orig',W1],['sym',W2]]){const w=makeWorld(WW,spec);WW.__s.sf=0;const s2=WW.FSimulation.create(w,{brain:WW.FBrain.create({mode:'cpu'}),armorSystem:true}),st=s2.state,input=mkInput();for(let i=0;i<1800;i++){drive(i,input,st);s2.step(1/60,input);st.events.length=0;if(st.dead)break;}res[name]={sf:WW.__s.sf,hash:fnv(JSON.stringify(s2.snapshot()))};}
  console.log(JSON.stringify({spec,gridEdges:edges,asymmetricEdges:asym,sfOrig:res.orig.sf,sfSym:res.sym.sf,sfGain:Math.round(100*(1-res.sym.sf/res.orig.sf))+'%',finalStateEqual:res.orig.hash===res.sym.hash}));
}
