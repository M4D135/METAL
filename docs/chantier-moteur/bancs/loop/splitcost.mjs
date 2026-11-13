// Coût marginal du découpage d'une image 60 Hz en 2 sous-pas (cas game.js:690 à 59,94 Hz / horodatages
// arrondis) mesuré sans chaos : mêmes états de départ restaurés, A = 1 pas de 1/60, B = 2 pas de 1/120,
// C = 1 pas de 1/40 sur 1,5 image. Alternance A/B/C pour neutraliser la charge machine.
// node splitcost.mjs <ferro> [world] [starts]
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const [root,wname='legacy-s0',starts='12']=process.argv.slice(2);const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld,FSimulation,FBrain}=ctx.window;const now=()=>performance.now();
const W={'legacy-s0':[0],'legacy-s2':[2],'campaign-9':[9,{campaign:true,campaignVersion:2}],'campaign-15':[15,{campaign:true,campaignVersion:2}]}[wname];
const world=FWorld.create(96,W[0],W[1]);const opts={armorSystem:true,...(W[1]?{}:{inventory:{weapons:[true,true,true],ammo:[180,36,12]}})};
const main=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})});const s=main.state;
const inputAt=t=>({moveX:Math.sin(t*.667),moveY:1,sprint:true,fire:(t%.333)<.1,dash:false,weapon:Math.floor(t/6)%3,lookX:0,lookY:0});
const clones=[FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})}),FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})}),FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})})];
let t=0,failed=0,used=0;const res={A:0,B:0,C:0};const ratios=[];
for(let k=0;k<+starts;k++){
  for(let i=0;i<90||s.player.airborne;i++){const inp=inputAt(t);inp.lookX=.01;main.step(1/60,inp);s.player.hp=Math.max(s.player.hp,60);t+=1/60;}// avance l'état de référence (combat)
  const snap=JSON.parse(JSON.stringify(main.snapshot()));
  const cost={A:0,B:0,C:0};
  for(let rep=0;rep<3;rep++)for(const mode of (rep%2?['B','C','A']:['A','B','C'])){
    const sim=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})});if(!sim.restore(JSON.parse(JSON.stringify(snap)),{recover:true})){failed++;cost.skip=1;break;}
    let tt=t;const a=now();
    if(mode==='A')for(let f=0;f<60;f++){sim.step(1/60,inputAt(tt));tt+=1/60;}
    else if(mode==='B')for(let f=0;f<60;f++){const inp=inputAt(tt);sim.step(1/120,inp);sim.step(1/120,inp);tt+=1/60;}
    else for(let f=0;f<40;f++){sim.step(1/40,inputAt(tt));tt+=1/40;}
    cost[mode]+=now()-a;
  }
  if(cost.skip)continue;used++;for(const m of ['A','B','C'])res[m]+=cost[m];ratios.push(cost.B/cost.A);
}
const r=ratios.sort((a,b)=>a-b);
console.log(JSON.stringify({world:wname,starts:used,failed,'ms par seconde simulée A (1 pas/image 60 Hz)':+(res.A/(used*3)).toFixed(1),'B (2 sous-pas/image)':+(res.B/(used*3)).toFixed(1),'C (pas de 25 ms)':+(res.C/(used*3)).toFixed(1),'B/A médiane':+r[r.length>>1].toFixed(3),'B/A min':+r[0].toFixed(3),'B/A max':+r.at(-1).toFixed(3),enemiesAlive:s.enemies.filter(e=>e.hp>0).length}));
