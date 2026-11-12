// SIM-01 scepticism: is nav-local structurally identical, or only on the tested runs?
// Compares, in lockstep, original (A) vs nav-local (B): (1) the nav cell grids step by step; (2) every N steps, each cached
// edge against a fresh segmentFree() recompute (stale edges), in both variants.
import {loadMain,make,pilot,digest} from './load.mjs';import {navLocal} from '../sim/nav-local.mjs';
const HOOK=['    function pumpNav(limit=768){',`    (globalThis.__EL=globalThis.__EL||[]).push(()=>{let known=0,stale=0,staleOpen=0;for(let i=0;i<nav.length;i++){if(!edgeKnown[i])continue;const ix=i%nx,nb=[ix?i-1:-1,ix<nx-1?i+1:-1,i-nx,i+nx];for(let k=0;k<4;k++){const m=1<<k,j=nb[k];if(!(edgeKnown[i]&m)||j<0||j>=nav.length)continue;known++;const open=segmentFree(...coord(i),...coord(j),.4),was=!!(edgeOpen[i]&m);if(open!==was){stale++;if(was)staleOpen++;}}}return [known,stale,staleOpen];});\n    function pumpNav(limit=768){`];
const A=loadMain({simulation:[HOOK]}),B=loadMain({simulation:[...navLocal.simulation,HOOK]});
for(const t of (process.env.SCEN||'2,c9').split(',')){
  const campaign=t[0]==='c',index=+(campaign?t.slice(1):t);globalThis.__EL=[];
  const a=make(A,index,campaign),b=make(B,index,campaign),ea=globalThis.__EL[0],eb=globalThis.__EL[1],sa=a.sim.state,sb=b.sim.state,ia={},ib={};
  let ha=1,hb=1,div=-1,navDiffSteps=0,navDiffMax=0,sA=[0,0,0],sB=[0,0,0],sAmax=0,sBmax=0,checks=0,traps=sa.traps.map(q=>q.kind).join(',');
  for(let i=0;i<1800;i++){
    pilot(i,ia,sa,[2,0,3,1]);pilot(i,ib,sb,[2,0,3,1]);if(sa.player.hp<40)sa.player.hp=100;if(sb.player.hp<40)sb.player.hp=100;
    a.sim.step(1/60,ia);b.sim.step(1/60,ib);ha=digest(sa,ha);hb=digest(sb,hb);if(ha!==hb&&div<0)div=i;sa.events.length=0;sb.events.length=0;
    const ca=a.sim.nav.cells,cb=b.sim.nav.cells;let d=0;for(let k=0;k<ca.length;k++)if(ca[k]!==cb[k])d++;if(d){navDiffSteps++;navDiffMax=Math.max(navDiffMax,d);}
    if(i%30===29){const x=ea(),y=eb();checks++;for(let k=0;k<3;k++){sA[k]+=x[k];sB[k]+=y[k];}sAmax=Math.max(sAmax,x[1]);sBmax=Math.max(sBmax,y[1]);}
    if(sa.dead||sb.dead)break;
  }
  console.log(`${t}: traps=[${traps}] state diverges@${div} | nav grids differ on ${navDiffSteps} steps (max ${navDiffMax} cells) | stale cached edges per check (mean known / stale / stale-open): original ${(sA[0]/checks).toFixed(0)} / ${(sA[1]/checks).toFixed(1)} / ${(sA[2]/checks).toFixed(1)} max ${sAmax} ; nav-local ${(sB[0]/checks).toFixed(0)} / ${(sB[1]/checks).toFixed(1)} / ${(sB[2]/checks).toFixed(1)} max ${sBmax}`);
}
