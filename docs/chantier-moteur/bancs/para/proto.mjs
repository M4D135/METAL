// PARA / E3-E4 : boucle prototype. A = simulation sur le fil principal ; B = la meme simulation dans un worker.
// Mesure le cout CPU du FIL PRINCIPAL par image (temps CPU du fil, process.threadCpuUsage : insensible a la
// preemption d'une machine chargee), le cout de postMessage selon le format, le retard des etats et l'egalite des etats.
// usage : node proto.mjs <scenario> [ticks=1800] [modes=packed,subset,naive] [vsync=1]
import {Worker,MessageChannel,receiveMessageOnPort} from 'node:worker_threads';
import {loadMain,build,drive,digest,summ,q,mean} from './load.mjs';
import {compileUnpack,SCALARS,LISTS} from './schema.mjs';const TA=process.env.F64?Float64Array:Float32Array,BPE=TA.BYTES_PER_ELEMENT;
const scenario=process.argv[2]||'legacy-s0',TICKS=+(process.argv[3]||1800),MODES=(process.argv[4]||'packed,subset,naive').split(','),VSYNC=process.argv[5]!=='0';
const cpu=()=>{const u=process.threadCpuUsage();return (u.user+u.system)/1000;};
const sab=new Int32Array(new SharedArrayBuffer(4));const sleepUntil=t=>{const d=t-performance.now();if(d>0.05)Atomics.wait(sab,0,0,d);};
const win=loadMain();const out={scenario,ticks:TICKS,charge:(await import('node:os')).loadavg().map(x=>+x.toFixed(1))};
function phaseA(){
  const {sim}=build(win,scenario),s=sim.state,input={};let h=2166136261;const stepCpu=new Float64Array(TICKS),stepWall=new Float64Array(TICKS);
  for(let i=0;i<TICKS;i++){drive(i,input);const w0=performance.now(),c0=cpu();sim.step(1/60,input);stepCpu[i]=cpu()-c0;stepWall[i]=performance.now()-w0;s.player.hp=Math.max(s.player.hp,60);h=digest(s,h);s.events.length=0;}
  return {digest:h>>>0,stepCpu,stepWall,state:s};
}
let refState=null;
async function phaseB(mode,{pingpong=false}={}){
  const {port1,port2}=new MessageChannel();
  const w=new Worker(new URL('./sim-worker.mjs',import.meta.url),{workerData:{port:port2},transferList:[port2]});
  await new Promise(r=>w.once('message',r));
  const wait=type=>new Promise(res=>{const poll=()=>{let r;while((r=receiveMessageOnPort(port1))){if(r.message.t===type)return res(r.message);}setTimeout(poll,2);};poll();});
  port1.postMessage({t:'start',scenario,mode});const ready=await wait('ready');
  const unpack=compileUnpack(),mirror={},D=[];
  const mainCpu=new Float64Array(TICKS),postCpu=new Float64Array(TICKS),recvCpu=new Float64Array(TICKS),unpackCpu=new Float64Array(TICKS),late=new Int32Array(TICKS),age=[],wStepCpu=new Float64Array(TICKS),wStepWall=new Float64Array(TICKS),wPackCpu=new Float64Array(TICKS),turn=new Float64Array(TICKS);
  let newest=-1,bytes=0,got=0,unpackAcc=0;const input={};
  const handle=m=>{if(m.t!=='st')return;got++;if(m.tick>newest)newest=m.tick;wStepCpu[m.tick]=m.stepCpu;wStepWall[m.tick]=m.stepWall;wPackCpu[m.tick]=m.packCpu;age.push(performance.timeOrigin+performance.now()-m.sentAt);
    if(m.dict)for(const v of m.dict)D.push(v);
    if(m.buf){const c=cpu();unpack(new TA(m.buf,0,m.len),mirror,D);{const d=cpu()-c;unpackCpu[m.tick]+=d;unpackAcc+=d;}bytes+=m.len*BPE;port1.postMessage({t:'ret',buf:m.buf},[m.buf]);}};
  const T0=performance.now();
  for(let i=0;i<TICKS;i++){
    const c0=cpu();drive(i,input);port1.postMessage({t:'in',tick:i,input});const c1=cpu();postCpu[i]=c1-c0;
    if(pingpong){const w0=performance.now();let r;for(;;){r=receiveMessageOnPort(port1);if(r){handle(r.message);if(newest>=i)break;}}turn[i]=performance.now()-w0;}
    else{const c2=cpu(),u0=unpackAcc;let r;while((r=receiveMessageOnPort(port1)))handle(r.message);const c3=cpu();recvCpu[i]=c3-c2-(unpackAcc-u0);mainCpu[i]=c3-c0;late[i]=Math.max(0,(i-1)-newest);
      if(VSYNC)sleepUntil(T0+(i+1)*1000/60);else{ // sans horloge : attendre l'etat i avant l'image suivante (cout CPU non compte)
        let r2;while(newest<i){const c=cpu(),u1=unpackAcc;r2=receiveMessageOnPort(port1);if(r2){handle(r2.message);const d=cpu()-c;mainCpu[i]+=d;recvCpu[i]+=d-(unpackAcc-u1);}}}}
  }
  const wallTotal=performance.now()-T0;
  while(got<TICKS){const r=receiveMessageOnPort(port1);if(r)handle(r.message);else await new Promise(r=>setTimeout(r,2));}
  port1.postMessage({t:'size'});const size=await wait('size');
  port1.postMessage({t:'stop'});const done=await wait('done');await w.terminate();
  const res={mode,digest:done.digest,createCpu:+ready.createCpu.toFixed(0),workerAcc:{stepCpuMoy:+(done.acc.stepCpu/done.acc.steps).toFixed(4),packCpuMoy:+(done.acc.packCpu/done.acc.steps).toFixed(4),postCpuMoy:+(done.acc.postCpu/done.acc.steps).toFixed(4),octetsMoy:Math.round(done.acc.bytes/done.acc.steps),tamponsAlloues:done.acc.allocs},tailleFinale:size,snapshotChars:done.snapshotChars,
    workerStepCpu:summ(wStepCpu)};
  if(mode==='packed'&&refState){const get=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);let n=0,bad=0,maxErr=0;const cmp=(a,b)=>{if(typeof a==='boolean')a=+a;if(typeof a!=='number'||Number.isNaN(a))return;n++;if(!Object.is(a,b)&&a!==b){bad++;maxErr=Math.max(maxErr,Math.abs(a-b));}};
    for(const p of SCALARS)cmp(get(refState,p),get(mirror,p));for(const [root,fields] of Object.entries(LISTS)){const A=refState[root]||[],B=mirror[root]||[];if(A.length!==B.length){bad+=1e6;continue;}for(let i=0;i<A.length;i++)for(const fl of fields){if(fl[0]==='$'){n++;if(get(A[i],fl.slice(1))!==get(B[i],fl.slice(1))&&get(A[i],fl.slice(1))!=null)bad++;}else cmp(get(A[i],fl),get(B[i],fl));}}
    res.miroirContreEtatFilPrincipal={format:process.env.F64?'Float64':'Float32',valeursComparees:n,differentes:bad,erreurMax:maxErr};}
  if(pingpong){const over=Array.from(turn,(t,i)=>t-wStepWall[i]);res.allerRetourMs=summ(turn);res.surcoutAllerRetourMs={p10:+q(over,.1).toFixed(4),p50:+q(over,.5).toFixed(4),p90:+q(over,.9).toFixed(4)};}
  else{res.filPrincipalCpuParImage=summ(mainCpu);res.dontEnvoiEntree=+mean(postCpu).toFixed(4);res.dontDepaquetage=+(unpackCpu.reduce((a,b)=>a+b,0)/TICKS).toFixed(4);res.dontReceptionDeserialisation=+mean(recvCpu).toFixed(4);
    res.imagesEnRetard={'>=1 tick':late.filter(x=>x>=1).length,'>=2':late.filter(x=>x>=2).length,'>=4':late.filter(x=>x>=4).length,max:Math.max(...late)};res.ageMessageMs=summ(age);res.dureeMurale=+wallTotal.toFixed(0);
    res.seuilsFilPrincipal={'>1ms':mainCpu.filter(x=>x>1).length,'>2ms':mainCpu.filter(x=>x>2).length,'>4ms':mainCpu.filter(x=>x>4).length,'>8ms':mainCpu.filter(x=>x>8).length};}
  return res;
}
// A deux fois (avant et apres) pour encadrer la derive de charge
const A1=phaseA();refState=A1.state;
out.B=[];for(const mode of MODES)out.B.push(await phaseB(mode));
if(process.env.PING)out.pingpong=await phaseB('packed',{pingpong:true});
const A2=phaseA();
const thr=a=>({'>1ms':a.filter(x=>x>1).length,'>2ms':a.filter(x=>x>2).length,'>4ms':a.filter(x=>x>4).length,'>8ms':a.filter(x=>x>8).length,'>16ms':a.filter(x=>x>16).length});
out.A={digest:A1.digest,memeDigestRejoue:A1.digest===A2.digest,stepCpu1:summ(A1.stepCpu),stepCpu2:summ(A2.stepCpu),seuils1:thr(A1.stepCpu),seuils2:thr(A2.stepCpu),stepWall1:summ(A1.stepWall)};
out.etatsIdentiques=out.B.every(b=>b.digest===A1.digest);
if(process.env.DUMP){(await import('node:fs')).writeFileSync(process.env.DUMP,JSON.stringify({scenario,a1:Array.from(A1.stepCpu,x=>+x.toFixed(3)),a2:Array.from(A2.stepCpu,x=>+x.toFixed(3))}));}
console.log(JSON.stringify(out,null,1));
