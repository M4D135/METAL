// Origine des débris « posés » qui font refuser restore() (simulation.js:2081).
// Pour chaque débris structurel au repos : instant de pose, premier instant où il recouvre un collider
// vivant (destruction.colliders + portes), révision de destruction à ces instants.
// node rubblecause.mjs <ferro> [secondes] [monde: classic-0|campaign-0|campaign-10]
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const [root,secs='30',wname='classic-0']=process.argv.slice(2);const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation']){let src=readFileSync(root+'/src/'+n+'.js','utf8');
  if(n==='simulation'){const a='function debrisHalf(q,r=q.rotation||[0,0,0]){';if(!src.includes(a))throw new Error('motif debrisHalf');src=src.replace(a,'globalThis.__dh=(...v)=>debrisHalf(...v);'+a);}
  vm.runInContext(src,ctx,{filename:n+'.js'});}
const {FWorld,FSimulation,FBrain}=ctx.window;
const W={'classic-0':[0],'campaign-0':[0,{campaign:true,campaignVersion:2}],'campaign-10':[10,{campaign:true,campaignVersion:2}]}[wname];
const world=FWorld.create(96,W[0],W[1]);const o={armorSystem:true,...(W[1]?{}:{inventory:{weapons:[true,true,true],ammo:[180,36,12]}})};
const sim=FSimulation.create(world,{...o,brain:FBrain.create({mode:'cpu'})});const s=sim.state;
const inputAt=t=>({moveX:Math.sin(t*.667),moveY:1,sprint:true,fire:(t%.333)<.1,dash:false,weapon:W[1]?undefined:Math.floor(t/6)%3,lookX:.01,lookY:0});
const over=(q,h,b)=>q.x+h[0]>b.minX+.0002&&q.x-h[0]<b.maxX-.0002&&q.y+h[1]>b.minY+.0002&&q.y-h[1]<b.maxY-.0002&&q.z+h[2]>b.minZ+.0002&&q.z-h[2]<b.maxZ-.0002;
const depth=(q,h,b)=>Math.min(q.x+h[0]-b.minX,b.maxX-(q.x-h[0]),q.y+h[1]-b.minY,b.maxY-(q.y-h[1]),q.z+h[2]-b.minZ,b.maxZ-(q.z-h[2]));
const boxesNow=()=>{const solids=sim.destruction?.colliders||world.colliders;const doors=(s.doors||[]).map(d=>({minX:d.x-d.w/2,maxX:d.x+d.w/2,minZ:d.z-d.d/2,maxZ:d.z+d.d/2,minY:(d.y||0)+(d.destroyed?1000:d.progress*(d.h+.25)),maxY:(d.y||0)+(d.destroyed?1000:d.progress*(d.h+.25))+d.h,door:true}));return [...solids,...doors];};
const info=new Map();let t=0,steps=0,firstFail=null;
while(t<+secs&&!s.dead&&!s.won){
  sim.step(1/60,inputAt(t));s.player.hp=Math.max(s.player.hp,60);t+=1/60;steps++;
  if(steps%3)continue;
  const rev=sim.destruction?.revision??0;let boxes=null;
  for(const q of s.debris){if(!q.structural)continue;let r=info.get(q.id);
    if(!q.resting){if(r&&r.restAt!==null&&r.overAt===null)r.restAt=null;continue;}
    if(!r){r={id:q.id,src:q.sourceId,restAt:null,restRev:null,overAt:null,overRev:null,depth:0,door:false};info.set(q.id,r);}
    if(r.restAt===null){r.restAt=t;r.restRev=rev;}
    if(r.overAt!==null)continue;
    boxes??=boxesNow();const h=ctx.__dh(q);const b=boxes.find(b=>over(q,h,b));
    if(b){r.overAt=t;r.overRev=rev;r.depth=depth(q,h,b);r.door=!!b.door;}
  }
  if(steps%180===0&&firstFail===null){const fresh=FSimulation.create(world,{...o,brain:FBrain.create({mode:'cpu'})});if(!s.player.airborne&&!fresh.restore(JSON.parse(JSON.stringify(sim.snapshot())),{recover:true}))firstFail=+t.toFixed(1);}
}
const rows=[...info.values()].filter(r=>r.overAt!==null);
const atRest=rows.filter(r=>r.overAt-r.restAt<.06),later=rows.filter(r=>r.overAt-r.restAt>=.06);
const laterRev=later.filter(r=>r.overRev!==r.restRev).length;
const fmt=a=>a.length?(+Math.min(...a).toFixed(3))+'…'+(+Math.max(...a).toFixed(3)):'-';
console.log(JSON.stringify({monde:wname,secondes:+t.toFixed(1),'premier refus restore (s)':firstFail,'débris posés vus':info.size,'posés en recouvrement':rows.length,
  'recouvrement dès la pose (≤0,05 s)':atRest.length,'recouvrement apparu après la pose':later.length,'dont après un changement de révision':laterRev,'dont porte':rows.filter(r=>r.door).length,
  'profondeur dès la pose (m)':fmt(atRest.map(r=>r.depth)),'profondeur après (m)':fmt(later.map(r=>r.depth)),'exemples':rows.slice(0,4).map(r=>({src:r.src,pose:+r.restAt.toFixed(2),recouvre:+r.overAt.toFixed(2),rev:[r.restRev,r.overRev],prof:+r.depth.toFixed(3)}))}));
