// Paired lockstep A/B in the main realm. usage: node ab.mjs <A spec> <B spec>   spec: orig | r1 | r1-nolabels | r1+<module>:<export> ...
// env: STEPS REPS SCEN WEAPON
import {loadAll,simSource,SCENARIOS,build,drive,makeInput,digest,snapHash,q,mean,sum} from './build.mjs';
async function spec(text){
  const [base,...mods]=text.split('+');let extra=[],patches={};
  for(const m of mods){const [file,exp]=m.split(':');const v=(await import('./'+file+'.mjs'))[exp];const p=typeof v==='function'?v():v;if(Array.isArray(p))extra.push(...p);else{extra.push(...(p.simulation||[]));for(const k in p)if(k!=='simulation')patches[k]=[...(patches[k]||[]),...p[k]];}}
  const opt=base==='orig'?{sim:false,heap:false,nearest:false,long:false,labels:false,extra}:base==='r1'?{extra}:base==='r1-nolabels'?{labels:false,extra}:base==='simonly'?{heap:false,nearest:false,long:false,labels:false,extra}:null;
  if(!opt)throw new Error('bad spec '+text);
  return loadAll({sim:simSource(opt),patches,names:['renderer','world','destruction','economy','brain','simulation']});
}
const [sa,sb]=process.argv.slice(2);const A=await spec(sa),B=await spec(sb);
const REPS=+process.env.REPS||2,STEPS=+process.env.STEPS||1800,WEAPON=process.env.WEAPON!==undefined?+process.env.WEAPON:undefined,SCEN=process.env.SCEN,WARM=+process.env.WARM||0;
for(const [label,idx,opts] of SCENARIOS){
  if(SCEN&&!SCEN.split(',').includes(label))continue;
  let identical=true,divAt=-1;const ta=[],tb=[];
  for(let r=0;r<REPS;r++){
    const a=build(A,idx,opts),b=build(B,idx,opts),xa=a.sim.state,xb=b.sim.state,ia=makeInput(),ib=makeInput();if(WEAPON!==undefined)ia.weapon=ib.weapon=WEAPON;let ha=2166136261,hb=2166136261;
    for(let i=0;i<STEPS;i++){
      drive(i,ia,xa);drive(i,ib,xb);let x,y;
      if(i&1){let t=performance.now();b.sim.step(1/60,ib);y=performance.now()-t;t=performance.now();a.sim.step(1/60,ia);x=performance.now()-t;}
      else{let t=performance.now();a.sim.step(1/60,ia);x=performance.now()-t;t=performance.now();b.sim.step(1/60,ib);y=performance.now()-t;}
      if((r>0||REPS===1)&&i>=WARM){ta.push(x);tb.push(y);}
      ha=digest(xa,ha);hb=digest(xb,hb);if(ha!==hb&&divAt<0){identical=false;divAt=i;}xa.events.length=0;xb.events.length=0;if(xa.dead||xb.dead){if(xa.dead!==xb.dead)identical=false;break;}
    }
    if(snapHash(a.sim)!==snapHash(b.sim))identical=false;
  }
  const SA=sum(ta),SB=sum(tb),ratios=ta.map((x,i)=>tb[i]/x).filter((v,i)=>ta[i]>.02);
  console.log(label.padEnd(13)+' identical='+identical+(divAt>=0?' (diverges at step '+divAt+')':'')+' | total '+SA.toFixed(0)+' -> '+SB.toFixed(0)+' ms ('+(100*(SB/SA-1)).toFixed(1)+'%) | med ratio '+q(ratios,.5).toFixed(3)+' | mean '+(1e3*mean(ta)).toFixed(0)+' -> '+(1e3*mean(tb)).toFixed(0)+' us | p99 '+q(ta,.99).toFixed(2)+' -> '+q(tb,.99).toFixed(2)+' | max '+Math.max(...ta).toFixed(1)+' -> '+Math.max(...tb).toFixed(1)+' | >4ms '+ta.filter(v=>v>4).length+' -> '+tb.filter(v=>v>4).length+' | n='+ta.length);
}
