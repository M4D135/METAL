// RGPU POST : pilote déterministe (60 Hz synthétiques), entrées scriptées, agrégation et sortie JSON.
// Tout s'exécute en micro-tâches avant l'événement load : --dump-dom récupère le <pre id="out">.
(async function(){
  'use strict';
  const C=window.__RGPU_CONFIG,Q=window.__RGPU_QUEUE;
  const out=document.createElement('pre');out.id='rgpu-out';document.body.appendChild(out);
  const result={name:C.name,errors:[],game:{},variants:{},samples:[]};
  const q=(arr,p)=>{if(!arr.length)return null;const a=arr.slice().sort((x,y)=>x-y);return +a[Math.min(a.length-1,Math.floor(a.length*p))].toFixed(3);};
  try{
    let now=performance.now();
    const tick=async()=>{const cbs=Q.splice(0);now+=1000/60;const t0=performance.now();for(const cb of cbs)cb(now);const dt=performance.now()-t0;await null;return dt;};
    for(let i=0;i<3;i++)await tick();
    const R=window.__RGPU;
    if(!R)throw new Error('proxy absent');
    for(const v of R.variants)if(v.err)result.errors.push(v.spec.id+': '+v.err);
    document.getElementById('start').click();now=performance.now();await null;
    const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,key:code,bubbles:true}));
    const canvas=document.getElementById('world');
    key('keydown','KeyW');key('keydown','ShiftLeft');
    const total=C.warmFrames+C.measureFrames,gameCpu=[],warmCpu=[];
    for(let f=0;f<total;f++){
      const ph=f%240;
      if(ph===0)key('keydown','ArrowRight');if(ph===50)key('keyup','ArrowRight');if(ph===120)key('keydown','ArrowLeft');if(ph===170)key('keyup','ArrowLeft');
      if(f%30===0)canvas.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true}));if(f%30===14)window.dispatchEvent(new MouseEvent('mouseup',{button:0,bubbles:true}));
      if(f%300===150)key('keydown','Space');if(f%300===151)key('keyup','Space');
      R.measuring=f>=C.warmFrames;R.segment=R.measuring&&!!C.segments;R.frameIndex=f;R.drawTime=0;
      const ms=await tick();
      if(R.measuring)gameCpu.push(ms-R.drawTime);else if(f>60)warmCpu.push(ms);
      if(f%60===0){const s=document.body.dataset;result.samples.push({f,state:s.state,health:s.health,score:s.score});}
    }
    result.game={frameCpuWarmMedian:q(warmCpu,.5),frameCpuWarmP95:q(warmCpu,.95),frameCpuWarmMax:q(warmCpu,1),frameCpuMeasureMedian:q(gameCpu,.5),frameCpuMeasureP95:q(gameCpu,.95)};
    const frames=R.frames.slice(C.skip||0);
    result.frames=frames.length;
    result.scene={dynMedian:q(frames.map(f=>f.dyn),.5),dynMax:q(frames.map(f=>f.dyn),1),fxMedian:q(frames.map(f=>f.fx),.5),fxMax:q(frames.map(f=>f.fx),1),overlayMedian:q(frames.map(f=>f.overlay),.5),transientLightsMax:q(frames.map(f=>f.lights),1),flashFrames:frames.filter(f=>f.flash>0).length};
    for(const v of R.variants){
      const id=v.spec.id,recs=frames.map(f=>f.v[id]).filter(Boolean);
      if(!recs.length){result.variants[id]={error:v.err||'no frames'};continue;}
      const r={code:v.spec.code,quality:v.spec.quality||'auto',fx:v.spec.fx||{},n:recs.length,
        totalMedian:q(recs.map(x=>x.total),.5),totalP10:q(recs.map(x=>x.total),.1),totalP90:q(recs.map(x=>x.total),.9),totalMax:q(recs.map(x=>x.total),1),
        minMedian:q(recs.map(x=>x.minTotal),.5),minP10:q(recs.map(x=>x.minTotal),.1),minP90:q(recs.map(x=>x.minTotal),.9),
        cpuMedian:q(recs.map(x=>x.cpu),.5),cpuP90:q(recs.map(x=>x.cpu),.9),
        drawsMedian:q(recs.map(x=>x.counts.draws),.5),instancesMedian:q(recs.map(x=>x.counts.instances),.5),trianglesMedian:q(recs.map(x=>x.counts.triangles),.5),uploadKBMedian:q(recs.map(x=>x.counts.uploadBytes/1024),.5),uploadKBMax:q(recs.map(x=>x.counts.uploadBytes/1024),1)};
      const st=recs.map(x=>x.stats).filter(Boolean);if(st.length)r.stats=st[st.length>>1];
      if(v.spec.segments){
        const seg={};
        for(const x of recs){if(!x.marks)continue;const acc={};for(let i=0;i<x.marks.length-1;i++){const k=x.marks[i].key;acc[k]=(acc[k]||0)+x.marks[i+1].t-x.marks[i].t;}for(const k in acc)(seg[k]||(seg[k]=[])).push(acc[k]);}
        r.segments={};for(const k in seg)r.segments[k]={median:q(seg[k],.5),p90:q(seg[k],.9)};
        const segc=recs.filter(x=>x.seg);if(segc.length)r.segCounts=segc[segc.length>>1].seg;
      }
      const rb=recs.map(x=>x.readback).filter(Boolean);
      if(rb.length){const keys=['meanAll','meanCovered','covered','ge2','ge3','ge4'];r.readback={n:rb.length};for(const k of keys)r.readback[k]=+(rb.reduce((a,b)=>a+b[k],0)/rb.length).toFixed(3);r.readback.max=Math.max(...rb.map(b=>b.max));r.readback.hist=rb[rb.length>>1].hist;}
      result.variants[id]=r;
    }
    if(R.dynDumps)result.dynDumps=R.dynDumps;
    if(R.sceneDump)result.sceneDump=R.sceneDump;
    if(R.diffs){result.diffs={};for(const id in R.diffs){const L=R.diffs[id],avg=k=>+(L.reduce((a,b)=>a+b[k],0)/L.length).toFixed(4);result.diffs[id]={n:L.length,mad:avg('mad'),gt3:avg('gt3'),gt10:avg('gt10'),gt25:avg('gt25'),psnr:avg('psnr'),worstGt10:+Math.max(...L.map(x=>x.gt10)).toFixed(4)};}}
    if(C.dumpFrames)result.perFrame=frames.map(f=>({f:f.f,dyn:f.dyn,fx:f.fx,l:f.lights,fl:+f.flash.toFixed(2),t:Object.fromEntries(Object.entries(f.v).map(([k,v])=>[k,+v.total.toFixed(2)])),m:Object.fromEntries(Object.entries(f.v).map(([k,v])=>[k,+v.minTotal.toFixed(2)])),c:Object.fromEntries(Object.entries(f.v).map(([k,v])=>[k,+v.cpu.toFixed(2)])),g:Object.fromEntries(Object.entries(f.v).map(([k,v])=>[k,+v.minGpu.toFixed(2)])),mc:Object.fromEntries(Object.entries(f.v).map(([k,v])=>[k,+v.minCpu.toFixed(2)])),u:Object.fromEntries(Object.entries(f.v).map(([k,v])=>[k,Math.round(v.counts.uploadBytes/1024)]))}));
  }catch(e){result.errors.push(String(e&&e.stack||e));}
  out.textContent=JSON.stringify(result);
})();
