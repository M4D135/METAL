// Coût des points de reprise (game.js:94 saveCheckpoint) : sim.snapshot + JSON.stringify,
// cas normal et cas « carte de navigation en attente » (après une explosion), plus reprise.
// node snapshot.mjs <ferro>
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const root=process.argv[2];const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld,FSimulation,FBrain}=ctx.window;const now=()=>performance.now();
const time=(f)=>{const t=now();const r=f();return [r,now()-t];};
const med=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const out=[];
for(const [label,idx,opts] of [['classic-0',0],['classic-2',2],['campaign-0',0,{campaign:true,campaignVersion:2}],['campaign-9',9,{campaign:true,campaignVersion:2}],['campaign-15',15,{campaign:true,campaignVersion:2}],['campaign-17',17,{campaign:true,campaignVersion:2}]]){
  const world=FWorld.create(96,idx,opts),brain=FBrain.create({mode:'cpu'});
  const sim=FSimulation.create(world,{armorSystem:true,brain});const s=sim.state,input={moveX:0,moveY:1,sprint:true,lookX:0,lookY:0};
  for(let i=0;i<300;i++){input.moveX=Math.sin(i/90);s.player.yaw+=.01;sim.step(1/60,input);}
  const snaps=[],strs=[];let json='';
  for(let k=0;k<7;k++){const [snap,a]=time(()=>sim.snapshot());const [j,b]=time(()=>JSON.stringify(snap));snaps.push(a);strs.push(b);json=j;}
  // Explosion près du joueur : la destruction remet toute la grille de navigation en file.
  const p=s.player,cx=sim.nav.nx,pendingBefore=s.aiStats?.navPending;
  let blasted=0;for(const [dx,dz] of [[3,0],[-3,0],[0,3],[0,-3],[4,4]]){const rev=sim.destruction?.revision;sim.destruction?.blast([p.x+dx,(p.y||0)+1,p.z+dz],3.5,80);if(sim.destruction?.revision!==rev)blasted++;}
  sim.step(1/60,input);const pending=s.aiStats?.navPending;
  const [snap2,c]=time(()=>sim.snapshot());const [j2,d]=time(()=>JSON.stringify(snap2));
  const [parsed,e]=time(()=>JSON.parse(j2));
  const [sim2,f]=time(()=>FSimulation.create(world,{armorSystem:true,brain:FBrain.create({mode:'cpu'})}));const [ok,g]=time(()=>sim2.restore(parsed,{recover:true}));
  const sizes=Object.fromEntries(Object.entries(snap2.state).map(([k,v])=>[k,JSON.stringify(v).length]).sort((a,b)=>b[1]-a[1]).slice(0,5));
  out.push({label,navCells:sim.nav.cells.length,enemies:s.enemies.length,chars:json.length,snapshotMs:+med(snaps).toFixed(2),snapshotFirstMs:+snaps[0].toFixed(2),stringifyMs:+med(strs).toFixed(2),
    blasts:blasted,navPendingAfterBlast:pending,snapshotWithPendingNavMs:+c.toFixed(2),stringifyAfterMs:+d.toFixed(2),charsAfter:j2.length,destructionChars:JSON.stringify(snap2.destruction).length,parseMs:+e.toFixed(2),createMs:+f.toFixed(1),restoreMs:+g.toFixed(1),restoreOk:ok,biggest:sizes});
}
console.log(JSON.stringify(out,null,1));
