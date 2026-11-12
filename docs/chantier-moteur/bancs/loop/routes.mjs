// Détail des recherches route() (A*, simulation.js:1402-1430) : durée, rayon, nœuds explorés,
// appels segmentFree, succès. node routes.mjs <ferro> [monde] [secondes]
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const [root,wname='campaign-9',secs='30']=process.argv.slice(2);
const ctx={window:{},performance,console,Math,Date,__sf:0,__rx:0,__routes:[]};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation']){let src=readFileSync(root+'/src/'+n+'.js','utf8');
  if(n==='simulation'){
    const rep=(a,b)=>{if(!src.includes(a))throw new Error('motif '+a);src=src.replace(a,b);};
    rep('function segmentFree(ax,az,bx,bz,r=.4){','function segmentFree(ax,az,bx,bz,r=.4){globalThis.__sf++;');
    rep('while(heap.length&&explored++<2400){','while(heap.length&&explored++<2400&&(globalThis.__rx=explored)){');
    rep('function route(e,x,z){','function route(...a){const t0=performance.now(),sf0=globalThis.__sf;globalThis.__rx=0;const out=route__o(...a);globalThis.__routes.push({ms:performance.now()-t0,r:radius(a[0]),type:a[0].type,giant:!!giant(a[0]),explored:globalThis.__rx,sf:globalThis.__sf-sf0,ok:out!==null,t:s.time});return out;}function route__o(e,x,z){');
  }
  vm.runInContext(src,ctx,{filename:n+'.js'});}
const {FWorld,FSimulation,FBrain}=ctx.window;
const W={'legacy-s0':[0],'campaign-9':[9,{campaign:true,campaignVersion:2}],'campaign-10':[10,{campaign:true,campaignVersion:2}]}[wname];
const world=FWorld.create(96,W[0],W[1]);const opts={armorSystem:true,...(W[1]?{}:{inventory:{weapons:[true,true,true],ammo:[180,36,12]}})};
const inputAt=t=>({moveX:Math.sin(t*.667),moveY:1,sprint:true,fire:(t%.333)<.1,dash:false,weapon:W[1]?undefined:Math.floor(t/6)%3,lookX:.01,lookY:0});
{const w=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})});let t=0;for(let i=0;i<600;i++){w.step(1/60,inputAt(t));w.state.player.hp=Math.max(w.state.player.hp,60);t+=1/60;}}
ctx.__routes.length=0;
const sim=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})});const s=sim.state;let t=0;
while(t<+secs&&!s.dead&&!s.won){sim.step(1/60,inputAt(t));s.player.hp=Math.max(s.player.hp,60);t+=1/60;}
const R=ctx.__routes.filter(x=>x.explored>0),all=ctx.__routes;
const sum=a=>a.reduce((v,x)=>v+x.ms,0);
const big=R.filter(x=>x.r>.4),small=R.filter(x=>x.r<=.4),fail=R.filter(x=>!x.ok),cap=R.filter(x=>x.explored>=2400);
console.log(JSON.stringify({monde:wname,'appels route':all.length,'recherches A*':R.length,'ms total':+sum(R).toFixed(1),
 'r>0,4 : recherches / ms':[big.length,+sum(big).toFixed(1)],'r≤0,4 : recherches / ms':[small.length,+sum(small).toFixed(1)],
 'échecs (null) : n / ms':[fail.length,+sum(fail).toFixed(1)],'plafond 2400 nœuds atteint : n / ms':[cap.length,+sum(cap).toFixed(1)],
 'segmentFree par recherche (moy.)':+(R.reduce((v,x)=>v+x.sf,0)/Math.max(1,R.length)).toFixed(0),'recherches >10 ms':R.filter(x=>x.ms>10).length,'recherches >50 ms':R.filter(x=>x.ms>50).length}));
for(const x of [...R].sort((a,b)=>b.ms-a.ms).slice(0,8))console.log(x.t.toFixed(2)+'s',x.ms.toFixed(1)+'ms','r='+x.r.toFixed(2),'type',x.type,'géant',x.giant,'nœuds',x.explored,'segmentFree',x.sf,'trouvé',x.ok);
