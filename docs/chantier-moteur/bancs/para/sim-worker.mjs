// PARA : la VRAIE FSimulation de METAL dans un node:worker_threads. Protocole du prototype :
//  page -> worker : {t:'start',scenario,mode} | {t:'in',tick,input} | {t:'ret',buf} | {t:'gen',scenario,what} | {t:'snap'} | {t:'stop'}
//  worker -> page : {t:'ready',...} | {t:'st',tick,mode,...} | {t:'gen',...} | {t:'snap',...} | {t:'done',digest,...}
import {parentPort,workerData} from 'node:worker_threads';
import v8 from 'node:v8';
import {loadMain,build,digest,SCENARIOS} from './load.mjs';
import {compilePack,compileSubset,needed,dict} from './schema.mjs';
const port=workerData.port;const win=loadMain();
const cpu=()=>{const u=process.threadCpuUsage();return (u.user+u.system)/1000;};
const pack=compilePack(),subset=compileSubset();const TA=process.env.F64?Float64Array:Float32Array,BPE=TA.BYTES_PER_ELEMENT;
let sim=null,world=null,s=null,mode='packed',h=2166136261,pool=[],dictSent=0;
const acc={stepCpu:0,packCpu:0,postCpu:0,steps:0,bytes:0,allocs:0};
function take(n){for(let k=0;k<pool.length;k++)if(pool[k].byteLength>=n*BPE)return pool.splice(k,1)[0];acc.allocs++;return new ArrayBuffer(Math.max(4096,n+1024)*BPE);}
port.on('message',m=>{
  if(m.t==='start'){
    const c0=cpu(),w0=performance.now();({world,sim}=build(win,m.scenario));s=sim.state;mode=m.mode;h=2166136261;
    port.postMessage({t:'ready',createCpu:cpu()-c0,createWall:performance.now()-w0});
  }else if(m.t==='in'){
    const w0=performance.now(),c0=cpu();
    sim.step(1/60,m.input);s.player.hp=Math.max(s.player.hp,60);
    const c1=cpu(),w1=performance.now();h=digest(s,h);
    const cA=cpu();let msg,tr=[],bytes=0;
    const events=s.events.length?s.events.map(e=>({...e})):null;
    if(mode==='packed'){
      const n=needed(s),buf=take(n),f=new TA(buf);const len=pack(s,f);bytes=len*BPE;
      msg={t:'st',tick:m.tick,len,buf,events,dict:dict.length>dictSent?dict.slice(dictSent):null,stepWall:w1-w0,stepCpu:c1-c0};dictSent=dict.length;tr=[buf];
    }else if(mode==='subset'){
      msg={t:'st',tick:m.tick,state:subset(s),events,stepWall:w1-w0,stepCpu:c1-c0};
    }else if(mode==='naive'){
      // etat complet sans le monde statique (clonage structure de tous les champs, IA comprise)
      const {world:_w,...rest}=s;msg={t:'st',tick:m.tick,state:rest,stepWall:w1-w0,stepCpu:c1-c0};
    }else msg={t:'st',tick:m.tick,stepWall:w1-w0,stepCpu:c1-c0};
    const cB=cpu();
    msg.packCpu=cB-cA;msg.sentAt=performance.timeOrigin+performance.now();
    port.postMessage(msg,tr);
    const cC=cpu();
    acc.stepCpu+=c1-c0;acc.packCpu+=cB-cA;acc.postCpu+=cC-cB;acc.steps++;acc.bytes+=bytes;
    s.events.length=0;
  }else if(m.t==='ret'){if(pool.length<4)pool.push(m.buf);}
  else if(m.t==='size'){ // tailles serialisees a cet instant
    const {world:_w,...rest}=s;const n=needed(s);
    port.postMessage({t:'size',packedBytes:n*4,subsetBytes:v8.serialize(subset(s)).length,naiveBytes:v8.serialize(rest).length,counts:Object.fromEntries(Object.entries(s).filter(([k,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]))});
  }else if(m.t==='snap'){
    const c0=cpu();const snap=sim.snapshot();const c1=cpu();const text=JSON.stringify(snap);const c2=cpu();port.postMessage({t:'snap',text,snapshotCpu:c1-c0,stringifyCpu:c2-c1});const c3=cpu();
    port.postMessage({t:'snapcost',postCpu:c3-c2,chars:text.length});
  }else if(m.t==='gen'){
    const [idx,opts]=SCENARIOS[m.scenario];const c0=cpu(),w0=performance.now();const wd=win.FWorld.create(m.seed||96,idx,opts);const c1=cpu();
    let simCpu=0;if(m.what!=='worldonly'){const b=win.FBrain.create({mode:'cpu'});const sm=win.FSimulation.create(wd,{brain:b});simCpu=cpu()-c1;sm.dispose?.();}
    const c2=cpu();let payload=null,tr=[];
    if(m.what==='world')payload=wd;
    else if(m.what==='render')payload={meshes:wd.meshes,lights:wd.lights,environment:wd.environment};
    else if(m.what==='packedmeshes'){const n=wd.meshes.length,f=new Float32Array(n*16);let o=0;const shapes=new Map(),cats=new Map();const id=(mp,v)=>{let i=mp.get(v);if(i===undefined){i=mp.size;mp.set(v,i);}return i;};
      for(const q of wd.meshes){f[o++]=id(shapes,q.shape);f[o++]=q.p[0];f[o++]=q.p[1];f[o++]=q.p[2];f[o++]=q.s[0];f[o++]=q.s[1];f[o++]=q.s[2];f[o++]=q.mat;f[o++]=q.color?q.color[0]:NaN;f[o++]=q.color?q.color[1]:NaN;f[o++]=q.color?q.color[2]:NaN;f[o++]=q.r?q.r[0]:0;f[o++]=q.r?q.r[1]:0;f[o++]=q.r?q.r[2]:0;f[o++]=q.destructibleId??-1;f[o++]=(q.outdoor?1:0)|(q.ground?2:0)|(q.solid?4:0)|(q.structural?8:0)|(q.terrain?16:0)|(q.indestructible?32:0)|(id(cats,q.category)<<8);}
      payload={n,buf:f.buffer,shapes:[...shapes.keys()],categories:[...cats.keys()],lights:wd.lights,environment:wd.environment};tr=[f.buffer];}
    const c3=cpu();port.postMessage({t:'gen',what:m.what,payload,worldCpu:c1-c0,simCpu,prepCpu:c3-c2,wall:performance.now()-w0},tr);const c4=cpu();
    port.postMessage({t:'gencost',postCpu:c4-c3});
  }else if(m.t==='mem'){if(globalThis.gc)globalThis.gc();const u=process.memoryUsage();port.postMessage({t:'mem',heapUsed:u.heapUsed,external:u.external,arrayBuffers:u.arrayBuffers});}
  else if(m.t==='stop'){port.postMessage({t:'done',digest:h>>>0,acc,snapshotChars:JSON.stringify(sim.snapshot()).length});}
});
parentPort.postMessage('up');
