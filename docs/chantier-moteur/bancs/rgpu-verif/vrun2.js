// RGPU-verif v2 : injections (particules, bouffée autour de l'œil), débit pipeliné, écarts d'image,
// puis phase asynchrone : une requête TIME_ELAPSED par image, chaque image dans sa propre tâche.
(function(){
  'use strict';
  const C=window.__CFG,out=document.createElement('pre');out.id='vout';document.body.appendChild(out);
  const R={errors:[],info:{},thr:{},lat:{},diffs:{},timer:{},stats:{}};
  const now=()=>performance.now();
  const finish=()=>{out.textContent=JSON.stringify(R);};
  let V=[],scenes={};
  const draw=(v,f)=>{v.r.actorFilter(f.camera,{shadows:true});const dyn=v.inject?f.dynamic.concat(v.inject(f.camera)):f.dynamic;v.r.draw(f.camera,dyn,f.fx);};
  const sync=v=>{const gl=v.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,v.px);};
  const axes=camera=>{const yaw=camera.yaw||0,pitch=camera.pitch||0;return {f:[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)],r:[Math.cos(yaw),0,Math.sin(yaw)]};};
  // Même générateur que pre.js de l'autre agent (stress reproductible).
  function stress(o){return camera=>{const out=[],{f,r}=axes(camera);
    for(let i=0;i<o.count;i++){const a=(i*0.618)%1,b=(i*0.381)%1,d=o.near+(o.far-o.near)*a,side=(b-.5)*o.spread,up=((i*0.7071)%1-.3)*o.spread*.5;
      const p=[camera.pos[0]+f[0]*d+r[0]*side,camera.pos[1]+f[1]*d+up,camera.pos[2]+f[2]*d+r[2]*side],sz=o.size*(.6+.8*b);
      const m={shape:'sphere',p,s:[sz,sz*.8,sz],r:[0,i,0],mat:7,color:o.fire&&i%3===0?[1,.45,.12]:[.32,.31,.30],surface:'object',effectPart:'blast-dust',fx:true,alpha:o.alpha,emissive:o.fire&&i%3===0?1.2:0};
      if(o.fire&&i%3===0)m.fxFire=true;else m.fxSmoke=true;out.push(m);}
    return out;};}
  // Une bouffée de fumée de rayon 1,5 m, centrée à `ahead` m devant l'œil (dedans si ahead < 1,2).
  function puff(ahead){return camera=>{const {f}=axes(camera),e=camera.pos;
    return [{shape:'sphere',p:[e[0]+f[0]*ahead,e[1]+f[1]*ahead,e[2]+f[2]*ahead],s:[3,2.4,3],r:[0,0,0],mat:7,color:[.32,.31,.30],surface:'object',effectPart:'blast-dust',fx:true,fxSmoke:true,alpha:.55}];};}
  try{
    const T0=now();
    const W=window.FWorld.create(96,C.world||0,{campaign:true,campaignVersion:2});
    const sim=window.FSimulation.create(W,{armorSystem:true,brain:window.FBrain.create({mode:'cpu'})});
    const meshes=sim.destruction&&sim.destruction.meshes||W.meshes,lights=sim.destruction&&sim.destruction.lights||W.lights;
    for(const spec of C.variants){
      const mod=spec.code==='base'?window.FRender:window.__V[spec.code];
      if(!mod){R.errors.push('variante absente '+spec.code);continue;}
      const c=document.createElement('canvas');c.style.width=C.cssW+'px';c.style.height=C.cssH+'px';document.body.appendChild(c);
      const r=mod.create(c);r.resize(spec.quality||'auto');r.setWorld(meshes,lights,W.environment);
      const inject=spec.stress?stress(spec.stress):spec.puff!==undefined?puff(spec.puff):null;
      V.push({spec,c,r,gl:c.getContext('webgl2'),px:new Uint8Array(4),inject});
    }
    {const gl=V[0].gl,e=gl.getExtension('WEBGL_debug_renderer_info');R.info.renderer=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);R.info.dpr=window.devicePixelRatio;}
    scenes.out=window.__SCENE.map(f=>({camera:f.camera,dynamic:f.dynamic,fx:Object.assign({},f.fx,{adaptive:false})}));
    const inn=[];for(let k=0;k<60;k++){const a=k*2*Math.PI/60;inn.push({camera:{pos:[C.inPos[0]+Math.cos(a*.5)*1.2,C.inPos[1],C.inPos[2]+Math.sin(a*.5)*1.2],yaw:a,pitch:-.08,roll:0,fov:78.5},dynamic:[],fx:{time:10+k/60,flash:0,lights:[],damage:0,pulse:0,shake:0,shadows:true,bloom:true,adaptive:false}});}
    scenes.in=inn;
    for(const sn of Object.keys(scenes))for(const v of V){for(const f of scenes[sn])draw(v,f);sync(v);}
    for(const v of V)R.stats[v.spec.id]={w:v.c.width,h:v.c.height,fx:v.r.stats.fxInstances,drawCalls:v.r.stats.drawCalls};
    const K=C.block||10;
    for(const sn of C.thrScenes){const S=scenes[sn],nb=Math.floor(S.length/K),acc={};for(const v of V)acc[v.spec.id]=[];let rot=0;
      for(let round=0;round<C.rounds;round++)for(let b=0;b<nb;b++){const order=V.map((_,j)=>V[(j+rot)%V.length]);rot++;
        for(const v of order){sync(v);const t0=now();let cpu=0;for(let k=0;k<K;k++){const a=now();draw(v,S[b*K+k]);cpu+=now()-a;}sync(v);acc[v.spec.id].push([round,b,+((now()-t0)/K).toFixed(3),+(cpu/K).toFixed(3)]);}}
      R.thr[sn]=acc;}
    for(const sn of C.latScenes||[]){const S=scenes[sn],acc={};for(const v of V)acc[v.spec.id]=[];let rot=0;
      for(let round=0;round<C.latRounds;round++)for(let i=0;i<S.length;i++){const order=V.map((_,j)=>V[(j+rot)%V.length]);rot++;
        for(const v of order){sync(v);const t0=now();draw(v,S[i]);const t1=now();sync(v);acc[v.spec.id].push([round,i,+(now()-t0).toFixed(3),+(t1-t0).toFixed(3)]);}}
      R.lat[sn]=acc;}
    const readAll=v=>{const gl=v.gl,w=v.c.width,h=v.c.height,b=new Uint8Array(w*h*4);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);return b;};
    function cmp(a,b){let sum=0,n3=0,n10=0,n25=0;const px=a.length/4;for(let i=0;i<a.length;i+=4){const d0=Math.abs(a[i]-b[i]),d1=Math.abs(a[i+1]-b[i+1]),d2=Math.abs(a[i+2]-b[i+2]),m=Math.max(d0,d1,d2);sum+=d0+d1+d2;if(m>3)n3++;if(m>10)n10++;if(m>25)n25++;}return {mad:sum/(px*3),gt3:n3/px,gt10:n10/px,gt25:n25/px};}
    for(const sn of C.diffScenes||[]){const S=scenes[sn],acc={};
      for(let i=0;i<S.length;i+=C.diffEvery){const imgs={};for(const v of V){draw(v,S[i]);imgs[v.spec.id]=readAll(v);}
        const ref=imgs[C.ref];for(const v of V){const id=v.spec.id;if(id===C.ref||imgs[id].length!==ref.length)continue;(acc[id]||(acc[id]=[])).push(cmp(imgs[id],ref));}}
      const avg={};for(const id in acc){const L=acc[id],m=k=>+(L.reduce((x,y)=>x+y[k],0)/L.length).toFixed(4);avg[id]={n:L.length,mad:m('mad'),gt3:m('gt3'),gt10:m('gt10'),gt25:m('gt25')};}
      R.diffs[sn]=avg;}
    R.info.syncMs=+(now()-T0).toFixed(0);
  }catch(e){R.errors.push(String(e&&e.stack||e));finish();return;}
  // Phase asynchrone : minuterie GPU (une requête par image et par tâche, lecture après coup).
  const TV=V.filter(v=>(C.timerVariants||[]).includes(v.spec.id));
  if(!TV.length){finish();return;}
  const ext=TV.map(v=>v.gl.getExtension('EXT_disjoint_timer_query_webgl2'));
  if(!ext.every(Boolean)){R.timer.error='extension absente';finish();return;}
  function spin(ms){let x=0;for(let i=0;i<ms*400000;i++)x+=Math.sqrt(i);return x;}
  const S=scenes.out,pending=[];let i=0;
  function step(){
    try{
      if(i<S.length*C.timerRounds){const f=S[i%S.length];
        TV.forEach((v,j)=>{const gl=v.gl,e=ext[j],q=gl.createQuery();gl.beginQuery(e.TIME_ELAPSED_EXT,q);draw(v,f);gl.endQuery(e.TIME_ELAPSED_EXT);gl.flush();pending.push({id:v.spec.id,i:i%S.length,q,gl});});
        i++;spin(6);setTimeout(step,0);return;}
      poll(0);
    }catch(e){R.errors.push('timer '+String(e&&e.stack||e));finish();}
  }
  function poll(n){
    spin(5);const ready=pending.filter(p=>p.gl.getQueryParameter(p.q,p.gl.QUERY_RESULT_AVAILABLE)).length;
    if(ready<pending.length&&n<300){setTimeout(()=>poll(n+1),0);return;}
    const res={};for(const p of pending){const ok=p.gl.getQueryParameter(p.q,p.gl.QUERY_RESULT_AVAILABLE);(res[p.id]||(res[p.id]=[])).push([p.i,ok?+(p.gl.getQueryParameter(p.q,p.gl.QUERY_RESULT)/1e6).toFixed(3):null]);}
    R.timer={polls:n,ready,total:pending.length,disjoint:TV.map((v,j)=>v.gl.getParameter(ext[j].GPU_DISJOINT_EXT)),res};
    finish();
  }
  setTimeout(step,0);
})();
