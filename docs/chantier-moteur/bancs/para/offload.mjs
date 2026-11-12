// PARA / E5-E8 : travaux sortis du fil principal. Tous les couts sont des temps CPU de fil (process.threadCpuUsage).
// usage : node offload.mjs [gen|snap|audio|all] [scenario]
import {Worker,MessageChannel,receiveMessageOnPort} from 'node:worker_threads';
import v8 from 'node:v8';
import {loadMain,build,drive,SCENARIOS,summ,mean,q} from './load.mjs';
const what=process.argv[2]||'all',scenario=process.argv[3]||'campaign2-w10';
const cpu=()=>{const u=process.threadCpuUsage();return (u.user+u.system)/1000;};
const sab=new Int32Array(new SharedArrayBuffer(4));const nap=ms=>Atomics.wait(sab,0,0,ms);
const out={scenario,charge:(await import('node:os')).loadavg().map(x=>+x.toFixed(1))};
function spawn(file){const {port1,port2}=new MessageChannel();const w=new Worker(new URL(file,import.meta.url),{workerData:{port:port2},transferList:[port2]});return new Promise(r=>w.once('message',()=>r({w,port:port1})));}
// attend un message d'un type donne ; rend le message et le cout CPU du fil principal pour le RECEVOIR (deserialisation)
function recv(port,type){for(;;){const c0=cpu();const r=receiveMessageOnPort(port);const c1=cpu();if(r){if(r.message.t===type)return {m:r.message,recvCpu:c1-c0};}else nap(1);}}
const win=loadMain(['renderer','world','destruction','economy','brain','simulation','music','audio'],{setTimeout:(f)=>setTimeout(f,0)});
if(what==='gen'||what==='all'){
  const [idx,opts]=SCENARIOS[scenario];const {w,port}=await spawn('./sim-worker.mjs');const R={main:[],worker:{}};
  for(let rep=0;rep<3;rep++){
    const c0=cpu();const world=win.FWorld.create(96,idx,opts);const c1=cpu();const sim=win.FSimulation.create(world,{brain:win.FBrain.create({mode:'cpu'})});const c2=cpu();
    R.main.push({worldCpu:+(c1-c0).toFixed(1),simCpu:+(c2-c1).toFixed(1)});
    if(rep===0){let ws=-1,rs=-1;try{ws=v8.serialize(world).length;}catch(e){ws='non clonable : '+String(e.message).slice(0,90);}try{rs=v8.serialize({meshes:world.meshes,lights:world.lights,environment:world.environment}).length;}catch(e){rs='non clonable : '+String(e.message).slice(0,90);}
      R.tailles={mondeEntierOctets:ws,renduOctets:rs,maillages:world.meshes.length,maillagesEmpaquetesOctets:world.meshes.length*64,jsonMonde:JSON.stringify(world).length};}
    sim.dispose?.();
    for(const k of ['sim','world','render','packedmeshes']){
      port.postMessage({t:'gen',scenario,what:k});let g;try{g=recv(port,'gen');}catch(e){g={m:{error:String(e.message)},recvCpu:NaN};}const gc=recv(port,'gencost');
      (R.worker[k]??=[]).push({worldCpu:+g.m.worldCpu.toFixed(1),simCpu:+g.m.simCpu.toFixed(1),prepCpu:+g.m.prepCpu.toFixed(2),postCpuWorker:+gc.m.postCpu.toFixed(2),recvCpuFilPrincipal:+g.recvCpu.toFixed(2)});
    }
  }
  await w.terminate();out.generation=R;
}
if(what==='snap'||what==='all'){
  const {w,port}=await spawn('./sim-worker.mjs');port.postMessage({t:'start',scenario,mode:'none'});recv(port,'ready');
  const {sim}=build(win,scenario),s=sim.state,input={};const R={main:[],worker:[]};
  for(let i=0;i<1500;i++){drive(i,input);port.postMessage({t:'in',tick:i,input});sim.step(1/60,input);s.player.hp=Math.max(s.player.hp,60);s.events.length=0;
    if(i%300===299){
      while(true){const r=receiveMessageOnPort(port);if(r&&r.message.t==='st'&&r.message.tick===i)break;if(!r)nap(1);}
      const c0=cpu();const snap=sim.snapshot();const c1=cpu();const text=JSON.stringify(snap);const c2=cpu();
      R.main.push({tick:i,snapshotCpu:+(c1-c0).toFixed(2),stringifyCpu:+(c2-c1).toFixed(2),chars:text.length});
      port.postMessage({t:'snap'});const g=recv(port,'snap'),gc=recv(port,'snapcost');
      R.worker.push({tick:i,snapshotCpu:+g.m.snapshotCpu.toFixed(2),stringifyCpu:+g.m.stringifyCpu.toFixed(2),postCpuWorker:+gc.m.postCpu.toFixed(3),recvCpuFilPrincipal:+g.recvCpu.toFixed(3),chars:g.m.text.length,identique:g.m.text===text});
    }}
  await w.terminate();out.pointDeReprise=R;
}
if(what==='audio'||what==='all'){
  const R={};
  // fil principal : lots de 2 noms comme warmBank (audio.js:302)
  const names=win.FAudio.effectNames,per=[];let total=0,bytes=0;
  for(const name of names){const c0=cpu();const variants=name.indexOf('motor:')===0?1:2;for(let v=0;v<variants;v++)bytes+=win.FAudio.synthesize(name,v,22050).byteLength;const d=cpu()-c0;per.push(d);total+=d;}
  const batches=[];for(let i=0;i<per.length;i+=2)batches.push(per[i]+(per[i+1]||0));
  R.fxFilPrincipal={noms:names.length,cpuTotal:+total.toFixed(1),lotMax:+Math.max(...batches).toFixed(1),lotP50:+q(batches,.5).toFixed(1),octetsPCM:bytes};
  const {w,port}=await spawn('./audio-worker.mjs');
  port.postMessage({t:'fx'});let recvTotal=0,recvMax=0,copyTotal=0,copyMax=0,n=0;
  for(;;){const c0=cpu();const r=receiveMessageOnPort(port);const c1=cpu();if(!r){nap(1);continue;}
    if(r.message.t==='fxbuf'){recvTotal+=c1-c0;recvMax=Math.max(recvMax,c1-c0);const c2=cpu();for(const b of r.message.list){const src=new Float32Array(b),dst=new Float32Array(src.length);dst.set(src);n++;}const d=cpu()-c2;copyTotal+=d;copyMax=Math.max(copyMax,d);}
    else if(r.message.t==='fxdone'){R.fxWorker={cpuWorker:+r.message.cpu.toFixed(1),tampons:r.message.n,octets:r.message.bytes,filPrincipal:{receptionCpuTotal:+recvTotal.toFixed(3),receptionMax:+recvMax.toFixed(3),copieVersAudioBufferTotal:+copyTotal.toFixed(2),copieMax:+copyMax.toFixed(3)}};break;}}
  // musique
  R.musique=[];
  for(const stage of [0,1,2]){
    port.postMessage({t:'music',stage});const g=recv(port,'musicmod'),d=recv(port,'musicdone');
    R.musique.push({stage,cpuWorker:+d.m.cpu.toFixed(1),postCpuWorker:+d.m.postCpu.toFixed(2),recvCpuFilPrincipal:+g.recvCpu.toFixed(3),octetsPCM:d.m.pcmBytes,clonable:d.m.ok,err:d.m.err,cles:d.m.keys,octetsModule:d.m.bytes});
  }
  await w.terminate();
  // musique sur le fil principal (meme processus, apres le worker) : tranches entre deux setTimeout(0)
  const m0=cpu();await win.FMusic.warmup(0);win.FMusic.getModule(0);R.musiqueFilPrincipalStage0Cpu=+(cpu()-m0).toFixed(1);
  out.audio=R;
}
console.log(JSON.stringify(out,null,1));process.exit(0);
