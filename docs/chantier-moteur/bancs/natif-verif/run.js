// NATIF : execution dans la page. Variantes appariees, ordre tourne, synchronisation par readPixels.
// - debit pipeline : blocs de K images, une synchro par bloc (ms par image, CPU d'emission a part) ;
// - identite d'image : lecture de tout le tampon, ecart maximal par canal et part de pixels differents.
(function(){
  'use strict';
  const C=window.__CFG,out=document.createElement('pre');out.id='vout';document.body.appendChild(out);
  const R={name:C.name,errors:[],info:{},thr:{},diffs:{},stats:{},scenes:{}};
  const now=()=>performance.now();
  let fakeDpr=1;Object.defineProperty(window,'devicePixelRatio',{get:()=>fakeDpr,configurable:true});
  const worlds=new Map();
  function getWorld(idx){
    if(worlds.has(idx))return worlds.get(idx);
    const W=window.FWorld.create(96,idx,{campaign:true,campaignVersion:2});
    const sim=window.FSimulation.create(W,{armorSystem:true,brain:window.FBrain.create({mode:'cpu'})});
    const o={W,sim,meshes:sim.destruction&&sim.destruction.meshes||W.meshes,lights:sim.destruction&&sim.destruction.lights||W.lights};
    worlds.set(idx,o);return o;
  }
  const FX={flash:0,lights:[],damage:0,pulse:0,shake:0,shadows:true,bloom:true,adaptive:false};
  function frames(spec){
    const w=getWorld(spec.world);
    if(spec.kind==='capture')return window.__SCENE.map(f=>({camera:f.camera,dynamic:f.dynamic,fx:Object.assign({},f.fx,{adaptive:false})}));
    if(spec.kind==='calm')return window.__SCENE.map(f=>({camera:f.camera,dynamic:f.dynamic,fx:Object.assign({},f.fx,{adaptive:false,flash:0,damage:0,pulse:0})}));
    if(spec.kind==='inside'){const L=[],n=spec.n||40;for(let k=0;k<n;k++){const a=k*2*Math.PI/n;L.push({camera:{pos:[spec.pos[0]+Math.cos(a*.5)*1.2,spec.pos[1],spec.pos[2]+Math.sin(a*.5)*1.2],yaw:a,pitch:-.08,roll:0,fov:78.5},dynamic:[],fx:Object.assign({time:10+k/60},FX)});}return L;}
    if(spec.kind==='walk'){
      // Trajet du joueur simule (avance + balayage du regard), une vue toutes les `every` etapes.
      const sim=w.sim,input={moveX:0,moveY:1,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,sprint:true},L=[];
      for(let s=0;s<spec.steps;s++){
        input.lookX=Math.sin(s*.013)*.018+(s%240<40?.03:0);
        try{sim.step(1/60,input);}catch(e){R.errors.push('walk '+spec.id+' '+e.message);break;}
        const p=sim.state.player;if(!p||p.hp<=0)break;
        if(s%spec.every===spec.every-1)L.push({camera:{pos:[p.x,(p.y||0)+1.62,p.z],yaw:p.yaw,pitch:p.pitch||0,roll:0,fov:74},dynamic:[],fx:Object.assign({time:s/60},FX)});
      }
      return L;
    }
    throw new Error('scene inconnue '+spec.kind);
  }
  try{
    const T0=now(),V=[];
    for(const spec of C.variants){
      const mod=window.__V[spec.code];
      if(!mod){R.errors.push('variante absente '+spec.code);continue;}
      const c=document.createElement('canvas');c.style.width=spec.cssW+'px';c.style.height=spec.cssH+'px';document.body.appendChild(c);
      fakeDpr=spec.dpr||2;
      const r=mod.create(c,spec.opts);r.resize(spec.quality===undefined?'auto':spec.quality);
      const gl=c.getContext('webgl2');
      V.push({spec,c,r,gl,px:new Uint8Array(4)});
    }
    {const gl=V[0].gl,e=gl.getExtension('WEBGL_debug_renderer_info');R.info.renderer=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);R.info.timerExt=!!gl.getExtension('EXT_disjoint_timer_query_webgl2');R.info.maxSamples=gl.getParameter(gl.MAX_SAMPLES);R.info.maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE);}
    const draw=(v,f)=>{fakeDpr=v.spec.dpr||2;v.r.actorFilter(f.camera,{shadows:true});v.r.draw(f.camera,f.dynamic,Object.assign({},f.fx,v.spec.fx||{},{adaptive:false}));};
    const sync=v=>{const gl=v.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,v.px);};
    const readAll=v=>{const gl=v.gl,w=v.c.width,h=v.c.height,b=new Uint8Array(w*h*4);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);return b;};
    function cmp(a,b,w){let sum=0,nz=0,n1=0,n3=0,n10=0,mx=0,bx0=1e9,bx1=-1,by0=1e9,by1=-1;const px=a.length/4;
      for(let i=0;i<a.length;i+=4){const d0=Math.abs(a[i]-b[i]),d1=Math.abs(a[i+1]-b[i+1]),d2=Math.abs(a[i+2]-b[i+2]),m=Math.max(d0,d1,d2);
        if(m){sum+=d0+d1+d2;nz++;if(m>1)n1++;if(m>3)n3++;if(m>10)n10++;if(m>mx)mx=m;const q=i>>2,X=q%w,Y=(q-X)/w;if(X<bx0)bx0=X;if(X>bx1)bx1=X;if(Y<by0)by0=Y;if(Y>by1)by1=Y;}}
      return {max:mx,nonzero:nz,gt1:n1,gt3:n3,gt10:n10,mad:sum/(px*3),px,box:nz?[bx0,by0,bx1,by1]:null};}
    const K=C.block||10;
    for(const sspec of C.scenes){
      const w=getWorld(sspec.world),S=frames(sspec),sn=sspec.id;
      R.scenes[sn]={frames:S.length,world:sspec.world,kind:sspec.kind,biome:w.W.environment&&w.W.environment.biome,meshes:w.meshes.length,lights:w.lights.length};
      if(S.length<K){R.errors.push('scene trop courte '+sn+' '+S.length);continue;}
      for(const v of V){fakeDpr=v.spec.dpr||2;v.r.setWorld(w.meshes,w.lights,w.W.environment);}
      // Echauffement : chaque image une fois par variante (compilation des programmes, caches statiques).
      for(const v of V){for(let i=0;i<S.length;i+=Math.max(1,Math.floor(S.length/20)))draw(v,S[i]);sync(v);}
      const st={};for(const v of V){draw(v,S[0]);sync(v);st[v.spec.id]={w:v.c.width,h:v.c.height,mpix:+(v.c.width*v.c.height/1e6).toFixed(3),drawCalls:v.r.stats.drawCalls,triangles:v.r.stats.triangles,instances:v.r.stats.instances,staticVisible:v.r.stats.staticVisible,fx:v.r.stats.fxInstances,shadowMaps:v.r.stats.shadowMaps,bloom:v.r.stats.bloom,shadows:v.r.stats.shadows,msaa:v.r.stats.msaa||0};}
      R.stats[sn]=st;
      const nb=Math.floor(S.length/K),acc={};for(const v of V)acc[v.spec.id]=[];let rot=0;
      for(let round=0;round<(C.rounds||2);round++)for(let b=0;b<nb;b++){const order=V.map((_,j)=>V[(j+rot)%V.length]);rot++;
        for(const v of order){sync(v);const t0=now();let cpu=0;for(let k=0;k<K;k++){const a=now();draw(v,S[b*K+k]);cpu+=now()-a;}sync(v);acc[v.spec.id].push([round,b,+((now()-t0)/K).toFixed(3),+(cpu/K).toFixed(3)]);}}
      R.thr[sn]=acc;
      if(C.diffEvery){const dacc={};
        for(let i=0;i<S.length;i+=C.diffEvery){
          const refV=V.find(v=>v.spec.id===C.ref);draw(refV,S[i]);const ref=readAll(refV);
          for(const v of V){if(v===refV||v.spec.nodiff)continue;if(v.c.width!==refV.c.width||v.c.height!==refV.c.height)continue;
            const tgt=v.spec.diffRef?V.find(x=>x.spec.id===v.spec.diffRef):null;let rb=ref;
            if(tgt){draw(tgt,S[i]);rb=readAll(tgt);}
            draw(v,S[i]);const img=readAll(v);(dacc[v.spec.id]||(dacc[v.spec.id]=[])).push(Object.assign({i},cmp(img,rb,v.c.width)));}
        }
        const sum={};for(const id in dacc){const L=dacc[id];sum[id]={n:L.length,max:Math.max(...L.map(x=>x.max)),identical:L.filter(x=>x.max===0).length,nonzeroPx:L.reduce((a,x)=>a+x.nonzero,0),gt1Px:L.reduce((a,x)=>a+x.gt1,0),gt3Px:L.reduce((a,x)=>a+x.gt3,0),gt10Px:L.reduce((a,x)=>a+x.gt10,0),px:L[0].px,mad:+(L.reduce((a,x)=>a+x.mad,0)/L.length).toFixed(5),worst:L.slice().sort((a,b)=>b.nonzero-a.nonzero).slice(0,2).map(x=>({i:x.i,max:x.max,nonzero:x.nonzero,box:x.box}))};}
        R.diffs[sn]=sum;}
    }
    R.info.ms=+(now()-T0).toFixed(0);
  }catch(e){R.errors.push(String(e&&e.stack||e));}
  out.textContent=JSON.stringify(R);
})();
