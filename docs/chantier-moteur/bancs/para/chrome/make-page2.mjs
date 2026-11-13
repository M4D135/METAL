// Fabrique chrome/page2.html : la VRAIE simulation de METAL dans un worker cree depuis un Blob, page ouverte en file://.
import {readFileSync,writeFileSync} from 'node:fs';
const ROOT=process.env.METAL_ROOT;const mods=['renderer','world','destruction','economy','brain','simulation'];
const esc=t=>{if(/<\/script/i.test(t))throw new Error('</script');return t;};
const schema=readFileSync(new URL('../schema.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
const glue=`
const __pack=compilePack();let __sim=null,__s=null,__world=null,__pool=[],__dictSent=0;
self.onmessage=e=>{const m=e.data;
  if(m.t==='gen'){const t0=performance.now();__world=FWorld.create(96,m.idx,m.opts);const t1=performance.now();__sim=FSimulation.create(__world,{brain:FBrain.create({mode:'cpu'})});__s=__sim.state;const t2=performance.now();self.postMessage({t:'gen',worldMs:t1-t0,simMs:t2-t1});}
  else if(m.t==='world'){let payload,tr=[];const t0=performance.now();
    if(m.what==='world')payload=__world;else if(m.what==='render')payload={meshes:__world.meshes,lights:__world.lights,environment:__world.environment};
    else{const n=__world.meshes.length,f=new Float32Array(n*16);let o=0;for(const q of __world.meshes){f[o++]=0;f[o++]=q.p[0];f[o++]=q.p[1];f[o++]=q.p[2];f[o++]=q.s[0];f[o++]=q.s[1];f[o++]=q.s[2];f[o++]=q.mat;f[o++]=q.color?q.color[0]:NaN;f[o++]=q.color?q.color[1]:NaN;f[o++]=q.color?q.color[2]:NaN;f[o++]=q.r?q.r[0]:0;f[o++]=q.r?q.r[1]:0;f[o++]=q.r?q.r[2]:0;f[o++]=q.destructibleId??-1;f[o++]=0;}payload={n,buf:f.buffer};tr=[f.buffer];}
    const t1=performance.now();self.postMessage({t:'world',what:m.what,payload,prepMs:t1-t0,sentAt:performance.timeOrigin+performance.now()},tr);self.postMessage({t:'worldcost',postMs:performance.now()-t1});}
  else if(m.t==='in'){const t0=performance.now();__sim.step(1/60,m.input);__s.player.hp=Math.max(__s.player.hp,60);const t1=performance.now();const n=needed(__s);let buf=__pool.pop();if(!buf||buf.byteLength<n*4)buf=new ArrayBuffer((n+1024)*4);const len=__pack(__s,new Float32Array(buf));__s.events.length=0;
    const d=dict.length>__dictSent?dict.slice(__dictSent):null;__dictSent=dict.length;self.postMessage({t:'st',tick:m.tick,len,buf,stepMs:t1-t0,dict:d,x:__s.player.x,kills:__s.kills},[buf]);}
  else if(m.t==='ret'){__pool.push(m.buf);}
};`;
const page=`<!doctype html><html><head><meta charset="utf-8"><title>para-page2</title></head><body><pre id="out">pending</pre>
<script type="text/plain" data-w>self.window=self;</script>
${mods.map(n=>'<script type="text/plain" data-w data-name="'+n+'">\n'+esc(readFileSync(ROOT+'/src/'+n+'.js','utf8'))+'\n</script>').join('\n')}
<script type="text/plain" data-w data-name="schema">${esc(schema)}</script>
<script type="text/plain" data-w data-name="glue">${esc(glue)}</script>
<script>
(async()=>{
  const out={};const FRAMES=${+(process.env.FRAMES||1800)};
  const stat=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),q=p=>+s[Math.min(s.length-1,Math.floor(s.length*p))].toFixed(2);return {n:s.length,moy:+(s.reduce((x,y)=>x+y,0)/s.length).toFixed(3),p50:q(.5),p95:q(.95),p99:q(.99),max:+s[s.length-1].toFixed(1)};};
  const cnt=(a,ts)=>Object.fromEntries(ts.map(t=>['>'+t+'ms',a.filter(x=>x>t).length]));
  try{
    // AudioWorklet par URL data:
    try{const oac=new OfflineAudioContext(1,4096,22050);await oac.audioWorklet.addModule('data:text/javascript,'+encodeURIComponent('class P extends AudioWorkletProcessor{process(i,o){const c=o[0][0];for(let k=0;k<c.length;k++)c[k]=.5;return true;}}registerProcessor("p",P);'));const node=new AudioWorkletNode(oac,'p');node.connect(oac.destination);const b=await oac.startRendering();out.audioWorkletDataUrl={ok:true,sample:b.getChannelData(0)[2000]};}catch(err){out.audioWorkletDataUrl={ok:false,error:String(err).slice(0,160)};}
    const scripts=[...document.querySelectorAll('script[data-w]')];const text=scripts.map(s=>s.textContent).join('\\n;\\n');out.octetsSourceWorker=text.length;
    const url=URL.createObjectURL(new Blob([text],{type:'text/javascript'}));
    // moniteur rAF
    let lastT=0,rec=null;(function f(t){if(lastT&&rec)rec.push(t-lastT);lastT=t;requestAnimationFrame(f);})(performance.now());
    const during=async fn=>{rec=[];await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));rec=[];const v=await fn();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const iv=rec;rec=null;return {v,imageMaxMs:+Math.max(...iv).toFixed(1),images:iv.length};};
    const w=new Worker(url,{name:'metal-sim'});const waiters=[];w.onmessage=e=>{const m=e.data;const k=waiters.findIndex(q=>q.t===m.t);if(k>=0)waiters.splice(k,1)[0].res(m);else if(onState&&m.t==='st')onState(m);};w.onerror=e=>{out.workerError=e.message;};
    let onState=null;const ask=(msg,type)=>new Promise(res=>{waiters.push({t:type,res});w.postMessage(msg);});
    const IDX=9,OPTS={campaign:true};
    // T1 : generation + FSimulation.create dans le worker, page libre
    {const r=await during(()=>ask({t:'gen',idx:IDX,opts:OPTS},'gen'));out.generationDansWorker={mondeMs:+r.v.worldMs.toFixed(0),simulationMs:+r.v.simMs.toFixed(0),imagePageMaxMs:r.imageMaxMs,imagesPendant:r.images};}
    // T2 : transfert du monde vers la page
    out.transfertMonde={};
    for(const what of ['packed','render','world']){const r=await during(async()=>{const p=ask({t:'world',what},'world');const c=new Promise(res=>waiters.push({t:'worldcost',res}));const m=await p;const transit=performance.timeOrigin+performance.now()-m.sentAt;const cost=await c;return {prepMs:m.prepMs,postMs:cost.postMs,transit,n:m.payload&&(m.payload.n||m.payload.meshes&&m.payload.meshes.length)};});
      out.transfertMonde[what]={preparationWorkerMs:+r.v.prepMs.toFixed(1),postWorkerMs:+r.v.postMs.toFixed(1),transitEtDeserialisationMs:+r.v.transit.toFixed(1),imagePageMaxMs:r.imageMaxMs,maillages:r.v.n};}
    // T3 : simulation dans le worker, cadencee par rAF de la page
    const drive=(i,input)=>{input.moveX=Math.sin(i/90);input.moveY=1;input.sprint=true;input.fire=(i%20)<6;input.dash=(i%240)===0;input.lookX=0.01;input.lookY=0;return input;};
    {const iv=[],late=[],turn=[],steps=[],sentAt=new Float64Array(FRAMES);let newest=-1,i=0,last=0,bytes=0,finalX=0,kills=0;
      onState=m=>{if(m.tick>newest)newest=m.tick;turn.push(performance.now()-sentAt[m.tick]);steps.push(m.stepMs);bytes+=m.len*4;finalX=m.x;kills=m.kills;w.postMessage({t:'ret',buf:m.buf},[m.buf]);};
      await new Promise(res=>{const f=t=>{if(last)iv.push(t-last);last=t;if(i>=FRAMES){res();return;}if(i>0)late.push(Math.max(0,(i-1)-newest));sentAt[i]=performance.now();w.postMessage({t:'in',tick:i,input:drive(i,{})});i++;requestAnimationFrame(f);};requestAnimationFrame(f);});
      await new Promise(r=>setTimeout(r,300));onState=null;
      out.simDansWorker={images:iv.length,intervalleRAF:stat(iv),imagesLongues:cnt(iv,[20,25,34,50]),pasWorkerMs:stat(steps),pasLongs:cnt(steps,[4,8,16]),etatEnRetard:{'>=1 tick':late.filter(x=>x>=1).length,'>=2':late.filter(x=>x>=2).length,max:Math.max(...late)},allerRetourMs:stat(turn),allerRetourSous:{'<=1ms':turn.filter(x=>x<=1).length,'<=2ms':turn.filter(x=>x<=2).length,'<=4ms':turn.filter(x=>x<=4).length,total:turn.length},octetsParTick:Math.round(bytes/steps.length),finalX,kills};}
    w.terminate();
    // T4 : la meme chose sur le fil principal
    for(const s of scripts.slice(0,-2)){const el=document.createElement('script');el.textContent=s.textContent;document.head.appendChild(el);}
    {const r=await during(async()=>{const t0=performance.now();const world=FWorld.create(96,IDX,OPTS);const t1=performance.now();const sim=FSimulation.create(world,{brain:FBrain.create({mode:'cpu'})});return {world,sim,worldMs:t1-t0,simMs:performance.now()-t1};});
      out.generationSurFilPrincipal={mondeMs:+r.v.worldMs.toFixed(0),simulationMs:+r.v.simMs.toFixed(0),imagePageMaxMs:r.imageMaxMs};
      const sim=r.v.sim,s=sim.state,iv=[],steps=[];let i=0,last=0;
      await new Promise(res=>{const f=t=>{if(last)iv.push(t-last);last=t;if(i>=FRAMES){res();return;}const t0=performance.now();sim.step(1/60,drive(i,{}));s.player.hp=Math.max(s.player.hp,60);s.events.length=0;steps.push(performance.now()-t0);i++;requestAnimationFrame(f);};requestAnimationFrame(f);});
      out.simSurFilPrincipal={images:iv.length,intervalleRAF:stat(iv),imagesLongues:cnt(iv,[20,25,34,50]),pasMs:stat(steps),pasLongs:cnt(steps,[4,8,16]),finalX:s.player.x,kills:s.kills};}
  }catch(err){out.error=String(err&&err.stack||err).slice(0,600);}
  out.finished=true;document.getElementById('out').textContent=JSON.stringify(out);
})();
</script>
<script src="gate.js"></script>
</body></html>`;
writeFileSync(new URL('./page2.html',import.meta.url),page);console.log('page2.html',page.length,'octets');
