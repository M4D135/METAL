// Banc DEMO — session d'endurance : le pilote (ou un flux d'entrées enregistré) traverse les mondes de campagne v2.
// Tout tourne dans le domaine principal de Node, sim.step à pas fixe 1/60. Le dépôt METAL n'est que lu.
import {loadMain,q} from './load.mjs';
import {createPilot} from './pilot.mjs';
export const W=loadMain();
export const HZ=60,DT=1/HZ,REC=8; // 8 octets par pas : moveX i8, moveY i8, lookX i16, lookY i16, boutons u8, arme u8
const LOOK=16384;
// Machine très chargée : on mesure le temps CPU du fil (process.threadCpuUsage), pas l'horloge murale.
const hasThread=typeof process.threadCpuUsage==='function';
export const cpuNow=()=>{const u=hasThread?process.threadCpuUsage():process.cpuUsage();return (u.user+u.system)/1000;};
// Quantification AVANT simulation : la simulation ne voit que des valeurs représentables dans le flux enregistré.
export function encode(input,view,o){
  const mx=Math.max(-127,Math.min(127,Math.round((input.moveX||0)*127))),my=Math.max(-127,Math.min(127,Math.round((input.moveY||0)*127)));
  const lx=Math.max(-32767,Math.min(32767,Math.round((input.lookX||0)*LOOK))),ly=Math.max(-32767,Math.min(32767,Math.round((input.lookY||0)*LOOK)));
  view.setInt8(o,mx);view.setInt8(o+1,my);view.setInt16(o+2,lx,true);view.setInt16(o+4,ly,true);
  view.setUint8(o+6,(input.fire?1:0)|(input.fireLeft?2:0)|(input.dash?4:0)|(input.pulse?8:0)|(input.melee?16:0)|(input.interact?32:0)|(input.sprint?64:0)|(input.assist?128:0));
  view.setUint8(o+7,Number.isInteger(input.weapon)?input.weapon:255);
}
export function decode(view,o,input){
  input.moveX=view.getInt8(o)/127;input.moveY=view.getInt8(o+1)/127;input.lookX=view.getInt16(o+2,true)/LOOK;input.lookY=view.getInt16(o+4,true)/LOOK;
  const b=view.getUint8(o+6);input.fire=!!(b&1);input.fireLeft=!!(b&2);input.dash=!!(b&4);input.pulse=!!(b&8);input.melee=!!(b&16);input.interact=!!(b&32);input.sprint=!!(b&64);input.assist=!!(b&128);
  const w=view.getUint8(o+7);input.weapon=w===255?undefined:w;return input;
}
const f64=new Float64Array(1),u32=new Uint32Array(f64.buffer);
const mix=(h,v)=>{f64[0]=v;h=Math.imul(h^u32[0],16777619);return Math.imul(h^u32[1],16777619);};
export function digest(s,h){const p=s.player;h=mix(h,p.x);h=mix(h,p.y);h=mix(h,p.z);h=mix(h,p.yaw);h=mix(h,p.pitch);h=mix(h,p.hp);h=mix(h,s.kills);h=mix(h,s.relays);for(const e of s.enemies){h=mix(h,e.x);h=mix(h,e.z);h=mix(h,e.hp);}h=mix(h,s.debris?.length||0);return h>>>0;}
const CHECKPOINT_EVENTS=new Set(['core','mechanism','armorPickup','bossReward','weaponPickup','shieldPickup','trophy','trophyComplete','encounterClear','bossDeath']);

export function runSession(o={}){
  const {minutes=30,startIndex=0,seed=96,difficulty=1,assist=true,checkpoints=true,replay=null,record=true,worldCapS=600,stallS=50,log=()=>{},memoryEveryS=60,sampleDigest=true,onStep=null,maxWorlds=1e9,wallLimitMs=Infinity,startLoadout=null,digestEvery=600}=o;
  const {FWorld,FSimulation,FBrain}=o.W||W;
  const totalSteps=replay?replay.steps:Math.round(minutes*60*HZ);
  const buf=replay?replay.bytes:new Uint8Array(record?totalSteps*REC:REC),view=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
  const brain=FBrain.create({mode:'cpu'});
  const out={steps:0,simSeconds:0,worlds:[],worldsWon:0,deaths:0,restoresOk:0,restoresRefused:0,stalls:0,timeouts:0,exceptions:[],relays:0,mechanisms:0,kills:0,shots:0,hits:0,bossKills:0,
    stepMs:[],thinkList:[],thinkMs:0,stepTotalMs:0,wallStepMs:0,checkpointMs:[],worldGenMs:[],simCreateMs:[],memory:[],caps:{},hist:new Array(10).fill(0),spikes:[],weaponsFired:[0,0,0,0,0],destructionRevisions:0,assistHp:0,digests:[],finalDigest:0,events:{}};
  const EDGES=[.125,.25,.5,1,2,4,8,16,33];
  let index=startIndex,world,sim,s,pilot,carry=null,entryLoadout=null,checkpoint=null,checkpointPending=false,worldStartStep=0,lastRev=0,h=2166136261,row=null,lastObjectiveT=0,lastObjectiveKey='',stallCount=0;
  const input={moveX:0,moveY:0,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:false,assist:false};
  function openWorld(i,loadout,why){
    let t=cpuNow();world=FWorld.create(seed,i%18,{campaign:true,campaignVersion:2});out.worldGenMs.push(cpuNow()-t);
    t=cpuNow();sim?.dispose?.();sim=FSimulation.create(world,{...(loadout||{}),armorSystem:true,brain});sim.setDifficulty(difficulty);out.simCreateMs.push(cpuNow()-t);
    s=sim.state;entryLoadout=sim.exportLoadout();checkpoint=null;checkpointPending=false;lastRev=s.destructionRevision??0;
    pilot=replay?null:createPilot(sim,world);worldStartStep=out.steps;lastObjectiveT=0;lastObjectiveKey='';stallCount=0;
    row={index:i%18,title:world.title,why,startStep:out.steps,won:false,seconds:0,deaths:0,stalls:0,relays:0,mechanisms:0,kills:0,bossHpLeft:null,restoresRefused:0,timeout:false,navCells:sim.nav.cells.length};out.worlds.push(row);
    log('monde '+(i%18+1)+' « '+world.title+' » ('+why+') à '+(out.steps/HZ).toFixed(0)+' s');
  }
  function closeRow(){const B=s.enemies.find(e=>e.type===3&&e.bossScale>1);row.seconds=+((out.steps-row.startStep)/HZ).toFixed(1);row.relays=s.relays;row.mechanisms=s.mechanisms.filter(m=>m.active).length;row.kills=s.kills;row.bossHpLeft=B?+B.hp.toFixed(0):null;row.bossMaxHp=B?.maxHp;row.hp=+s.player.hp.toFixed(0);if(pilot){row.pilot={...pilot.stats};row.lastGoal=pilot.goalKey;}}
  function takeCheckpoint(){
    if(!checkpoints||s.dead||s.won)return;if(s.player.airborne){checkpointPending=true;return;}
    checkpointPending=false;const t=cpuNow();checkpoint=sim.snapshot();out.checkpointMs.push(cpuNow()-t);
  }
  function afterDeath(){
    out.deaths++;row.deaths++;
    let ok=false;
    if(checkpoint){const t=performance.now();const next=FSimulation.create(world,{...(entryLoadout||{}),armorSystem:true,brain});ok=next.restore(JSON.parse(JSON.stringify(checkpoint)),{recover:true});out.simCreateMs.push(performance.now()-t);
      if(ok){sim.dispose();sim=next;sim.setDifficulty(difficulty);s=sim.state;pilot=replay?null:createPilot(sim,world);out.restoresOk++;lastRev=s.destructionRevision??0;}else{next.dispose();out.restoresRefused++;row.restoresRefused++;}}
    if(!ok){const keep=row;const i=index;openWorld(i,entryLoadout,'reprise à l’entrée');out.worlds.pop();row=keep;}
    lastObjectiveT=out.steps/HZ;
  }
  openWorld(index,startLoadout,'départ');
  let nextMemory=0;
  const startWall=performance.now();
  for(let step=0;step<totalSteps&&out.worlds.length<=maxWorlds;step++){
    if((step&255)===0&&performance.now()-startWall>wallLimitMs){out.wallStopped=true;break;}
    try{
      if(replay)decode(view,step*REC,input);
      else{const t=cpuNow();pilot.think(input,DT);const tk=cpuNow()-t;out.thinkMs+=tk;out.thinkList.push(tk);const at=record?step*REC:0;encode(input,view,at);decode(view,at,input);}
      const w0=performance.now(),t0=cpuNow();sim.step(DT,input);const ms=cpuNow()-t0,wall=performance.now()-w0;out.wallStepMs+=wall;
      out.stepMs.push(ms);out.stepTotalMs+=ms;let bi=0;while(bi<EDGES.length&&ms>=EDGES[bi])bi++;out.hist[bi]++;
      if(ms>8&&out.spikes.length<400)out.spikes.push({step,t:+(step/HZ).toFixed(1),ms:+ms.toFixed(1),world:index%18,ev:[...new Set(s.events.map(e=>e.name))].slice(0,8),routes:s.aiStats?.routeSearches,nav:s.aiStats?.navUpdates});
      let due=false,won=false,dead=false;
      for(const e of s.events){
        out.events[e.name]=(out.events[e.name]||0)+1;
        if(CHECKPOINT_EVENTS.has(e.name)||e.name==='liftStop'&&e.carrying||e.name==='lootPickup'&&(e.boss||e.armor>0))due=true;
        if(e.name==='shot'||e.name==='fracture')out.weaponsFired[e.weapon??s.weapon]++;if((e.name==='rocket'||e.name==='grenadeLaunch')&&e.owner==='player')out.weaponsFired[e.weapon??s.weapon]++;
        if(e.name==='bossDeath')out.bossKills++;if(e.name==='core')out.relays++;if(e.name==='mechanism')out.mechanisms++;
        if(e.name==='win')won=true;if(e.name==='dead')dead=true;
      }
      s.events.length=0;
      const rev=s.destructionRevision??0;if(rev!==lastRev){out.destructionRevisions++;lastRev=rev;}
      if(due||checkpointPending&&!s.player.airborne)takeCheckpoint();
      // aide discrète à la survie : fonction pure de l'état, appliquée à l'identique à l'enregistrement et au rejeu
      if(assist&&!s.dead&&!s.won&&s.player.hp<30){const add=Math.min(30-s.player.hp,22*DT);s.player.hp+=add;out.assistHp+=add;}
      out.steps++;h=digest(s,h);if(sampleDigest&&step%digestEvery===digestEvery-1)out.digests.push(h);
      if(onStep)onStep(step,s,sim,input,pilot);
      const tNow=out.steps/HZ;
      if(pilot){const BB=s.enemies.find(e=>e.type===3&&e.bossScale>1),key=(BB&&BB.bossAwake?'boss':pilot.goalKey)+'|'+s.relays+'|'+s.mechanisms.filter(m=>m.active).length+'|'+s.kills+'|'+(BB?Math.ceil(BB.hp/BB.maxHp*30):0);if(key!==lastObjectiveKey){lastObjectiveKey=key;lastObjectiveT=tNow;}}
      if(won){out.worldsWon++;row.won=true;closeRow();out.kills+=s.kills;out.shots+=s.shots;out.hits+=s.hits;carry=sim.exportLoadout();index++;openWorld(index,carry,'monde suivant');}
      else if(dead||s.dead){closeRow();afterDeath();}
      else if(pilot&&tNow-lastObjectiveT>stallS){out.stalls++;row.stalls++;stallCount++;closeRow();log('  blocage au monde '+(index%18+1)+' objectif '+pilot.goalKey+' pos '+s.player.x.toFixed(1)+','+s.player.y.toFixed(1)+','+s.player.z.toFixed(1)+' bloqués '+pilot.blockedKeys().join(' '));
        (row.stallLog||(row.stallLog=[])).push({t:+tNow.toFixed(0),goal:pilot.goalKey,x:+s.player.x.toFixed(1),y:+s.player.y.toFixed(1),z:+s.player.z.toFixed(1),relays:s.relays,mech:s.mechanisms.filter(m=>m.active).length});
        if(stallCount>=2){out.kills+=s.kills;out.shots+=s.shots;out.hits+=s.hits;row.timeout=true;out.timeouts++;carry=sim.exportLoadout();index++;openWorld(index,carry,'saut après blocage');}else{pilot.reset();lastObjectiveT=tNow;}}
      else if((out.steps-worldStartStep)/HZ>worldCapS){closeRow();row.timeout=true;out.timeouts++;out.kills+=s.kills;out.shots+=s.shots;out.hits+=s.hits;carry=sim.exportLoadout();index++;openWorld(index,carry,'saut après délai');}
      if(tNow>=nextMemory){nextMemory+=memoryEveryS;if(globalThis.gc)globalThis.gc();const m=process.memoryUsage();out.memory.push({t:+tNow.toFixed(0),heapMB:+(m.heapUsed/1048576).toFixed(2),rssMB:+(m.rss/1048576).toFixed(1),abMB:+(m.arrayBuffers/1048576).toFixed(2)});}
      if(step%120===0)for(const k of ['enemies','debris','particles','projectiles','explosions','bullets','loot','bossAttacks','pickups'])out.caps[k]=Math.max(out.caps[k]||0,s[k]?.length||0);
    }catch(error){
      out.exceptions.push({step,world:index%18,message:String(error&&error.stack||error).slice(0,600)});log('  EXCEPTION '+String(error&&error.message||error));
      if(out.exceptions.length>20)break;
      // garde-fou : une exception ferme le monde et passe au suivant
      try{index++;openWorld(index,carry,'saut après exception');}catch(e2){out.exceptions.push({step,message:'ouverture impossible : '+String(e2)});break;}
    }
  }
  closeRow();out.wallMs=performance.now()-startWall;out.simSeconds=out.steps/HZ;out.finalDigest=h>>>0;out.record=record&&!replay?{bytes:buf,steps:out.steps}:null;
  sim.dispose();brain.dispose?.();
  return out;
}
export function summarize(out){
  const st=out.stepMs,sum=st.reduce((a,b)=>a+b,0);
  const mem=out.memory.slice(Math.min(3,Math.max(0,out.memory.length-3)));let slope=null;
  if(mem.length>=3){const n=mem.length,mx=mem.reduce((a,m)=>a+m.t,0)/n,my=mem.reduce((a,m)=>a+m.heapMB,0)/n;let num=0,den=0;for(const m of mem){num+=(m.t-mx)*(m.heapMB-my);den+=(m.t-mx)**2;}slope=den?num/den*3600:null;}
  return {simMinutes:+(out.simSeconds/60).toFixed(1),wallS:+(out.wallMs/1000).toFixed(1),worldsWon:out.worldsWon,worldsOpened:out.worlds.length,deaths:out.deaths,restoresOk:out.restoresOk,restoresRefused:out.restoresRefused,stalls:out.stalls,timeouts:out.timeouts,exceptions:out.exceptions.length,
    relays:out.relays,mechanisms:out.mechanisms,bossKills:out.bossKills,kills:out.kills,weaponsFired:out.weaponsFired,destructionRevisions:out.destructionRevisions,assistHp:+out.assistHp.toFixed(0),
    step:{mean:+(sum/st.length).toFixed(3),p50:+q(st,.5).toFixed(3),p95:+q(st,.95).toFixed(3),p99:+q(st,.99).toFixed(3),p999:+q(st,.999).toFixed(2),max:+Math.max(...st).toFixed(1),over8:st.filter(v=>v>8).length,over16:st.filter(v=>v>16).length,over33:st.filter(v=>v>33).length},
    hist:{edgesMs:[.125,.25,.5,1,2,4,8,16,33],counts:out.hist},thinkMsPerStep:+(out.thinkMs/Math.max(1,out.steps)).toFixed(4),think:{p50:+q(out.thinkList,.5).toFixed(4),p99:+q(out.thinkList,.99).toFixed(3),p999:+q(out.thinkList,.999).toFixed(2),max:+Math.max(0,...out.thinkList).toFixed(1),over4:out.thinkList.filter(v=>v>4).length},wallOverCpu:+(out.wallStepMs/Math.max(1e-9,out.stepTotalMs)).toFixed(2),cpuClock:hasThread?'thread':'process',
    checkpoint:{n:out.checkpointMs.length,p50:+q(out.checkpointMs,.5).toFixed(2),max:+Math.max(0,...out.checkpointMs).toFixed(1)},worldGenMs:{p50:+q(out.worldGenMs,.5).toFixed(0),max:+Math.max(...out.worldGenMs).toFixed(0)},simCreateMs:{p50:+q(out.simCreateMs,.5).toFixed(0),max:+Math.max(...out.simCreateMs).toFixed(0)},
    memory:{first:out.memory[0],last:out.memory[out.memory.length-1],min:Math.min(...out.memory.map(m=>m.heapMB)),max:Math.max(...out.memory.map(m=>m.heapMB)),slopeMBperHour:slope===null?null:+slope.toFixed(2),samples:out.memory.length},caps:out.caps,finalDigest:out.finalDigest.toString(16)};
}

export function plausibleLoadout(index,{ammoFraction=1}={}){
  const E=W.FEconomy;let profile=E.fresh({campaignVersion:2});const weapons=[false,false,false,false,true];
  for(let i=0;i<index;i++){profile=E.grantBossReward(profile,i);const r=E.bossReward(i);if(r.weapon!==null)weapons[r.weapon]=true;}
  const caps=E.ammoCaps(profile,{campaign:true}),ammo=caps.map((c,i)=>weapons[i]?(i===4?1:Math.floor(c*ammoFraction)):0);
  return {inventory:{weapons,ammo,shield:true},economy:profile,campaign:{version:2,discovered:['pistol','shield',...(weapons[0]?['smg']:[]),...(weapons[1]?['shotgun']:[]),...(weapons[3]?['grenade']:[]),...(weapons[2]?['rocket']:[])],claimedBossRewards:Array.from({length:index},(_,i)=>i)}};
}
