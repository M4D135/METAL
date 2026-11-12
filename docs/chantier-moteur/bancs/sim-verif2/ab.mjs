// Paired lockstep A/B with independent pilot/digest. usage: node ab.mjs <patchModule> <export> ; env SCEN="0,2,c9,c15" STEPS REPS WEAPONS="2,0,3,1" BASE=mod:export KEEPALIVE=1
import {loadMain,make,pilot,quant,digest,snapHash} from './load.mjs';
const [mod,exp]=process.argv.slice(2);const get=async(m,e)=>{const f=(await import(m))[e];return typeof f==='function'?f():f;};
const P=await get(mod,exp);const base=process.env.BASE?await get(...process.env.BASE.split('::')):null;
const A=loadMain(base||undefined),B=loadMain(base?{simulation:[...base.simulation,...P.simulation]}:P);
const STEPS=+process.env.STEPS||1800,REPS=+process.env.REPS||1,W=(process.env.WEAPONS||'2,0,3,1').split(',').map(Number),KEEP=process.env.KEEPALIVE!=='0';
const SC=(process.env.SCEN||'0,2,c9,c15').split(',').map(t=>t[0]==='c'?[+t.slice(1),true,t]:[+t,false,t]);
for(const [index,campaign,label] of SC){
  let identical=true,div=-1,reached=0;const ta=[],tb=[],ca=[],cb=[];let ev={};const cpu=f=>{const c0=process.cpuUsage();const t=performance.now();f();const w=performance.now()-t;const c=process.cpuUsage(c0);return [w,(c.user+c.system)/1000];};
  for(let r=0;r<REPS;r++){
    const a=make(A,index,campaign),b=make(B,index,campaign),sa=a.sim.state,sb=b.sim.state,ia={},ib={};let ha=2166136261,hb=2166136261;
    for(let i=0;i<STEPS;i++){
      pilot(i,ia,sa,W);pilot(i,ib,sb,W);let x,y,t;
      if(KEEP){if(sa.player.hp<40)sa.player.hp=100;if(sb.player.hp<40)sb.player.hp=100;}
      let cx,cy;if((i+r)&1){[y,cy]=cpu(()=>b.sim.step(1/60,ib));[x,cx]=cpu(()=>a.sim.step(1/60,ia));}else{[x,cx]=cpu(()=>a.sim.step(1/60,ia));[y,cy]=cpu(()=>b.sim.step(1/60,ib));}
      ta.push(x);tb.push(y);ca.push(cx);cb.push(cy);for(const e of sa.events)ev[e.name]=(ev[e.name]||0)+1;
      ha=digest(sa,ha);hb=digest(sb,hb);if(ha!==hb&&div<0){identical=false;div=i;}sa.events.length=0;sb.events.length=0;reached=i+1;if(sa.dead||sb.dead||sa.won||sb.won)break;
    }
    if(snapHash(a.sim)!==snapHash(b.sim)){identical=false;}
  }
  const sum=v=>v.reduce((x,y)=>x+y,0),SA=sum(ta),SB=sum(tb),ratios=[];for(let i=0;i<ta.length;i++)if(ta[i]>.03)ratios.push(tb[i]/ta[i]);
  const E=['materialBreak','doorOpen','waveStart','explosion','rocket','grenade','kill','trap'].map(k=>k+'='+(ev[k]||0)).join(' ');
  const CA=sum(ca),CB=sum(cb);const WA=sum(ca.filter((v,i)=>i%STEPS>=600)),WB=sum(cb.filter((v,i)=>i%STEPS>=600));const cr=[];for(let i=0;i<ca.length;i++)if(ca[i]>.05)cr.push(cb[i]/ca[i]);const mins=(v)=>{let t=0;for(let i=0;i<v.length;i++)t+=Math.min(v[i],ta[i]>0?Infinity:Infinity);return t;};
  console.log(label.padEnd(4)+' steps='+reached+' identical='+identical+(div>=0?' DIVERGES@'+div:'')+' | CPU '+CA.toFixed(0)+'->'+CB.toFixed(0)+' ms ('+(100*(CB/CA-1)).toFixed(0)+'%) cpuMax '+Math.max(...ca).toFixed(1)+'->'+Math.max(...cb).toFixed(1)+' warm(>=600) '+WA.toFixed(0)+'->'+WB.toFixed(0)+' ('+(100*(WB/WA-1)).toFixed(0)+'%) cpuMedRatio '+quant(cr,.5).toFixed(2)+' cpu>2ms '+ca.filter(v=>v>2).length+'->'+cb.filter(v=>v>2).length+' | wall total '+SA.toFixed(0)+'->'+SB.toFixed(0)+' ms ('+(100*(SB/SA-1)).toFixed(0)+'%) medRatio '+quant(ratios,.5).toFixed(2)+' | mean '+(SA/ta.length).toFixed(3)+'->'+(SB/tb.length).toFixed(3)+' p99 '+quant(ta,.99).toFixed(2)+'->'+quant(tb,.99).toFixed(2)+' max '+Math.max(...ta).toFixed(1)+'->'+Math.max(...tb).toFixed(1)+' >4ms '+ta.filter(v=>v>4).length+'->'+tb.filter(v=>v>4).length+' | '+E);
}
