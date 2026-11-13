// MD-4 (DEMO-10, DEMO-09, DEMO-V2) : FDemo.replay sur la vraie simulation de METAL, aux réglages du banc d'audit
// « replay.mjs 100 6 » : 100 s, monde 7, graine 96, campagne v2, arsenal plausible des 6 mondes précédents, FBrain cpu,
// difficulté 1, pilote de bancs/demo/pilot.mjs et aide à la survie du banc (PV écrits hors de la simulation).
// Rien du jeu n'est modifié : les modules sont lus et chargés dans le domaine principal de Node.
// Enregistrement, à chaque pas : sim.state.events vidé, pilote, rec.step, sim.step(rec.dt, entrée relue), aide, empreinte
// stateDigest (rec.checksum si due), puis point de reprise du banc enregistré comme commande « snapshot ». Monde gagné :
// nouvelle scène (monde suivant, arsenal exporté). Rejeu : FDemo.replay, la poignée refait la même chose dans le même ordre.
//   node docs/chantier-moteur/preuves/module-demo/MD-4/metal-session.mjs [--seconds 100] [--world 6] [--out F]
import {loadRealm,DEFAULT_ROOT} from '../../../../../tools/realm-loader.mjs';
import {stateDigest,snapshotDigest} from '../../../../../tools/proof/digest.mjs';
import {createPilot} from '../../../bancs/demo/pilot.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {relative} from 'node:path';
import os from 'node:os';

const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:fallback;};
const SECONDS=+arg('--seconds',100),START=+arg('--world',6),OUT=arg('--out',null),SELF=fileURLToPath(import.meta.url);
const HZ=60,DT=1/HZ,STEPS=Math.round(SECONDS*HZ),EVERY=60,K=1234,REPS=20,PASSES=7;
const {FWorld,FSimulation,FBrain,FEconomy,FDemo}=loadRealm({modules:['renderer','world','destruction','economy','brain','simulation','demo']}).window;
const METAL_FIELDS=[
  {name:'moveX',type:'i8',scale:127},{name:'moveY',type:'i8',scale:127},
  {name:'lookX',type:'i16',scale:8192},{name:'lookY',type:'i16',scale:8192},
  {name:'buttons',type:'bits',names:['fire','fireLeft','dash','pulse','melee','interact','sprint','assist']},
  {name:'weapon',type:'u8'}];
const read=path=>readFileSync(DEFAULT_ROOT+path,'utf8'),sha=text=>createHash('sha256').update(text).digest('hex');
const simHash=sha(['world','destruction','economy','brain','simulation'].map(n=>read('src/'+n+'.js')).join(''));
const header={game:'metal',simHash,engine:'node '+process.version,fields:METAL_FIELDS,checksumEvery:EVERY,meta:{banc:'replay.mjs '+SECONDS+' '+START}};
const cpu=()=>{const u=process.threadCpuUsage();return (u.user+u.system)/1000;};
const plain=v=>JSON.parse(JSON.stringify(v));

// Arsenal plausible à l'entrée du monde index (bancs/demo/session.mjs, plausibleLoadout), sur l'économie du dépôt.
function plausibleLoadout(index){
  let profile=FEconomy.fresh({campaignVersion:2});const weapons=[false,false,false,false,true];
  for(let i=0;i<index;i++){profile=FEconomy.grantBossReward(profile,i);const r=FEconomy.bossReward(i);if(r.weapon!==null)weapons[r.weapon]=true;}
  const ammo=FEconomy.ammoCaps(profile,{campaign:true}).map((c,i)=>weapons[i]?(i===4?1:c):0);
  return {inventory:{weapons,ammo,shield:true},economy:profile,campaign:{version:2,discovered:['pistol','shield',...(weapons[0]?['smg']:[]),...(weapons[1]?['shotgun']:[]),
    ...(weapons[3]?['grenade']:[]),...(weapons[2]?['rocket']:[])],claimedBossRewards:Array.from({length:index},(_,i)=>i)}};
}
// Scène : monde de campagne v2 et simulation neuve, comme openWorld() du banc. info = {world, seed, loadout}.
function openScene(info){
  const world=FWorld.create(info.seed,info.world%18,{campaign:true,campaignVersion:2}),brain=FBrain.create({mode:'cpu'});
  const sim=FSimulation.create(world,{...(info.loadout||{}),armorSystem:true,brain});sim.setDifficulty(1);
  return {world,sim,dispose(){sim.dispose();brain.dispose?.();}};
}
// Aide à la survie du banc : écriture directe dans l'état, hors de sim.step (DEMO-09, point 4).
const assist=s=>{if(s.dead||s.won||!(s.player.hp<30))return 0;const add=Math.min(30-s.player.hp,22*DT);s.player.hp+=add;return add;};
const CHECKPOINTS=new Set(['core','mechanism','armorPickup','bossReward','weaponPickup','shieldPickup','trophy','trophyComplete','encounterClear','bossDeath']);
const checkpointDue=s=>s.events.some(e=>CHECKPOINTS.has(e.name)||e.name==='liftStop'&&e.carrying||e.name==='lootPickup'&&(e.boss||e.armor>0));

function record(){
  const rec=FDemo.recorder(header),raw={moveX:0,moveY:0,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:false,assist:false};
  const digests=[],raws=[],finals=[],worlds=[],firstAssist=[];let info,scene,s,pilot,pending=false,assistHp=0,snapshots=0,simMs=0,stop=null;
  const enter=next=>{info=next;scene=openScene(info);s=scene.sim.state;pilot=createPilot(scene.sim,scene.world);pending=false;worlds.push(info.world);rec.scene(info);rec.checksum(stateDigest(s));};
  enter({world:START,seed:96,loadout:plausibleLoadout(START)});
  for(let i=0;i<STEPS;i++){
    s.events.length=0;
    pilot.think(raw,DT);raws.push({...raw});
    const q=rec.step(raw),t=cpu();scene.sim.step(rec.dt,q);simMs+=cpu()-t;
    const add=assist(s);if(add>0){assistHp+=add;if(firstAssist.length<1)firstAssist.push(i);}
    const d=stateDigest(s);digests.push(d);
    if(rec.checksumDue())rec.checksum(d);
    if((checkpointDue(s)||pending)&&!s.dead&&!s.won){if(s.player.airborne)pending=true;else{pending=false;rec.command('snapshot');scene.sim.snapshot();snapshots++;}}
    if(s.won){const loadout=plain(scene.sim.exportLoadout());finals.push(snapshotDigest(scene.sim).sha256);scene.dispose();enter({world:info.world+1,seed:96,loadout});}
    else if(s.dead){stop='mort au pas '+i;break;}
  }
  finals.push(snapshotDigest(scene.sim).sha256);scene.dispose();
  return {bytes:rec.end(),digests,raws,finals,worlds,snapshots,assistHp,firstAssistStep:firstAssist[0]??null,simMs,stop};
}
// Rejeu par FDemo.replay. options : sans aide, sans les commandes snapshot, perturbation kills + 1 après le pas d'indice
// perturb, snapshot() de plus après le pas d'indice extra (DEMO-V2), entrées brutes de l'enregistrement à la place des
// entrées relues, arrêt ou non à la première divergence.
function replay(bytes,{help=true,snapshots=true,perturb=-1,extra=-1,raws=null,stopOnDesync=true}={}){
  const digests=[],finals=[];let simMs=0,count=0;
  const game={open(info){
    const scene=openScene(info),s=scene.sim.state;
    return {
      step(input,dt){s.events.length=0;const t=cpu();scene.sim.step(dt,raws?raws[count]:input);simMs+=cpu()-t;if(help)assist(s);if(count===perturb)s.kills+=1;if(count===extra)scene.sim.snapshot();count++;digests.push(stateDigest(s));},
      checksum(){return stateDigest(s);},
      command(type){if(type!=='snapshot')throw new Error('commande inconnue : '+type);if(snapshots)scene.sim.snapshot();},
      dispose(){finals.push(snapshotDigest(scene.sim).sha256);scene.dispose();}};
  }};
  const t=cpu(),result=plain(FDemo.replay(bytes,game,{expect:{simHash,game:'metal'},stopOnDesync}).run());
  return {result,digests,finals,simMs,totalMs:cpu()-t};
}
// Premier n (pas déjà joués) où les empreintes de pas diffèrent, null si aucune.
const firstDifferent=(a,b)=>{for(let i=0;i<Math.max(a.length,b.length);i++)if(a[i]!==b[i])return i+1;return null;};
const sameBytes=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
// Coût du rejoueur seul sur cet enregistrement (poignée vide, empreinte rendue juste), apparié et alterné avec la boucle
// minimale écrite à la main sur FDemo.player (commandes, next, step, empreinte attendue), comme en MD-3. Les deux
// lisent l'enregistrement à chaque tour (FDemo.replay crée son lecteur).
function replayCost(bytes){
  const play=FDemo.player(bytes),expected=[];
  for(let k=0;k<play.sceneCount;k++){play.select(k);const m=new Map();for(let n=0;n<=play.steps;n++)if(play.expected(n)!==undefined)m.set(n,play.expected(n));expected.push(m);}
  let scene=0,count=0;const handle={step(input,dt){count++;},checksum(){return expected[scene].get(count);},command(){}},game={open(info,k){scene=k;count=0;return handle;}};
  const steps=REPS*play.header.scenes.reduce((a,s)=>a+s.steps,0),median=a=>[...a].sort((x,y)=>x-y)[a.length>>1];
  const viaReplay=()=>{const c0=cpu();for(let r=0;r<REPS;r++)if(!FDemo.replay(bytes,game).run().ok)throw new Error('rejeu à vide divergent');return (cpu()-c0)*1e6/steps;};
  const byHand=()=>{const c0=cpu(),input={};
    for(let r=0;r<REPS;r++)for(let k=0,play=FDemo.player(bytes);k<play.sceneCount;k++){
      play.select(k);count=0;scene=k;if(!play.verify(0,handle.checksum()))throw new Error('empreinte 0');
      for(let n=0;;n++){const list=play.commandsAt(n);for(let i=0;i<list.length;i++)handle.command(list[i].type,list[i].data);
        if(!play.next(input))break;handle.step(input,play.dt);if(play.expected(n+1)!==undefined&&!play.verify(n+1,handle.checksum()))throw new Error('empreinte '+(n+1));}
    }
    return (cpu()-c0)*1e6/steps;};
  viaReplay();byHand();
  const a=[],b=[];for(let p=0;p<PASSES;p++){if(p&1){b.push(byHand());a.push(viaReplay());}else{a.push(viaReplay());b.push(byHand());}}
  return {replayNsPerStep:+median(a).toFixed(1),byHandNsPerStep:+median(b).toFixed(1),replayPasses:a.map(v=>+v.toFixed(1)),byHandPasses:b.map(v=>+v.toFixed(1)),steps,passes:PASSES};
}

const wall0=performance.now();
const first=record(),second=record();
const same=replay(first.bytes),noAssist=replay(first.bytes,{help:false}),noSnapshot=replay(first.bytes,{snapshots:false,stopOnDesync:false});
const negative=replay(first.bytes,{perturb:K}),extraSnapshot=replay(first.bytes,{extra:2700,stopOnDesync:false}),raw=replay(first.bytes,{raws:first.raws,stopOnDesync:false});
const head=FDemo.player(first.bytes).header,L=new DataView(first.bytes.buffer).getUint32(4,true),steps=first.digests.length,cost=replayCost(first.bytes);
const simNs=(first.simMs+same.simMs)*1e6/(2*steps),perMinute=x=>Math.round(x/steps*HZ*60);
const detect=step=>step===null?null:Math.ceil(step/EVERY)*EVERY;
const result={schema:'fdemo-md4-metal-session-v1',command:['node',relative(DEFAULT_ROOT,SELF),...process.argv.slice(2)].join(' '),
  sourceSha256:{demo:sha(read('src/demo.js')),pilot:sha(read('docs/chantier-moteur/bancs/demo/pilot.mjs'))},simHash,
  environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,cores:os.cpus().length,loadavg:os.loadavg().map(x=>+x.toFixed(2))},
  settings:{seconds:SECONDS,hz:HZ,checksumEvery:EVERY,startWorld:START+1,seed:96,campaignVersion:2,brain:'cpu',difficulty:1,fields:'METAL, 8 octets'},
  record:{steps,stop:first.stop,worlds:first.worlds.map(w=>w+1),scenes:head.scenes.map(s=>({steps:s.steps,checksums:s.checksums,commandBytes:s.commandBytes,truncated:s.truncated})),
    snapshotCommands:first.snapshots,assistHp:+first.assistHp.toFixed(2),firstAssistStepIndex:first.firstAssistStep},
  secondRecordingIdentical:sameBytes(first.bytes,second.bytes),
  replay:{...same.result,firstDifferentStep:firstDifferent(first.digests,same.digests),snapshotsEqual:JSON.stringify(same.finals)===JSON.stringify(first.finals)},
  replayWithoutAssist:{ok:noAssist.result.ok,divergence:noAssist.result.divergence,steps:noAssist.result.steps,firstDifferentStep:firstDifferent(first.digests,noAssist.digests),
    expectedDetection:detect(first.firstAssistStep===null?null:first.firstAssistStep+1)},
  replayWithoutSnapshotCommands:{ok:noSnapshot.result.ok,divergence:noSnapshot.result.divergence,checked:noSnapshot.result.checked,firstDifferentStep:firstDifferent(first.digests,noSnapshot.digests),
    snapshotsEqual:JSON.stringify(noSnapshot.finals)===JSON.stringify(first.finals)},
  extraSnapshot:{stepIndex:2700,ok:extraSnapshot.result.ok,divergence:extraSnapshot.result.divergence,firstDifferentStep:firstDifferent(first.digests,extraSnapshot.digests)},
  negative:{perturbedStepIndex:K,expectedDetection:detect(K+1),detectedAt:negative.result.divergence?.step??null,steps:negative.result.steps},
  raw:{ok:raw.result.ok,firstDifferentStep:firstDifferent(first.digests,raw.digests),detectedAt:raw.result.divergence?.step??null},
  sizes:{headerBytes:L,bodyBytes:first.bytes.length-8-L,fileBytes:first.bytes.length,perMinute:{records:perMinute(steps*8),body:perMinute(first.bytes.length-8-L),file:perMinute(first.bytes.length)}},
  timing:{simNsPerStep:Math.round(simNs),replayRunMs:+same.totalMs.toFixed(1),replaySimMs:+same.simMs.toFixed(1),...cost,
    replayOverhead:+(cost.replayNsPerStep/simNs).toExponential(2),
    method:'temps processeur du fil ; sim.step mesuré pas à pas pendant l’enregistrement et le rejeu ; rejoueur seul (poignée vide) contre boucle à la main sur FDemo.player : '+REPS+' tours de l’enregistrement, médiane de '+PASSES+' passes alternées'},
  wallSeconds:+((performance.now()-wall0)/1000).toFixed(1)};
const text=JSON.stringify(result,null,1)+'\n';
if(OUT)writeFileSync(OUT,text);
process.stdout.write(text);
