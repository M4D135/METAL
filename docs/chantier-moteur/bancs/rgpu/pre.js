// RGPU PRE : exécuté avant le code du jeu dans la page instrumentée (copie locale).
(function(){
  'use strict';
  const C=window.__RGPU_CONFIG;
  Object.defineProperty(window,'devicePixelRatio',{get:()=>C.dpr,configurable:true});
  try{localStorage.setItem('ferro-settings',JSON.stringify(C.prefs||{}));localStorage.removeItem('ferro-expedition-v2');}catch(e){}
  // Boucle pilotée : les rappels rAF sont mis en file et exécutés par le pilote (POST).
  const queue=[];let rafId=0;
  window.requestAnimationFrame=cb=>{queue.push(cb);return ++rafId;};
  window.cancelAnimationFrame=()=>{};
  window.__RGPU_QUEUE=queue;
  // Sans FMusic, preparePlay() lance la partie de façon synchrone (pas d'attente audio).
  Object.defineProperty(window,'FMusic',{configurable:true,get(){return undefined;},set(v){window.__RGPU_FMUSIC=v;}});
  window.__RGPU_CODE={};
  // ---- Instrumentation WebGL par contexte ----
  const origGetContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,attrs){
    const ctx=origGetContext.call(this,type,attrs);
    if(ctx&&type==='webgl2'&&!this.__gl){this.__gl=ctx;this.__rgpu=instrument(ctx);}
    return ctx;
  };
  function instrument(gl){
    const o={};
    for(const k of ['createProgram','createBuffer','createFramebuffer','bindFramebuffer','viewport','useProgram','bindBuffer','clear','drawElementsInstanced','drawArrays','bufferData','colorMask'])o[k]=gl[k].bind(gl);
    const ids={prog:new Map(),buf:new Map(),fb:new Map()};
    const S={on:false,marks:[],counts:null,key:'',curFb:null,mask:[true,true,true,true],ids,seg:{}};
    const reset=()=>{S.counts={draws:0,instances:0,triangles:0,uploads:0,uploadBytes:0};S.seg={};};reset();S.reset=reset;
    const px=new Uint8Array(4);let syncFb=null;
    function hardSync(){
      if(!syncFb){
        syncFb=o.createFramebuffer();const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        o.bindFramebuffer(gl.FRAMEBUFFER,syncFb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
      }
      o.bindFramebuffer(gl.FRAMEBUFFER,syncFb);
      const m=S.mask;if(!(m[0]&&m[1]&&m[2]&&m[3]))o.colorMask(true,true,true,true);
      o.clear(gl.COLOR_BUFFER_BIT);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
      if(!(m[0]&&m[1]&&m[2]&&m[3]))o.colorMask(m[0],m[1],m[2],m[3]);
      o.bindFramebuffer(gl.FRAMEBUFFER,S.curFb);
    }
    S.hardSync=hardSync;
    function boundary(key){
      if(key===S.key)return;
      if(S.on){hardSync();S.marks.push({key,t:performance.now()});}
      S.key=key;
    }
    S.mark=(key,t)=>{S.key=key;S.marks.push({key,t});};
    const fbName=fb=>fb===null?'screen':'fb'+ids.fb.get(fb);
    const progName=p=>'prog'+ids.prog.get(p);
    gl.createProgram=()=>{const p=o.createProgram();ids.prog.set(p,ids.prog.size);return p;};
    gl.createBuffer=()=>{const b=o.createBuffer();ids.buf.set(b,ids.buf.size);return b;};
    gl.createFramebuffer=()=>{const f=o.createFramebuffer();ids.fb.set(f,ids.fb.size);return f;};
    gl.colorMask=(r,g,b,a)=>{S.mask=[r,g,b,a];o.colorMask(r,g,b,a);};
    const oFbt=gl.framebufferTexture2D.bind(gl);
    gl.framebufferTexture2D=(target,att,tt,tex,level)=>{if(att===gl.DEPTH_ATTACHMENT)S.shadowKey=S.fbKey;oFbt(target,att,tt,tex,level);};
    gl.bindFramebuffer=(target,fb)=>{if(target===gl.FRAMEBUFFER||target===gl.DRAW_FRAMEBUFFER){boundary(fbName(fb));S.curFb=fb;S.fbKey=fbName(fb);}o.bindFramebuffer(target,fb);};
    gl.viewport=(x,y,w,h)=>{if(S.fbKey===S.shadowKey&&S.shadowKey)boundary('shadow@'+x+','+y);o.viewport(x,y,w,h);};
    gl.useProgram=p=>{const n=progName(p);
      if(n==='prog3')boundary('sky');else if(n==='prog4')boundary('fx');else if(n==='prog0'&&(S.key==='sky'||S.key===S.fbKey))boundary('opaque');
      o.useProgram(p);};
    gl.bindBuffer=(target,b)=>{if(target===gl.ARRAY_BUFFER&&ids.buf.get(b)===3&&S.key==='opaque')boundary('opaque-dyn');o.bindBuffer(target,b);};
    gl.clear=mask=>{if(mask===gl.DEPTH_BUFFER_BIT&&S.fbKey!==S.shadowKey)boundary('overlay');o.clear(mask);};
    gl.drawElementsInstanced=(mode,count,type,offset,inst)=>{const c=S.counts;c.draws++;c.instances+=inst;c.triangles+=count/3*inst;
      const s=S.seg[S.key]||(S.seg[S.key]={draws:0,instances:0,triangles:0});s.draws++;s.instances+=inst;s.triangles+=count/3*inst;
      o.drawElementsInstanced(mode,count,type,offset,inst);};
    gl.drawArrays=(mode,first,count)=>{S.counts.draws++;const s=S.seg[S.key]||(S.seg[S.key]={draws:0,instances:0,triangles:0});s.draws++;o.drawArrays(mode,first,count);};
    gl.bufferData=(target,data,usage)=>{if(data&&data.byteLength!==undefined){S.counts.uploads++;S.counts.uploadBytes+=data.byteLength;}o.bufferData(target,data,usage);};
    return S;
  }
  // ---- Remplacement de FRender.create : le moteur du jeu + N variantes sur des toiles cachées ----
  let realFRender=null;
  Object.defineProperty(window,'FRender',{configurable:true,get(){return realFRender;},set(v){realFRender=Object.assign({},v,{create:canvas=>createProxy(v,canvas)});}});
  function pick(st){const o={};for(const k of ['drawCalls','triangles','instances','uploadBytes','width','height','pixelRatio','renderScale','staticVisible','staticCulled','staticTotal','dynamicLights','fxInstances','shadowMaps','shadows','bloom','viewDistance','actorsConsidered','actorsCulled'])o[k]=st[k];return o;}
  function createProxy(baseModule,canvas){
    const base=baseModule.create(canvas);
    const R=window.__RGPU={base,variants:[],measuring:false,segment:false,frames:[],frameIndex:0,drawTime:0,lastStats:null};
    for(const spec of C.variants){
      const mod=spec.code==='base'?baseModule:window.__RGPU_CODE[spec.code];
      const c=document.createElement('canvas');c.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;visibility:hidden;pointer-events:none;z-index:-1';
      document.getElementById('app').appendChild(c);
      let r=null,err=null;
      try{if(!mod)throw new Error('variante absente '+spec.code);r=mod.create(c);r.resize(spec.quality||'auto');}catch(e){err=String(e&&e.message||e);}
      const S=c.__rgpu;
      R.variants.push({spec,canvas:c,r,err,S});
    }
    // Particules synthétiques (fumée/feu) devant la caméra : charge d'explosion reproductible.
    function inject(camera,o){
      const out=[],yaw=camera.yaw||0,pitch=camera.pitch||0,f=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)],r=[Math.cos(yaw),0,Math.sin(yaw)];
      for(let i=0;i<o.count;i++){
        const a=(i*0.618)%1,b=(i*0.381)%1,d=o.near+(o.far-o.near)*a,side=(b-.5)*o.spread,up=((i*0.7071)%1-.3)*o.spread*.5;
        const p=[camera.pos[0]+f[0]*d+r[0]*side,camera.pos[1]+f[1]*d+up,camera.pos[2]+f[2]*d+r[2]*side],sz=o.size*(.6+.8*b);
        const m={shape:'sphere',p,s:[sz,sz*.8,sz],r:[0,i,0],mat:7,color:o.fire&&i%3===0?[1,.45,.12]:[.32,.31,.30],surface:'object',effectPart:'blast-dust',fx:true,alpha:o.alpha,emissive:o.fire&&i%3===0?1.2:0};
        if(o.fire&&i%3===0)m.fxFire=true;else m.fxSmoke=true;out.push(m);
      }
      return out;
    }
    function readback(v){
      const gl=v.canvas.__gl,w=v.canvas.width,h=v.canvas.height,buf=new Uint8Array(w*h*4);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);
      let sum=0,covered=0,ge2=0,ge3=0,ge4=0,max=0;const hist=new Array(12).fill(0);
      for(let i=0;i<buf.length;i+=4){const n=buf[i];sum+=n;if(n>0)covered++;if(n>=2)ge2++;if(n>=3)ge3++;if(n>=4)ge4++;if(n>max)max=n;hist[Math.min(11,n)]++;}
      const px=w*h;
      if(v.spec.readback==='lcount'){let c=0,a8=0,a16=0,ac=0;const h16=new Array(13).fill(0),hc=new Array(13).fill(0);for(let i=0;i<buf.length;i+=4){if(buf[i+1]>0){c++;a8+=buf[i];a16+=buf[i+1]-1;ac+=buf[i+2];h16[Math.min(12,buf[i+1]-1)]++;hc[Math.min(12,buf[i+2])]++;}}
        return {pixels:px,covered:c/px,meanAll:c?ac/c:0,meanCovered:c?ac/c:0,ge2:c?a8/c:0,ge3:c?a16/c:0,ge4:0,max:0,hist:hc,h16};}
      return {pixels:px,meanAll:sum/px,meanCovered:covered?sum/covered:0,covered:covered/px,ge2:ge2/px,ge3:ge3/px,ge4:ge4/px,max,hist};
    }
    const proxy={
      stats:base.stats,
      setWorld(...a){base.setWorld(...a);for(const v of R.variants)if(v.r)v.r.setWorld(...a);},
      updateWorld(...a){const res=base.updateWorld?base.updateWorld(...a):undefined;for(const v of R.variants)if(v.r&&v.r.updateWorld)v.r.updateWorld(...a);return res;},
      resize(q){const res=base.resize(q);for(const v of R.variants)if(v.r)v.r.resize(v.spec.quality||'auto');return res;},
      actorFilter(camera,fx){return base.actorFilter?base.actorFilter(camera,fx):()=>true;},
      dispose(){base.dispose();for(const v of R.variants)if(v.r)v.r.dispose();},
      draw(camera,dynamic,fx){
        const tStart=performance.now();
        if(!R.measuring){R.drawTime=0;return;}
        const list=dynamic||[];let fxCount=0,overlay=0;for(const m of list){if(m.fx)fxCount++;if(m.overlay)overlay++;}
        const frame={f:R.frameIndex,dyn:list.length,fx:fxCount,overlay,lights:(fx&&fx.lights||[]).length,flash:fx&&fx.flash||0,damage:fx&&fx.damage||0,v:{}};
        const live=R.variants.filter(v=>v.r);
        if(C.dumpDynamicAt&&C.dumpDynamicAt.includes(R.frameIndex)){
          const eye=camera.pos,shapes={},mats={};let big=[];
          for(const m of list){shapes[m.shape||'box']=(shapes[m.shape||'box']||0)+1;const s=m.s||[1,1,1],d=Math.hypot(m.p[0]-eye[0],m.p[1]-eye[1],m.p[2]-eye[2]);big.push({shape:m.shape,mat:m.mat,s:s.map(x=>+x.toFixed(2)),d:+d.toFixed(1),fx:!!m.fx,ov:!!m.overlay,a:m.alpha,part:m.effectPart||m.actorPart||undefined});}
          big.sort((a,b)=>Math.max(...b.s)/Math.max(.5,b.d)-Math.max(...a.s)/Math.max(.5,a.d));
          (R.dynDumps||(R.dynDumps=[])).push({f:R.frameIndex,eye:eye.map(x=>+x.toFixed(2)),yaw:camera.yaw,pitch:camera.pitch,shapes,top:big.slice(0,14)});
        }
        if(C.dumpScene&&R.frameIndex>=C.dumpScene[0]&&R.frameIndex<C.dumpScene[1]){
          const clean=m=>{const o={};for(const k of ['shape','p','s','r','mat','color','emissive','overlay','fx','alpha','surface','outdoor','fxFire','fxSmoke','fxSpark','fxPriority','innerRatio','actorPart','actorScale','effectPart'])if(m[k]!==undefined)o[k]=m[k];return o;};
          (R.sceneDump||(R.sceneDump=[])).push({f:R.frameIndex,camera:JSON.parse(JSON.stringify(camera)),fx:JSON.parse(JSON.stringify(Object.assign({},fx,{horror:undefined}))),dynamic:list.map(clean)});
        }
        const reps=Math.max(1,C.reps||1),acc={};const cmp=C.compareEvery&&R.frameIndex%C.compareEvery===0?{}:null;
        for(let rep=0;rep<reps;rep++){
        const k=(R.frameIndex+rep*3)%Math.max(1,live.length);const order=live.slice(k).concat(live.slice(0,k));
        for(const v of order){
          const fx2=Object.assign({},fx,v.spec.fx||{},{adaptive:false});const S=v.S;
          S.reset();S.marks.length=0;S.on=!!(R.segment&&v.spec.segments);S.key='';
          const t0=performance.now();if(S.on)S.mark('cpu-prep',t0);
          v.r.draw(camera,v.spec.inject?list.concat(inject(camera,v.spec.inject)):dynamic,fx2);
          const t1=performance.now();S.hardSync();const t2=performance.now();
          if(cmp&&rep===0&&(v.spec.compare||v.spec.id===C.compareRef)){const g2=v.canvas.__gl,buf=new Uint8Array(v.canvas.width*v.canvas.height*4);g2.bindFramebuffer(g2.FRAMEBUFFER,null);g2.readPixels(0,0,v.canvas.width,v.canvas.height,g2.RGBA,g2.UNSIGNED_BYTE,buf);cmp[v.spec.id]=buf;}
          if(S.on)S.marks.push({key:'end',t:t2});
          const rec={cpu:t1-t0,total:t2-t0,counts:Object.assign({},S.counts)};
          if(S.on){rec.marks=S.marks.map(m=>({key:m.key,t:m.t-t0}));rec.seg=JSON.parse(JSON.stringify(S.seg));}
          if(v.spec.readback&&R.frameIndex%(v.spec.readbackEvery||10)===0)rec.readback=readback(v);
          if(R.frameIndex%20===0)rec.stats=pick(v.r.stats);
          S.on=false;
          const prev=acc[v.spec.id];
          const g=rec.total-rec.cpu;if(!prev){acc[v.spec.id]=rec;rec.first=rec.total;rec.minTotal=rec.total;rec.minGpu=g;rec.minCpu=rec.cpu;}else{prev.minTotal=Math.min(prev.minTotal,rec.total);prev.minGpu=Math.min(prev.minGpu,g);prev.minCpu=Math.min(prev.minCpu,rec.cpu);}
        }
        }
        for(const id in acc)frame.v[id]=acc[id];
        if(cmp){const ref=cmp[C.compareRef];if(ref)for(const id in cmp){if(id===C.compareRef||cmp[id].length!==ref.length)continue;const a=cmp[id];let sum=0,n3=0,n10=0,n25=0,se=0;const px=a.length/4;
          for(let i=0;i<a.length;i+=4){const d0=Math.abs(a[i]-ref[i]),d1=Math.abs(a[i+1]-ref[i+1]),d2=Math.abs(a[i+2]-ref[i+2]),m=Math.max(d0,d1,d2);sum+=d0+d1+d2;se+=d0*d0+d1*d1+d2*d2;if(m>3)n3++;if(m>10)n10++;if(m>25)n25++;}
          const mse=se/(px*3);(R.diffs||(R.diffs={}))[id]=(R.diffs[id]||[]);R.diffs[id].push({f:R.frameIndex,mad:sum/(px*3),gt3:n3/px,gt10:n10/px,gt25:n25/px,psnr:mse>0?10*Math.log10(255*255/mse):99});}}
        R.frames.push(frame);R.drawTime=performance.now()-tStart;
      }
    };
    return proxy;
  }
})();
