// Origine des pas de simulation les plus longs (saccades) : sondes inclusives sur les grandes fonctions
// internes de simulation.js / destruction.js / brain.js, pas de 1/60 en combat scripté.
// node spikes.mjs <ferro> [monde: legacy-s0|campaign-9|campaign-10] [secondes]
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const [root,wname='campaign-9',secs='30']=process.argv.slice(2);
const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
const acc={};let cur=null;ctx.__probe=(n,f)=>{const a=performance.now();try{return f();}finally{const d=performance.now()-a;if(cur)cur[n]=(cur[n]||0)+d;const q=acc[n]??={ms:0,n:0,max:0};q.ms+=d;q.n++;if(d>q.max)q.max=d;}};
const SIM=['updateEnemies','plan','route','navigate','perceive','updateEncounters','locomote','updateDebris','updateEnvironment','fireArsenal','fire','collectSupplies','explode','updateDirector','damageScenery','updateBossAttacks','updateProjectiles','tickBoss','appendDebris','updateBrain','damageEnemy','syncDestruction','rebuildCollision','refreshNav','pumpNav','unsupportedBodies','updateSystems','beneathTerrain','snapshot'];
const DES=['rebuild','damage','compile','fallingDebris','removedGeometry'];
function wrap(src,names,file){for(const f of names){const re=new RegExp('(\\n\\s+)function '+f+'\\(');if(!re.test(src)){console.error('absent',file,f);continue;}src=src.replace(re,(m,sp)=>sp+'function '+f+'(...__a){return __probe('+JSON.stringify(file+':'+f)+',()=>'+f+'__o(...__a));}'+sp+'function '+f+'__o(');}return src;}
for(const n of ['renderer','world','destruction','economy','brain','simulation']){let src=readFileSync(root+'/src/'+n+'.js','utf8');
  if(n==='simulation')src=wrap(src,SIM,'sim');if(n==='destruction')src=wrap(src,DES,'des');
  vm.runInContext(src,ctx,{filename:n+'.js'});}
const {FWorld,FSimulation,FBrain}=ctx.window;
const W={'legacy-s0':[0],'campaign-9':[9,{campaign:true,campaignVersion:2}],'campaign-10':[10,{campaign:true,campaignVersion:2}]}[wname];
const world=FWorld.create(96,W[0],W[1]);const opts={armorSystem:true,...(W[1]?{}:{inventory:{weapons:[true,true,true],ammo:[180,36,12]}})};
const sim=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})});const s=sim.state;
const inputAt=t=>({moveX:Math.sin(t*.667),moveY:1,sprint:true,fire:(t%.333)<.1,dash:false,weapon:W[1]?undefined:Math.floor(t/6)%3,lookX:.01,lookY:0});
// échauffement JIT sur un autre exemplaire (même monde) pour écarter les compilations froides
{const w=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})});let t=0;for(let i=0;i<600;i++){w.step(1/60,inputAt(t));w.state.player.hp=Math.max(w.state.player.hp,60);t+=1/60;}}
for(const k in acc)delete acc[k];
const steps=[];let t=0;
while(t<+secs&&!s.dead&&!s.won){cur={};const rev=sim.destruction?.revision??0;const a=performance.now();sim.step(1/60,inputAt(t));const d=performance.now()-a;
  steps.push({t:+t.toFixed(2),ms:d,parts:cur,rev:(sim.destruction?.revision??0)-rev,navPending:sim.nav?.pending});s.player.hp=Math.max(s.player.hp,60);t+=1/60;}
const ms=steps.map(x=>x.ms).sort((a,b)=>a-b),q=p=>+ms[Math.min(ms.length-1,Math.floor(p*ms.length))].toFixed(2);
console.log(JSON.stringify({monde:wname,pas:steps.length,p50:q(.5),p95:q(.95),p99:q(.99),max:+ms.at(-1).toFixed(1),'pas >8 ms':ms.filter(v=>v>8).length,'pas >16 ms':ms.filter(v=>v>16).length,'pas avec révision de destruction':steps.filter(x=>x.rev>0).length}));
const top=[...steps].sort((a,b)=>b.ms-a.ms).slice(0,10);
for(const x of top)console.log(x.t+'s',x.ms.toFixed(1)+'ms','rev+'+x.rev,Object.entries(x.parts).filter(([k])=>k!=='sim:snapshot').sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>k+'='+v.toFixed(1)).join(' '));
// part des pas lents (>8 ms) qui contiennent une révision de destruction
const slow=steps.filter(x=>x.ms>8);console.log('pas >8 ms avec révision :',slow.filter(x=>x.rev>0).length,'/',slow.length,'; pas avec révision : ms moyen',(steps.filter(x=>x.rev>0).reduce((a,x)=>a+x.ms,0)/Math.max(1,steps.filter(x=>x.rev>0).length)).toFixed(1),'vs sans',(steps.filter(x=>!x.rev).reduce((a,x)=>a+x.ms,0)/Math.max(1,steps.filter(x=>!x.rev).length)).toFixed(2));
console.log('cumul (ms/s simulée) :',Object.entries(acc).sort((a,b)=>b[1].ms-a[1].ms).slice(0,14).map(([k,v])=>k+'='+(v.ms/t).toFixed(1)+'(max '+v.max.toFixed(1)+')').join(' '));
