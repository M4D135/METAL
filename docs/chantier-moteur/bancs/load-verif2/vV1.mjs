// Missed finding: cold edge cache is the A* spike. Variants: orig / localnav / localnav + prewarmed symmetric edge cache.
import {loadFast,makeWorld,drive,mkInput,q,fnv,BL} from './lib.mjs';
const {PATCHES}=await import(BL+'/patches.mjs');
const [spec='c:9',repsArg='3']=process.argv.slice(2);const STEPS=1800,REPS=+repsArg;
const toMap=list=>{const m={};for(const [f,a,b] of list)(m[f]=m[f]||[]).push([a,b]);return m;};
const add=(m,extra)=>({...m,simulation:[...(m.simulation||[]),...extra]});
const TIMER=[['const stamp=++routeSerial,heap=[];','const __t0=performance.now();const stamp=++routeSerial,heap=[];'],['      if(!found)return null;\n      const raw=[];','      G.__s.routes.push({found,explored,ms:performance.now()-__t0});if(!found)return null;\n      const raw=[];']];
const PRE=[["nav:{cells:nav,","nav:{prewarm(){let n=0;for(let i=0;i<nav.length;i++){if(!nav[i])continue;const ix=i%nx;for(const [k,j] of [[1,ix<nx-1?i+1:-1],[3,i+nx]]){if(j<0||j>=nav.length||!nav[j])continue;const m=1<<k;if(edgeKnown[i]&m)continue;n++;edgeKnown[i]|=m;edgeKnown[j]|=1<<(k^1);if(segmentFree(...coord(i),...coord(j),.4)){edgeOpen[i]|=m;edgeOpen[j]|=1<<(k^1);}}}return n;},cells:nav,"]];
const V={orig:loadFast({patches:add({},TIMER)}),local:loadFast({patches:add(toMap(PATCHES.localnav),TIMER)}),localPre:loadFast({patches:add(toMap(PATCHES.localnav),[...TIMER,...PRE])})};
const worlds=Object.fromEntries(Object.entries(V).map(([k,W])=>[k,makeWorld(W,spec)]));
const prof={},R={},hash={},pre={ms:[],n:0};
for(let rep=0;rep<REPS;rep++)for(const name of (rep%2?['localPre','local','orig']:['orig','local','localPre'])){
  const W=V[name];W.__s.routes=[];const sim=W.FSimulation.create(worlds[name],{brain:W.FBrain.create({mode:'cpu'}),armorSystem:true}),s=sim.state,input=mkInput();
  if(name==='localPre'){const t=performance.now();pre.n=sim.nav.prewarm();pre.ms.push(performance.now()-t);}
  const p=prof[name]=prof[name]||[];
  for(let i=0;i<STEPS;i++){drive(i,input,s);const t=performance.now();sim.step(1/60,input);const d=performance.now()-t;p[i]=Math.min(p[i]??Infinity,d);s.events.length=0;if(s.dead)break;}
  const r=W.__s.routes;if(!R[name])R[name]=r.map(x=>({...x}));else r.forEach((x,i)=>{R[name][i].ms=Math.min(R[name][i].ms,x.ms);});
  hash[name]=fnv(JSON.stringify(sim.snapshot()));
}
const out={spec,prewarmEdges:pre.n,prewarmMsMin:+Math.min(...pre.ms).toFixed(1)};
for(const name of Object.keys(V)){const p=prof[name],r=R[name];out[name]={astar:r.length,failed:r.filter(x=>!x.found).length,astarMsSum:+r.reduce((v,x)=>v+x.ms,0).toFixed(1),astarMsMax:+Math.max(0,...r.map(x=>x.ms)).toFixed(1),stepMax:+Math.max(...p).toFixed(1),over2:p.filter(x=>x>2).length,over4:p.filter(x=>x>4).length,over8:p.filter(x=>x>8).length,totalMs:+p.reduce((a,b)=>a+b,0).toFixed(0),hash:hash[name]};}
out.localEqualsLocalPre=hash.local===hash.localPre;
console.log(JSON.stringify(out));
