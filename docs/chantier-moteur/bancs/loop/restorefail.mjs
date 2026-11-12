// Diagnostic : quelle vérification de restore() rejette des points de reprise pris en combat ?
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const [root,wname='legacy-s0']=process.argv.slice(2);const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation']){let src=readFileSync(root+'/src/'+n+'.js','utf8');
  if(n==='simulation'){const a="require=condition=>{if(!condition)throw new Error('Invalid checkpoint');};";if(!src.includes(a))throw new Error('pattern');src=src.replace(a,"require=condition=>{if(!condition){const e=new Error('Invalid checkpoint');globalThis.__fail=(e.stack.split('\\n')[2]||'').trim();throw e;}};");}
  if(n==='simulation'){const b="require(!supportBoxes.some(box=>debrisOverlaps(q,h,box)));";if(!src.includes(b))throw new Error('pattern2');src=src.replace(b,"{const bad=supportBoxes.find(box=>debrisOverlaps(q,h,box));if(bad){const kind=savedSolids.includes(bad)?'solide':savedDoors.includes(bad)?'porte':savedTrapBoxes.includes(bad)?'piège':'ascenseur';const depth=Math.min(q.x+h[0]-bad.minX,bad.maxX-(q.x-h[0]),q.y+h[1]-bad.minY,bad.maxY-(q.y-h[1]),q.z+h[2]-bad.minZ,bad.maxZ-(q.z-h[2]));globalThis.__rubble={kind,depth:+depth.toFixed(4),source:q.sourceId,shape:q.shape,size:q.size.map(v=>+v.toFixed(2)),bottom:+(q.y-h[1]).toFixed(3),boxTop:+bad.maxY.toFixed(3),boxBottom:+bad.minY.toFixed(3),boxId:bad.id||bad.sourceId||null};}require(!bad);}");}
  vm.runInContext(src,ctx,{filename:n+'.js'});}
const {FWorld,FSimulation,FBrain}=ctx.window;
const W={'legacy-s0':[0],'campaign-9':[9,{campaign:true,campaignVersion:2}]}[wname];
const world=FWorld.create(96,W[0],W[1]);const opts={armorSystem:true,...(W[1]?{}:{inventory:{weapons:[true,true,true],ammo:[180,36,12]}})};
const main=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})});const s=main.state;
const inputAt=t=>({moveX:Math.sin(t*.667),moveY:1,sprint:true,fire:(t%.333)<.1,dash:false,weapon:Math.floor(t/6)%3,lookX:.01,lookY:0});
let t=0;const lines=readFileSync(root+'/src/simulation.js','utf8').split('\n');
for(let k=0;k<10;k++){
  for(let i=0;i<90||s.player.airborne;i++){main.step(1/60,inputAt(t));t+=1/60;}
  if(s.dead)break;
  const snap=main.snapshot();const sim=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})});ctx.__fail=null;ctx.__rubble=null;
  const ok=sim.restore(JSON.parse(JSON.stringify(snap)),{recover:true});
  let where='';if(!ok&&ctx.__fail){const m=ctx.__fail.match(/simulation\.js:(\d+):(\d+)/);if(m){const L=lines[+m[1]-1];where='L'+m[1]+':'+m[2]+' … '+L.slice(Math.max(0,+m[2]-120),+m[2]+80);}}
  console.log('t',t.toFixed(1),'ok',ok,ok?'':JSON.stringify(ctx.__rubble),'hp',Math.round(s.player.hp),'dead',s.dead,'rev',main.destruction?.revision,where);
}
