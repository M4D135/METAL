// Émule la boucle game.js:675 (pas variables ceil(dt*60)) + les points de reprise de events()
// (game.js:193-238) sur un combat réel, et compare d'autres schémas de pas.
// node combat.mjs <ferro> [scheme] [world] [seconds]
// scheme : current | fixed60 | fixed120 | bounded
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const [root,scheme='current',worldName='legacy-s0',seconds='30',pattern='q60',variant='0']=process.argv.slice(2);const V=+variant;
const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld,FSimulation,FBrain}=ctx.window;const now=()=>performance.now();
const worlds={'legacy-s0':[0],'legacy-s2':[2],'campaign-w10':[9,{campaign:true,campaignVersion:2}],'campaign-w16':[15,{campaign:true,campaignVersion:2}]};
const [idx,opts]=worlds[worldName];const world=FWorld.create(96,idx,opts);
const sim=FSimulation.create(world,{armorSystem:true,brain:FBrain.create({mode:'cpu'}),...(opts?{}:{inventory:{weapons:[true,true,true],ammo:[180,36,12]}})});const s=sim.state;
const CHECK=new Set(['core','mechanism','armorPickup','bossReward','weaponPickup','shieldPickup','trophy','trophyComplete','encounterClear','bossDeath']);
const intervals={q60:(()=>{let t=0;return ()=>{const a=Math.round(t*10)/10;t+=1000/60;return Math.round(t*10)/10-a;};})(),'60':()=>1000/60,'59.94':()=>1000/59.94,'144':()=>1000/144,'30':()=>1000/30};
const nextInterval=intervals[pattern];
let acc=0;const H=scheme==='fixed120'?1/120:1/60;
function partition(dt){
  if(scheme==='current'){const steps=Math.max(1,Math.ceil(dt*60));return Array(steps).fill(dt/steps);}
  if(scheme==='bounded'){const steps=Math.max(1,Math.ceil(dt/.025-1e-9));return Array(steps).fill(dt/steps);}
  // accumulateur à pas fixe, au plus 5 pas par image, reste conservé (interpolation de rendu)
  acc+=dt;const out=[];while(acc>=H-1e-9&&out.length<5){out.push(H);acc-=H;}if(out.length===5)acc=Math.min(acc,H);return out;
}
const input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0,weapon:0};
const frameCpu=[],stepCpu=[],checkpoints=[],spikes=[];let t=0,frames=0,pendingSteps=0,steps=0,cp=0,checkpointPending=false,lastRev=sim.destruction?.revision,revChanges=0;
const total=+seconds;
while(t<total&&!s.dead&&!s.won){
  const dt=Math.min(.12,nextInterval()/1000);frames++;
  // entrées dérivées du temps : identiques quel que soit le schéma
  input.moveX=Math.sin(t*.667+V*1.7);input.fire=(t%.333)<.1;input.dash=Math.floor(t/4)!==Math.floor((t-dt)/4);input.weapon=Math.floor(t/6)%3;
  input.lookX=(.6+V*.15)*dt;input.lookY=0;
  const f0=now();let first=true;
  for(const part of partition(dt)){
    const a=now();sim.step(part,input);const d=now()-a;stepCpu.push(d);steps++;
    if(!first){input.lookX=input.lookY=0;input.dash=false;}first=false;
    if(s.aiStats?.navPending>0)pendingSteps++;
    if(sim.destruction?.revision!==lastRev){lastRev=sim.destruction.revision;revChanges++;}
    const names=s.events.map(e=>e.name);let due=names.some(n=>CHECK.has(n))||s.events.some(e=>e.name==='liftStop'&&e.carrying||e.name==='lootPickup'&&(e.boss||e.armor>0));
    s.events.length=0;
    if(due||checkpointPending&&!s.player.airborne){
      if(s.player.airborne){checkpointPending=true;}else{checkpointPending=false;const pending=s.aiStats?.navPending||0;const c0=now();const json=JSON.stringify(sim.snapshot());const c=now()-c0;cp++;checkpoints.push({t:+t.toFixed(2),ms:+c.toFixed(1),navPending:pending,chars:json.length,why:names.filter(n=>CHECK.has(n)||n==='lootPickup'||n==='liftStop').join(',')});}
    }
    if(d>8)spikes.push([+t.toFixed(2),+d.toFixed(1)]);
    t+=part;
  }
  frameCpu.push(now()-f0);
}
const st=a=>{const q=[...a].sort((x,y)=>x-y),p=k=>q[Math.min(q.length-1,Math.floor(q.length*k))];return {avg:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3),p50:+p(.5).toFixed(3),p99:+p(.99).toFixed(2),max:+q.at(-1).toFixed(1),over8:a.filter(x=>x>8).length,over16:a.filter(x=>x>16.7).length};};
const cpuPerSimSecond=+(stepCpu.reduce((a,b)=>a+b,0)/t).toFixed(1);console.log(JSON.stringify({cpuPerSimSecond,variant:V,scheme,pattern,world:worldName,simTime:+t.toFixed(2),frames,steps,stepsPerFrame:+(steps/frames).toFixed(3),frameCpu:st(frameCpu),stepCpu:st(stepCpu),navPendingShare:+(pendingSteps/steps).toFixed(3),destructionRevisions:revChanges,kills:s.kills,shots:s.shots,dead:s.dead,checkpoints,spikes:spikes.slice(0,10),nSpikes:spikes.length}));
