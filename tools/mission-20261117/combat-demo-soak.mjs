// Reproduce the title-screen worlds, loadouts, pilot and current simulation.
// No healing, checkpoint resets, fake kills or position writes during a scene.
import vm from 'node:vm';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
globalThis.window=globalThis;
for(const n of ['fmath','passages','renderer','profiles','world','destruction','economy','physics-geometry','physics','metal-physics','humanoids','actors','simulation','demo','pilot','demo-metal'])vm.runInThisContext(readFileSync(root+'src/'+n+'.js','utf8'),{filename:n+'.js'});
const seconds=Number(process.env.SCENE_SECONDS)||32, rows=[];
for(const scene of MetalDemo.scenes(96)){
 const begin=performance.now(),w=MetalDemo.world(FWorld.create(scene.seed,scene.index,{campaign:true,campaignVersion:2,profiles:true,combatVersion:1,hordeVersion:1}),scene),loadout=MetalDemo.loadout(scene.index,MetalDemo.active(scene));
 const sim=FSimulation.create(w,{...loadout,armorSystem:true,brain:null});sim.setDifficulty(0);
 const pilot=FPilot.create(sim,w,{seed:scene.seed,combatOnly:scene.combatOnly,patrol:w.attractPatrol}),activity=MetalDemo.activity(sim),s=sim.state,p=s.player,input={};
 const row={id:scene.id,world:scene.index+1,profile:s.activeProfile,spawn:[p.x,p.y,p.z],patrol:w.attractPatrol?.length||0,shots:0,kills:0,bossKills:0,bossVisibleFrames:0,death:false,collisionFrames:0,blockedRunMax:0,travel:0,shotTimes:[],waypoints:[],forcedObstacleAttacks:0};
 let blockedRun=0;const thinkTimes=[],stepTimes=[];
 for(let i=0;i<Math.round(seconds*60);i++){
  const x=p.x,y=p.y,z=p.z;let at=performance.now();pilot.think(input,1/60);thinkTimes.push(performance.now()-at);
  at=performance.now();sim.step(1/60,input);stepTimes.push(performance.now()-at);
  const moved=Math.hypot(p.x-x,p.z-z),requested=Math.hypot(input.moveX,input.moveY)>.2;
  row.travel+=moved;if(row.directorSeconds===undefined&&activity.done())row.directorSeconds=s.time;blockedRun=requested&&moved<.003?blockedRun+1:0;row.blockedRunMax=Math.max(row.blockedRunMax,blockedRun);
  if(sim.blocked(p.x,p.z,.275,p.y))row.collisionFrames++;
  if(s.enemies.some(e=>e.bossScale>1&&e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<36&&sim.sight(p.x,p.z,e.x,e.z,p.y+1.62,e.y)))row.bossVisibleFrames++;
  if(input.melee&&!s.enemies.some(e=>e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<2))row.forcedObstacleAttacks++;
  for(const e of s.events){if(e.name==='bossDeath')row.bossKills++;if(['shot','fracture'].includes(e.name)||['rocket','grenadeLaunch'].includes(e.name)&&e.owner==='player'){row.shots++;if(row.shotTimes.length<6)row.shotTimes.push(Number(s.time.toFixed(2)));}}
  s.events.length=0;
  if(i%120===0)row.waypoints.push({t:Number(s.time.toFixed(2)),x:p.x,z:p.z,y:p.y,kills:s.kills,goal:pilot.goalKey,moving:[input.moveX,input.moveY],blocked:blockedRun});
  if(s.dead||s.won)break;
 }
 const stat=a=>{a.sort((a,b)=>a-b);return {p50:a[Math.floor(a.length*.5)],p99:a[Math.floor(a.length*.99)],max:a[a.length-1]};};
 Object.assign(row,{seconds:s.time,kills:s.kills,death:s.dead,hp:p.hp,position:[p.x,p.y,p.z],pilot:{...pilot.stats},thinkMs:stat(thinkTimes),stepMs:stat(stepTimes),cpuSeconds:(performance.now()-begin)/1000});rows.push(row);console.error(JSON.stringify({...row,waypoints:undefined,pilot:undefined}));sim.dispose();
}
const result={schema:'metal-current-combat-demo-soak-v1',version:JSON.parse(readFileSync(root+'package.json','utf8')).version,seed:96,secondsPerScene:seconds,worldOptions:{campaignVersion:2,combatVersion:1,hordeVersion:1,profiles:true},note:'CPU simulation qualification, not a GPU frame-rate benchmark. No checkpoint restoration or player-state writes.',rows};
const invalid=rows.filter(r=>!r.kills||!r.shots||r.collisionFrames||r.bossKills||r.bossVisibleFrames||r.forcedObstacleAttacks||r.blockedRunMax>30);result.ok=invalid.length===0;if(invalid.length)process.exitCode=1;
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
