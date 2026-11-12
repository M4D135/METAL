// Contre-verification PARA : (1) quand un dessin WebGL fait HORS rAF est-il remis au compositeur ? (2) worker froid contre chaud.
import {readFileSync,writeFileSync} from 'node:fs';
const ROOT=process.env.METAL_ROOT;const mods=['renderer','world','destruction','economy','brain','simulation'];
const esc=t=>{if(/<\/script/i.test(t))throw new Error('</script');return t;};
const glue=`
let __sim=null,__s=null,__world=null;
self.onmessage=e=>{const m=e.data;
  if(m.t==='gen'){const t0=performance.now();__world=FWorld.create(96,m.idx,m.opts);const t1=performance.now();__sim=FSimulation.create(__world,{brain:FBrain.create({mode:'cpu'})});__s=__sim.state;const t2=performance.now();self.postMessage({t:'gen',worldMs:t1-t0,simMs:t2-t1});}
  else if(m.t==='run'){const a=[];const input={};for(let i=0;i<m.n;i++){input.moveX=Math.sin(i/90);input.moveY=1;input.sprint=true;input.fire=(i%20)<6;input.dash=(i%240)===0;input.lookX=0.01;input.lookY=0;const t0=performance.now();__sim.step(1/60,input);a.push(performance.now()-t0);__s.player.hp=Math.max(__s.player.hp,60);__s.events.length=0;}self.postMessage({t:'run',a});}
};`;
const page=`<!doctype html><html><head><meta charset="utf-8"><title>para-verif</title></head><body style="margin:0"><canvas id="c" width="64" height="64" style="width:64px;height:64px;display:block"></canvas><pre id="out">pending</pre>
<script type="text/plain" data-w>self.window=self;</script>
${mods.map(n=>'<script type="text/plain" data-w data-name="'+n+'">\n'+esc(readFileSync(ROOT+'/src/'+n+'.js','utf8'))+'\n</script>').join('\n')}
<script type="text/plain" data-w data-name="glue">${esc(glue)}</script>
<script>
(async()=>{
  const out={};const stat=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),q=p=>+s[Math.min(s.length-1,Math.floor(s.length*p))].toFixed(2);return {n:s.length,moy:+(s.reduce((x,y)=>x+y,0)/s.length).toFixed(2),p10:q(.1),p50:q(.5),p90:q(.9),max:+s[s.length-1].toFixed(1)};};
  try{
    // ---- (1) remise au compositeur : rAF contre tache hors rAF
    const cv=document.getElementById('c'),gl=cv.getContext('webgl2',{antialias:false,preserveDrawingBuffer:false,alpha:true});
    const px=new Uint8Array(4);const cleared=()=>{gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);return px[0]===0&&px[3]===0;};
    const draw=()=>{gl.clearColor(1,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);};
    let rafCount=0,rafTime=0;(function f(t){rafCount++;rafTime=performance.now();requestAnimationFrame(f);})(0);
    const mc=new MessageChannel();let onTask=null;mc.port1.onmessage=()=>{if(onTask)onTask();};const task=fn=>{onTask=fn;mc.port2.postMessage(0);};
    const nextRaf=()=>new Promise(r=>requestAnimationFrame(()=>r(performance.now())));
    async function trial(mode,delayMs){
      await nextRaf();await nextRaf();
      return await new Promise(res=>{requestAnimationFrame(()=>{const tR=performance.now(),r0=rafCount;let tDraw=0;
        const poll=()=>{if(cleared()){res({drawAfterRaf:tDraw-tR,presentedAfterRaf:performance.now()-tR,presentedAfterDraw:performance.now()-tDraw,rafsBetween:rafCount-r0,sinceLastRaf:performance.now()-rafTime});return;}if(performance.now()-tR>200){res({timeout:true});return;}task(poll);};
        if(mode==='raf'){draw();tDraw=performance.now();task(poll);}
        else{const go=()=>{if(performance.now()-tR<delayMs){task(go);return;}draw();tDraw=performance.now();task(poll);};task(go);}
      });});
    }
    const sum=rs=>{const ok=rs.filter(r=>!r.timeout);return {essais:rs.length,expires:rs.length-ok.length,dessinApresRafMs:stat(ok.map(r=>r.drawAfterRaf)),remiseApresRafMs:stat(ok.map(r=>r.presentedAfterRaf)),remiseApresDessinMs:stat(ok.map(r=>r.presentedAfterDraw)),rafEntreDessinEtRemise:Object.entries(ok.reduce((h,r)=>{h[r.rafsBetween]=(h[r.rafsBetween]||0)+1;return h;},{})).map(([k,v])=>k+':'+v).join(' ')};};
    const A=[],B1=[],B5=[],B10=[];
    for(let k=0;k<40;k++){A.push(await trial('raf',0));B1.push(await trial('task',1));B5.push(await trial('task',5));B10.push(await trial('task',10));}
    out.presentation={dansRAF:sum(A),tache1msApresRAF:sum(B1),tache5msApresRAF:sum(B5),tache10msApresRAF:sum(B10)};
    // ---- (2) worker froid contre chaud
    const scripts=[...document.querySelectorAll('script[data-w]')];const text=scripts.map(s=>s.textContent).join('\\n;\\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/javascript'}));
    const mk=()=>{const t0=performance.now();const w=new Worker(url);const waiters=[];w.onmessage=e=>{const k=waiters.findIndex(q=>q.t===e.data.t);if(k>=0)waiters.splice(k,1)[0].res(e.data);};return {w,t0,ask:(msg,type)=>new Promise(res=>{waiters.push({t:type,res});w.postMessage(msg);})};};
    const IDX=9,OPTS={campaign:true};const rows=[];
    for(let rep=0;rep<3;rep++){const k=mk();const g1=await k.ask({t:'gen',idx:IDX,opts:OPTS},'gen');const boot=performance.now()-k.t0-g1.worldMs-g1.simMs;const r1=await k.ask({t:'run',n:300},'run');
      const g2=await k.ask({t:'gen',idx:IDX,opts:OPTS},'gen');const r2=await k.ask({t:'run',n:300},'run');const g3=await k.ask({t:'gen',idx:IDX,opts:OPTS},'gen');const r3=await k.ask({t:'run',n:300},'run');k.w.terminate();
      const s=a=>+a.reduce((x,y)=>x+y,0).toFixed(1);
      rows.push({demarrageWorkerMs:+boot.toFixed(0),froid:{mondeMs:+g1.worldMs.toFixed(0),simMs:+g1.simMs.toFixed(0),pas300Ms:s(r1.a),pas60premiersMs:s(r1.a.slice(0,60)),pasMax:+Math.max(...r1.a).toFixed(1)},chaud2:{mondeMs:+g2.worldMs.toFixed(0),simMs:+g2.simMs.toFixed(0),pas300Ms:s(r2.a),pas60premiersMs:s(r2.a.slice(0,60)),pasMax:+Math.max(...r2.a).toFixed(1)},chaud3:{mondeMs:+g3.worldMs.toFixed(0),simMs:+g3.simMs.toFixed(0),pas300Ms:s(r3.a),pas60premiersMs:s(r3.a.slice(0,60)),pasMax:+Math.max(...r3.a).toFixed(1)}});}
    out.workerFroidChaud=rows;
    // fil principal : meme chose
    for(const s of scripts.slice(0,-1)){const el=document.createElement('script');el.textContent=s.textContent;document.head.appendChild(el);}
    const mrows=[];for(let rep=0;rep<3;rep++){const t0=performance.now();const world=FWorld.create(96,IDX,OPTS);const t1=performance.now();const sim=FSimulation.create(world,{brain:FBrain.create({mode:'cpu'})});const t2=performance.now();const a=[];const input={};for(let i=0;i<300;i++){input.moveX=Math.sin(i/90);input.moveY=1;input.sprint=true;input.fire=(i%20)<6;input.dash=(i%240)===0;input.lookX=0.01;input.lookY=0;const q=performance.now();sim.step(1/60,input);a.push(performance.now()-q);sim.state.player.hp=Math.max(sim.state.player.hp,60);sim.state.events.length=0;}
      mrows.push({mondeMs:+(t1-t0).toFixed(0),simMs:+(t2-t1).toFixed(0),pas300Ms:+a.reduce((x,y)=>x+y,0).toFixed(1),pas60premiersMs:+a.slice(0,60).reduce((x,y)=>x+y,0).toFixed(1)});await new Promise(r=>setTimeout(r,50));}
    out.filPrincipalFroidChaud=mrows;
  }catch(err){out.error=String(err&&err.stack||err).slice(0,600);}
  out.finished=true;document.getElementById('out').textContent=JSON.stringify(out);
})();
</script>
<script src="gate.js"></script>
</body></html>`;
writeFileSync(new URL('./verif.html',import.meta.url),page);console.log('verif.html',page.length,'octets');
