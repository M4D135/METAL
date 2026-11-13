// MD-3 (DEMO-08, DEMO-09, DEMO-V2) : FDemo.recorder et FDemo.player sur la vraie simulation de METAL, aux réglages
// du banc d'audit replay.mjs (40 s, monde 1, graine 96, campagne v2, FBrain cpu, pilote de bancs/demo/pilot.mjs).
// Rien du jeu n'est modifié : les modules sont lus et chargés dans le domaine principal de Node.
// Chaque pas, dans le même ordre aux deux passes : sim.state.events vidé, entrée relue (rec.step ou play.next),
// sim.step(dt, entrée relue), empreinte stateDigest. Les points de reprise du banc (sim.snapshot()) sont enregistrés
// comme commandes « snapshot » et rejoués à la même place, avant le pas suivant.
//   node docs/chantier-moteur/preuves/module-demo/MD-3/metal-fdm1.mjs [--seconds 40] [--out F]
import {loadRealm,DEFAULT_ROOT} from '../../../../../tools/realm-loader.mjs';
import {stateDigest,snapshotDigest} from '../../../../../tools/proof/digest.mjs';
import {createPilot} from '../../../bancs/demo/pilot.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {relative} from 'node:path';
import zlib from 'node:zlib';
import os from 'node:os';

const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:fallback;};
const SECONDS=+arg('--seconds',40),OUT=arg('--out',null),SELF=fileURLToPath(import.meta.url);
const HZ=60,STEPS=Math.round(SECONDS*HZ),EVERY=60,K=1234,REPS=50,PASSES=5;
const {FWorld,FSimulation,FBrain,FDemo}=loadRealm({modules:['renderer','world','destruction','economy','brain','simulation','demo']}).window;
const METAL_FIELDS=[
  {name:'moveX',type:'i8',scale:127},{name:'moveY',type:'i8',scale:127},
  {name:'lookX',type:'i16',scale:8192},{name:'lookY',type:'i16',scale:8192},
  {name:'buttons',type:'bits',names:['fire','fireLeft','dash','pulse','melee','interact','sprint','assist']},
  {name:'weapon',type:'u8'}];
const read=path=>readFileSync(DEFAULT_ROOT+path,'utf8'),sha=text=>createHash('sha256').update(text).digest('hex');
const simHash=sha(['world','destruction','economy','brain','simulation'].map(n=>read('src/'+n+'.js')).join(''));
const header={game:'metal',simHash,engine:'node '+process.version,fields:METAL_FIELDS,checksumEvery:EVERY,meta:{banc:'replay.mjs '+SECONDS+' 0'}};
const CHECKPOINTS=new Set(['core','mechanism','armorPickup','bossReward','weaponPickup','shieldPickup','trophy','trophyComplete','encounterClear','bossDeath']);
const cpu=()=>{const u=process.threadCpuUsage();return (u.user+u.system)/1000;};

function open(){
  const world=FWorld.create(96,0,{campaign:true,campaignVersion:2}),brain=FBrain.create({mode:'cpu'});
  const sim=FSimulation.create(world,{armorSystem:true,brain});sim.setDifficulty(1);
  return {world,sim,dispose(){sim.dispose();brain.dispose?.();}};
}
function record(){
  const {world,sim,dispose}=open(),s=sim.state,pilot=createPilot(sim,world),rec=FDemo.recorder(header);
  const raw={moveX:0,moveY:0,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:false,assist:false};
  const digests=[],raws=[];let simMs=0,snapshots=0,stop=null;
  rec.scene({monde:1,index:0,graine:96,campagne:2});
  rec.checksum(stateDigest(s));
  for(let i=0;i<STEPS&&!stop;i++){
    s.events.length=0;
    pilot.think(raw,1/HZ);raws.push({...raw});
    const q=rec.step(raw),t=cpu();sim.step(rec.dt,q);simMs+=cpu()-t;
    const d=stateDigest(s);digests.push(d);
    if(rec.checksumDue())rec.checksum(d);
    if(s.events.some(e=>CHECKPOINTS.has(e.name))){rec.command('snapshot');sim.snapshot();snapshots++;}
    if(s.won||s.dead)stop=s.won?'victoire':'mort';
  }
  const snapshot=snapshotDigest(sim).sha256,bytes=rec.end();dispose();
  return {bytes,digests,raws,snapshots,snapshot,simMs,stop};
}
function replay(bytes,{perturb=-1,raws=null}={}){
  const play=FDemo.player(bytes,{simHash,game:'metal'}),{sim,dispose}=open(),s=sim.state,input={},digests=[];
  let checked=0,simMs=0;
  const verify=(n,d)=>{if(play.expected(n)!==undefined){checked++;play.verify(n,d);}};
  verify(0,stateDigest(s));
  for(let n=0;;n++){
    for(const c of play.commandsAt(n)){if(c.type!=='snapshot')throw new Error('commande inconnue : '+c.type);sim.snapshot();}
    if(!play.next(input))break;
    s.events.length=0;
    const t=cpu();sim.step(play.dt,raws?raws[n]:input);simMs+=cpu()-t;
    if(n===perturb)s.kills+=1;
    const d=stateDigest(s);digests.push(d);verify(n+1,d);
  }
  const snapshot=snapshotDigest(sim).sha256;dispose();
  return {divergence:play.divergence,digests,checked,simMs,snapshot};
}
// Premier n (pas déjà joués) où les empreintes de pas diffèrent, null si aucune.
const firstDifferent=(a,b)=>{for(let i=0;i<Math.max(a.length,b.length);i++)if(a[i]!==b[i])return i+1;return null;};
// Coût de FDemo seul, sur les entrées brutes de l'enregistrement : rec.step (+ checksumDue/checksum), play.next (+ verify).
function fdemoCost(bytes,raws){
  const median=a=>[...a].sort((x,y)=>x-y)[a.length>>1],n=REPS*raws.length,out={},play=FDemo.player(bytes);
  const recorder=()=>{const rec=FDemo.recorder(header,{initialSteps:n});rec.scene({});const c0=cpu();
    for(let r=0;r<REPS;r++)for(let i=0;i<raws.length;i++){rec.step(raws[i]);if(rec.checksumDue())rec.checksum(i);}return (cpu()-c0)*1e6/n;};
  const player=()=>{const c0=cpu();
    for(let r=0;r<REPS;r++){play.select(0);while(play.next(out)){const k=play.step,want=play.expected(k);play.verify(k,want===undefined?0:want);}}return (cpu()-c0)*1e6/n;};
  recorder();player();
  const rec=[],next=[];for(let p=0;p<PASSES;p++){rec.push(recorder());next.push(player());}
  return {recordNsPerStep:+median(rec).toFixed(1),playNsPerStep:+median(next).toFixed(1),steps:n,passes:PASSES};
}

const first=record(),second=record(),same=replay(first.bytes),negative=replay(first.bytes,{perturb:K}),raw=replay(first.bytes,{raws:first.raws});
const head=FDemo.player(first.bytes).header,scene=head.scenes[0],L=new DataView(first.bytes.buffer).getUint32(4,true);
const steps=first.digests.length,body=first.bytes.length-8-L,perMinute=x=>Math.round(x/steps*HZ*60),cost=fdemoCost(first.bytes,first.raws);
const simNs=(first.simMs+same.simMs)*1e6/(2*steps);
const result={schema:'fdemo-md3-metal-fdm1-v1',command:['node',relative(DEFAULT_ROOT,SELF),...process.argv.slice(2)].join(' '),
  sourceSha256:{demo:sha(read('src/demo.js')),pilot:sha(read('docs/chantier-moteur/bancs/demo/pilot.mjs'))},simHash,
  environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,cores:os.cpus().length,loadavg:os.loadavg().map(x=>+x.toFixed(2))},
  settings:{seconds:SECONDS,hz:HZ,checksumEvery:EVERY,world:1,seed:96,campaignVersion:2,brain:'cpu',fields:'METAL, 8 octets'},
  record:{steps,stop:first.stop,checksums:scene.checksums,snapshotCommands:first.snapshots,commandBytes:scene.commandBytes,truncated:scene.truncated},
  secondRecordingIdentical:first.bytes.length===second.bytes.length&&first.bytes.every((v,i)=>v===second.bytes[i]),
  replay:{ok:same.divergence===null,checked:same.checked,firstDifferentStep:firstDifferent(first.digests,same.digests),snapshotEqual:same.snapshot===first.snapshot},
  negative:{perturbedStep:K,expectedDetection:Math.ceil((K+1)/EVERY)*EVERY,detectedAt:negative.divergence?.step??null,firstDifferentStep:firstDifferent(first.digests,negative.digests)},
  raw:{firstDifferentStep:firstDifferent(first.digests,raw.digests),finalEqual:raw.digests.at(-1)===first.digests.at(-1)},
  sizes:{headerBytes:L,bodyBytes:body,fileBytes:first.bytes.length,
    perMinute:{records:perMinute(steps*8),body:perMinute(body),file:perMinute(first.bytes.length),bodyDeflateRaw6:perMinute(zlib.deflateRawSync(first.bytes.subarray(8+L),{level:6}).length)}},
  timing:{simNsPerStep:Math.round(simNs),...cost,recordOverhead:+(cost.recordNsPerStep/simNs).toExponential(2),playOverhead:+(cost.playNsPerStep/simNs).toExponential(2),
    method:'temps processeur du fil ; sim.step mesuré pas à pas pendant l’enregistrement et le rejeu ; FDemo seul sur '+REPS+' tours des entrées brutes, médiane de '+PASSES+' passes'}};
const text=JSON.stringify(result,null,1)+'\n';
if(OUT)writeFileSync(OUT,text);
process.stdout.write(text);
