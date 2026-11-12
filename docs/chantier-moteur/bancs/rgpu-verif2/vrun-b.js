// RGPU-verif : exécuté de façon synchrone dans la page (aucune attente d'événement) ; sortie dans <pre id="vout">.
(function(){
  'use strict';
  const C=window.__CFG,out=document.createElement('pre');out.id='vout';document.body.appendChild(out);
  const R={errors:[],info:{},thr:{},lat:{},diffs:{},realloc:null,stats:{}};
  const now=()=>performance.now();
  try{
    const T0=now();
    const W=window.FWorld.create(96,C.world||0,{campaign:true,campaignVersion:2});
    const sim=window.FSimulation.create(W,{armorSystem:true,brain:window.FBrain.create({mode:'cpu'})});
    const meshes=sim.destruction&&sim.destruction.meshes||W.meshes,lights=sim.destruction&&sim.destruction.lights||W.lights;
    R.info.worldMs=+(now()-T0).toFixed(1);
    const V=[];
    for(const spec of C.variants){
      const mod=spec.code==='base'?window.FRender:window.__V[spec.code];
      if(!mod){R.errors.push('variante absente '+spec.code);continue;}
      const c=document.createElement('canvas');c.style.width=C.cssW+'px';c.style.height=C.cssH+'px';document.body.appendChild(c);
      const r=mod.create(c);r.resize(spec.quality||'auto');r.setWorld(meshes,lights,W.environment);
      V.push({spec,c,r,gl:c.getContext('webgl2'),px:new Uint8Array(4)});
    }
    {const gl=V[0].gl,e=gl.getExtension('WEBGL_debug_renderer_info');R.info.renderer=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);R.info.dpr=window.devicePixelRatio;}
    const scenes={};
    scenes.out=(window.__SCENE||[]).map(f=>({camera:f.camera,dynamic:f.dynamic,fx:Object.assign({},f.fx,{adaptive:false})}));
    const inn=[];for(let k=0;k<60;k++){const a=k*2*Math.PI/60;inn.push({camera:{pos:[C.inPos[0]+Math.cos(a*.5)*1.2,C.inPos[1],C.inPos[2]+Math.sin(a*.5)*1.2],yaw:a,pitch:-.08,roll:0,fov:78.5},dynamic:[],fx:{time:10+k/60,flash:0,lights:[],damage:0,pulse:0,shake:0,shadows:true,bloom:true,adaptive:false}});}
    scenes.in=inn;
    scenes.outT=scenes.out.map(f=>{const e=f.camera.pos,y=f.camera.yaw,fw=[Math.sin(y),0,-Math.cos(y)];
      return {camera:f.camera,dynamic:f.dynamic,fx:Object.assign({},f.fx,{lights:[4,7,10].map((d,i)=>({p:[e[0]+fw[0]*d+(i-1)*1.5,e[1]+.3,e[2]+fw[2]*d],power:20,range:12,color:[1,.45,.1]}))})};});
    const fwd=c=>[Math.sin(c.yaw),0,-Math.cos(c.yaw)];
    const withT=(S,ds,pw,rg)=>S.map(f=>{const e=f.camera.pos,fw=fwd(f.camera);return {camera:f.camera,dynamic:f.dynamic,fx:Object.assign({},f.fx,{lights:ds.map((d,i)=>({p:[e[0]+fw[0]*d+(i-1)*1.5,e[1]+.3,e[2]+fw[2]*d],power:pw,range:rg,color:[1,.45,.1]}))})};});
    const withA=S=>S.map(f=>{const e=f.camera.pos,fw=fwd(f.camera),rt=[-fw[2],0,fw[0]],at=(d,s,y)=>[e[0]+fw[0]*d+rt[0]*s,e[1]+y,e[2]+fw[2]*d+rt[2]*s];
      const part=(p,s,shape)=>({shape:shape||'box',p,s,r:[0,f.camera.yaw,0],mat:0,color:[.24,.28,.31],emissive:0,surface:'object'});
      return {camera:f.camera,fx:f.fx,dynamic:f.dynamic.concat([part(at(2.2,-.35,-.55),[.55,.75,.32]),part(at(2.2,-.35,-1.25),[.42,.7,.3]),part(at(2.2,-.35,.05),[.34,.34,.34],'sphere'),part(at(1.6,.5,-.3),[.2,.9,.2],'cylinder')])};});
    scenes.inT=withT(scenes.in,[4,7,10],20,12);
    scenes.inFar=withT(scenes.in,[30],3.5,5.5);
    scenes.inA=withA(scenes.in);
    if(C.walk){const input={moveX:0,moveY:1,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,sprint:true},wk=[];
      for(let s2=0;s2<C.walk;s2++){input.lookX=Math.sin(s2*.013)*.018+(s2%240<40?.03:0);try{sim.step(1/60,input);}catch(e){R.errors.push('walk '+e);break;}
        if(s2%Math.floor(C.walk/60)===0){const p=sim.state.player;wk.push({camera:{pos:[p.x,(p.y||0)+1.62,p.z],yaw:p.yaw,pitch:p.pitch||0,roll:0,fov:78.5},dynamic:[],fx:{time:10+s2/60,flash:0,lights:[],damage:0,pulse:0,shake:0,shadows:true,bloom:true,adaptive:false}});}}
      scenes.walk=wk.slice(0,60);scenes.walkT=withT(scenes.walk,[6,7.5,9],20,12);scenes.walkFar=withT(scenes.walk,[30],3.5,5.5);scenes.walkA=withA(scenes.walk);}
    if(!window.__SCENE.length){delete scenes.out;delete scenes.outT;}
    const draw=(v,f)=>{v.r.actorFilter(f.camera,{shadows:true});v.r.draw(f.camera,f.dynamic,f.fx);};
    const sync=v=>{const gl=v.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,v.px);};
    // Chauffe : chaque variante dessine chaque scène une fois (compilation, allocations).
    for(const sn of Object.keys(scenes))for(const v of V){for(const f of scenes[sn])draw(v,f);sync(v);}
    for(const v of V)R.stats[v.spec.id]={w:v.c.width,h:v.c.height,staticVisible:v.r.stats.staticVisible,shadowMaps:v.r.stats.shadowMaps,drawCalls:v.r.stats.drawCalls};
    R.info.warmMs=+(now()-T0).toFixed(0);
    // 1) Débit pipeliné : blocs de K images consécutives sans synchro intermédiaire.
    const K=C.block||10;
    for(const sn of C.thrScenes){const S=scenes[sn],nb=Math.floor(S.length/K),acc={};for(const v of V)acc[v.spec.id]=[];let rot=0;
      for(let round=0;round<C.rounds;round++)for(let b=0;b<nb;b++){const order=V.map((_,j)=>V[(j+rot)%V.length]);rot++;
        for(const v of order){sync(v);const t0=now();let cpu=0;for(let k=0;k<K;k++){const a=now();draw(v,S[b*K+k]);cpu+=now()-a;}sync(v);acc[v.spec.id].push([round,b,+((now()-t0)/K).toFixed(3),+(cpu/K).toFixed(3)]);}}
      R.thr[sn]=acc;}
    R.info.thrMs=+(now()-T0).toFixed(0);
    // 2) Latence : synchro après chaque image (méthode de l'autre agent, pour comparaison).
    for(const sn of C.latScenes){const S=scenes[sn],acc={};for(const v of V)acc[v.spec.id]=[];let rot=0;
      for(let round=0;round<C.latRounds;round++)for(let i=0;i<S.length;i++){const order=V.map((_,j)=>V[(j+rot)%V.length]);rot++;
        for(const v of order){sync(v);const t0=now();draw(v,S[i]);const t1=now();sync(v);acc[v.spec.id].push([round,i,+(now()-t0).toFixed(3),+(t1-t0).toFixed(3)]);}}
      R.lat[sn]=acc;}
    R.info.latMs=+(now()-T0).toFixed(0);
    // 3) Écarts d'image par rapport à la référence de même taille.
    const readAll=v=>{const gl=v.gl,w=v.c.width,h=v.c.height,b=new Uint8Array(w*h*4);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);return b;};
    function cmp(a,b){let sum=0,n3=0,n10=0,n25=0,se=0;const px=a.length/4;for(let i=0;i<a.length;i+=4){const d0=Math.abs(a[i]-b[i]),d1=Math.abs(a[i+1]-b[i+1]),d2=Math.abs(a[i+2]-b[i+2]),m=Math.max(d0,d1,d2);sum+=d0+d1+d2;se+=d0*d0+d1*d1+d2*d2;if(m>3)n3++;if(m>10)n10++;if(m>25)n25++;}
      const mse=se/(px*3);return {mad:sum/(px*3),gt3:n3/px,gt10:n10/px,gt25:n25/px,psnr:mse>0?10*Math.log10(65025/mse):99};}
    for(const sn of C.diffScenes){const S=scenes[sn],acc={},lum=[];
      for(let i=0;i<S.length;i+=C.diffEvery){const imgs={};for(const v of V){draw(v,S[i]);imgs[v.spec.id]=readAll(v);}
        const ref=imgs[C.ref];{let s=0;for(let k=0;k<ref.length;k+=4)s+=.2126*ref[k]+.7152*ref[k+1]+.0722*ref[k+2];lum.push(s/(ref.length/4));}
        for(const v of V){const id=v.spec.id;if(id===C.ref)continue;const pair=v.spec.quality==='high'?imgs[C.refHigh]:ref;if(!pair||id===C.refHigh||pair.length!==imgs[id].length)continue;(acc[id]||(acc[id]=[])).push(cmp(imgs[id],pair));}}
      const avg={};for(const id in acc){const L=acc[id],m=k=>+(L.reduce((x,y)=>x+y[k],0)/L.length).toFixed(4);avg[id]={n:L.length,mad:m('mad'),gt3:m('gt3'),gt10:m('gt10'),gt25:m('gt25'),psnr:m('psnr'),worstGt10:+Math.max(...L.map(x=>x.gt10)).toFixed(4),worstGt25:+Math.max(...L.map(x=>x.gt25)).toFixed(4)};}
      avg.__meanLuma=+(lum.reduce((x,y)=>x+y,0)/lum.length).toFixed(1);R.diffs[sn]=avg;}
    R.pairs={};for(const [sa,sb,id] of (C.pairs||[])){const v=V.find(x=>x.spec.id===id),A=scenes[sa],B=scenes[sb];if(!v||!A||!B)continue;const L=[];
      for(let i=0;i<A.length;i+=C.diffEvery){draw(v,A[i]);const ia=readAll(v);draw(v,B[i]);const ib=readAll(v);const c=cmp(ib,ia);let sa2=0,sb2=0;for(let k=0;k<ia.length;k+=4){sa2+=ia[k]+ia[k+1]+ia[k+2];sb2+=ib[k]+ib[k+1]+ib[k+2];}c.lumaRatio=sb2/sa2;L.push(c);}
      const m=k=>+(L.reduce((x,y)=>x+y[k],0)/L.length).toFixed(4);R.pairs[sa+'>'+sb+':'+id]={n:L.length,mad:m('mad'),gt3:m('gt3'),gt10:m('gt10'),gt25:m('gt25'),lumaRatio:m('lumaRatio'),minLumaRatio:+Math.min(...L.map(x=>x.lumaRatio)).toFixed(4)};}
    R.shots=[];for(const [sn,id] of (C.shots||[])){const S=scenes[sn],v=V.find(x=>x.spec.id===id),r0=V.find(x=>x.spec.id===C.ref);if(!S||!v)continue;let worst=-1,wi=0;
      for(let i=0;i<S.length;i+=C.diffEvery){draw(r0,S[i]);const a=readAll(r0);draw(v,S[i]);const c=cmp(readAll(v),a);if(c.gt10>worst){worst=c.gt10;wi=i;}}
      draw(r0,S[wi]);const a=readAll(r0);draw(v,S[wi]);const bb=readAll(v),w=r0.c.width,h=r0.c.height;
      const toJpeg=(arr,amp)=>{const c2=document.createElement('canvas');c2.width=w;c2.height=h;const x=c2.getContext('2d'),im=x.createImageData(w,h);
        for(let y=0;y<h;y++){const so=(h-1-y)*w*4,dо=y*w*4;for(let k=0;k<w*4;k+=4){if(amp){im.data[dо+k]=Math.min(255,Math.abs(arr[so+k]-a[so+k])*amp);im.data[dо+k+1]=Math.min(255,Math.abs(arr[so+k+1]-a[so+k+1])*amp);im.data[dо+k+2]=Math.min(255,Math.abs(arr[so+k+2]-a[so+k+2])*amp);}else{im.data[dо+k]=arr[so+k];im.data[dо+k+1]=arr[so+k+1];im.data[dо+k+2]=arr[so+k+2];}im.data[dо+k+3]=255;}}
        x.putImageData(im,0,0);const c3=document.createElement('canvas');c3.width=w>>1;c3.height=h>>1;c3.getContext('2d').drawImage(c2,0,0,c3.width,c3.height);return c3.toDataURL('image/jpeg',.8);};
      R.shots.push({scene:sn,id,frame:wi,gt10:worst,base:toJpeg(a,0),variant:toJpeg(bb,0),diff:toJpeg(bb,8)});}
    R.info.diffMs=+(now()-T0).toFixed(0);
    // 4) Coût d'un changement de taille (chemin du gouverneur : canvas.width + réallocation des cibles).
    {const v=V.find(x=>x.spec.id===C.ref),S=scenes.out||scenes.walk,normal=[],spike=[],spikeCpu=[],normalCpu=[];
      for(let c=0;c<C.reallocCycles;c++){
        for(let k=0;k<4;k++){const f=S[(c*5+k)%S.length];sync(v);const t0=now();draw(v,f);const t1=now();sync(v);normal.push(now()-t0);normalCpu.push(t1-t0);}
        v.c.style.width=(c%2?C.cssW:C.cssW-40)+'px';
        const f=S[(c*5+4)%S.length];sync(v);const t0=now();draw(v,f);const t1=now();sync(v);spike.push(now()-t0);spikeCpu.push(t1-t0);
      }
      v.c.style.width=C.cssW+'px';
      const q=(a,p)=>{const b=a.slice().sort((x,y)=>x-y);return +b[Math.min(b.length-1,Math.floor(b.length*p))].toFixed(2);};
      R.realloc={cycles:C.reallocCycles,normalMed:q(normal,.5),normalP90:q(normal,.9),normalCpuMed:q(normalCpu,.5),spikeMed:q(spike,.5),spikeP90:q(spike,.9),spikeMax:q(spike,1),spikeCpuMed:q(spikeCpu,.5),spikeCpuMax:q(spikeCpu,1)};}
    R.info.totalMs=+(now()-T0).toFixed(0);
  }catch(e){R.errors.push(String(e&&e.stack||e));}
  out.textContent=JSON.stringify(R);
})();
