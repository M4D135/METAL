// Partie complète pilotée : node play.mjs <ferro> [secondes] [intervalle_ms|pattern] [monde]
// pattern : 60 (16,667 fixe), 59.94, q60 (16,6/16,7 arrondi 0,1 ms), 144, 120, 30, 48
import {createHarness,stats,realNow} from './harness.mjs';
const root=process.argv[2],seconds=+(process.argv[3]||30),pattern=process.argv[4]||'60',worldIndex=process.argv[5]===undefined?null:+process.argv[5];
const H=await createHarness(root);
await H.startGame();
if(worldIndex!==null){H.G.load(worldIndex,96,undefined,true,2);H.G.saveCheckpoint();H.G.start('bench');}
const sim=()=>H.G.sim;
function intervals(p){
  if(p==='59.94')return ()=>1000/59.94;
  if(p==='q60'){let t=0;return ()=>{const a=Math.round(t*10)/10;t+=1000/60;return Math.round(t*10)/10-a;};}
  if(p==='jitter60'){let k=0;return ()=>16.667+((k++*7919)%7-3)*.25;}
  return ()=>1000/(+p);
}
const next=intervals(pattern);
for(const k of Object.keys(H.C.probes))delete H.C.probes[k];
H.C.stepMs.length=0;H.C.stepCount=0;H.C.storage.set=0;H.C.storage.ms=0;H.resetDom();
const frameMs=[],stepsPerFrame=[],hud=[];let t=H.now,frames=0,lastSteps=0,elapsed=0;
H.key('keydown','KeyW');H.key('keydown','ShiftLeft');
const s0=sim().state;const shots0=s0.shots,kills0=s0.kills;if(process.env.MARK)console.log('PLAY-START');
while(elapsed<seconds*1000){
  const dt=next();t+=dt;elapsed+=dt;frames++;
  // entrées : strafe alterné, rafales, souris, esquive
  // entrées indexées sur le temps (comparables entre cadences)
  const slot=k=>Math.floor((elapsed)/k),prevSlot=k=>Math.floor((elapsed-dt)/k);
  if(slot(1500)!==prevSlot(1500)){const phase=slot(1500)%2;H.key('keyup',phase?'KeyA':'KeyD');H.key('keydown',phase?'KeyD':'KeyA');}
  const inBurst=v=>(v%333)<100;if(inBurst(elapsed)&&!inBurst(elapsed-dt))H.mouse.down(0);if(!inBurst(elapsed)&&inBurst(elapsed-dt))H.mouse.up(0);
  if(slot(4000)!==prevSlot(4000))H.key('keydown','Space');else if(Math.floor((elapsed-dt)/4000)!==Math.floor((elapsed-2*dt)/4000))H.key('keyup','Space');
  H.mouse.move(dt*.36,(elapsed%2000<1000)?-dt/16:dt/16);
  const domBefore={...H.C.dom},r0=realNow();
  H.frame(t);
  const d=realNow()-r0;frameMs.push(d);stepsPerFrame.push(H.C.stepCount-lastSteps);lastSteps=H.C.stepCount;
  const hudCalls=H.C.probes.renderHUD?.n||0;
  if(hudCalls!==hud.length){const delta={};for(const k in H.C.dom)delta[k]=H.C.dom[k]-domBefore[k];hud.push(delta);}
  if(H.G.mode!=='playing'){console.log('mode',H.G.mode,'at',elapsed.toFixed(0));if(H.G.mode==='dead'||H.G.mode==='cleared')break;H.G.setMode('playing');}
}
if(process.env.MARK)console.log('PLAY-END');const s=sim().state;
const probes=Object.fromEntries(Object.entries(H.C.probes).map(([k,v])=>[k,{totalMs:+v.ms.toFixed(1),n:v.n,avgMs:+(v.ms/v.n).toFixed(3),maxMs:+v.max.toFixed(2),perFrameMs:+(v.ms/frames).toFixed(3)}]).sort((a,b)=>b[1].totalMs-a[1].totalMs));
const sum=a=>a.reduce((x,y)=>x+y,0),hudAvg={};for(const k of Object.keys(hud[0]||{}))hudAvg[k]=+(sum(hud.map(h=>h[k]))/hud.length).toFixed(1);
console.log(JSON.stringify({pattern,seconds,frames,world:H.G.world.campaign?'campaign '+H.G.stage:'classic',frame:stats(frameMs),steps:{total:H.C.stepCount,perFrame:+(H.C.stepCount/frames).toFixed(3),hist:stepsPerFrame.reduce((h,n)=>(h[n]=(h[n]||0)+1,h),{})},step:stats(H.C.stepMs),
  shots:s.shots-shots0,kills:s.kills-kills0,hp:Math.round(s.player.hp),meshesLastFrame:H.C.meshes,draws:H.C.drawCount,storage:H.C.storage,hudTicks:hud.length,domPerHudTick:hudAvg,canvasCallsPerHud:+(H.C.canvas.calls/Math.max(1,hud.length)).toFixed(1),audioParamPerFrame:+(H.C.audio.param/frames).toFixed(1),audioNodesPerFrame:+(H.C.audio.nodes/frames).toFixed(2),topParams:Object.entries(H.C.audio.byParam).sort((a,b)=>b[1]-a[1]).slice(0,8),probes},null,1));
process.exit(0);
