// PARA / E7-E8 : synthese des sons et de la musique dans un worker, tampons PCM transferes.
import {parentPort,workerData} from 'node:worker_threads';
import {loadMain} from './load.mjs';
const port=workerData.port;const win=loadMain(['music','audio'],{setTimeout:(f)=>setTimeout(f,0)});
const cpu=()=>{const u=process.threadCpuUsage();return (u.user+u.system)/1000;};
port.on('message',async m=>{
  if(m.t==='fx'){
    const c0=cpu();let n=0,bytes=0;
    for(const name of win.FAudio.effectNames){const variants=name.indexOf('motor:')===0?1:2;const list=[];
      for(let v=0;v<variants;v++){const d=win.FAudio.synthesize(name,v,22050);list.push(d.buffer);bytes+=d.byteLength;n++;}
      port.postMessage({t:'fxbuf',name,list},list);}
    port.postMessage({t:'fxdone',cpu:cpu()-c0,n,bytes});
  }else if(m.t==='music'){
    const c0=cpu();await win.FMusic.warmup(m.stage);const mod=win.FMusic.getModule(m.stage);const c1=cpu();
    // le module decode : samples[].pcm (Int8Array ?) + partition ; on transfere les PCM et on clone le reste
    const tr=[];let pcmBytes=0;for(const sm of mod.samples||[]){if(sm.pcm&&sm.pcm.buffer&&!tr.includes(sm.pcm.buffer)){tr.push(sm.pcm.buffer);pcmBytes+=sm.pcm.byteLength;}}
    let ok=true,err='';try{port.postMessage({t:'musicmod',stage:m.stage,mod},tr);}catch(e){ok=false;err=String(e.message).slice(0,120);port.postMessage({t:'musicmod',stage:m.stage,mod:null});}
    port.postMessage({t:'musicdone',cpu:c1-c0,postCpu:cpu()-c1,pcmBytes,ok,err,keys:Object.keys(mod),bytes:mod.bytes?.length});
  }
});
parentPort.postMessage('up');
