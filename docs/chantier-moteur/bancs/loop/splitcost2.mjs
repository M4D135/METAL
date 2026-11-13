// Coût marginal de 2 sous-pas par image (game.js:690) sans chaos ni restore() (voir bogue débris) :
// la simulation est déterministe (aucun Math.random) ; chaque mesure rejoue la même partie jusqu'à t0
// puis mesure 1 s : A = 1 pas de 1/60 par image, B = 2 pas de 1/120, C = pas de 1/40.
// node splitcost2.mjs <ferro> [world] [starts]
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const [root,wname='legacy-s0',starts='8']=process.argv.slice(2);const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld,FSimulation,FBrain}=ctx.window;const now=()=>performance.now();
const W={'legacy-s0':[0],'legacy-s2':[2],'campaign-9':[9,{campaign:true,campaignVersion:2}],'campaign-15':[15,{campaign:true,campaignVersion:2}]}[wname];
const world=FWorld.create(96,W[0],W[1]);const opts={armorSystem:true,...(W[1]?{}:{inventory:{weapons:[true,true,true],ammo:[180,36,12]}})};
const inputAt=t=>({moveX:Math.sin(t*.667),moveY:1,sprint:true,fire:(t%.333)<.1,dash:false,weapon:W[1]?undefined:Math.floor(t/6)%3,lookX:.01,lookY:0});
function prepared(frames){const sim=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})});let t=0;for(let i=0;i<frames;i++){sim.step(1/60,inputAt(t));sim.state.player.hp=Math.max(sim.state.player.hp,60);t+=1/60;}return [sim,t];}
const sum={A:0,B:0,C:0},ratios=[],ratiosC=[];
for(let k=1;k<=+starts;k++){
  const frames=k*90,cost={A:0,B:0,C:0};
  for(let rep=0;rep<2;rep++)for(const mode of (rep?['B','C','A']:['A','B','C'])){
    const [sim,t0]=prepared(frames);let t=t0;const a=now();
    if(mode==='A')for(let f=0;f<60;f++){sim.step(1/60,inputAt(t));t+=1/60;}
    else if(mode==='B')for(let f=0;f<60;f++){const i=inputAt(t);sim.step(1/120,i);sim.step(1/120,{...i,lookX:0});t+=1/60;}
    else for(let f=0;f<40;f++){sim.step(1/40,inputAt(t));t+=1/40;}
    cost[mode]+=now()-a;
  }
  for(const m in cost)sum[m]+=cost[m];ratios.push(cost.B/cost.A);ratiosC.push(cost.C/cost.A);
}
const med=a=>{const s=[...a].sort((x,y)=>x-y);return +s[s.length>>1].toFixed(3);};
console.log(JSON.stringify({world:wname,starts:+starts,'A ms/s (1 pas 1/60)':+(sum.A/(+starts*2)).toFixed(1),'B ms/s (2 x 1/120)':+(sum.B/(+starts*2)).toFixed(1),'C ms/s (1/40)':+(sum.C/(+starts*2)).toFixed(1),'B/A médiane':med(ratios),'B/A min':+Math.min(...ratios).toFixed(3),'B/A max':+Math.max(...ratios).toFixed(3),'C/A médiane':med(ratiosC)}));
